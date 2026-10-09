// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {EventBook} from "../../src/events/EventBook.sol";
import "../../src/events/EventTypes.sol";
import "../../src/markets/MarketTypes.sol";
import {MarketsBase} from "../markets/MarketsBase.t.sol";

/// @notice A three-member committee (two must agree, a dissent heard for ten minutes), one question that closes in an
///         hour and is answered from the hour after, a 2 % fee on the losing side, and three funded callers.
abstract contract EventBase is MarketsBase {
    uint16 internal constant COMMITTEE = 1;
    uint8 internal constant QUORUM = 2;
    uint32 internal constant DISSENT_WAIT = 600;
    uint16 internal constant FEE_BPS = 200;
    uint64 internal constant MIN_STAKE = 1e6;
    uint64 internal constant MAX_STAKE = 1000e6;
    uint40 internal constant CLOSES_IN = 3600;
    uint40 internal constant ANSWER_AFTER = 7200;
    uint40 internal constant ANSWER_SPAN = 86_400;
    /// @dev The role on the pool's `fund` door the book's sweep needs (DeployMarkets' FUND).
    uint64 internal constant FUND_ROLE = 7;
    bytes32 internal constant EVENT = keccak256("nhl:2026020056");
    string internal constant QUESTION = "Will the Boston Bruins beat the Utah Mammoth?";
    string internal constant RULES = "Yes if Boston wins, overtime and shootout included. No otherwise.";
    uint256 internal constant M1_PK = 0xC1;
    uint256 internal constant M2_PK = 0xC2;
    uint256 internal constant M3_PK = 0xC3;
    uint256 internal constant B_PK = 0xB0B;
    uint256 internal constant C_PK = 0xCA7;

    EventBook internal book;
    address[] internal members;
    address internal b;
    address internal c;
    bytes32 internal terms;
    uint40 internal closesAt;
    uint40 internal answerFrom;

    function setUp() public virtual override {
        super.setUp();
        book = new EventBook(address(manager), reserve, DISSENT_WAIT, MIN_STAKE, MAX_STAKE);
        members.push(vm.addr(M1_PK));
        members.push(vm.addr(M2_PK));
        members.push(vm.addr(M3_PK));
        string[] memory names = new string[](3);
        names[0] = "league feed";
        names[1] = "ESPN";
        names[2] = "theScore";
        book.setCommittee(COMMITTEE, members, QUORUM, names);

        bytes4[] memory fund = new bytes4[](1);
        fund[0] = reserve.fund.selector;
        manager.setTargetFunctionRole(address(reserve), fund, FUND_ROLE);
        manager.grantRole(FUND_ROLE, address(book), 0);

        b = vm.addr(B_PK);
        c = vm.addr(C_PK);
        address[3] memory callers = [owner, b, c];
        for (uint256 i; i < callers.length; ++i) {
            if (usd.balanceOf(callers[i]) == 0) usd.mint(callers[i], WALLET);
            vm.prank(callers[i]);
            usd.approve(address(book), type(uint256).max);
        }
        terms = list(EVENT);
    }

    function list(bytes32 id) internal returns (bytes32) {
        closesAt = uint40(vm.getBlockTimestamp()) + CLOSES_IN;
        answerFrom = closesAt + ANSWER_AFTER;
        book.listEvent(eventTerms(id), QUESTION, RULES);
        return book.eventOf(id).termsHash;
    }

    function eventTerms(bytes32 id) internal view returns (EventTerms memory) {
        return EventTerms({
            eventId: id,
            committeeId: COMMITTEE,
            feeBps: FEE_BPS,
            closesAt: closesAt,
            answerFrom: answerFrom,
            answerBy: answerFrom + ANSWER_SPAN
        });
    }

    // ------------------------------------------------------------------------------------------------ calls

    function callOf(address who, bool yes, uint64 stake) internal returns (EventCall memory) {
        return EventCall({
            owner: who,
            eventId: EVENT,
            yes: yes,
            stake: stake,
            deadline: uint64(vm.getBlockTimestamp() + 300),
            nonce: nextNonce++,
            epoch: reserve.epochOf(who)
        });
    }

    function signCall(uint256 pk, EventCall memory e) internal view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, book.hashCall(e));
        return abi.encodePacked(r, s, v);
    }

    /// @dev A call signed by its owner and relayed by this contract.
    function place(uint256 pk, bool yes, uint64 stake) internal returns (uint256) {
        EventCall memory e = callOf(vm.addr(pk), yes, stake);
        return book.placeCall(e, signCall(pk, e), noPermit());
    }

    // ------------------------------------------------------------------------------------------------ answers

    function answerOf(uint256 pk, bool yes) internal view returns (EventAnswer memory) {
        return EventAnswer({
            eventId: EVENT,
            termsHash: terms,
            member: vm.addr(pk),
            yes: yes,
            statementHash: keccak256(abi.encode("statement", pk, yes)),
            attestedAt: uint40(vm.getBlockTimestamp())
        });
    }

    function signAnswer(uint256 pk, EventAnswer memory a) internal view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, book.hashAnswer(a));
        return abi.encodePacked(r, s, v);
    }

    /// @dev A member's answer, signed now and relayed by this contract.
    function say(uint256 pk, bool yes) internal {
        EventAnswer memory a = answerOf(pk, yes);
        book.answer(a, signAnswer(pk, a));
    }

    function toAnswers() internal {
        vm.warp(answerFrom + 1);
    }

    function claimAll(uint256 count) internal {
        uint256[] memory ids = new uint256[](count);
        for (uint256 i; i < count; ++i) {
            ids[i] = i + 1;
        }
        book.claimFor(ids);
    }

    function state() internal view returns (uint8) {
        return book.eventOf(EVENT).state;
    }

    /// @dev The book holds exactly what it owes, and the reserve stays whole.
    function assertBookSolvent() internal view {
        assertEq(usd.balanceOf(address(book)), book.liabilities(), "book balance == liabilities");
        assertSolvent();
    }
}
