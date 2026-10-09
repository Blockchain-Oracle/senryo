// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {Test} from "forge-std/Test.sol";
import {AccessManager} from "@openzeppelin/contracts/access/manager/AccessManager.sol";
import {BasketPrintVerifier} from "../../src/markets/BasketPrintVerifier.sol";
import {PythPrintVerifier} from "../../src/markets/PythPrintVerifier.sol";
import {Windows} from "../../src/markets/Windows.sol";
import {IPyth} from "../../src/markets/interfaces/IPyth.sol";
import {IMarketCalendar} from "../../src/oracle/interfaces/IMarketCalendar.sol";
import "../../src/markets/MarketTypes.sol";
import {MockPyth} from "./mocks/MockPyth.sol";

/// @notice Baskets (D-286): the points index over members' unique prints, its refusals, and a basket series on Windows.
contract BasketTest is Test {
    bytes32 internal constant BTC = keccak256("BTC/USD");
    bytes32 internal constant ETH = keccak256("ETH/USD");
    bytes32 internal constant SOL = keccak256("SOL/USD");
    int64 internal constant BTC_BASE = 80_000e8;
    int64 internal constant ETH_BASE = 2500e8;
    int64 internal constant SOL_BASE = 120e8;
    int32 internal constant EXPO = -8;
    uint16 internal constant GRACE = 5;
    uint16 internal constant MAX_CONF_BPS = 25;
    uint32 internal constant ADMISSION = 300;
    uint40 internal constant T = 1_800_000_000 - (1_800_000_000 % 300);
    /// 1,000 points × 1e8.
    int64 internal constant BASE_INDEX = 1000e8;

    MockPyth internal pyth;
    BasketPrintVerifier internal basket;

    function setUp() public {
        vm.warp(T + 1);
        pyth = new MockPyth();
        basket = new BasketPrintVerifier(IPyth(address(pyth)), GRACE, MAX_CONF_BPS, ADMISSION);
    }

    function majors() internal pure returns (BasketPrintVerifier.Basket memory def) {
        def.ids = new bytes32[](3);
        def.weightsBps = new uint16[](3);
        def.basesE8 = new int64[](3);
        (def.ids[0], def.ids[1], def.ids[2]) = (BTC, ETH, SOL);
        (def.weightsBps[0], def.weightsBps[1], def.weightsBps[2]) = (4000, 3000, 3000);
        (def.basesE8[0], def.basesE8[1], def.basesE8[2]) = (BTC_BASE, ETH_BASE, SOL_BASE);
    }

    /// @dev Every member's unique print at `t` (previous print the second before), as one proof.
    function proofAt(BasketPrintVerifier.Basket memory def, int64[3] memory prices, uint64 confBpsOf0)
        internal
        returns (bytes memory)
    {
        bytes[] memory updates = new bytes[](3);
        for (uint256 i; i < 3; ++i) {
            // forge-lint: disable-next-line(unsafe-typecast)
            uint64 conf = i == 0 ? (uint64(prices[0]) * confBpsOf0) / 10_000 : uint64(prices[i]) / 10_000;
            pyth.push(def.ids[i], T, T - 1, prices[i], conf, EXPO);
            updates[i] = abi.encode(def.ids[i], uint64(T));
        }
        return abi.encode(def, updates);
    }

    function test_atBasePricesItIsAThousandPoints() public {
        BasketPrintVerifier.Basket memory def = majors();
        bytes memory proof = proofAt(def, [BTC_BASE, ETH_BASE, SOL_BASE], 1);
        (int64 price,, uint40 at) = basket.verifyPrint{value: 3}(proof, basket.basketId(def), T);
        assertEq(price, BASE_INDEX);
        assertEq(at, T);
    }

    function test_aMemberMoveMovesTheIndexByItsWeight() public {
        BasketPrintVerifier.Basket memory def = majors();
        // BTC +10 % at 40 % weight: +4 % → 1,040 points.
        bytes memory proof = proofAt(def, [int64(88_000e8), ETH_BASE, SOL_BASE], 1);
        (int64 price,,) = basket.verifyPrint{value: 3}(proof, basket.basketId(def), T);
        assertEq(price, 1040e8);
    }

    function test_aMissingMemberRefusesTheSlot() public {
        BasketPrintVerifier.Basket memory def = majors();
        pyth.push(BTC, T, T - 1, BTC_BASE, 1e8, EXPO);
        pyth.push(ETH, T, T - 1, ETH_BASE, 1e6, EXPO);
        bytes[] memory updates = new bytes[](2);
        updates[0] = abi.encode(BTC, uint64(T));
        updates[1] = abi.encode(ETH, uint64(T));
        bytes32 id = basket.basketId(def);
        vm.expectRevert(MockPyth.PriceFeedNotFoundWithinRange.selector);
        basket.verifyPrint{value: 2}(abi.encode(def, updates), id, T);
    }

    function test_oneWideMemberRefusesTheBasket() public {
        BasketPrintVerifier.Basket memory def = majors();
        bytes memory proof = proofAt(def, [BTC_BASE, ETH_BASE, SOL_BASE], 30); // 30 bps > 25
        bytes32 id = basket.basketId(def);
        vm.expectRevert(
            abi.encodeWithSelector(PythPrintVerifier.LowQuality.selector, BTC_BASE, uint64(BTC_BASE) * 30 / 10_000)
        );
        basket.verifyPrint{value: 3}(proof, id, T);
    }

    function test_theFeedIdMustBeTheDefinition() public {
        BasketPrintVerifier.Basket memory def = majors();
        bytes memory proof = proofAt(def, [BTC_BASE, ETH_BASE, SOL_BASE], 1);
        vm.expectRevert();
        basket.verifyPrint{value: 3}(proof, keccak256("another basket"), T);
    }

    function test_weightsMustSumToTheWhole() public {
        BasketPrintVerifier.Basket memory def = majors();
        def.weightsBps[2] = 2999;
        bytes memory proof = proofAt(def, [BTC_BASE, ETH_BASE, SOL_BASE], 1);
        bytes32 id = basket.basketId(def);
        vm.expectRevert(BasketPrintVerifier.BadBasket.selector);
        basket.verifyPrint{value: 3}(proof, id, T);
    }

    function test_aBasketSeriesRecordsItsPrintOnWindows() public {
        AccessManager manager = new AccessManager(address(this));
        Windows windows = new Windows(address(manager), IMarketCalendar(address(0)));
        BasketPrintVerifier.Basket memory def = majors();
        bytes32 id = basket.basketId(def);
        PolicyVersion memory v0;
        v0.validUntil = OPEN_ENDED;
        v0.primary = PrintSource(address(basket), id);
        windows.registerSeries(bytes32("MAJORS"), 300, 0, v0);
        bytes memory proof = proofAt(def, [int64(88_000e8), ETH_BASE, SOL_BASE], 1);
        windows.recordPrint{value: 3}(address(basket), id, T, proof);
        assertEq(windows.printOf(address(basket), id, T).priceE8, 1040e8);
    }
}
