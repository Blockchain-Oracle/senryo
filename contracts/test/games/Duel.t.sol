// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {IAccessManaged} from "@openzeppelin/contracts/access/manager/IAccessManaged.sol";
import {IDuelArena} from "../../src/games/IDuelArena.sol";
import "../../src/games/DuelTypes.sol";
import "../../src/markets/MarketTypes.sol";
import {DuelBase} from "./DuelBase.t.sol";

/// @notice Duel (D-294): two signed entries paired into a sealed deck, picks placed as real calls the arena owns, the
///         card results paid to the players, the pot to the better total; forfeits, refunds and ties; the arena vouches
///         for nothing but its own opens; both the arena and the reserve stay whole throughout.
contract DuelTest is DuelBase {
    int64 internal constant UP_MOVE_BPS = 10; // +0.1 % at the close
    uint64 internal constant FAR_PAYOUT = 1_000_000e6;

    // ------------------------------------------------------------------------------------------------ the whole duel

    function test_aFullDuelPaysEachCardToItsPlayerAndThePotToTheBetterTotal() public {
        uint256 a0 = usd.balanceOf(owner);
        uint256 b0 = usd.balanceOf(b);
        openAndReveal();
        assertEq(usd.balanceOf(owner), a0 - POT - 3 * CARD, "A escrowed a pot and three cards");
        assertArenaSolvent();

        uint256[3] memory aIds;
        uint256[3] memory bIds;
        for (uint8 c; c < DUEL_CARDS; ++c) {
            aIds[c] = swipe(owner, A_KEY_PK, c, UP);
            bIds[c] = swipe(b, B_KEY_PK, c, DOWN);
        }
        assertEq(status(), MATCH_SETTLING, "the last pick locks the match");
        assertEq(reserve.ticketOf(aIds[0]).owner, address(arena), "the arena owns each pick's call");
        int64[3] memory ks = [K, KE, KS];
        for (uint8 c; c < DUEL_CARDS; ++c) {
            fillOn(c, aIds[c], ks[c]);
            fillOn(c, bIds[c], ks[c]);
        }
        closeAll(UP_MOVE_BPS);
        // The keeper may already have paid the arena some tickets; settlement takes both orders.
        uint256[] memory one = new uint256[](1);
        one[0] = aIds[0];
        reserve.claimFor(one);
        settleCards();

        uint256 aWon;
        for (uint8 c; c < DUEL_CARDS; ++c) {
            aWon += reserve.ticketOf(aIds[c]).payout;
        }
        (int256 ra, int256 rb) = arena.resultsOf(MATCH);
        assertEq(ra, int256(aWon) - int256(uint256(3 * CARD)), "A's total: payouts less stakes");
        assertEq(rb, -int256(uint256(3 * CARD)), "B lost every card");

        arena.finalize(MATCH);
        assertEq(status(), MATCH_FINALIZED);
        assertEq(usd.balanceOf(owner), a0 - 3 * CARD + aWon + POT, "A: every payout and both pots");
        assertEq(usd.balanceOf(b), b0 - POT - 3 * CARD, "B: lost the pot and the cards");
        assertEq(usd.balanceOf(address(arena)), 0, "nothing left behind");
        assertArenaSolvent();
    }

    function test_aTieReturnsEachSeatItsOwnPot() public {
        openAndReveal();
        uint256[6] memory ids;
        for (uint8 c; c < DUEL_CARDS; ++c) {
            ids[2 * c] = swipe(owner, A_KEY_PK, c, UP);
            ids[2 * c + 1] = swipe(b, B_KEY_PK, c, DOWN);
        }
        int64[3] memory ks = [K, KE, KS];
        for (uint8 c; c < DUEL_CARDS; ++c) {
            fillOn(c, ids[2 * c], ks[c]);
            fillOn(c, ids[2 * c + 1], ks[c]);
        }
        // Every window closes exactly on its line: Up and Down are both refunded, so both totals are 0.
        closeAll(0);
        settleCards();
        (int256 ra, int256 rb) = arena.resultsOf(MATCH);
        assertEq(ra, 0);
        assertEq(rb, 0);
        uint256 a0 = usd.balanceOf(owner);
        uint256 b0 = usd.balanceOf(b);
        vm.expectEmit(true, false, false, true, address(arena));
        emit IDuelArena.MatchFinalized(MATCH, address(0), 0, 0, 2 * POT);
        arena.finalize(MATCH);
        assertEq(usd.balanceOf(owner), a0 + POT, "A's own pot back");
        assertEq(usd.balanceOf(b), b0 + POT, "B's own pot back");
        assertArenaSolvent();
    }

    // ------------------------------------------------------------------------------------------------ the ways out

    function test_aSeatShortOfACardForfeitsThePotAndGetsTheUnplacedStakeBack() public {
        openAndReveal();
        for (uint8 c; c < DUEL_CARDS; ++c) {
            swipe(owner, A_KEY_PK, c, DOWN);
        }
        swipe(b, B_KEY_PK, 0, UP);
        vm.expectRevert(abi.encodeWithSelector(IDuelArena.DeadlineNotPassed.selector, uint40(T0 + 1 + 120)));
        arena.lockPicks(MATCH);

        vm.warp(T0 + 1 + 121);
        uint256 b0 = usd.balanceOf(b);
        arena.lockPicks(MATCH);
        assertEq(status(), MATCH_FORFEITED);
        assertEq(usd.balanceOf(b), b0 + 2 * CARD, "B's two unplaced card stakes");
        // Nobody filled: every call's window closes first and refunds — both totals 0, A still takes the pot.
        closeAll(UP_MOVE_BPS);
        settleCards();
        uint256 a0 = usd.balanceOf(owner);
        arena.finalize(MATCH);
        assertEq(usd.balanceOf(owner), a0 + 2 * POT, "A takes both pots");
        assertArenaSolvent();
    }

    function test_bothSeatsShortSendsBothPotsHomeAndPlacedCallsStillPay() public {
        openAndReveal();
        uint256 id = swipe(owner, A_KEY_PK, 0, UP);
        fillOn(0, id, K);
        vm.warp(T0 + 1 + 121);
        uint256 a0 = usd.balanceOf(owner);
        arena.lockPicks(MATCH);
        assertEq(status(), MATCH_REFUNDED);
        assertEq(usd.balanceOf(owner), a0 + POT + 2 * CARD, "A's pot and two unplaced cards");
        closeAll(UP_MOVE_BPS);
        arena.settleCard(MATCH, 0);
        assertEq(usd.balanceOf(owner), a0 + POT + 2 * CARD + reserve.ticketOf(id).payout, "the call still pays");
        vm.expectRevert(abi.encodeWithSelector(IDuelArena.WrongStatus.selector, MATCH, MATCH_REFUNDED));
        arena.finalize(MATCH);
        assertArenaSolvent();
    }

    function test_aDeckNeverRevealedRefundsEverything() public {
        uint256 a0 = usd.balanceOf(owner);
        open();
        vm.warp(T0 + 1 + 121);
        vm.expectRevert(abi.encodeWithSelector(IDuelArena.DeadlinePassed.selector, uint40(T0 + 1 + 120)));
        arena.revealDeck(MATCH, SERVER_SEED, cards);
        arena.refundUnrevealed(MATCH);
        assertEq(usd.balanceOf(owner), a0, "A whole again");
        assertEq(arena.liabilities(), 0);
        assertArenaSolvent();
    }

    // ------------------------------------------------------------------------------------------------ the deck

    function test_theRevealMustMatchTheSealAndEveryCardMustBePlayable() public {
        open();
        bytes32[DUEL_CARDS] memory swapped = [cards[1], cards[0], cards[2]];
        vm.expectRevert();
        arena.revealDeck(MATCH, SERVER_SEED, swapped);
        vm.expectRevert();
        arena.revealDeck(MATCH, keccak256("other"), cards);

        // A deck whose cards end inside the pick window plus the lockout is refused.
        vm.warp(T0 + CADENCE - 179);
        vm.expectRevert(abi.encodeWithSelector(IDuelArena.CardTooShort.selector, cards[0], uint40(T0 + CADENCE)));
        arena.revealDeck(MATCH, SERVER_SEED, cards);
    }

    // ------------------------------------------------------------------------------------------------ entries

    function test_onlyTheMatchmakerPairsAndEachEntryIsTheOwnersOnce() public {
        DuelEntry memory ea = entry(owner, seedA, address(0));
        DuelEntry memory eb = entry(b, seedB, address(0));
        bytes memory sa = signEntry(OWNER_PK, ea);
        bytes memory sb = signEntry(B_PK, eb);
        bytes memory byKey = signEntry(B_KEY_PK, eb);
        bytes32 h = deckHash();
        vm.prank(b);
        vm.expectRevert(abi.encodeWithSelector(IAccessManaged.AccessManagedUnauthorized.selector, b));
        arena.openMatch(MATCH, ea, sa, noPermit(), eb, sb, noPermit(), h);

        // B's session key can't sign an entry: it spends money.
        vm.expectRevert(IDuelArena.SignatureInvalid.selector);
        arena.openMatch(MATCH, ea, sa, noPermit(), eb, byKey, noPermit(), h);

        arena.openMatch(MATCH, ea, sa, noPermit(), eb, sb, noPermit(), h);
        vm.expectRevert(abi.encodeWithSelector(IDuelArena.EntryUsed.selector, owner, ea.nonce));
        arena.openMatch(keccak256("match-2"), ea, sa, noPermit(), eb, sb, noPermit(), h);

        DuelEntry memory late = entry(owner, seedA, address(0));
        bytes memory sl = signEntry(OWNER_PK, late);
        vm.warp(late.deadline + 1);
        vm.expectRevert(abi.encodeWithSelector(IDuelArena.EntryExpired.selector, late.deadline));
        arena.openMatch(keccak256("match-3"), late, sl, noPermit(), eb, sb, noPermit(), h);
    }

    // ------------------------------------------------------------------------------------------------ picks

    function test_theSeatKeySwipesUntilARevokeAndTheOwnerAlways() public {
        openAndReveal();
        DuelPick memory p = duelPick(owner, 0, UP);
        bytes memory byOtherKey = signPick(B_KEY_PK, p);
        bytes memory byKey = signPick(A_KEY_PK, p);
        bytes memory byOwner = signPick(OWNER_PK, p);
        // Another seat's key can't swipe for A.
        vm.expectRevert(IDuelArena.SignatureInvalid.selector);
        arena.pick(p, byOtherKey);

        vm.prank(owner);
        reserve.bumpEpoch();
        vm.expectRevert(IDuelArena.SignatureInvalid.selector);
        arena.pick(p, byKey);
        arena.pick(p, byOwner);

        vm.expectRevert(abi.encodeWithSelector(IDuelArena.AlreadyPicked.selector, MATCH, uint8(0), owner));
        arena.pick(p, byOwner);
        DuelPick memory moon = duelPick(owner, 1, MOON);
        bytes memory moonSig = signPick(OWNER_PK, moon);
        vm.expectRevert(abi.encodeWithSelector(IDuelArena.NotUpOrDown.selector, cards[1], MOON));
        arena.pick(moon, moonSig);
    }

    function test_aRefusedFillCountsAsZeroAndReturnsTheStake() public {
        openAndReveal();
        DuelPick memory p = duelPick(owner, 0, UP);
        p.minPayout = FAR_PAYOUT;
        uint256 id = arena.pick(p, signPick(A_KEY_PK, p));
        fillOn(0, id, K);
        assertEq(reserve.ticketOf(id).status, TICKET_REFUNDED, "slippage refused the fill");
        assertArenaSolventOrAbove();
        closeAll(UP_MOVE_BPS);
        uint256 a0 = usd.balanceOf(owner);
        arena.settleCard(MATCH, 0);
        assertEq(usd.balanceOf(owner), a0 + CARD, "the stake back");
        (int256 ra,) = arena.resultsOf(MATCH);
        assertEq(ra, 0, "a refused call is worth nothing either way");
        assertArenaSolvent();
    }

    // ------------------------------------------------------------------------------------------------ ERC-1271

    function test_theArenaVouchesOnlyForTheOpenItIsCommitting() public {
        openAndReveal();
        uint256 id = swipe(owner, A_KEY_PK, 0, UP);
        fillOn(0, id, K);
        assertEq(arena.isValidSignature(reserve.hashIntent(intent(ACTION_OPEN, UP, 0, CARD, 0)), ""), ERC1271_INVALID);
        // Nobody can cash out or set an exit on the arena's call in its name.
        Intent memory close = intent(ACTION_CLOSE, 0, id, 1e6, 0);
        close.owner = address(arena);
        close.recipient = address(arena);
        close.epoch = 0;
        vm.warp(vm.getBlockTimestamp() + MIN_HOLD_SEC);
        vm.expectRevert();
        reserve.commit(close, "", noPermit());
    }

    /// @dev A refused fill pays the arena before its card settles: the arena may briefly hold more than it owes.
    function assertArenaSolventOrAbove() internal view {
        assertGe(usd.balanceOf(address(arena)), arena.liabilities());
        assertSolvent();
    }
}
