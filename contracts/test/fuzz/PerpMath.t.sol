// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {Constants as C} from "../../src/libraries/Constants.sol";
import {PerpMath} from "../../src/libraries/PerpMath.sol";
import {Book} from "../../src/libraries/Types.sol";
import {SeedConstants as S} from "../../script/SeedConstants.sol";
import {Fixture} from "../utils/Fixture.sol";

/// @notice PerpMath fuzz: a round trip at one oracle price never profits, and every rounding favours the pool.
contract PerpMathFuzzTest is Fixture {
    uint256 internal constant MIN_PRICE = 1e15;
    uint256 internal constant MAX_PRICE = 1e24;
    uint256 internal constant MAX_NOTIONAL = 1e15;
    uint256 internal constant MAX_SPREAD = 500;

    function setUp() public {
        _deploy(true, MONDAY + 12 * HOUR);
        _seedBooks();
    }

    // ---------------------------------------------------------------- pure maths

    function testFuzz_roundTripSamePriceNeverProfits(uint256 notional, uint256 price, uint256 spread, bool isLong)
        public
        pure
    {
        notional = bound(notional, 1, MAX_NOTIONAL);
        price = bound(price, MIN_PRICE, MAX_PRICE);
        spread = bound(spread, 0, MAX_SPREAD);
        uint256 entry = PerpMath.applySpread(price, spread, isLong);
        uint256 exit = PerpMath.applySpread(price, spread, !isLong);
        uint256 size = PerpMath.sizeFor(notional, entry);
        assertLe(PerpMath.pnl(isLong, size, entry, exit), 0);
        assertLe(PerpMath.pnl(isLong, size, price, price), 0);
    }

    function testFuzz_sizeRoundsDownNotionalRoundsUp(uint256 notional, uint256 price) public pure {
        notional = bound(notional, 1, MAX_NOTIONAL);
        price = bound(price, MIN_PRICE, MAX_PRICE);
        uint256 size = PerpMath.sizeFor(notional, price);
        assertLe(size * price / C.NOTIONAL_SCALE, notional, "never more units than paid for");
        uint256 n = PerpMath.notional(size, price);
        assertGe(n * C.NOTIONAL_SCALE, size * price, "margin basis rounds up");
    }

    function testFuzz_pnlRoundsTowardNegativeInfinity(uint256 size, uint256 entry, uint256 exit, bool isLong)
        public
        pure
    {
        size = bound(size, 1, 1e30);
        entry = bound(entry, MIN_PRICE, MAX_PRICE);
        exit = bound(exit, MIN_PRICE, MAX_PRICE);
        int256 p = PerpMath.pnl(isLong, size, entry, exit);
        int256 diff = isLong ? int256(exit) - int256(entry) : int256(entry) - int256(exit);
        int256 exactScaled = int256(size) * diff;
        assertLe(p * int256(C.NOTIONAL_SCALE), exactScaled, "never above the exact PnL");
    }

    function testFuzz_averageEntryAgainstAccount(uint256 s0, uint256 e0, uint256 ds, uint256 px, bool isLong)
        public
        pure
    {
        s0 = bound(s0, 1, 1e27);
        ds = bound(ds, 1, 1e27);
        e0 = bound(e0, MIN_PRICE, MAX_PRICE);
        px = bound(px, MIN_PRICE, MAX_PRICE);
        uint256 avg = PerpMath.averageEntry(s0, e0, ds, px, isLong);
        uint256 weighted = s0 * e0 + ds * px;
        if (isLong) assertGe(avg * (s0 + ds), weighted, "long entry rounds up");
        else assertLe(avg * (s0 + ds), weighted, "short entry rounds down");
    }

    function testFuzz_fundingNeverDrainsPool(uint256 n, int256 idx, int256 snap) public pure {
        n = bound(n, 0, MAX_NOTIONAL);
        idx = bound(idx, -1e24, 1e24);
        snap = bound(snap, -1e24, 1e24);
        int256 longOwes = PerpMath.fundingOwed(true, n, idx, snap);
        int256 shortOwes = PerpMath.fundingOwed(false, n, idx, snap);
        assertGe(longOwes + shortOwes, 0, "equal opposite legs net >= 0 for the pool");
        assertGe(PerpMath.borrowOwed(n, uint256(bound(idx, 0, 1e24)), 0) * C.WAD, n * uint256(bound(idx, 0, 1e24)));
    }

    function testFuzz_spreadBrackets(uint256 price, uint256 spread) public pure {
        price = bound(price, MIN_PRICE, MAX_PRICE);
        spread = bound(spread, 0, MAX_SPREAD);
        assertGe(PerpMath.applySpread(price, spread, true), price);
        assertLe(PerpMath.applySpread(price, spread, false), price);
    }

    // ---------------------------------------------------------------- engine round trip

    /// @notice Open then close at an unchanged oracle price through SenryoCore: the trader never gains and the pool
    /// plus insurance never lose.
    function testFuzz_engineRoundTripNeverProfits(uint256 notional, bool isLong, uint256 waitBlocks) public {
        uint256 cap = PerpMath.bpsDown(S.LP_SEED_USD6, S.TRADE_CAP_POOL_BPS);
        notional = bound(notional, C.MIN_POSITION_NOTIONAL_USD6, cap);
        waitBlocks = bound(waitBlocks, 0, C.MIN_HOLD_BLOCKS * 2);
        address trader = makeAddr("trader");
        _depositFor(trader, ausd, notional);
        (uint256 poolA0, uint256 poolU0) = core.book(_pool());
        (uint256 insA0,) = core.book(_insurance());

        vm.startPrank(trader);
        core.increase(S.GOLD_MARKET, isLong, notional, isLong ? type(uint256).max : 0, uint64(vm.getBlockTimestamp()));
        vm.roll(vm.getBlockNumber() + waitBlocks);
        core.close(S.GOLD_MARKET, isLong ? 0 : type(uint256).max, uint64(vm.getBlockTimestamp()));
        vm.stopPrank();

        uint256 after_ = core.account(trader).ausd + core.account(trader).usdc;
        assertLe(after_, notional, "trader never profits at an unchanged price");
        (uint256 poolA1, uint256 poolU1) = core.book(_pool());
        (uint256 insA1,) = core.book(_insurance());
        assertGe(poolA1 + poolU1 + insA1, poolA0 + poolU0 + insA0, "pool + insurance never lose");
    }

    function _pool() internal pure returns (Book) {
        return Book.POOL;
    }

    function _insurance() internal pure returns (Book) {
        return Book.INSURANCE;
    }
}
