// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {CommonBase} from "forge-std/Base.sol";
import {StdUtils} from "forge-std/StdUtils.sol";
import "../../src/markets/MarketTypes.sol";
import {MarketsBase} from "./MarketsBase.t.sol";

/// @notice What the handler asks the fixture to do (the fixture owns the clock, the prints and the caller's key).
interface ISolvencyDriver {
    function canTrade() external view returns (bool);
    function handlerOpen(uint8 band, uint64 stake, int64 move) external returns (uint256);
    function handlerClose(uint256 id, uint256 pct, int64 move) external;
    function handlerRoll(int64 closeMove, uint256[] calldata ids) external;
}

/// @notice Random opens, cash-outs and window rolls at random prices.
contract SolvencyHandler is CommonBase, StdUtils {
    ISolvencyDriver internal immutable base;
    uint256[] public live;
    uint256 public windowsSettled;

    constructor(ISolvencyDriver base_) {
        base = base_;
    }

    function liveCount() external view returns (uint256) {
        return live.length;
    }

    function openCall(uint8 bandSeed, uint64 stakeSeed, int64 moveSeed) external {
        if (!base.canTrade()) return;
        uint8 band = uint8(bound(bandSeed, 0, 3));
        uint64 stake = uint64(bound(stakeSeed, 1e6, 200e6));
        int64 move = int64(bound(moveSeed, -40e8, 40e8));
        uint256 id = base.handlerOpen(band, stake, move);
        if (id != 0) live.push(id);
    }

    function cashOut(uint256 pick, uint256 fracSeed, int64 moveSeed) external {
        if (live.length == 0 || !base.canTrade()) return;
        uint256 id = live[bound(pick, 0, live.length - 1)];
        base.handlerClose(id, bound(fracSeed, 1, 100), int64(bound(moveSeed, -40e8, 40e8)));
    }

    function roll(int64 closeMoveSeed) external {
        base.handlerRoll(int64(bound(closeMoveSeed, -60e8, 60e8)), live);
        delete live;
        windowsSettled += 1;
    }
}

/// forge-config: default.invariant.runs = 64
/// forge-config: default.invariant.depth = 64
contract SolvencyInvariantTest is MarketsBase, ISolvencyDriver {
    SolvencyHandler internal handler;

    function setUp() public override {
        super.setUp();
        handler = new SolvencyHandler(ISolvencyDriver(address(this)));
        targetContract(address(handler));
    }

    /// @dev D-264: every unit of collateral has exactly one home.
    function invariant_balanceCoversEveryLiability() public view {
        assertEq(usd.balanceOf(address(reserve)), reserve.liabilities());
    }

    function invariant_exposureWithinCap() public view {
        assertLe(reserve.reserved() * BPS, (reserve.liquid() + reserve.reserved()) * params().maxExposureBps);
    }

    /// @dev The window's band totals are exactly the sum over its open tickets, so settlement moves the right money.
    function invariant_bandTotalsMatchTickets() public view {
        uint256 n = reserve.ticketCount();
        uint256[4] memory payout;
        uint256[4] memory stake;
        for (uint256 id = 1; id <= n; ++id) {
            Ticket memory t = reserve.ticketOf(id);
            if (t.windowId != windowId || t.status != TICKET_OPEN) continue;
            payout[t.band] += t.payout;
            stake[t.band] += t.stake;
            assertLe(t.stake, t.payout, "basis never above shares");
        }
        if (reserve.windowSettled(windowId)) return;
        for (uint8 b; b < 4; ++b) {
            (uint128 p, uint128 s) = reserve.bandTotals(windowId, b);
            assertEq(p, payout[b]);
            assertEq(s, stake[b]);
        }
    }

    // ------------------------------------------------------------------------------------------------ handler hooks

    function canTrade() external view returns (bool) {
        return block.timestamp + LOCKOUT_SEC + MIN_HOLD_SEC + 2 < windowStart() + CADENCE;
    }

    function handlerOpen(uint8 band, uint64 stake, int64 move) external returns (uint256 id) {
        if (usd.balanceOf(owner) < stake) usd.mint(owner, WALLET);
        vm.prank(owner);
        usd.approve(address(reserve), type(uint256).max);
        id = open(band, stake);
        fill(id, kNow() + move);
        if (reserve.ticketOf(id).status != TICKET_OPEN) return 0;
    }

    function handlerClose(uint256 id, uint256 pct, int64 move) external {
        Ticket memory t = reserve.ticketOf(id);
        if (t.status != TICKET_OPEN || t.windowId != windowId) return;
        vm.warp(block.timestamp + MIN_HOLD_SEC);
        if (!this.canTrade()) return;
        uint64 shares = uint64(uint256(t.payout) * pct / 100);
        if (shares == 0) return;
        closeShares(id, shares);
        fill(id, kNow() + move);
    }

    function handlerRoll(int64 closeMove, uint256[] calldata ids) external {
        uint40 start = windowStart();
        vm.warp(start + CADENCE + 1);
        record(start + CADENCE, kNow() + closeMove);
        windows.resolve(windowId);
        reserve.settleWindow(windowId);
        for (uint256 i; i < ids.length; i += MAX_BATCH) {
            uint256 end = i + MAX_BATCH < ids.length ? i + MAX_BATCH : ids.length;
            uint256[] memory batch = new uint256[](end - i);
            for (uint256 j = i; j < end; ++j) {
                batch[j - i] = ids[j];
            }
            reserve.claimFor(batch);
        }
        // Next window starts on the close print (shared by key: no copy step).
        windowId = windows.openWindow(seriesId, start + CADENCE);
        vm.warp(start + CADENCE + 2);
    }

    function windowStart() internal view returns (uint40) {
        return windows.windowOf(windowId).start;
    }

    function kNow() internal view returns (int64) {
        return windows.openPrintOf(windowId).priceE8;
    }
}
