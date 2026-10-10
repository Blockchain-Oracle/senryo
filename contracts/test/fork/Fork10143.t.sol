// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {Test} from "forge-std/Test.sol";
import {stdJson} from "forge-std/StdJson.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SSTORE2} from "solady/utils/SSTORE2.sol";
import {BandReserve} from "../../src/markets/BandReserve.sol";
import {TailTableData} from "../../src/markets/TailTableData.sol";
import {IPrintVerifier} from "../../src/markets/interfaces/IPrintVerifier.sol";
import {Windows} from "../../src/markets/Windows.sol";
import {IWindows} from "../../src/markets/interfaces/IWindows.sol";
import "../../src/markets/MarketTypes.sol";
import "../../src/markets/RideTypes.sol";

interface ITestUSD {
    function mint(address to, uint256 amount) external;
}

/// @notice R3.18: the v3 reserve on a fork of Monad testnet (10143), against the contracts v3 reuses (D-309) — the
///         live AccessManager, `Windows`, Pyth verifier and Test USD — with two real Hermes updates for BTC
///         (`fixtures/btc-hermes.json`): a window opened on the first, a call and a ride filled on the second through
///         `ensurePrint`, and the ride's bounds checked at it. Needs the network:
///         `FORK_TESTS=true forge test --match-contract Fork10143Test`.
contract Fork10143Test is Test {
    using stdJson for string;

    address internal constant MANAGER = 0x2da4aD070f76b433dD68fef2B2E93524c93a9AC5;
    address internal constant WINDOWS = 0x4a97Ea931498eE8831D1fBF3E11065de6AcAFd61;
    address internal constant VERIFIER = 0xc958F3894C01Af4B5b83a2A1659B4FC87bb200D4;
    address internal constant TEST_USD = 0xABb0BFD3de979112EAa5C6d26580e716f71E87A3;
    /// @dev The deployer: the AccessManager's admin and a Test USD minter.
    address internal constant ADMIN = 0x52d205731E97C90aAB738AE66371449F585C0E6A;
    uint256 internal constant USER_PK = 0xF0C;
    uint256 internal constant SIGNER_PK = 0x516A;
    uint32 internal constant CADENCE = 300;
    uint64 internal constant SIGMA = 8900;

    BandReserve internal reserve;
    Windows internal windows = Windows(WINDOWS);
    string internal fx;
    bytes32 internal feed;
    bytes32 internal series;
    address internal user;

    function setUp() public {
        vm.skip(!vm.envOr("FORK_TESTS", false));
        vm.createSelectFork("monad_testnet");
        fx = vm.readFile("test/fork/fixtures/btc-hermes.json");
        feed = fx.readBytes32(".feedId");
        series = keccak256(abi.encode(bytes32("BTC"), CADENCE));
        user = vm.addr(USER_PK);
        vm.warp(fx.readUint(".t0") + 2);

        Params memory p = Params(2500, 10_000, 30_000, 970_000, 6000, 500_000e6, 1e6, 1000e6, 1);
        BandReserve.Caps memory caps = BandReserve.Caps(1000e6, 10_000e6, 3600);
        address table = SSTORE2.write(TailTableData.BLOB);
        reserve = new BandReserve(MANAGER, IERC20(TEST_USD), IWindows(WINDOWS), table, p, caps, 0);
        vm.startPrank(ADMIN);
        BandDef[] memory menu = new BandDef[](2);
        (menu[0], menu[1]) = (BandDef(BAND_UP, 0, 0), BandDef(BAND_DOWN, 0, 0));
        reserve.listSeries(series, SeriesTerms(SIGMA / 2, SIGMA * 2, 20_000), menu);
        reserve.setSigmaSigner(vm.addr(SIGNER_PK), true);
        reserve.setRideTerms(RideTerms(3000, 1000, 20, 15));
        reserve.addRideMarket(
            RideMarket(VERIFIER, true, 400_000, 5, 2, feed, 90_000, 2500, 1500, 5000, 14_400, 15_000e6, 1e6, 1000e6)
        );
        ITestUSD(TEST_USD).mint(ADMIN, 1_000_000e6);
        IERC20(TEST_USD).approve(address(reserve), 1_000_000e6);
        reserve.fund(1_000_000e6);
        ITestUSD(TEST_USD).mint(user, 1000e6);
        vm.stopPrank();
        vm.prank(user);
        IERC20(TEST_USD).approve(address(reserve), type(uint256).max);
    }

    function test_realHermesPrintsOpenAWindowAndFillACallAndARide() public {
        uint40 t0 = uint40(fx.readUint(".t0"));
        uint40 t1 = uint40(fx.readUint(".t1"));
        bytes32 windowId = windows.openWindow(series, t0);
        bytes memory update0 = _proof(fx.readBytes(".update0"));
        uint256 fee0 = IPrintVerifier(VERIFIER).fee(update0);
        Print memory open = windows.ensurePrint{value: fee0}(VERIFIER, feed, t0, update0);
        assertEq(open.priceE8, int64(int256(fx.readUint(".price0"))), "the window opens on Pyth's own print");

        vm.warp(t1 - 1);
        Intent memory it =
            Intent(ACTION_OPEN, user, windowId, 0, 0, 10e6, 0, user, reserve.configVersion(), uint64(t1 + 60), 1, 0);
        uint256 ticket = reserve.commit(it, _sign(USER_PK, reserve.hashIntent(it)), _noPermit());
        RideIntent memory ri = RideIntent(
            ACTION_OPEN,
            user,
            0,
            true,
            0,
            10e6,
            400_000,
            0,
            type(int64).max,
            user,
            reserve.configVersion(),
            uint64(t1 + 60),
            2,
            0
        );
        uint256 ride = reserve.commitRide(ri, _sign(USER_PK, reserve.hashRide(ri)), _noPermit());

        vm.warp(t1 + 3);
        bytes memory update1 = _proof(fx.readBytes(".update1"));
        SigmaMark memory mark = SigmaMark(feed, reserve.markMinuteOf(t1), SIGMA, SIGMA);
        bytes memory markSig = _sign(SIGNER_PK, reserve.hashSigmaMark(mark));
        uint256[] memory one = new uint256[](1);
        one[0] = ticket;
        reserve.finalize{value: IPrintVerifier(VERIFIER).fee(update1)}(t1, one, update1, mark, markSig);
        int64 p1 = int64(int256(fx.readUint(".price1")));
        assertEq(reserve.ticketOf(ticket).status, TICKET_OPEN);
        assertEq(reserve.ticketOf(ticket).entryE8, p1, "the call fills at the second print");

        one[0] = ride;
        reserve.finalizeRides(t1, one, ""); // the print is already recorded: no fee, no proof
        Ride memory r = reserve.rideOf(ride);
        assertEq(r.status, RIDE_OPEN);
        assertEq(r.entryE8, p1, "the ride fills at the same unique print");
        reserve.settleBounds(t1, one, "");
        assertEq(reserve.rideOf(ride).status, RIDE_OPEN, "no bound crossed at its own fill print");
        assertEq(IERC20(TEST_USD).balanceOf(address(reserve)), reserve.liabilities(), "every unit has a home");
    }

    /// @dev A proof is `abi.encode(bytes[] updates)`, as the relay wraps what Hermes serves for an instant.
    function _proof(bytes memory update) internal pure returns (bytes memory) {
        bytes[] memory updates = new bytes[](1);
        updates[0] = update;
        return abi.encode(updates);
    }

    function _sign(uint256 pk, bytes32 digest) internal pure returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }

    function _noPermit() internal pure returns (Permit memory p) {}
}
