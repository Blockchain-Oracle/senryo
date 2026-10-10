// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import "../../src/markets/MarketTypes.sol";
import "../../src/markets/RideTypes.sol";
import {MarketsBase} from "./MarketsBase.t.sol";

/// @notice The BTC ride market on the calls' feed, testnet terms (D-301): 40×, 5 bps taker / 2 bps maker, profit
///         reserved to min(900 %, L × 25 %), 4 h life; rides at most 30 % of the pool, a 10 % hourly loss brake, an
///         early-close fee of 20 → 0 bps over 15 s.
abstract contract RidesBase is MarketsBase {
    uint16 internal constant BTC_RIDE = 0;
    uint32 internal constant LEV40 = 400_000;
    uint32 internal constant LEV10 = 100_000;
    uint64 internal constant MARGIN = 10e6;
    uint16 internal constant TAKER = 5;
    uint16 internal constant MAKER = 2;
    uint32 internal constant LIFE = 14_400;
    int64 internal constant ANY_LONG = type(int64).max;
    int64 internal constant ANY_SHORT = 1;

    function setUp() public virtual override {
        super.setUp();
        reserve.setRideTerms(
            RideTerms({maxLinearBps: 3000, maxHourlyLossBps: 1000, earlyFeeBps: 20, earlyWindowSec: 15})
        );
        reserve.addRideMarket(btcRide());
        usd.mint(owner, WALLET);
    }

    function btcRide() internal view returns (RideMarket memory) {
        return RideMarket({
            verifier: address(verifier),
            enabled: true,
            maxLeverageBps: LEV40,
            takerFeeBps: TAKER,
            makerFeeBps: MAKER,
            feedId: BTC_FEED,
            maxProfitBps: 90_000,
            maxMoveBps: 2500,
            marketReserveBps: 1500,
            skewCapBps: 5000,
            maxLifeSec: LIFE,
            marketReserveCap: 15_000e6,
            minMargin: 1e6,
            maxMargin: 1000e6
        });
    }

    // ------------------------------------------------------------------------------------------------ intents

    function rideIntent(uint8 action, bool isLong, uint256 rideId, uint64 margin, uint32 lev, uint128 size, int64 worst)
        internal
        returns (RideIntent memory it)
    {
        it = RideIntent({
            action: action,
            owner: owner,
            marketId: BTC_RIDE,
            isLong: isLong,
            rideId: rideId,
            margin: margin,
            leverageBps: lev,
            size: size,
            worstPriceE8: worst,
            recipient: owner,
            configVersion: reserve.configVersion(),
            deadline: uint64(vm.getBlockTimestamp() + 60),
            nonce: nextNonce++,
            epoch: reserve.epochOf(owner)
        });
    }

    function signRide(uint256 pk, RideIntent memory it) internal view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, reserve.hashRide(it));
        return abi.encodePacked(r, s, v);
    }

    function openRide(bool isLong, uint64 margin, uint32 lev) internal returns (uint256 id) {
        RideIntent memory it = rideIntent(ACTION_OPEN, isLong, 0, margin, lev, 0, isLong ? ANY_LONG : ANY_SHORT);
        id = reserve.commitRide(it, signRide(OWNER_PK, it), noPermit());
    }

    function closeRide(uint256 id, uint128 size) internal {
        bool isLong = reserve.rideOf(id).isLong;
        RideIntent memory it = rideIntent(ACTION_CLOSE, isLong, id, 0, 0, size, isLong ? ANY_SHORT : ANY_LONG);
        reserve.commitRide(it, signRide(OWNER_PK, it), noPermit());
    }

    /// @dev Fills the ride's pending action at its target, at `price`.
    function fillRide(uint256 id, int64 price) internal {
        uint40 target = reserve.rideOf(id).target;
        if (vm.getBlockTimestamp() <= target) vm.warp(target + 1);
        bool have = windows.printOf(address(verifier), BTC_FEED, target).publishTime != 0;
        bytes memory proof = have ? bytes("") : printAt(target, price);
        uint256[] memory ids = new uint256[](1);
        ids[0] = id;
        reserve.finalizeRides{value: have ? 0 : pyth.FEE()}(target, ids, proof);
    }

    function one(uint256 id) internal pure returns (uint256[] memory ids) {
        ids = new uint256[](1);
        ids[0] = id;
    }

    /// @dev Proves the print of `t` at `price` against `ids`' bounds.
    function bounds(uint40 t, int64 price, uint256[] memory ids) internal {
        if (vm.getBlockTimestamp() <= t) vm.warp(t + 1);
        bool have = windows.printOf(address(verifier), BTC_FEED, t).publishTime != 0;
        bytes memory proof = have ? bytes("") : printAt(t, price);
        reserve.settleBounds{value: have ? 0 : pyth.FEE()}(t, ids, proof);
    }

    /// @dev D-264 with rides: every unit has a home, and the side sums equal the open rides' stored values.
    function assertRidesBalance() internal view {
        assertSolvent();
        uint256 n = reserve.rideCount();
        uint256[SIDES] memory size;
        uint256[SIDES] memory cost;
        uint256[SIDES] memory margin;
        uint256[SIDES] memory res;
        uint256[SIDES] memory count;
        uint256 margins;
        uint256 reserves;
        for (uint256 i = 1; i <= n; ++i) {
            Ride memory r = reserve.rideOf(i);
            if (r.status != RIDE_OPEN) continue;
            uint8 s = r.isLong ? SIDE_LONG : SIDE_SHORT;
            size[s] += r.size;
            cost[s] += uint256(r.size) * uint256(int256(r.entryE8));
            margin[s] += r.margin;
            res[s] += r.reserve;
            count[s] += 1;
            margins += r.margin;
            reserves += r.reserve;
        }
        for (uint8 s; s < SIDES; ++s) {
            RideSide memory side = reserve.rideSideOf(BTC_RIDE, s);
            assertEq(side.size, size[s], "side size == sum of rides");
            assertEq(side.cost, cost[s], "side cost == sum of rides");
            assertEq(side.margin, margin[s], "side margin == sum of rides");
            assertEq(side.reserve, res[s], "side reserve == sum of rides");
            assertEq(side.count, count[s], "side count == open rides");
        }
        assertEq(reserve.margins(), margins, "margins == open rides' margins");
        assertEq(reserve.linearReserved(), reserves, "linearReserved == open rides' reserves");
    }
}
