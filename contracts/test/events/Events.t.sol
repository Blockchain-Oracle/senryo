// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {IAccessManaged} from "@openzeppelin/contracts/access/manager/IAccessManaged.sol";
import {IEventBook} from "../../src/events/IEventBook.sol";
import "../../src/events/EventTypes.sol";
import "../../src/markets/MarketTypes.sol";
import {EventBase} from "./EventBase.t.sol";

contract EventsTest is EventBase {
    function test_theWholeCommitteeAgreeingPaysTheWinnersTheLosersStakesLessTheFee() public {
        place(OWNER_PK, true, 30e6);
        place(B_PK, true, 10e6);
        place(C_PK, false, 60e6);
        assertBookSolvent();
        uint256 ownerBefore = usd.balanceOf(owner);
        uint256 bBefore = usd.balanceOf(b);
        uint256 cBefore = usd.balanceOf(c);

        toAnswers();
        say(M1_PK, true);
        say(M2_PK, true);
        assertEq(state(), EVENT_OPEN, "a quorum waits for the third member");
        say(M3_PK, true);
        EventMarket memory m = book.eventOf(EVENT);
        assertEq(m.state, EVENT_DECIDED);
        assertTrue(m.answer);
        // 2 % of the 60 on No is the fee; the 58.8 left is shared 30 : 10 by the Yes side.
        assertEq(book.feesHeld(), 1.2e6);
        assertEq(m.prize, 58.8e6);

        claimAll(3);
        assertEq(usd.balanceOf(owner) - ownerBefore, 74.1e6, "30 + 30/40 of 58.8");
        assertEq(usd.balanceOf(b) - bBefore, 24.7e6, "10 + 10/40 of 58.8");
        assertEq(usd.balanceOf(c), cBefore, "the No side lost its stake");
        assertEq(book.totalHeld(), 0);
        assertBookSolvent();

        uint256 liquid = reserve.liquid();
        book.sweepFees();
        assertEq(reserve.liquid() - liquid, 1.2e6, "the fee lands in the shared pool");
        assertEq(usd.balanceOf(address(book)), 0);
        assertBookSolvent();
    }

    function test_aDissentVoidsAndRefundsEveryCall() public {
        place(OWNER_PK, true, 30e6);
        place(C_PK, false, 60e6);
        toAnswers();
        say(M1_PK, true);
        say(M2_PK, false);
        EventMarket memory m = book.eventOf(EVENT);
        assertEq(m.state, EVENT_VOIDED);
        assertEq(m.voidReason, EVENT_VOID_DISAGREEMENT);

        uint256 ownerBefore = usd.balanceOf(owner);
        uint256 cBefore = usd.balanceOf(c);
        claimAll(2);
        assertEq(usd.balanceOf(owner) - ownerBefore, 30e6);
        assertEq(usd.balanceOf(c) - cBefore, 60e6);
        assertEq(book.feesHeld(), 0, "a void takes no fee");
        assertBookSolvent();
    }

    function test_aQuorumDecidesOnlyOnceADissentHadTimeToBeHeard() public {
        place(OWNER_PK, true, 30e6);
        place(C_PK, false, 60e6);
        toAnswers();
        say(M1_PK, false);
        say(M2_PK, false);
        vm.expectRevert(abi.encodeWithSelector(IEventBook.NotReady.selector, EVENT));
        book.resolve(EVENT);

        // The third member answers Yes inside the wait: the dissent voids the event.
        uint256 snap = vm.snapshotState();
        vm.warp(vm.getBlockTimestamp() + DISSENT_WAIT - 1);
        say(M3_PK, true);
        assertEq(book.eventOf(EVENT).voidReason, EVENT_VOID_DISAGREEMENT);

        // Silent through the wait: the quorum decides No.
        vm.revertToState(snap);
        vm.warp(vm.getBlockTimestamp() + DISSENT_WAIT);
        book.resolve(EVENT);
        EventMarket memory m = book.eventOf(EVENT);
        assertEq(m.state, EVENT_DECIDED);
        assertFalse(m.answer);
        claimAll(2);
        assertBookSolvent();
    }

    function test_tooFewAnswersByTheDeadlineVoids() public {
        place(OWNER_PK, true, 30e6);
        toAnswers();
        say(M1_PK, true);
        vm.expectRevert(abi.encodeWithSelector(IEventBook.NotReady.selector, EVENT));
        book.resolve(EVENT);

        vm.warp(answerFrom + ANSWER_SPAN + 1);
        // Too late to answer now.
        EventAnswer memory a = answerOf(M2_PK, true);
        bytes memory sig = signAnswer(M2_PK, a);
        vm.expectRevert(abi.encodeWithSelector(IEventBook.OutsideAnswerWindow.selector, EVENT, a.attestedAt));
        book.answer(a, sig);

        book.resolve(EVENT);
        assertEq(book.eventOf(EVENT).voidReason, EVENT_VOID_QUORUM_NOT_MET);
        uint256 before = usd.balanceOf(owner);
        claimAll(1);
        assertEq(usd.balanceOf(owner) - before, 30e6);
        assertBookSolvent();
    }

    function test_nobodyOnTheWinningSideRefundsEveryoneAndKeepsTheAnswer() public {
        place(OWNER_PK, false, 30e6);
        place(C_PK, false, 60e6);
        toAnswers();
        say(M1_PK, true);
        say(M2_PK, true);
        say(M3_PK, true);
        EventMarket memory m = book.eventOf(EVENT);
        assertEq(m.state, EVENT_VOIDED);
        assertEq(m.voidReason, EVENT_VOID_NO_WINNERS);
        assertTrue(m.answer, "the committee's answer is still on record");
        uint256 before = usd.balanceOf(c);
        claimAll(2);
        assertEq(usd.balanceOf(c) - before, 60e6);
        assertBookSolvent();
    }

    function test_callsCloseBeforeTheAnswerAndEachSignedCallIsTheOwnersOnce() public {
        EventCall memory e = callOf(owner, true, 10e6);
        bytes memory sig = signCall(OWNER_PK, e);
        book.placeCall(e, sig, noPermit());
        vm.expectRevert(abi.encodeWithSelector(IEventBook.CallUsed.selector, owner, e.nonce));
        book.placeCall(e, sig, noPermit());

        // Someone else's signature, a stake outside the limits, a revoke since signing.
        EventCall memory forged = callOf(owner, true, 10e6);
        bytes memory forgedSig = signCall(B_PK, forged);
        vm.expectRevert(IEventBook.SignatureInvalid.selector);
        book.placeCall(forged, forgedSig, noPermit());
        EventCall memory big = callOf(owner, true, MAX_STAKE + 1);
        bytes memory bigSig = signCall(OWNER_PK, big);
        vm.expectRevert(
            abi.encodeWithSelector(IEventBook.StakeOutOfRange.selector, MAX_STAKE + 1, MIN_STAKE, MAX_STAKE)
        );
        book.placeCall(big, bigSig, noPermit());
        EventCall memory stale = callOf(owner, true, 10e6);
        bytes memory staleSig = signCall(OWNER_PK, stale);
        vm.prank(owner);
        reserve.bumpEpoch();
        vm.expectRevert(abi.encodeWithSelector(IEventBook.WrongEpoch.selector, 1, 0));
        book.placeCall(stale, staleSig, noPermit());

        vm.warp(closesAt);
        EventCall memory late = callOf(owner, true, 10e6);
        bytes memory lateSig = signCall(OWNER_PK, late);
        vm.expectRevert(abi.encodeWithSelector(IEventBook.CallsClosed.selector, EVENT, closesAt));
        book.placeCall(late, lateSig, noPermit());
        assertBookSolvent();
    }

    function test_onlyMembersAnswerOncePerEventInsideTheWindowOnTheseTerms() public {
        EventAnswer memory early = answerOf(M1_PK, true);
        bytes memory earlySig = signAnswer(M1_PK, early);
        vm.expectRevert(abi.encodeWithSelector(IEventBook.OutsideAnswerWindow.selector, EVENT, early.attestedAt));
        book.answer(early, earlySig);

        toAnswers();
        EventAnswer memory stranger = answerOf(B_PK, true);
        bytes memory strangerSig = signAnswer(B_PK, stranger);
        vm.expectRevert(abi.encodeWithSelector(IEventBook.NotAMember.selector, EVENT, b));
        book.answer(stranger, strangerSig);

        EventAnswer memory otherTerms = answerOf(M1_PK, true);
        otherTerms.termsHash = keccak256("another question");
        bytes memory otherSig = signAnswer(M1_PK, otherTerms);
        vm.expectRevert(abi.encodeWithSelector(IEventBook.WrongTerms.selector, EVENT));
        book.answer(otherTerms, otherSig);

        // A member's answer signed by someone else.
        EventAnswer memory forged = answerOf(M1_PK, true);
        bytes memory forgedSig = signAnswer(M2_PK, forged);
        vm.expectRevert(IEventBook.SignatureInvalid.selector);
        book.answer(forged, forgedSig);

        say(M1_PK, true);
        EventAnswer memory again = answerOf(M1_PK, false);
        bytes memory againSig = signAnswer(M1_PK, again);
        vm.expectRevert(abi.encodeWithSelector(IEventBook.AlreadyAnswered.selector, EVENT, members[0]));
        book.answer(again, againSig);
    }

    function test_aCommitteeIsFixedAndOnlyTheListerLists() public {
        string[] memory names = new string[](1);
        names[0] = "swap";
        address[] memory one = new address[](1);
        one[0] = b;
        vm.expectRevert(abi.encodeWithSelector(IEventBook.CommitteeExists.selector, COMMITTEE));
        book.setCommittee(COMMITTEE, one, 1, names);

        vm.prank(b);
        vm.expectRevert(abi.encodeWithSelector(IAccessManaged.AccessManagedUnauthorized.selector, b));
        book.listEvent(eventTerms(keccak256("other")), QUESTION, RULES);

        vm.expectRevert(abi.encodeWithSelector(IEventBook.EventExists.selector, EVENT));
        book.listEvent(eventTerms(EVENT), QUESTION, RULES);

        book.setCommitteeEnabled(COMMITTEE, false);
        vm.expectRevert(abi.encodeWithSelector(IEventBook.UnknownCommittee.selector, COMMITTEE));
        book.listEvent(eventTerms(keccak256("other")), QUESTION, RULES);
    }

    function test_aBlockedOwnerIsHeldAsOwedAndTheEventStillSettles() public {
        place(OWNER_PK, true, 30e6);
        place(C_PK, false, 60e6);
        toAnswers();
        say(M1_PK, true);
        say(M2_PK, true);
        say(M3_PK, true);
        usd.setBlocked(owner, true);
        claimAll(2);
        assertEq(book.owedOf(owner), 30e6 + 58.8e6);
        assertBookSolvent();
        usd.setBlocked(owner, false);
        vm.prank(owner);
        book.claimOwed();
        assertEq(book.owedOf(owner), 0);
        assertBookSolvent();
    }

    function test_theListerListsSeveralQuestionsInOneTransaction() public {
        bytes[] memory batch = new bytes[](2);
        batch[0] = abi.encodeCall(book.listEvent, (eventTerms(keccak256("q2")), QUESTION, RULES));
        batch[1] = abi.encodeCall(book.listEvent, (eventTerms(keccak256("q3")), QUESTION, RULES));
        book.multicall(batch);
        assertEq(book.eventOf(keccak256("q3")).state, EVENT_OPEN);
        vm.prank(b);
        vm.expectRevert(abi.encodeWithSelector(IAccessManaged.AccessManagedUnauthorized.selector, b));
        book.multicall(batch);
    }

    /// @dev Any mix of stakes and answer: winners never get back less than their stake, the book pays out no more than
    ///      it took less the fee, and once every call is paid only the fee (and rounding dust) is left.
    function testFuzz_payoutsNeverExceedThePool(uint64[6] memory stakes, uint8 sides, bool yes) public {
        uint256 total;
        uint256 losing;
        uint256[6] memory before;
        for (uint256 i; i < stakes.length; ++i) {
            uint256 pk = 0x1000 + i;
            address who = vm.addr(pk);
            usd.mint(who, MAX_STAKE);
            vm.prank(who);
            usd.approve(address(book), type(uint256).max);
            before[i] = usd.balanceOf(who);
            stakes[i] = uint64(bound(stakes[i], MIN_STAKE, MAX_STAKE));
            bool side = (sides >> i) & 1 == 1;
            place(pk, side, stakes[i]);
            total += stakes[i];
            if (side != yes) losing += stakes[i];
        }
        toAnswers();
        say(M1_PK, yes);
        say(M2_PK, yes);
        say(M3_PK, yes);
        claimAll(stakes.length);

        uint256 paid;
        bool voided = book.eventOf(EVENT).state == EVENT_VOIDED;
        for (uint256 i; i < stakes.length; ++i) {
            uint256 got = usd.balanceOf(vm.addr(0x1000 + i)) + stakes[i] - before[i];
            bool won = ((sides >> i) & 1 == 1) == yes;
            if (voided || won) assertGe(got, stakes[i], "a winner or a refund gets at least the stake");
            else assertEq(got, 0, "a loser gets nothing");
            paid += got;
        }
        uint256 fee = voided ? 0 : losing * FEE_BPS / BPS;
        assertLe(paid, total - fee, "never more than the pool less the fee");
        assertEq(usd.balanceOf(address(book)), total - paid, "what is left is the book's");
        assertEq(book.feesHeld(), total - paid, "the fee and the dust, nothing else");
        assertBookSolvent();
    }
}
