// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {Test} from "forge-std/Test.sol";
import {stdJson} from "forge-std/StdJson.sol";
import {BandMath} from "../../src/markets/BandMath.sol";
import {LinearMath} from "../../src/markets/LinearMath.sol";
import "../../src/markets/MarketTypes.sol";
import "../../src/markets/RideTypes.sol";
import {MarketsBase} from "./MarketsBase.t.sol";

/// @notice R3.19: the client's ride maths (`packages/core/src/market/ride-math.ts`), spread curve and EIP-712 digests
///         (`packages/chain`) must equal the contract's. This pins `LinearMath`, `BandMath.halfSpreadE6` and the
///         reserve's typed-data hashes to `packages/core/vectors/{ride-math,typed-data}.json`; `scripts/drive` checks
///         the mirrors against the same files. Regenerate with `WRITE_VECTORS=1 forge test --mt test_mirrorVectors`.
contract RideMathVectorsTest is MarketsBase {
    using stdJson for string;

    string internal constant RIDE_PATH = "../packages/core/vectors/ride-math.json";
    string internal constant TYPED_PATH = "../packages/core/vectors/typed-data.json";
    uint256 internal constant CASES = 400;

    struct Row {
        uint256 isLong;
        uint256 margin;
        uint256 lev;
        uint256 maxProfit;
        uint256 maxMove;
        uint256 entry;
        uint256 exit;
        uint256 part;
        uint256 age;
        uint256 feeBps;
    }

    function test_mirrorVectors() public {
        string memory o = "r";
        uint256[][] memory cols = new uint256[][](23);
        for (uint256 c; c < cols.length; ++c) {
            cols[c] = new uint256[](CASES);
        }
        for (uint256 i; i < CASES; ++i) {
            uint256 seed = uint256(keccak256(abi.encode("ride", i)));
            Row memory r = Row(
                seed % 2,
                1e6 + (seed >> 8) % 1000e6,
                MIN_LEVERAGE_BPS + (seed >> 48) % 490_000,
                1 + (seed >> 80) % MAX_PROFIT_BPS,
                1 + (seed >> 100) % MAX_MOVE_BPS,
                1e6 + (seed >> 120) % 1e14,
                0,
                0,
                (seed >> 168) % 30,
                (seed >> 176) % (MAX_RIDE_FEE_BPS + 1)
            );
            r.exit = r.entry * (8000 + (seed >> 184) % 4000) / 10_000 + 1;
            _row(cols, i, r);
        }
        if (vm.envOr("WRITE_VECTORS", false)) {
            string[23] memory names = [
                "isLong",
                "margin",
                "leverageBps",
                "maxProfitBps",
                "maxMoveBps",
                "entryE8",
                "exitE8",
                "part",
                "age",
                "feeBps",
                "notional",
                "size",
                "reserve",
                "koE8",
                "capE8",
                "pnlAbs",
                "pnlNeg",
                "equity",
                "fee",
                "earlyFee",
                "keeperFee",
                "share",
                "halfSpreadE6"
            ];
            for (uint256 c; c < 22; ++c) {
                vm.serializeUint(o, names[c], cols[c]);
            }
            vm.writeJson(vm.serializeUint(o, names[22], cols[22]), RIDE_PATH);
            _writeTyped();
            return;
        }
        string memory json = vm.readFile(RIDE_PATH);
        assertEq(json.readUintArray(".size"), cols[11], "LinearMath changed: regenerate the vectors");
        assertEq(json.readUintArray(".koE8"), cols[13]);
        assertEq(json.readUintArray(".capE8"), cols[14]);
        assertEq(json.readUintArray(".pnlAbs"), cols[15]);
        assertEq(json.readUintArray(".fee"), cols[18]);
        assertEq(json.readUintArray(".halfSpreadE6"), cols[22]);
        _checkTyped();
    }

    /// @dev PnL is stored as its magnitude and a sign (the JSON writer takes unsigned values).
    function _row(uint256[][] memory c, uint256 i, Row memory r) internal pure {
        bool isLong = r.isLong == 1;
        int64 x = int64(uint64(r.entry));
        int64 y = int64(uint64(r.exit));
        uint256 n = LinearMath.notional(r.margin, r.lev);
        uint256 size = LinearMath.sizeOf(n, x);
        uint256 res = LinearMath.reserveOf(r.margin, r.lev, r.maxProfit, r.maxMove);
        r.part = size == 0 ? 0 : 1 + (r.entry ^ r.exit) % size;
        int256 pnl = LinearMath.pnl(isLong, r.part, x, y);
        uint256 exitN = LinearMath.notionalAt(r.part, y);
        uint256[23] memory v = [
            r.isLong,
            r.margin,
            r.lev,
            r.maxProfit,
            r.maxMove,
            r.entry,
            r.exit,
            r.part,
            r.age,
            r.feeBps,
            n,
            size,
            res,
            size == 0 ? 0 : uint256(int256(LinearMath.koPrice(isLong, x, size, r.margin))),
            size == 0 ? 0 : uint256(int256(LinearMath.capPrice(isLong, x, size, res))),
            pnl < 0 ? uint256(-pnl) : uint256(pnl),
            pnl < 0 ? 1 : 0,
            LinearMath.equity(r.margin, res, pnl),
            LinearMath.feeOf(exitN, r.feeBps),
            LinearMath.earlyFee(exitN, pnl, r.age, 20, 15),
            LinearMath.keeperFee(r.margin),
            size == 0 ? 0 : LinearMath.share(r.margin, r.part, size),
            BandMath.halfSpreadE6(
                MIN_PROB_FLOOR_E6 + r.entry % (MAX_PROB_CEIL_E6 - MIN_PROB_FLOOR_E6),
                uint32(1 + r.margin % MAX_HALF_SPREAD_E6),
                2500
            )
        ];
        for (uint256 k; k < v.length; ++k) {
            c[k][i] = v[k];
        }
    }

    // ------------------------------------------------------------------------------------------------ typed data

    function _samples() internal view returns (RideIntent memory it, SigmaMark memory m, ExitOrder memory e) {
        it = RideIntent(
            ACTION_OPEN, owner, 3, true, 7, 12_345_678, 250_000, 99, 6_123_456_789_012, owner, 5, 1_800_000_060, 42, 1
        );
        m = SigmaMark(BTC_FEED, 1_800_000_000, 8900, 9100);
        e = ExitOrder(
            owner, BOOK_RIDE, 9, 7_000_000_000_000, 5_900_000_000_000, 6_000_000_000_000, 150, 1_800_000_060, 77, 2
        );
    }

    function _writeTyped() internal {
        (RideIntent memory it, SigmaMark memory m, ExitOrder memory e) = _samples();
        string memory o = "t";
        vm.serializeAddress(o, "verifyingContract", address(reserve));
        vm.serializeUint(o, "chainId", block.chainid);
        vm.serializeAddress(o, "owner", owner);
        vm.serializeBytes32(o, "feedId", BTC_FEED);
        vm.serializeBytes32(o, "rideIntent", reserve.hashRide(it));
        vm.serializeBytes32(o, "sigmaMark", reserve.hashSigmaMark(m));
        vm.writeJson(vm.serializeBytes32(o, "exitOrder", reserve.hashExit(e)), TYPED_PATH);
    }

    function _checkTyped() internal view {
        (RideIntent memory it, SigmaMark memory m, ExitOrder memory e) = _samples();
        string memory json = vm.readFile(TYPED_PATH);
        assertEq(json.readBytes32(".rideIntent"), reserve.hashRide(it), "RideIntent hashing changed");
        assertEq(json.readBytes32(".sigmaMark"), reserve.hashSigmaMark(m));
        assertEq(json.readBytes32(".exitOrder"), reserve.hashExit(e));
    }
}
