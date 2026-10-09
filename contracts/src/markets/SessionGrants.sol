// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

// Grant caps from CWF d7b576b:contracts/src/products/vault/{IEventVault,EventVault}.sol (per-call cap, budget, expiry,
// revocation; CWF only accepted `msg.sender == actor`). New for Senryo: everything is a relayed EIP-712 signature
// (D-266) — the owner signs once with Face ID to hand a capped budget to an ephemeral delegate key (D-267) — with
// unordered nonces (Permit2's bitmap) and a per-owner epoch that cancels every outstanding intent and session at once.

import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import "./MarketTypes.sol";

/// @title SessionGrants — who may place a call for an owner, and how much.
/// @notice An intent is valid when the owner signed it (no caps beyond their allowance), or when the owner's live
///         session delegate signed it within the session's per-call and per-session caps, paying out only to the
///         owner. The chain enforces the caps; the delegate key never sees the owner's key.
abstract contract SessionGrants is EIP712 {
    bytes32 public constant INTENT_TYPEHASH = keccak256(
        "Intent(uint8 action,address owner,bytes32 windowId,uint8 band,uint256 ticketId,uint64 amount,uint64 limit,"
        "address recipient,uint32 configVersion,uint64 deadline,uint256 nonce,uint32 epoch)"
    );
    bytes32 public constant GRANT_TYPEHASH = keccak256(
        "SessionGrant(address owner,address delegate,uint64 perCallCap,uint64 sessionCap,uint40 expiry,uint32 epoch,"
        "uint256 nonce)"
    );
    bytes32 public constant REVOKE_TYPEHASH =
        keccak256("Revoke(address owner,uint32 epoch,uint256 nonce,uint64 deadline)");
    uint256 private constant NONCE_WORD_BITS = 8;

    /// @dev What every signed order shares, for `_authorizeSigned`.
    struct Signed {
        address owner;
        uint64 deadline;
        uint256 nonce;
        uint32 epoch;
        address recipient;
    }
    uint256 private constant NONCE_BIT_MASK = 0xff;

    /// @notice The chain's ceilings for any grant (D-267: Real $25 / $100 / 15 min; Practice $1,000 / $10,000 / 60 min).
    uint64 public immutable maxPerCallCap;
    uint64 public immutable maxSessionCap;
    uint40 public immutable maxSessionSec;

    mapping(address owner => uint32) public epochOf;
    mapping(address owner => Session) private _sessions;
    mapping(address owner => mapping(uint256 word => uint256 bits)) public nonceBitmap;

    event SessionGranted(
        address indexed owner,
        address indexed delegate,
        uint64 perCallCap,
        uint64 sessionCap,
        uint40 expiry,
        uint32 epoch
    );
    event EpochBumped(address indexed owner, uint32 epoch);
    event NoncesInvalidated(address indexed owner, uint256 word, uint256 mask);

    error SignatureInvalid();
    error SignatureExpired(uint64 deadline);
    error NonceUsed(address owner, uint256 nonce);
    error WrongEpoch(uint32 expected, uint32 got);
    error BadGrant();
    error SessionExpired(address owner);
    error OverCallCap(uint64 amount, uint64 cap);
    error OverSessionCap(uint64 wouldBe, uint64 cap);
    error RecipientNotOwner(address recipient);

    constructor(uint64 maxPerCallCap_, uint64 maxSessionCap_, uint40 maxSessionSec_) {
        if (maxPerCallCap_ == 0 || maxSessionCap_ < maxPerCallCap_ || maxSessionSec_ == 0) revert BadGrant();
        maxPerCallCap = maxPerCallCap_;
        maxSessionCap = maxSessionCap_;
        maxSessionSec = maxSessionSec_;
    }

    // ------------------------------------------------------------------------------------------------ owner actions

    /// @notice Cancels every outstanding intent and session of the caller (for owners who send their own tx).
    function bumpEpoch() external {
        _bump(msg.sender);
    }

    /// @notice The same, signed by the owner and relayed (Face ID, D-267: grant changes always need the owner).
    function revokeBySig(address owner, uint256 nonce, uint64 deadline, bytes calldata sig) external {
        if (block.timestamp > deadline) revert SignatureExpired(deadline);
        bytes32 digest =
            _hashTypedDataV4(keccak256(abi.encode(REVOKE_TYPEHASH, owner, epochOf[owner], nonce, deadline)));
        if (!SignatureChecker.isValidSignatureNowCalldata(owner, digest, sig)) revert SignatureInvalid();
        _useNonce(owner, nonce);
        _bump(owner);
    }

    /// @notice Burns unordered nonces of the caller: bit `i` of `mask` is nonce `word × 256 + i`.
    function invalidateNonces(uint256 word, uint256 mask) external {
        nonceBitmap[msg.sender][word] |= mask;
        emit NoncesInvalidated(msg.sender, word, mask);
    }

    function sessionOf(address owner) external view returns (Session memory) {
        return _sessions[owner];
    }

    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    function hashIntent(Intent calldata it) public view returns (bytes32) {
        return _hashTypedDataV4(_intentStruct(it));
    }

    // ------------------------------------------------------------------------------------------------ internals

    /// @dev Starts (or replaces) the owner's session. The grant is the owner's own signature at the current epoch.
    function _grant(SessionGrant calldata g, bytes calldata sig) internal {
        bytes32 digest = _hashTypedDataV4(
            keccak256(
                abi.encode(GRANT_TYPEHASH, g.owner, g.delegate, g.perCallCap, g.sessionCap, g.expiry, g.epoch, g.nonce)
            )
        );
        if (!SignatureChecker.isValidSignatureNowCalldata(g.owner, digest, sig)) revert SignatureInvalid();
        if (g.epoch != epochOf[g.owner]) revert WrongEpoch(epochOf[g.owner], g.epoch);
        if (g.delegate == address(0) || g.delegate == g.owner) revert BadGrant();
        if (g.perCallCap == 0 || g.perCallCap > maxPerCallCap || g.sessionCap < g.perCallCap) revert BadGrant();
        if (g.sessionCap > maxSessionCap) revert BadGrant();
        // forge-lint: disable-next-line(block-timestamp)
        if (g.expiry <= block.timestamp || g.expiry > block.timestamp + maxSessionSec) revert BadGrant();
        _useNonce(g.owner, g.nonce);
        _sessions[g.owner] = Session(g.delegate, g.expiry, g.epoch, g.perCallCap, g.sessionCap, 0);
        emit SessionGranted(g.owner, g.delegate, g.perCallCap, g.sessionCap, g.expiry, g.epoch);
    }

    /// @dev Checks deadline, epoch and signature, burns the nonce, and for a delegate also its caps (an open spends
    ///      `amount` of the session). Returns whether the session delegate signed.
    function _authorize(Intent calldata it, bytes calldata sig) internal returns (bool viaSession) {
        Signed memory s = Signed(it.owner, it.deadline, it.nonce, it.epoch, it.recipient);
        return _authorizeSigned(s, _hashTypedDataV4(_intentStruct(it)), sig, it.action == ACTION_OPEN ? it.amount : 0);
    }

    /// @dev Any signed order (a call, a parlay, an exit): deadline, epoch, signer, the nonce burnt; for a delegate the
    ///      recipient must be the owner and `spend` comes out of the session's caps.
    function _authorizeSigned(Signed memory s, bytes32 digest, bytes calldata sig, uint64 spend)
        internal
        returns (bool viaSession)
    {
        // forge-lint: disable-next-line(block-timestamp)
        if (block.timestamp > s.deadline) revert SignatureExpired(s.deadline);
        uint32 epoch = epochOf[s.owner];
        if (s.epoch != epoch) revert WrongEpoch(epoch, s.epoch);
        viaSession = _signedBy(s.owner, digest, sig, epoch);
        if (viaSession) {
            if (s.recipient != s.owner) revert RecipientNotOwner(s.recipient);
            if (spend != 0) {
                Session storage session = _sessions[s.owner];
                if (spend > session.perCallCap) revert OverCallCap(spend, session.perCallCap);
                uint64 wouldBe = session.spent + spend;
                if (wouldBe > session.sessionCap) revert OverSessionCap(wouldBe, session.sessionCap);
                session.spent = wouldBe;
            }
        }
        _useNonce(s.owner, s.nonce);
    }

    /// @dev The owner signed `digest`, or their session delegate did while the session is live (returns true).
    function _signedBy(address owner, bytes32 digest, bytes calldata sig, uint32 epoch)
        internal
        view
        returns (bool viaSession)
    {
        if (SignatureChecker.isValidSignatureNowCalldata(owner, digest, sig)) return false;
        Session storage s = _sessions[owner];
        if (s.delegate == address(0) || !SignatureChecker.isValidSignatureNowCalldata(s.delegate, digest, sig)) {
            revert SignatureInvalid();
        }
        // forge-lint: disable-next-line(block-timestamp)
        if (s.epoch != epoch || block.timestamp >= s.expiry) revert SessionExpired(owner);
        return true;
    }

    function _intentStruct(Intent calldata it) private pure returns (bytes32) {
        return keccak256(
            abi.encode(
                INTENT_TYPEHASH,
                it.action,
                it.owner,
                it.windowId,
                it.band,
                it.ticketId,
                it.amount,
                it.limit,
                it.recipient,
                it.configVersion,
                it.deadline,
                it.nonce,
                it.epoch
            )
        );
    }

    function _useNonce(address owner, uint256 nonce) internal {
        uint256 word = nonce >> NONCE_WORD_BITS;
        uint256 bit = 1 << (nonce & NONCE_BIT_MASK);
        uint256 bits = nonceBitmap[owner][word];
        if (bits & bit != 0) revert NonceUsed(owner, nonce);
        nonceBitmap[owner][word] = bits | bit;
    }

    function _bump(address owner) private {
        uint32 next = epochOf[owner] + 1;
        epochOf[owner] = next;
        delete _sessions[owner];
        emit EpochBumped(owner, next);
    }
}
