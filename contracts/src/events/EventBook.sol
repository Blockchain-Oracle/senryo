// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

// The book half of D-296: a parimutuel pool per question (Yes stakes against No stakes) instead of a quoted price — a
// committee never signs a moving price, and pricing news from a price feed would let anyone who learns it early drain
// the shared pool (docs/research/pivot/s8-exits-events-2026-10-09.md §3). Calls close before the thing happens; there
// is no cash-out; the fee is a share of the losing side, swept into the shared pool so Earn's suppliers carry it.

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessManaged} from "@openzeppelin/contracts/access/manager/AccessManaged.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {Multicall} from "@openzeppelin/contracts/utils/Multicall.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {BandReserve} from "../markets/BandReserve.sol";
import {MAX_BATCH, OUTCOME_LOSE, OUTCOME_REFUND, OUTCOME_WIN, Permit} from "../markets/MarketTypes.sol";
import {EventCommittee} from "./EventCommittee.sol";
import {EventLedger} from "./EventLedger.sol";
import "./EventTypes.sol";

/// @title EventBook — yes/no questions settled by a named committee, the losing side paying the winning side.
/// @notice The lister (the keeper) lists a question with its rules, the committee that answers it and three times:
///         when calls close, and the window in which an answer counts. Callers stake Yes or No with a signed order
///         anyone relays. The committee's members answer with signed statements; when they agree (every member, or a
///         quorum that no dissent followed in time) the winners share the losers' stakes less the fee, pro rata.
///         Disagreement, too few answers by the deadline, or nobody on the winning side refunds every call. Payouts
///         are permissionless batches (`claimFor`); the book's fees go to the shared pool (`sweepFees`).
contract EventBook is EventCommittee, Multicall {
    using SafeERC20 for IERC20;

    string public constant NAME = "Senryo Events";
    string public constant VERSION = "1";

    constructor(address authority, BandReserve reserve_, uint32 dissentWaitSec_, uint64 minStake_, uint64 maxStake_)
        AccessManaged(authority)
        EIP712(NAME, VERSION)
        EventLedger(reserve_, dissentWaitSec_)
    {
        if (minStake_ == 0 || maxStake_ < minStake_) revert BadLimits();
        minStake = minStake_;
        maxStake = maxStake_;
        // The shared pool pulls the book's fees through `fund` (`sweepFees`).
        collateral.forceApprove(address(reserve_), type(uint256).max);
    }

    // ------------------------------------------------------------------------------------------------ listing

    /// @notice Lists a question (the lister's role). Its id is the lister's (one per real-world question, so a re-run
    ///         listing is refused rather than doubled); the question and rules land in the log and their hash binds
    ///         every call and answer.
    function listEvent(EventTerms calldata t, string calldata question, string calldata rules) external restricted {
        if (t.eventId == bytes32(0) || bytes(question).length == 0 || bytes(rules).length == 0) revert BadTerms();
        EventMarket storage m = _events[t.eventId];
        if (m.state != EVENT_NONE) revert EventExists(t.eventId);
        Committee storage c = _committees[t.committeeId];
        if (c.size == 0 || !c.enabled) revert UnknownCommittee(t.committeeId);
        if (t.feeBps > MAX_EVENT_FEE_BPS) revert BadTerms();
        // forge-lint: disable-next-line(block-timestamp)
        if (t.closesAt <= block.timestamp || t.closesAt > block.timestamp + MAX_EVENT_LEAD_SEC) revert BadTerms();
        if (t.answerFrom < t.closesAt || t.answerBy <= t.answerFrom) revert BadTerms();
        if (t.answerBy - t.answerFrom > MAX_ANSWER_SPAN_SEC) revert BadTerms();

        bytes32 termsHash = termsHashOf(t.eventId, question, rules);
        m.state = EVENT_OPEN;
        m.committeeId = t.committeeId;
        m.feeBps = t.feeBps;
        m.closesAt = t.closesAt;
        m.answerFrom = t.answerFrom;
        m.answerBy = t.answerBy;
        m.termsHash = termsHash;
        emit EventListed(
            t.eventId, t.committeeId, t.feeBps, t.closesAt, t.answerFrom, t.answerBy, termsHash, question, rules
        );
    }

    // ------------------------------------------------------------------------------------------------ calls

    /// @notice A signed Yes or No (the owner's own signature, at their current epoch at the reserve, unexpired and
    ///         unused), relayed by anyone; an optional permit sets the book's allowance in the same transaction.
    function placeCall(EventCall calldata c, bytes calldata sig, Permit calldata permit)
        external
        nonReentrant
        returns (uint256 ticketId)
    {
        EventMarket storage m = _event(c.eventId);
        if (m.state != EVENT_OPEN) revert NotOpen(c.eventId, m.state);
        // forge-lint: disable-next-line(block-timestamp)
        if (block.timestamp >= m.closesAt) revert CallsClosed(c.eventId, m.closesAt);
        if (c.stake < minStake || c.stake > maxStake) revert StakeOutOfRange(c.stake, minStake, maxStake);
        // forge-lint: disable-next-line(block-timestamp)
        if (block.timestamp > c.deadline) revert CallExpired(c.deadline);
        uint32 epoch = reserve.epochOf(c.owner);
        if (c.epoch != epoch) revert WrongEpoch(epoch, c.epoch);
        if (callUsed[c.owner][c.nonce]) revert CallUsed(c.owner, c.nonce);
        if (!SignatureChecker.isValidSignatureNowCalldata(c.owner, hashCall(c), sig)) revert SignatureInvalid();
        callUsed[c.owner][c.nonce] = true;
        if (permit.deadline != 0) {
            // A front-run permit only spends the same signature; the pull below is what must succeed.
            try IERC20Permit(address(collateral))
                .permit(c.owner, address(this), permit.value, permit.deadline, permit.v, permit.r, permit.s) {}
                catch {}
        }
        collateral.safeTransferFrom(c.owner, address(this), c.stake);

        ticketId = ++ticketCount;
        _tickets[ticketId] = EventTicket(c.owner, EVENT_CALL_OPEN, c.yes, c.stake, c.eventId);
        if (c.yes) m.yesPool += c.stake;
        else m.noPool += c.stake;
        m.held += c.stake;
        m.openCalls += 1;
        totalHeld += c.stake;
        emit Called(c.eventId, ticketId, c.owner, c.yes, c.stake, m.yesPool, m.noPool);
        _assertSolvent();
    }

    // ------------------------------------------------------------------------------------------------ payouts

    /// @notice Pays out calls on settled events: a winning share, a refund, or nothing on a loss. Anyone may crank it;
    ///         the money only ever goes to the call's owner, or is held as owed if they cannot receive it. Calls whose
    ///         event is still open are skipped.
    function claimFor(uint256[] calldata ids) external nonReentrant {
        if (ids.length == 0 || ids.length > MAX_BATCH) revert BadBatch();
        for (uint256 i; i < ids.length; ++i) {
            EventTicket storage t = _tickets[ids[i]];
            if (t.status != EVENT_CALL_OPEN) continue;
            EventMarket storage m = _events[t.eventId];
            if (m.state != EVENT_DECIDED && m.state != EVENT_VOIDED) continue;
            (uint256 amount, uint8 outcome) = _payoutOf(m, t);
            t.status = EVENT_CALL_PAID;
            m.held -= SafeCast.toUint128(amount);
            m.openCalls -= 1;
            totalHeld -= amount;
            // The last call paid leaves only rounding dust behind: it is the book's.
            if (m.openCalls == 0 && m.held != 0) {
                totalHeld -= m.held;
                feesHeld += m.held;
                m.held = 0;
            }
            bool paid = _payOrOwe(t.owner, amount);
            emit CallPaid(ids[i], t.eventId, t.owner, outcome, amount, paid);
        }
        _assertSolvent();
    }

    /// @dev A refund on a void; on a decision, the stake plus its pro-rata share of the prize when it called right.
    function _payoutOf(EventMarket storage m, EventTicket storage t) private view returns (uint256, uint8) {
        if (m.state == EVENT_VOIDED) return (t.stake, OUTCOME_REFUND);
        if (t.yes != m.answer) return (0, OUTCOME_LOSE);
        uint256 win = m.answer ? m.yesPool : m.noPool;
        return (t.stake + uint256(t.stake) * m.prize / win, OUTCOME_WIN);
    }

    /// @notice Moves the book's fees into the shared pool (permissionless), where Earn's suppliers carry them.
    function sweepFees() external nonReentrant {
        uint256 amount = feesHeld;
        if (amount == 0) revert NothingToSweep();
        feesHeld = 0;
        reserve.fund(amount);
        emit FeesSwept(amount);
        _assertSolvent();
    }
}
