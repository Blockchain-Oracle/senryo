// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

// The verdict half of Owarine abu-pm-main 0.5.2:daml/PM/Event.daml: an answer counts iff it is for this event's terms,
// from a member of its committee, dated inside the answer window, one per member (the first); a mix of Yes and No
// voids (the committee's deviation limit is zero); too few answers by the deadline void. On chain every answer is
// recorded the moment it is relayed, so nobody resolving can leave a dissent out: a quorum waits `dissentWaitSec` for
// the rest of the committee (Owarine's resolver waits the same way), and every member answering decides at once.

import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {BPS} from "../markets/MarketTypes.sol";
import {EventLedger} from "./EventLedger.sol";
import "./EventTypes.sol";

/// @title EventCommittee — named signers answer a question; their agreement decides it, anything else refunds it.
abstract contract EventCommittee is EventLedger {
    // ------------------------------------------------------------------------------------------------ committees (admin)

    /// @notice Sets a committee once: its members (named in the log), and how many must agree. It can be retired from
    ///         new listings (`setCommitteeEnabled`) but never changed, so a listed event's judges are fixed.
    function setCommittee(uint16 committeeId, address[] calldata members, uint8 quorum, string[] calldata names)
        external
        restricted
    {
        if (_committees[committeeId].size != 0) revert CommitteeExists(committeeId);
        uint256 n = members.length;
        if (n == 0 || n > MAX_COMMITTEE_SIZE || names.length != n || quorum == 0 || quorum > n) revert BadCommittee();
        for (uint256 i; i < n; ++i) {
            address member = members[i];
            if (member == address(0) || _seat[committeeId][member] != 0) revert BadCommittee();
            _seat[committeeId][member] = i + 1;
            _members[committeeId].push(member);
        }
        _committees[committeeId] = Committee({size: uint8(n), quorum: quorum, enabled: true});
        emit CommitteeSet(committeeId, members, quorum, names);
    }

    function setCommitteeEnabled(uint16 committeeId, bool enabled) external restricted {
        Committee storage c = _committees[committeeId];
        if (c.size == 0) revert UnknownCommittee(committeeId);
        c.enabled = enabled;
        emit CommitteeEnabled(committeeId, enabled);
    }

    // ------------------------------------------------------------------------------------------------ answers

    /// @notice Records one member's signed answer (anyone may relay it) and settles the event when the answers allow:
    ///         a conflict voids at once, the whole committee agreeing decides at once.
    function answer(EventAnswer calldata a, bytes calldata sig) external nonReentrant {
        EventMarket storage m = _event(a.eventId);
        if (m.state != EVENT_OPEN) revert NotOpen(a.eventId, m.state);
        if (a.termsHash != m.termsHash) revert WrongTerms(a.eventId);
        uint256 seat = _seat[m.committeeId][a.member];
        if (seat == 0) revert NotAMember(a.eventId, a.member);
        uint16 bit = uint16(uint256(1) << (seat - 1));
        if (m.answered & bit != 0) revert AlreadyAnswered(a.eventId, a.member);
        // forge-lint: disable-next-line(block-timestamp)
        if (a.attestedAt < m.answerFrom || a.attestedAt > block.timestamp || block.timestamp > m.answerBy) {
            revert OutsideAnswerWindow(a.eventId, a.attestedAt);
        }
        if (!SignatureChecker.isValidSignatureNowCalldata(a.member, hashAnswer(a), sig)) revert SignatureInvalid();

        m.answered |= bit;
        if (a.yes) ++m.yesVotes;
        else ++m.noVotes;
        statementOf[a.eventId][a.member] = a.statementHash;
        emit Answered(a.eventId, a.member, a.yes, a.statementHash, a.attestedAt);
        uint8 agreeing = a.yes ? m.yesVotes : m.noVotes;
        if (m.quorumAt == 0 && agreeing >= _committees[m.committeeId].quorum) m.quorumAt = uint40(block.timestamp);
        _settleIfReady(a.eventId, m);
    }

    /// @notice Settles an event the answers have decided (permissionless): a quorum once the dissent wait is over, or a
    ///         void once the deadline has passed with too few. Reverts while the event must still wait.
    function resolve(bytes32 eventId) external nonReentrant {
        EventMarket storage m = _event(eventId);
        if (m.state != EVENT_OPEN) revert NotOpen(eventId, m.state);
        if (!_settleIfReady(eventId, m)) revert NotReady(eventId);
    }

    // ------------------------------------------------------------------------------------------------ verdict

    /// @dev What the answers so far allow. False = wait.
    function _settleIfReady(bytes32 eventId, EventMarket storage m) private returns (bool) {
        if (m.yesVotes != 0 && m.noVotes != 0) {
            _void(eventId, m, EVENT_VOID_DISAGREEMENT, false);
            return true;
        }
        Committee storage c = _committees[m.committeeId];
        uint8 votes = m.yesVotes + m.noVotes;
        // forge-lint: disable-next-line(block-timestamp)
        bool late = block.timestamp > m.answerBy;
        // forge-lint: disable-next-line(block-timestamp)
        bool heard = m.quorumAt != 0 && block.timestamp >= uint256(m.quorumAt) + dissentWaitSec;
        if (votes == c.size || (votes >= c.quorum && (late || heard))) {
            _decide(eventId, m, m.yesVotes != 0);
            return true;
        }
        if (late) {
            _void(eventId, m, EVENT_VOID_QUORUM_NOT_MET, false);
            return true;
        }
        return false;
    }

    /// @dev The committee's answer: the winning side shares the losing side's stakes less the fee, pro rata. With
    ///      nobody on the winning side there is no one to pay, so every call is refunded (the answer still recorded).
    function _decide(bytes32 eventId, EventMarket storage m, bool yes) private {
        uint256 win = yes ? m.yesPool : m.noPool;
        if (win == 0) {
            _void(eventId, m, EVENT_VOID_NO_WINNERS, yes);
            return;
        }
        uint256 lose = yes ? m.noPool : m.yesPool;
        uint256 fee = lose * m.feeBps / BPS;
        m.state = EVENT_DECIDED;
        m.answer = yes;
        m.decidedAt = uint40(block.timestamp);
        m.prize = uint128(lose - fee);
        m.held -= uint128(fee);
        totalHeld -= fee;
        feesHeld += fee;
        emit EventDecided(eventId, yes, m.yesPool, m.noPool, fee, m.prize);
    }

    function _void(bytes32 eventId, EventMarket storage m, uint8 reason, bool answer_) private {
        m.state = EVENT_VOIDED;
        m.voidReason = reason;
        m.answer = answer_;
        m.decidedAt = uint40(block.timestamp);
        emit EventVoided(eventId, reason, answer_);
    }
}
