// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {Test} from "forge-std/Test.sol";
import {stdJson} from "forge-std/StdJson.sol";
import {SSTORE2} from "solady/utils/SSTORE2.sol";
import {BandMath} from "../../src/markets/BandMath.sol";
import {TailTableData} from "../../src/markets/TailTableData.sol";
import "../../src/markets/MarketTypes.sol";

/// @dev External doors onto the library, so the vectors run the same code the reserve does.
contract BandMathHarness {
    address internal immutable table = SSTORE2.write(TailTableData.BLOB);

    function probE6(BandDef memory d, int64 k, int64 spot, uint64 markE8, uint64 longE8, uint256 tauSec)
        external
        view
        returns (uint256)
    {
        return BandMath.probE6(d, k, spot, markE8, longE8, tauSec, BandMath.shapeOf(table));
    }
}

/// @notice R3.3 (D-300): the TS mirror (`packages/core/src/market/band-math.ts`) must price every band exactly as the
///         contract does. This pins `BandMath` to `packages/core/vectors/band-math.json`; `scripts/drive` checks the
///         mirror against the same file. After a pricing change, regenerate with `WRITE_VECTORS=1 forge test --mt
///         test_bandMathVectors` and commit the file with the change.
contract BandMathVectorsTest is Test {
    using stdJson for string;

    string internal constant PATH = "../packages/core/vectors/band-math.json";
    uint256 internal constant CASES = 600;
    int64 internal constant K = 6_000_000_000_000; // $60,000 × 1e8
    /// @dev σ per √second × 1e8 from ≈ 0.05 to ≈ 2.5 a year; spots within ±3 % of K; τ from 1 s to 2 h.
    uint64 internal constant SIGMA_MIN = 900;
    uint64 internal constant SIGMA_SPAN = 44_000;
    uint256 internal constant SPOT_SPAN_BPS = 300;
    uint256 internal constant TAU_SPAN = 7200;
    uint256 internal constant OFFSET_SPAN_BPS = 200;
    uint256 internal constant KINDS = 5;

    BandMathHarness internal math = new BandMathHarness();

    function test_bandMathVectors() public {
        uint256[] memory kind = new uint256[](CASES);
        uint256[] memory low = new uint256[](CASES);
        uint256[] memory high = new uint256[](CASES);
        uint256[] memory spot = new uint256[](CASES);
        uint256[] memory mark = new uint256[](CASES);
        uint256[] memory long = new uint256[](CASES);
        uint256[] memory tau = new uint256[](CASES);
        uint256[] memory prob = new uint256[](CASES);
        for (uint256 i; i < CASES; ++i) {
            uint256 seed = uint256(keccak256(abi.encode(i)));
            BandDef memory d = _band(seed);
            (kind[i], low[i], high[i]) = (d.kind, d.lowBps, d.highBps);
            spot[i] = uint256(uint64(K)) * (BPS - SPOT_SPAN_BPS + (seed >> 32) % (2 * SPOT_SPAN_BPS + 1)) / BPS;
            mark[i] = SIGMA_MIN + (seed >> 64) % SIGMA_SPAN;
            long[i] = SIGMA_MIN + (seed >> 96) % SIGMA_SPAN;
            tau[i] = 1 + (seed >> 128) % TAU_SPAN;
            // forge-lint: disable-next-line(unsafe-typecast)
            prob[i] = math.probE6(d, K, int64(uint64(spot[i])), uint64(mark[i]), uint64(long[i]), tau[i]);
        }
        if (vm.envOr("WRITE_VECTORS", false)) {
            string memory o = "v";
            vm.serializeUint(o, "k", uint256(uint64(K)));
            vm.serializeUint(o, "kind", kind);
            vm.serializeUint(o, "lowBps", low);
            vm.serializeUint(o, "highBps", high);
            vm.serializeUint(o, "spotE8", spot);
            vm.serializeUint(o, "markE8", mark);
            vm.serializeUint(o, "longE8", long);
            vm.serializeUint(o, "tauSec", tau);
            vm.writeJson(vm.serializeUint(o, "probE6", prob), PATH);
            return;
        }
        string memory json = vm.readFile(PATH);
        assertEq(json.readUintArray(".probE6"), prob, "BandMath changed: regenerate the vectors (WRITE_VECTORS=1)");
        assertEq(json.readUintArray(".tauSec"), tau);
        assertEq(json.readUintArray(".spotE8"), spot);
    }

    function _band(uint256 seed) internal pure returns (BandDef memory d) {
        // forge-lint: disable-next-line(unsafe-typecast)
        d.kind = uint8(1 + seed % KINDS);
        // forge-lint: disable-next-line(unsafe-typecast)
        uint16 a = uint16(1 + (seed >> 8) % OFFSET_SPAN_BPS);
        // forge-lint: disable-next-line(unsafe-typecast)
        uint16 b = uint16(1 + (seed >> 16) % OFFSET_SPAN_BPS);
        if (d.kind == BAND_RANGE) (d.lowBps, d.highBps) = (a, b);
        else if (d.kind == BAND_MOONSHOT || d.kind == BAND_CRASH) d.lowBps = a;
    }
}
