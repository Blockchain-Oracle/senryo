// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

// The ledger half of Masayume 68f7a09:contracts/src/games/ArenaMatches.sol (matches, decks, picks, the ways a pot goes
// home), with Senryo's money rules (D-264): every unit has one home, rechecked against the balance after each money
// path, and payouts land on their own — a recipient who cannot receive is held as owed, never blocking settlement.

import {AccessManaged} from "@openzeppelin/contracts/access/manager/AccessManaged.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ReentrancyGuardTransient} from "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";
import {BandReserve} from "../markets/BandReserve.sol";
import {IWindows} from "../markets/interfaces/IWindows.sol";
import {LOCKOUT_SEC} from "../markets/MarketTypes.sol";
import {IDuelArena} from "./IDuelArena.sol";
import "./DuelTypes.sol";

/// @title DuelLedger — where a duel's money sits: `balance ≥ potsHeld + budgetsHeld + totalOwed`.
/// @notice - `potsHeld`: both seats' pots of undecided matches;
///         - `budgetsHeld`: card stakes escrowed at entry and not yet placed as calls (or returned);
///         - `totalOwed`: payouts a player could not receive, claimable with `claimOwed`.
///         A placed pick's stake lives in the reserve until its window settles; what it returns passes straight on.
abstract contract DuelLedger is AccessManaged, EIP712, ReentrancyGuardTransient, IDuelArena {
    using SafeERC20 for IERC20;

    bytes32 public constant ENTRY_TYPEHASH = keccak256(
        "DuelEntry(address owner,uint8 tier,address delegate,bytes32 seed,uint64 deadline,uint256 nonce,uint32 epoch)"
    );
    bytes32 public constant PICK_TYPEHASH =
        keccak256("DuelPick(bytes32 matchId,address player,uint8 card,uint8 band,uint64 minPayout)");

    BandReserve public immutable reserve;
    IWindows public immutable windows;
    IERC20 public immutable collateral;
    uint32 public immutable revealWindowSec;
    uint32 public immutable pickWindowSec;
    uint32 public immutable minCardLifeSec;

    mapping(uint8 tier => DuelTier) public tierOf;
    mapping(bytes32 matchId => DuelMatch) internal _matches;
    mapping(bytes32 matchId => DuelSeat[DUEL_SEATS]) internal _seats;
    mapping(bytes32 matchId => bytes32[DUEL_CARDS]) internal _decks;
    /// @dev Keyed by `card × 2 + seat`, so one card's two picks sit side by side.
    mapping(bytes32 matchId => mapping(uint256 slot => DuelCall)) internal _calls;
    mapping(bytes32 matchId => int256[DUEL_SEATS]) internal _results;
    mapping(address owner => mapping(uint256 nonce => bool)) public entryUsed;
    mapping(address account => uint256) public owedOf;

    uint256 public potsHeld;
    uint256 public budgetsHeld;
    uint256 public totalOwed;

    constructor(BandReserve reserve_, DuelClocks memory clocks) {
        if (address(reserve_) == address(0)) revert ZeroAddress();
        if (
            clocks.revealWindowSec == 0 || clocks.pickWindowSec == 0 || clocks.minCardLifeSec > MAX_DUEL_CLOCK_SEC
                || clocks.revealWindowSec > MAX_DUEL_CLOCK_SEC
        ) revert BadClocks();
        // Every card must still be callable at the pick deadline: its lockout comes after it.
        if (uint256(clocks.pickWindowSec) + LOCKOUT_SEC >= clocks.minCardLifeSec) revert BadClocks();
        reserve = reserve_;
        windows = reserve_.windows();
        collateral = reserve_.collateral();
        revealWindowSec = clocks.revealWindowSec;
        pickWindowSec = clocks.pickWindowSec;
        minCardLifeSec = clocks.minCardLifeSec;
    }

    // ------------------------------------------------------------------------------------------------ tiers (admin)

    /// @notice Sets an entry price. The card stake must be a stake the reserve takes; a disabled tier opens no match.
    function setTier(uint8 tier, DuelTier calldata t) external restricted {
        (,,,,,, uint64 minStake, uint64 maxStake) = reserve.params();
        if (t.cardStake < minStake || t.cardStake > maxStake) revert BadTier(tier);
        tierOf[tier] = t;
        emit TierSet(tier, t.pot, t.cardStake, t.enabled);
    }

    // ------------------------------------------------------------------------------------------------ owed

    /// @notice Collects everything the caller is owed after a held payout (pays the caller only).
    function claimOwed() external nonReentrant returns (uint256 amount) {
        amount = owedOf[msg.sender];
        if (amount == 0) revert NothingOwed();
        owedOf[msg.sender] = 0;
        totalOwed -= amount;
        collateral.safeTransfer(msg.sender, amount);
        emit OwedClaimed(msg.sender, amount);
        _assertSolvent();
    }

    // ------------------------------------------------------------------------------------------------ views

    function matchOf(bytes32 matchId)
        external
        view
        returns (DuelMatch memory, DuelSeat[DUEL_SEATS] memory, bytes32[DUEL_CARDS] memory)
    {
        return (_matches[matchId], _seats[matchId], _decks[matchId]);
    }

    function callOf(bytes32 matchId, uint8 card, uint8 seat) external view returns (DuelCall memory) {
        return _calls[matchId][_slot(card, seat)];
    }

    /// @notice Each seat's total so far: Σ (what a pick returned − its stake) over settled cards.
    function resultsOf(bytes32 matchId) external view returns (int256 resultA, int256 resultB) {
        int256[DUEL_SEATS] storage r = _results[matchId];
        return (r[0], r[1]);
    }

    function hashEntry(DuelEntry calldata e) public view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(abi.encode(ENTRY_TYPEHASH, e.owner, e.tier, e.delegate, e.seed, e.deadline, e.nonce, e.epoch))
        );
    }

    function hashPick(DuelPick calldata p) public view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(PICK_TYPEHASH, p.matchId, p.player, p.card, p.band, p.minPayout)));
    }

    /// @notice The sealed deck's commitment: the chain, this arena, the match, the server's seed, both players' seeds
    ///         (in seat order, from their signed entries) and the three windows. Fixed-size words, so unambiguous.
    function deckHashOf(
        bytes32 matchId,
        bytes32 serverSeed,
        bytes32[DUEL_SEATS] memory seeds,
        bytes32[DUEL_CARDS] memory cards
    ) public view returns (bytes32) {
        return keccak256(abi.encode(block.chainid, address(this), matchId, serverSeed, seeds, cards));
    }

    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    /// @notice Everything the arena must be able to pay or return, against its balance.
    function liabilities() public view returns (uint256) {
        return potsHeld + budgetsHeld + totalOwed;
    }

    // ------------------------------------------------------------------------------------------------ internals

    function _match(bytes32 matchId) internal view returns (DuelMatch storage m) {
        m = _matches[matchId];
        if (m.status == MATCH_NONE) revert NoSuchMatch(matchId);
    }

    function _seatOf(DuelSeat[DUEL_SEATS] storage seats, address who) internal view returns (uint8) {
        if (who == seats[0].player) return 0;
        if (who == seats[1].player) return 1;
        revert NotAPlayer(who);
    }

    function _slot(uint8 card, uint8 seat) internal pure returns (uint256) {
        return uint256(card) * DUEL_SEATS + seat;
    }

    function _missing(uint8 picked) internal pure returns (uint256 n) {
        for (uint8 c; c < DUEL_CARDS; ++c) {
            if (picked & (uint8(1) << c) == 0) ++n;
        }
    }

    /// @dev Both pots home and, before any card was placed, both card budgets too.
    function _refund(bytes32 matchId, DuelMatch storage m, uint8 reason, bool budgets) internal {
        DuelSeat[DUEL_SEATS] storage seats = _seats[matchId];
        uint256 per = m.pot;
        potsHeld -= per * DUEL_SEATS;
        if (budgets) {
            uint256 budget = uint256(m.cardStake) * DUEL_CARDS;
            budgetsHeld -= budget * DUEL_SEATS;
            per += budget;
        }
        m.status = MATCH_REFUNDED;
        _payOrOwe(seats[0].player, per);
        _payOrOwe(seats[1].player, per);
        emit MatchRefunded(matchId, reason, per);
    }

    /// @dev Pays `to` or books it as owed (a reverting or blocked recipient never blocks a duel).
    function _payOrOwe(address to, uint256 amount) internal returns (bool paid) {
        if (amount == 0) return true;
        if (collateral.trySafeTransfer(to, amount)) return true;
        uint256 owed = owedOf[to] + amount;
        owedOf[to] = owed;
        totalOwed += amount;
        emit PayoutHeld(to, amount, owed);
        return false;
    }

    function _assertSolvent() internal view {
        uint256 balance = collateral.balanceOf(address(this));
        uint256 owed = liabilities();
        if (balance < owed) revert Insolvent(balance, owed);
    }
}
