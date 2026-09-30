// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Constants as C} from "../libraries/Constants.sol";
import {Errors} from "../libraries/Errors.sol";
import {Events} from "../libraries/Events.sol";
import {PerpMath} from "../libraries/PerpMath.sol";
import {Account, Allowance, Book, Hold, HoldState, MarketStatus, ReleaseReason, Risk} from "../libraries/Types.sol";
import {TriggerOrders} from "./TriggerOrders.sol";

/// @title CardModule — Kinpaku card holds against the same balance that backs trading (D-032, D-036).
/// @notice The operator (CARD_OPERATOR) can place/increase holds only inside the user-signed live spend allowance
/// (I7). Envelope holds (H + amount ≤ R) are pre-reserved and always approvable; other holds are risk-checked (I2)
/// and blocked while a held market is STALE / CIRCUIT / HALTED. `holdId = keccak256(issuer, issuerTxnToken)`, so a
/// second placement reverts (idempotent). A release-only issuer (mainnet Lithic sandbox) never captures.
abstract contract CardModule is TriggerOrders {
    using SafeCast for uint256;

    bytes32 public constant ALLOWANCE_TYPEHASH =
        keccak256("SpendAllowance(address user,uint128 dailyLimit,uint64 expiry,uint64 nonce)");

    // ---------------------------------------------------------------- user

    /// @notice Set the user's daily spend allowance from their EIP-712 signature (anyone may relay).
    function setSpendAllowance(address user, uint128 dailyLimit, uint64 expiry, bytes calldata signature) external {
        uint64 n = allowanceNonce[user];
        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(ALLOWANCE_TYPEHASH, user, dailyLimit, expiry, n)));
        if (ECDSA.recoverCalldata(digest, signature) != user) revert Errors.InvalidSignature();
        allowanceNonce[user] = n + 1;
        Allowance storage al = _allowances[user];
        al.dailyLimit = dailyLimit;
        al.expiry = expiry;
        emit Events.AllowanceSet(user, dailyLimit, expiry, _bump(user));
        _emitRisk(user);
    }

    /// @notice Optional onchain freeze (D-039): the user revokes the allowance directly.
    function revokeSpendAllowance() external {
        Allowance storage al = _allowances[msg.sender];
        al.dailyLimit = 0;
        al.expiry = 0;
        ++allowanceNonce[msg.sender];
        emit Events.AllowanceSet(msg.sender, 0, 0, _bump(msg.sender));
        _emitRisk(msg.sender);
    }

    /// @notice Reserve an envelope for instant card approvals; excluded from trading (I2-checked).
    function setCardEnvelope(uint128 amount) external nonReentrant {
        _accounts[msg.sender].envelope = amount;
        emit Events.CardEnvelopeSet(msg.sender, amount, _bump(msg.sender));
        _emitRiskChecked(msg.sender);
    }

    function repayCardDebt(uint256 amount) external nonReentrant {
        Account storage a = _accounts[msg.sender];
        uint256 due = Math.min(amount, a.cardDebt);
        uint256 bal = _balanceOf(a);
        if (bal < due) revert Errors.InsufficientBalance(bal, due);
        _chargeUser(msg.sender, due, Book.CARD_FLOAT);
        a.cardDebt -= due.toUint128();
        _bump(msg.sender);
        emit Events.CardDebtRepaid(msg.sender, due, a.cardDebt);
        _emitRiskChecked(msg.sender);
    }

    // ---------------------------------------------------------------- operator (CARD_OPERATOR)

    function placeHold(bytes32 issuer, bytes32 issuerTxnToken, address user, uint128 amount)
        external
        nonReentrant
        restricted
        returns (bytes32 holdId)
    {
        holdId = keccak256(abi.encode(issuer, issuerTxnToken));
        if (_holds[holdId].state != HoldState.NONE) revert Errors.HoldExists(holdId);
        if (amount == 0) revert Errors.ZeroAmount();
        if (amount > C.MAX_HOLD_USD6) revert Errors.HoldTooLarge(amount, C.MAX_HOLD_USD6);
        _consumeAllowance(user, amount);
        Account storage a = _accounts[user];
        bool fromEnvelope = uint256(a.holds) + amount <= a.envelope;
        if (!fromEnvelope) _requireHoldAllowed(user);
        a.holds += amount;
        uint64 expiry = uint64(block.timestamp) + C.HOLD_TTL;
        _holds[holdId] = Hold(user, expiry, fromEnvelope, HoldState.OPEN, amount, issuer);
        emit Events.HoldPlaced(holdId, user, amount, expiry, fromEnvelope, _bump(user));
        _finishHold(user, fromEnvelope);
    }

    function increaseHold(bytes32 holdId, uint128 delta) external nonReentrant restricted {
        Hold storage h = _openHold(holdId);
        if (h.expiry <= block.timestamp) revert Errors.HoldExpired(holdId);
        if (delta == 0) revert Errors.ZeroAmount();
        uint256 total = uint256(h.amount) + delta;
        if (total > C.MAX_HOLD_USD6) revert Errors.HoldTooLarge(total, C.MAX_HOLD_USD6);
        address user = h.user;
        _consumeAllowance(user, delta);
        Account storage a = _accounts[user];
        bool fromEnvelope = h.fromEnvelope && uint256(a.holds) + delta <= a.envelope;
        if (!fromEnvelope) _requireHoldAllowed(user);
        a.holds += delta;
        h.amount = total.toUint128();
        h.fromEnvelope = fromEnvelope;
        emit Events.HoldIncreased(holdId, user, delta, total, _bump(user));
        _finishHold(user, fromEnvelope);
    }

    /// @notice Capture ≤ hold releases the remainder; over-capture within CAPTURE_OVER_TOLERANCE_BPS debits free
    /// collateral and books any remainder as card debt. Allowed until expiry + HOLD_RELEASE_GRACE.
    function captureHold(bytes32 holdId, uint128 amount) external nonReentrant restricted {
        Hold storage h = _openHold(holdId);
        if (h.expiry + C.HOLD_RELEASE_GRACE <= block.timestamp) revert Errors.HoldExpired(holdId);
        if (releaseOnly[h.issuer]) {
            _release(holdId, h, ReleaseReason.RELEASE_ONLY);
            return;
        }
        uint256 maxCapture = PerpMath.bpsDown(h.amount, C.BPS + C.CAPTURE_OVER_TOLERANCE_BPS);
        if (amount > maxCapture) revert Errors.CaptureTooLarge(amount, maxCapture);
        address user = h.user;
        Account storage a = _accounts[user];
        a.holds -= h.amount;
        h.state = HoldState.CAPTURED;
        uint256 holdPart = Math.min(amount, h.amount);
        uint256 paid = _chargeUser(user, holdPart, Book.CARD_FLOAT);
        uint256 excess = amount - holdPart;
        if (excess != 0) {
            Risk memory r = _risk(user);
            uint256 free = r.freeToTrade > 0 ? uint256(r.freeToTrade) : 0;
            paid += _chargeUser(user, Math.min(excess, free), Book.CARD_FLOAT);
        }
        uint256 debt = amount - paid;
        a.cardDebt += debt.toUint128();
        cardCaptured[user] += amount;
        _bump(user);
        emit Events.HoldCaptured(holdId, user, amount, h.amount - holdPart, debt);
        _emitRisk(user);
    }

    function releaseHold(bytes32 holdId) external nonReentrant restricted {
        _release(holdId, _openHold(holdId), ReleaseReason.OPERATOR);
    }

    /// @notice Anyone may release a hold after expiry + HOLD_RELEASE_GRACE.
    function releaseExpiredHold(bytes32 holdId) external nonReentrant {
        Hold storage h = _openHold(holdId);
        if (h.expiry + C.HOLD_RELEASE_GRACE > block.timestamp) revert Errors.HoldNotReleasable(holdId);
        _release(holdId, h, ReleaseReason.EXPIRED);
    }

    /// @notice Merchant refund: repays card debt first, then credits the user from CARD_FLOAT. Idempotent per refId.
    function refund(address user, bytes32 refId, uint128 amount) external nonReentrant restricted {
        if (refundUsed[refId]) revert Errors.RefundUsed(refId);
        uint256 maxRefund = cardCaptured[user] - cardRefunded[user];
        if (amount > maxRefund) revert Errors.RefundTooLarge(amount, maxRefund);
        refundUsed[refId] = true;
        cardRefunded[user] += amount;
        Account storage a = _accounts[user];
        uint256 debtRepaid = Math.min(amount, a.cardDebt);
        a.cardDebt -= debtRepaid.toUint128();
        uint256 rest = amount - debtRepaid;
        if (rest != 0) _payUser(user, rest, Book.CARD_FLOAT);
        _bump(user);
        emit Events.CardRefunded(user, refId, amount, debtRepaid);
        _emitRisk(user);
    }

    /// @notice ADMIN: mark an issuer release-only (D-036: mainnet Lithic sandbox holds never capture).
    function setReleaseOnly(bytes32 issuer, bool on) external restricted {
        releaseOnly[issuer] = on;
        emit Events.ReleaseOnlySet(issuer, on);
    }

    // ---------------------------------------------------------------- views

    function hold(bytes32 holdId) external view returns (Hold memory) {
        return _holds[holdId];
    }

    function allowance(address user) external view returns (Allowance memory al, uint256 left) {
        return (_allowances[user], _allowanceLeft(user));
    }

    // ---------------------------------------------------------------- internal

    function _consumeAllowance(address user, uint256 amount) internal {
        Allowance storage al = _allowances[user];
        if (al.expiry <= block.timestamp) revert Errors.AllowanceExpired();
        uint64 today = _today();
        if (al.day != today) {
            al.day = today;
            al.usedToday = 0;
        }
        uint256 used = uint256(al.usedToday) + amount;
        if (used > al.dailyLimit) revert Errors.AllowanceExceeded(used, al.dailyLimit);
        al.usedToday = used.toUint128();
    }

    /// @dev Non-envelope holds: new-risk guards plus no held market in STALE / CIRCUIT / HALTED.
    function _requireHoldAllowed(address user) internal view {
        _requireNewRiskAllowed();
        uint32 bitmap = _accounts[user].positionBitmap;
        for (uint8 id; bitmap != 0; ++id) {
            if (bitmap & 1 == 1) {
                MarketStatus st = ORACLE.peek(id).status;
                if (_unsafe(st)) revert Errors.UnsafeMarketForHold(id, st);
            }
            bitmap >>= 1;
        }
    }

    function _finishHold(address user, bool fromEnvelope) internal {
        if (fromEnvelope) _emitRisk(user);
        else _emitRiskChecked(user);
    }

    function _openHold(bytes32 holdId) internal view returns (Hold storage h) {
        h = _holds[holdId];
        if (h.state != HoldState.OPEN) revert Errors.HoldNotOpen(holdId);
    }

    function _release(bytes32 holdId, Hold storage h, ReleaseReason reason) internal {
        address user = h.user;
        _accounts[user].holds -= h.amount;
        h.state = HoldState.RELEASED;
        _bump(user);
        emit Events.HoldReleased(holdId, user, h.amount, reason);
        _emitRisk(user);
    }
}
