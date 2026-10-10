// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {BandMath} from "../../src/markets/BandMath.sol";
import {IBandReserve} from "../../src/markets/interfaces/IBandReserve.sol";
import "../../src/markets/MarketTypes.sol";
import {MarketsBase} from "./MarketsBase.t.sol";

/// @notice D-309: a series is listed once, in one call, and its packed menu reads back exactly — a ticket's band index
///         must always decode to the band it was sold as.
contract ListingTest is MarketsBase {
    bytes32 internal constant ETH = bytes32("ETH");

    bytes32 internal ethSeries;

    function setUp() public override {
        super.setUp();
        PolicyVersion memory v0;
        v0.validUntil = OPEN_ENDED;
        v0.primary = PrintSource(address(verifier), keccak256("ETH/USD"));
        ethSeries = windows.registerSeries(ETH, CADENCE, 0, v0);
    }

    function test_listOnceWithTermsAndMenu() public {
        BandDef[] memory menu = fullMenu();
        list(ethSeries, menu);
        BandDef[] memory got = reserve.menuOf(ethSeries);
        assertEq(got.length, menu.length);
        for (uint256 i; i < menu.length; ++i) {
            assertEq(abi.encode(got[i]), abi.encode(menu[i]));
        }
        SeriesTerms memory t = reserve.termsOf(ethSeries);
        assertEq(abi.encode(t), abi.encode(SeriesTerms(SIGMA, SIGMA / 2, SIGMA * 2, H50)));

        vm.expectRevert(abi.encodeWithSelector(IBandReserve.SeriesAlreadyListed.selector, ethSeries));
        list(ethSeries, menu);
    }

    function test_refusesBadListings() public {
        BandDef[] memory menu = fullMenu();
        vm.expectRevert(abi.encodeWithSelector(IBandReserve.UnknownSeries.selector, bytes32("nope")));
        reserve.listSeries(bytes32("nope"), SeriesTerms(SIGMA, SIGMA, SIGMA, H50), menu);

        SeriesTerms[5] memory bad = [
            SeriesTerms(SIGMA, 0, SIGMA, H50), // no floor
            SeriesTerms(SIGMA, SIGMA + 1, SIGMA * 2, H50), // σ under its floor
            SeriesTerms(SIGMA, SIGMA, SIGMA - 1, H50), // σ over its cap
            SeriesTerms(SIGMA, SIGMA, MAX_SIGMA_E8 + 1, H50), // cap over the chain's bound
            SeriesTerms(SIGMA, SIGMA, SIGMA, MAX_HALF_SPREAD_E6 + 1) // spread over the chain's bound
        ];
        for (uint256 i; i < bad.length; ++i) {
            vm.expectRevert(IBandReserve.BadParams.selector);
            reserve.listSeries(ethSeries, bad[i], menu);
        }
        SeriesTerms memory ok = SeriesTerms(SIGMA, SIGMA, SIGMA, H50);
        vm.expectRevert(IBandReserve.BadParams.selector);
        reserve.listSeries(ethSeries, ok, new BandDef[](0));
        vm.expectRevert(IBandReserve.BadParams.selector);
        reserve.listSeries(ethSeries, ok, new BandDef[](MAX_BANDS + 1));
        menu[2] = BandDef(BAND_RANGE, 0, 15); // a range needs both offsets
        vm.expectRevert(IBandReserve.BadParams.selector);
        reserve.listSeries(ethSeries, ok, menu);
    }

    function test_addBandAppendsUpToEight() public {
        vm.expectRevert(abi.encodeWithSelector(IBandReserve.SeriesNotListed.selector, ethSeries));
        reserve.addBand(ethSeries, BandDef(BAND_UP, 0, 0));

        BandDef[] memory menu = new BandDef[](2);
        menu[0] = BandDef(BAND_UP, 0, 0);
        menu[1] = BandDef(BAND_DOWN, 0, 0);
        list(ethSeries, menu);
        for (uint16 i = 2; i < MAX_BANDS; ++i) {
            reserve.addBand(ethSeries, BandDef(BAND_MOONSHOT, 10 * i, 0));
        }
        BandDef[] memory got = reserve.menuOf(ethSeries);
        assertEq(got.length, MAX_BANDS);
        assertEq(abi.encode(got[1]), abi.encode(menu[1]));
        assertEq(abi.encode(got[MAX_BANDS - 1]), abi.encode(BandDef(BAND_MOONSHOT, 70, 0)));
        vm.expectRevert(IBandReserve.BadParams.selector);
        reserve.addBand(ethSeries, BandDef(BAND_UP, 0, 0));
    }

    function test_sigmaStaysInsideItsBounds() public {
        vm.expectRevert(IBandReserve.BadParams.selector);
        reserve.setSigma(seriesId, SIGMA * 2 + 1);
        vm.expectRevert(IBandReserve.BadParams.selector);
        reserve.setSigma(seriesId, SIGMA / 2 - 1);
        reserve.setSigma(seriesId, SIGMA * 2);
        assertEq(reserve.termsOf(seriesId).sigmaE8, SIGMA * 2);
    }

    function testFuzz_packRoundTrips(uint8 kind, uint16 lowBps, uint16 highBps) public pure {
        BandDef memory d = BandDef(kind, lowBps, highBps);
        assertEq(abi.encode(BandMath.unpack(BandMath.pack(d))), abi.encode(d));
    }

    function fullMenu() internal pure returns (BandDef[] memory menu) {
        menu = new BandDef[](5);
        menu[0] = BandDef(BAND_UP, 0, 0);
        menu[1] = BandDef(BAND_DOWN, 0, 0);
        menu[2] = BandDef(BAND_RANGE, 8, 8);
        menu[3] = BandDef(BAND_MOONSHOT, 15, 0);
        menu[4] = BandDef(BAND_CRASH, 15, 0);
    }
}
