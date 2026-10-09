// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {Test} from "forge-std/Test.sol";
import {AccessManager} from "@openzeppelin/contracts/access/manager/AccessManager.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IMarketCalendar} from "../../src/oracle/interfaces/IMarketCalendar.sol";
import {BandReserve} from "../../src/markets/BandReserve.sol";
import {PythPrintVerifier} from "../../src/markets/PythPrintVerifier.sol";
import {Windows} from "../../src/markets/Windows.sol";
import {IPyth} from "../../src/markets/interfaces/IPyth.sol";
import {IWindows} from "../../src/markets/interfaces/IWindows.sol";
import "../../src/markets/MarketTypes.sol";
import {BlockingUSD} from "./mocks/BlockingUSD.sol";
import {MockPyth} from "./mocks/MockPyth.sol";

/// @notice One BTC 5-minute series with Up / Down / Range ±0.15 % / Moonshot +0.3 %, a funded pool and a funded caller.
abstract contract MarketsBase is Test {
    bytes32 internal constant BTC = bytes32("BTC");
    bytes32 internal constant BTC_FEED = keccak256("BTC/USD");
    uint32 internal constant CADENCE = 300;
    uint16 internal constant GRACE = 5;
    uint16 internal constant MAX_CONF_BPS = 25;
    uint32 internal constant ADMISSION = 300;
    int32 internal constant EXPO = -8;
    int64 internal constant K = 60_000e8;
    uint64 internal constant CONF = 1e8; // $1 on $60,000: well inside 25 bps
    /// @dev ≈ 50 % a year per √second (0.5 / √(365 × 86,400)) × 1e8.
    uint64 internal constant SIGMA = 8900;
    uint256 internal constant POOL = 100_000e6;
    uint256 internal constant WALLET = 10_000e6;
    uint64 internal constant STAKE = 10e6;
    uint40 internal constant T0 = 1_800_000_000 - (1_800_000_000 % 300);
    uint8 internal constant UP = 0;
    uint8 internal constant DOWN = 1;
    uint8 internal constant RANGE = 2;
    uint8 internal constant MOON = 3;
    uint256 internal constant OWNER_PK = 0xA11CE;
    uint256 internal constant DELEGATE_PK = 0xDE1E;

    AccessManager internal manager;
    MockPyth internal pyth;
    PythPrintVerifier internal verifier;
    Windows internal windows;
    BlockingUSD internal usd;
    BandReserve internal reserve;
    bytes32 internal seriesId;
    bytes32 internal windowId;
    address internal owner;
    address internal delegate;
    uint256 internal nextNonce;

    function setUp() public virtual {
        vm.warp(T0 - 10);
        manager = new AccessManager(address(this));
        pyth = new MockPyth();
        verifier = new PythPrintVerifier(IPyth(address(pyth)), GRACE, MAX_CONF_BPS, ADMISSION);
        windows = new Windows(address(manager), IMarketCalendar(address(0)));
        usd = new BlockingUSD(address(manager));
        reserve = new BandReserve(address(manager), IERC20(address(usd)), IWindows(address(windows)), params(), caps());

        PolicyVersion memory v0;
        v0.validUntil = OPEN_ENDED;
        v0.primary = PrintSource(address(verifier), BTC_FEED);
        seriesId = windows.registerSeries(BTC, CADENCE, 0, v0);
        reserve.setSigma(seriesId, SIGMA);
        reserve.addBand(seriesId, BandDef(BAND_UP, 0, 0));
        reserve.addBand(seriesId, BandDef(BAND_DOWN, 0, 0));
        reserve.addBand(seriesId, BandDef(BAND_RANGE, 15, 15));
        reserve.addBand(seriesId, BandDef(BAND_MOONSHOT, 30, 0));

        usd.mint(address(this), POOL);
        usd.approve(address(reserve), POOL);
        reserve.fund(POOL);

        owner = vm.addr(OWNER_PK);
        delegate = vm.addr(DELEGATE_PK);
        usd.mint(owner, WALLET);
        vm.prank(owner);
        usd.approve(address(reserve), WALLET);

        windowId = windows.openWindow(seriesId, T0);
        vm.warp(T0 + 1);
        record(T0, K);
    }

    function params() internal pure virtual returns (Params memory) {
        return Params({
            halfSpreadE6: 20_000,
            maxSurchargeE6: 10_000,
            minProbE6: 30_000,
            maxProbE6: 970_000,
            maxExposureBps: 6000,
            maxExpiryReserved: 50_000e6,
            minStake: 1e6,
            maxStake: 1000e6
        });
    }

    function caps() internal pure returns (BandReserve.Caps memory) {
        return BandReserve.Caps({maxPerCallCap: 1000e6, maxSessionCap: 10_000e6, maxSessionSec: 3600});
    }

    // ------------------------------------------------------------------------------------------------ prints

    /// @dev Stores the unique print for instant `t` (previous print the second before) and returns its proof.
    function printAt(uint40 t, int64 price) internal returns (bytes memory) {
        return pyth.push(BTC_FEED, t, t - 1, price, CONF, EXPO);
    }

    function record(uint40 t, int64 price) internal {
        bytes memory proof = printAt(t, price);
        windows.recordPrint{value: pyth.FEE()}(address(verifier), BTC_FEED, t, proof);
    }

    // ------------------------------------------------------------------------------------------------ calls

    function intent(uint8 action, uint8 band, uint256 ticketId, uint64 amount, uint64 limit)
        internal
        returns (Intent memory it)
    {
        it = Intent({
            action: action,
            owner: owner,
            windowId: windowId,
            band: band,
            ticketId: ticketId,
            amount: amount,
            limit: limit,
            recipient: owner,
            configVersion: reserve.configVersion(),
            deadline: uint64(block.timestamp + 60),
            nonce: nextNonce++,
            epoch: reserve.epochOf(owner)
        });
    }

    function sign(uint256 pk, Intent memory it) internal view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, reserve.hashIntent(it));
        return abi.encodePacked(r, s, v);
    }

    function noPermit() internal pure returns (Permit memory p) {}

    // ------------------------------------------------------------------------------------------------ sessions

    function grant(uint64 perCall, uint64 budget, uint40 expiry) internal {
        (SessionGrant memory g, bytes memory sig) = signedGrant(perCall, budget, expiry);
        reserve.grantSession(g, sig, noPermit());
    }

    function signedGrant(uint64 perCall, uint64 budget, uint40 expiry)
        internal
        returns (SessionGrant memory g, bytes memory sig)
    {
        g = SessionGrant({
            owner: owner,
            delegate: delegate,
            perCallCap: perCall,
            sessionCap: budget,
            expiry: expiry,
            epoch: reserve.epochOf(owner),
            nonce: nextNonce++
        });
        bytes32 structHash = keccak256(
            abi.encode(
                reserve.GRANT_TYPEHASH(), g.owner, g.delegate, g.perCallCap, g.sessionCap, g.expiry, g.epoch, g.nonce
            )
        );
        (uint8 v, bytes32 r, bytes32 s) =
            vm.sign(OWNER_PK, keccak256(abi.encodePacked("\x19\x01", reserve.domainSeparator(), structHash)));
        sig = abi.encodePacked(r, s, v);
    }

    function open(uint8 band, uint64 stake) internal returns (uint256 id) {
        Intent memory it = intent(ACTION_OPEN, band, 0, stake, 0);
        id = reserve.commit(it, sign(OWNER_PK, it), noPermit());
    }

    function closeShares(uint256 id, uint64 shares) internal {
        Intent memory it = intent(ACTION_CLOSE, 0, id, shares, 0);
        reserve.commit(it, sign(OWNER_PK, it), noPermit());
    }

    /// @dev Moves to just after the ticket's fill instant and fills it at `price`.
    function fill(uint256 id, int64 price) internal {
        uint40 target = reserve.ticketOf(id).target;
        if (block.timestamp <= target) vm.warp(target + 1);
        bytes memory proof = printAt(target, price);
        uint256[] memory ids = new uint256[](1);
        ids[0] = id;
        reserve.finalize{value: pyth.FEE()}(target, ids, proof);
    }

    function settle(int64 closePrice) internal {
        vm.warp(T0 + CADENCE + 1);
        record(T0 + CADENCE, closePrice);
        windows.resolve(windowId);
        reserve.settleWindow(windowId);
    }

    function claim(uint256 id) internal {
        uint256[] memory ids = new uint256[](1);
        ids[0] = id;
        reserve.claimFor(ids);
    }

    // ------------------------------------------------------------------------------------------------ checks

    /// @dev D-264: every unit has a home, and the token balance covers all of it exactly (nobody sent extra).
    function assertSolvent() internal view {
        assertEq(usd.balanceOf(address(reserve)), reserve.liabilities(), "balance == liabilities");
        assertLe(reserve.reserved() * BPS, (reserve.liquid() + reserve.reserved()) * 6000, "exposure cap");
    }
}
