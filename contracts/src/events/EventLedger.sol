// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

// Senryo's money rules (D-264) on the yes/no book: every unit has one home, rechecked against the balance after each
// money path, and payouts land on their own — a recipient who cannot receive is held as owed, never blocking an event.

import {AccessManaged} from "@openzeppelin/contracts/access/manager/AccessManaged.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ReentrancyGuardTransient} from "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";
import {BandReserve} from "../markets/BandReserve.sol";
import {BPS} from "../markets/MarketTypes.sol";
import {IEventBook} from "./IEventBook.sol";
import "./EventTypes.sol";

/// @title EventLedger — where the yes/no book's money sits: `balance ≥ totalHeld + feesHeld + totalOwed`.
/// @notice - `totalHeld`: every open event's stakes, then (once decided) what its calls are still due;
///         - `feesHeld`: the book's share of decided events, on its way to the shared pool (`sweepFees`);
///         - `totalOwed`: payouts a caller could not receive, claimable with `claimOwed`.
abstract contract EventLedger is AccessManaged, EIP712, ReentrancyGuardTransient, IEventBook {
    using SafeERC20 for IERC20;

    bytes32 public constant CALL_TYPEHASH = keccak256(
        "EventCall(address owner,bytes32 eventId,bool yes,uint64 stake,uint64 deadline,uint256 nonce,uint32 epoch)"
    );
    bytes32 public constant ANSWER_TYPEHASH = keccak256(
        "EventAnswer(bytes32 eventId,bytes32 termsHash,address member,bool yes,bytes32 statementHash,uint40 attestedAt)"
    );

    /// @dev The reserve whose collateral this book takes, whose epochs cancel a caller's signed calls, and whose shared
    ///      pool receives the fees.
    BandReserve public immutable reserve;
    IERC20 public immutable collateral;
    /// @dev How long a quorum waits for the rest of the committee before it decides: a dissent heard in time voids.
    uint32 public immutable dissentWaitSec;

    uint64 public minStake;
    uint64 public maxStake;

    mapping(uint16 committeeId => Committee) internal _committees;
    mapping(uint16 committeeId => address[]) internal _members;
    /// @dev A member's place in their committee, plus one (0 = not a member).
    mapping(uint16 committeeId => mapping(address member => uint256)) internal _seat;
    mapping(bytes32 eventId => EventMarket) internal _events;
    mapping(bytes32 eventId => mapping(address member => bytes32)) public statementOf;
    mapping(uint256 ticketId => EventTicket) internal _tickets;
    mapping(address owner => mapping(uint256 nonce => bool)) public callUsed;
    mapping(address account => uint256) public owedOf;

    uint256 public ticketCount;
    uint256 public totalHeld;
    uint256 public feesHeld;
    uint256 public totalOwed;

    constructor(BandReserve reserve_, uint32 dissentWaitSec_) {
        if (address(reserve_) == address(0)) revert ZeroAddress();
        if (dissentWaitSec_ > MAX_DISSENT_WAIT_SEC) revert BadLimits();
        reserve = reserve_;
        collateral = reserve_.collateral();
        dissentWaitSec = dissentWaitSec_;
    }

    // ------------------------------------------------------------------------------------------------ limits (admin)

    function setLimits(uint64 minStake_, uint64 maxStake_) external restricted {
        if (minStake_ == 0 || maxStake_ < minStake_) revert BadLimits();
        minStake = minStake_;
        maxStake = maxStake_;
        emit LimitsSet(minStake_, maxStake_);
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

    function eventOf(bytes32 eventId) external view returns (EventMarket memory) {
        return _events[eventId];
    }

    function committeeOf(uint16 committeeId) external view returns (Committee memory, address[] memory members) {
        return (_committees[committeeId], _members[committeeId]);
    }

    function ticketOf(uint256 ticketId) external view returns (EventTicket memory) {
        return _tickets[ticketId];
    }

    /// @notice What `stake` on `yes` would return if the event were decided that way with the pools as they are now
    ///         (this call included). Parimutuel: the final pools decide, so this is an estimate, never a promise.
    function estimatePayout(bytes32 eventId, bool yes, uint64 stake) external view returns (uint256) {
        EventMarket storage m = _events[eventId];
        uint256 win = (yes ? m.yesPool : m.noPool) + stake;
        uint256 lose = yes ? m.noPool : m.yesPool;
        uint256 prize = lose - lose * m.feeBps / BPS;
        return stake + uint256(stake) * prize / win;
    }

    /// @notice The terms every call and answer is bound to: the event, its question and its rules.
    function termsHashOf(bytes32 eventId, string calldata question, string calldata rules)
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(eventId, keccak256(bytes(question)), keccak256(bytes(rules))));
    }

    function hashCall(EventCall calldata c) public view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(abi.encode(CALL_TYPEHASH, c.owner, c.eventId, c.yes, c.stake, c.deadline, c.nonce, c.epoch))
        );
    }

    function hashAnswer(EventAnswer calldata a) public view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(ANSWER_TYPEHASH, a.eventId, a.termsHash, a.member, a.yes, a.statementHash, a.attestedAt)
            )
        );
    }

    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    /// @notice Everything the book must be able to pay or return, against its balance.
    function liabilities() public view returns (uint256) {
        return totalHeld + feesHeld + totalOwed;
    }

    // ------------------------------------------------------------------------------------------------ internals

    function _event(bytes32 eventId) internal view returns (EventMarket storage m) {
        m = _events[eventId];
        if (m.state == EVENT_NONE) revert NoSuchEvent(eventId);
    }

    /// @dev Pays `to` or books it as owed (a reverting or blocked recipient never blocks an event).
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
