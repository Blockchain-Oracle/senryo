// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {DuelArena} from "../../src/games/DuelArena.sol";
import "../../src/games/DuelTypes.sol";
import "../../src/markets/MarketTypes.sol";
import {MarketsBase} from "../markets/MarketsBase.t.sol";

/// @notice Two players, a deck of three 5-minute windows (BTC, ETH, SOL, all opened at T0 with their line) and an arena
///         with a $20 pot and $10 cards.
abstract contract DuelBase is MarketsBase {
    bytes32 internal constant ETH = bytes32("ETH");
    bytes32 internal constant SOL = bytes32("SOL");
    bytes32 internal constant ETH_FEED = keccak256("ETH/USD");
    bytes32 internal constant SOL_FEED = keccak256("SOL/USD");
    int64 internal constant KE = 3000e8;
    int64 internal constant KS = 150e8;
    uint256 internal constant B_PK = 0xB0B;
    uint256 internal constant B_KEY_PK = 0xB0B1;
    uint256 internal constant A_KEY_PK = 0xA1;
    uint8 internal constant TIER = 1;
    uint64 internal constant POT = 20e6;
    uint64 internal constant CARD = 10e6;
    bytes32 internal constant MATCH = keccak256("match-1");
    bytes32 internal constant SERVER_SEED = keccak256("server");

    DuelArena internal arena;
    address internal b;
    bytes32[DUEL_CARDS] internal cards;
    bytes32[DUEL_CARDS] internal feeds;
    bytes32 internal seedA = keccak256("a");
    bytes32 internal seedB = keccak256("b");

    receive() external payable {}

    function setUp() public virtual override {
        super.setUp();
        b = vm.addr(B_PK);
        bytes32 ethWindow = listAndOpen(ETH, ETH_FEED, KE);
        bytes32 solWindow = listAndOpen(SOL, SOL_FEED, KS);
        cards = [windowId, ethWindow, solWindow];
        feeds = [BTC_FEED, ETH_FEED, SOL_FEED];

        arena = new DuelArena(address(manager), reserve, DuelClocks(120, 120, 180));
        arena.setTier(TIER, DuelTier(POT, CARD, true));
        usd.mint(b, WALLET);
        vm.prank(owner);
        usd.approve(address(arena), type(uint256).max);
        vm.prank(b);
        usd.approve(address(arena), type(uint256).max);
    }

    function listAndOpen(bytes32 market, bytes32 feed, int64 k) internal returns (bytes32 w) {
        PolicyVersion memory v0;
        v0.validUntil = OPEN_ENDED;
        v0.primary = PrintSource(address(verifier), feed);
        bytes32 series = windows.registerSeries(market, CADENCE, 0, v0);
        reserve.setSigma(series, SIGMA);
        reserve.addBand(series, BandDef(BAND_UP, 0, 0));
        reserve.addBand(series, BandDef(BAND_DOWN, 0, 0));
        reserve.addBand(series, BandDef(BAND_MOONSHOT, 30, 0));
        w = windows.openWindow(series, T0);
        recordOn(feed, T0, k);
    }

    function recordOn(bytes32 feed, uint40 t, int64 price) internal {
        bytes memory proof = pyth.push(feed, t, t - 1, price, confOf(price), EXPO);
        windows.recordPrint{value: pyth.FEE()}(address(verifier), feed, t, proof);
    }

    /// @dev One basis point of the price: well inside the verifier's quality bound on any feed.
    function confOf(int64 price) internal pure returns (uint64) {
        return uint64(price) / uint64(BPS);
    }

    // ------------------------------------------------------------------------------------------------ entry

    function entry(address who, bytes32 seed, address key) internal returns (DuelEntry memory) {
        return DuelEntry({
            owner: who,
            tier: TIER,
            delegate: key,
            seed: seed,
            deadline: uint64(vm.getBlockTimestamp() + 300),
            nonce: nextNonce++,
            epoch: reserve.epochOf(who)
        });
    }

    function signEntry(uint256 pk, DuelEntry memory e) internal view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, arena.hashEntry(e));
        return abi.encodePacked(r, s, v);
    }

    function deckHash() internal view returns (bytes32) {
        return arena.deckHashOf(MATCH, SERVER_SEED, [seedA, seedB], cards);
    }

    /// @dev Pairs the two players (A's key `A_KEY_PK`, B's `B_KEY_PK`) and reveals the deck.
    function openAndReveal() internal {
        open();
        arena.revealDeck(MATCH, SERVER_SEED, cards);
    }

    function open() internal {
        DuelEntry memory ea = entry(owner, seedA, vm.addr(A_KEY_PK));
        DuelEntry memory eb = entry(b, seedB, vm.addr(B_KEY_PK));
        arena.openMatch(MATCH, ea, signEntry(OWNER_PK, ea), noPermit(), eb, signEntry(B_PK, eb), noPermit(), deckHash());
    }

    // ------------------------------------------------------------------------------------------------ picks

    function duelPick(address who, uint8 card, uint8 band) internal pure returns (DuelPick memory) {
        return DuelPick({matchId: MATCH, player: who, card: card, band: band, minPayout: 0});
    }

    function signPick(uint256 pk, DuelPick memory p) internal view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, arena.hashPick(p));
        return abi.encodePacked(r, s, v);
    }

    /// @dev A swipe signed by the seat's key, relayed by this contract.
    function swipe(address who, uint256 keyPk, uint8 card, uint8 band) internal returns (uint256) {
        DuelPick memory p = duelPick(who, card, band);
        return arena.pick(p, signPick(keyPk, p));
    }

    /// @dev Fills one ticket at its target on the card's feed.
    function fillOn(uint8 card, uint256 id, int64 price) internal {
        uint40 target = reserve.ticketOf(id).target;
        if (vm.getBlockTimestamp() <= target) vm.warp(target + 1);
        PrintSource memory src = windows.primarySourceOf(cards[card]);
        bool have = windows.printOf(src.verifier, src.feedId, target).publishTime != 0;
        bytes memory proof = have ? bytes("") : pyth.push(feeds[card], target, target - 1, price, confOf(price), EXPO);
        uint256[] memory ids = new uint256[](1);
        ids[0] = id;
        reserve.finalize{value: have ? 0 : pyth.FEE()}(target, ids, proof);
    }

    /// @dev Closes every card's window at its open price moved by `moveBps` (positive: up) and settles it.
    function closeAll(int64 moveBps) internal {
        vm.warp(T0 + CADENCE + 1);
        int64[DUEL_CARDS] memory ks = [K, KE, KS];
        for (uint256 i; i < DUEL_CARDS; ++i) {
            recordOn(feeds[i], T0 + CADENCE, ks[i] + ks[i] * moveBps / int64(int256(BPS)));
            windows.resolve(cards[i]);
            reserve.settleWindow(cards[i]);
        }
    }

    function settleCards() internal {
        for (uint8 c; c < DUEL_CARDS; ++c) {
            arena.settleCard(MATCH, c);
        }
    }

    function status() internal view returns (uint8) {
        (DuelMatch memory m,,) = arena.matchOf(MATCH);
        return m.status;
    }

    /// @dev The arena holds exactly what it owes, and the reserve stays whole.
    function assertArenaSolvent() internal view {
        assertEq(usd.balanceOf(address(arena)), arena.liabilities(), "arena balance == liabilities");
        assertSolvent();
    }
}
