// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {AccessManaged} from "@openzeppelin/contracts/access/manager/AccessManaged.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {Constants as C} from "../libraries/Constants.sol";
import {Errors} from "../libraries/Errors.sol";
import {Events} from "../libraries/Events.sol";
import {PerpMath} from "../libraries/PerpMath.sol";
import {MarketStatus, PriceView} from "../libraries/Types.sol";
import {AggregatorV3Interface} from "./interfaces/AggregatorV3Interface.sol";
import {IMarketCalendar} from "./interfaces/IMarketCalendar.sol";
import {IPriceSource} from "./interfaces/IPriceSource.sol";

/// @title SessionOracle — Chainlink push-feed adapter with clamp, circuit, 3-round confirm and session calendar.
/// @notice Every read checks: answer > 0; updatedAt ≤ now (future guard → STALE); answeredInRound ≥ roundId;
/// age ≤ heartbeat + FEED_GRACE; |Δ| vs the last accepted ≤ clampBps (reopenClampBps after CLOSED) else CIRCUIT.
/// CIRCUIT exits only by CONFIRM_ROUNDS consecutive rounds within CONFIRM_BAND_BPS spanning ≥ CONFIRM_SECONDS,
/// or by the timelocked `acceptFeedPrice` (which accepts the feed's own answer — never a price argument).
contract SessionOracle is AccessManaged, IPriceSource {
    struct FeedConfig {
        AggregatorV3Interface feed;
        uint8 calendarId;
        uint8 decimals;
        uint32 heartbeat;
        uint16 clampBps;
        uint16 reopenClampBps;
    }

    struct FeedState {
        uint128 lastPrice18;
        uint64 lastUpdatedAt;
        uint64 haltedUntil;
        uint80 lastRoundId;
        bool circuit;
        bool closedSeen;
        MarketStatus lastStatus;
    }

    /// @dev Result of one evaluation (`observe` persists `next`; `peek` discards it).
    struct Eval {
        PriceView view_;
        FeedState next;
        uint80 roundId;
        bool rejected;
        bool accepted;
    }

    struct FeedInit {
        uint8 marketId;
        AggregatorV3Interface feed;
        bytes32 descriptionHash;
        uint8 calendarId;
        uint32 heartbeat;
        uint16 clampBps;
        uint16 reopenClampBps;
    }

    IMarketCalendar public immutable calendar;
    mapping(uint8 marketId => FeedConfig) public feeds;
    mapping(uint8 marketId => FeedState) public states;
    uint8[] public marketIds;

    constructor(address authority, IMarketCalendar calendar_, FeedInit[] memory inits) AccessManaged(authority) {
        if (address(calendar_) == address(0)) revert Errors.ZeroAddress();
        calendar = calendar_;
        for (uint256 i; i < inits.length; ++i) {
            _setFeed(inits[i]);
        }
    }

    // ---------------------------------------------------------------- reads (IPriceSource)

    /// @inheritdoc IPriceSource
    function observe(uint8 marketId) external returns (PriceView memory) {
        Eval memory e = _evaluate(marketId);
        FeedState storage st = states[marketId];
        if (e.rejected) emit Events.PriceRejected(marketId, e.roundId, e.view_.latest18, st.lastPrice18);
        if (e.accepted) emit Events.PriceAccepted(marketId, e.roundId, e.next.lastPrice18, e.next.lastUpdatedAt);
        if (e.next.lastStatus != st.lastStatus) {
            emit Events.MarketStatusChanged(marketId, st.lastStatus, e.next.lastStatus, e.view_.price18);
        }
        states[marketId] = e.next;
        return e.view_;
    }

    /// @inheritdoc IPriceSource
    function peek(uint8 marketId) external view returns (PriceView memory) {
        return _evaluate(marketId).view_;
    }

    /// @inheritdoc IPriceSource
    function allOpen() external view returns (bool) {
        for (uint256 i; i < marketIds.length; ++i) {
            if (_evaluate(marketIds[i]).view_.status != MarketStatus.OPEN) return false;
        }
        return true;
    }

    function marketCount() external view returns (uint256) {
        return marketIds.length;
    }

    // ---------------------------------------------------------------- admin

    /// @notice Add or replace a market's feed (PARAM_ADMIN, timelocked). The feed's description hash is asserted.
    function setFeed(FeedInit calldata init) external restricted {
        _setFeed(init);
    }

    /// @notice Ratify the feed's own current answer and clear the circuit (PARAM_ADMIN, timelocked).
    function acceptFeedPrice(uint8 marketId) external restricted {
        FeedConfig memory cfg = _config(marketId);
        (uint80 roundId, int256 answer,, uint256 updatedAt, uint80 answeredInRound) = cfg.feed.latestRoundData();
        if (answer <= 0 || updatedAt > block.timestamp || answeredInRound < roundId) revert Errors.FeedAnswerInvalid();
        FeedState storage st = states[marketId];
        st.lastPrice18 = uint128(_normalize(answer, cfg.decimals));
        st.lastUpdatedAt = uint64(updatedAt);
        st.lastRoundId = roundId;
        st.circuit = false;
        st.closedSeen = false;
        emit Events.PriceAccepted(marketId, roundId, st.lastPrice18, st.lastUpdatedAt);
    }

    /// @notice Halt a market (GUARDIAN, instant). Auto-expires after MAX_PAUSE_SECONDS.
    function halt(uint8 marketId) external restricted {
        _config(marketId);
        uint64 until = uint64(block.timestamp) + C.MAX_PAUSE_SECONDS;
        states[marketId].haltedUntil = until;
        emit Events.MarketHalted(marketId, until);
    }

    /// @notice Lift a halt early (GUARDIAN).
    function unhalt(uint8 marketId) external restricted {
        states[marketId].haltedUntil = 0;
        emit Events.MarketHalted(marketId, 0);
    }

    // ---------------------------------------------------------------- evaluation

    function _evaluate(uint8 marketId) internal view returns (Eval memory e) {
        FeedConfig memory cfg = _config(marketId);
        FeedState memory st = states[marketId];
        e.next = st;
        uint256 answer18;
        uint256 updatedAt;
        bool valid;
        (valid, e.roundId, answer18, updatedAt) = _latest(cfg);
        e.view_.latest18 = answer18;
        bool open = calendar.isOpen(cfg.calendarId, block.timestamp);
        bool reopening = open && !calendar.isOpen(cfg.calendarId, block.timestamp - C.REOPEN_WINDOW);
        MarketStatus status;

        if (st.haltedUntil > block.timestamp) {
            status = MarketStatus.HALTED;
        } else if (!valid || block.timestamp - updatedAt > uint256(cfg.heartbeat) + C.FEED_GRACE) {
            status = MarketStatus.STALE;
        } else if (!open) {
            status = MarketStatus.CLOSED;
            e.next.closedSeen = true;
        } else if (e.roundId == st.lastRoundId && st.lastPrice18 != 0) {
            status = st.circuit ? MarketStatus.CIRCUIT : (reopening ? MarketStatus.REOPENING : MarketStatus.OPEN);
        } else if (st.lastPrice18 == 0 || _withinClamp(cfg, st, answer18, reopening)) {
            if (st.circuit && !_confirmed(cfg, e.roundId, answer18, updatedAt)) {
                status = MarketStatus.CIRCUIT;
            } else {
                _accept(e, answer18, updatedAt);
                status = reopening ? MarketStatus.REOPENING : MarketStatus.OPEN;
            }
        } else if (_confirmed(cfg, e.roundId, answer18, updatedAt)) {
            _accept(e, answer18, updatedAt);
            status = reopening ? MarketStatus.REOPENING : MarketStatus.OPEN;
        } else {
            status = MarketStatus.CIRCUIT;
            e.rejected = !st.circuit;
            e.next.circuit = true;
        }

        e.next.lastStatus = status;
        e.view_.status = status;
        e.view_.price18 = e.next.lastPrice18;
        e.view_.updatedAt = e.next.lastUpdatedAt;
        uint256 age = e.next.lastUpdatedAt == 0 ? 0 : block.timestamp - e.next.lastUpdatedAt;
        e.view_.spreadBps =
            uint16(status == MarketStatus.CLOSED ? PerpMath.closedSpreadBps(age) : PerpMath.ageSpreadBps(age));
    }

    function _accept(Eval memory e, uint256 answer18, uint256 updatedAt) private pure {
        e.accepted = true;
        e.next.lastPrice18 = uint128(answer18);
        e.next.lastUpdatedAt = uint64(updatedAt);
        e.next.lastRoundId = e.roundId;
        e.next.circuit = false;
        e.next.closedSeen = false;
    }

    function _withinClamp(FeedConfig memory cfg, FeedState memory st, uint256 answer18, bool reopening)
        private
        pure
        returns (bool)
    {
        uint256 clamp = (st.closedSeen || reopening) ? cfg.reopenClampBps : cfg.clampBps;
        return _withinBand(answer18, st.lastPrice18, clamp);
    }

    /// @dev ≥ CONFIRM_ROUNDS consecutive rounds ending at `roundId`, all valid, within CONFIRM_BAND_BPS of the latest
    /// answer, spanning ≥ CONFIRM_SECONDS. Stateless, so `peek` and `observe` agree.
    function _confirmed(FeedConfig memory cfg, uint80 roundId, uint256 answer18, uint256 updatedAt)
        private
        view
        returns (bool)
    {
        uint256 oldest = updatedAt;
        uint80 id = roundId;
        uint256 count = 1;
        while (count < C.CONFIRM_LOOKBACK_ROUNDS && id != 0) {
            if (count >= C.CONFIRM_ROUNDS && updatedAt - oldest >= C.CONFIRM_SECONDS) return true;
            --id;
            try cfg.feed.getRoundData(id) returns (uint80 rid, int256 a, uint256, uint256 at, uint80 air) {
                if (a <= 0 || at == 0 || air < rid || at > oldest) break;
                if (!_withinBand(_normalize(a, cfg.decimals), answer18, C.CONFIRM_BAND_BPS)) break;
                oldest = at;
                ++count;
            } catch {
                break;
            }
        }
        return count >= C.CONFIRM_ROUNDS && updatedAt - oldest >= C.CONFIRM_SECONDS;
    }

    function _latest(FeedConfig memory cfg)
        private
        view
        returns (bool valid, uint80 roundId, uint256 answer18, uint256 updatedAt)
    {
        try cfg.feed.latestRoundData() returns (uint80 rid, int256 answer, uint256, uint256 at, uint80 air) {
            roundId = rid;
            updatedAt = at;
            valid = answer > 0 && at != 0 && at <= block.timestamp && air >= rid;
            if (answer > 0) answer18 = _normalize(answer, cfg.decimals);
        } catch {
            valid = false;
        }
    }

    function _withinBand(uint256 a, uint256 b, uint256 bandBps) private pure returns (bool) {
        uint256 diff = a > b ? a - b : b - a;
        return diff <= Math.mulDiv(b, bandBps, C.BPS);
    }

    function _normalize(int256 answer, uint8 decimals) private pure returns (uint256) {
        return uint256(answer) * C.DECIMAL_BASE ** (C.PRICE_DECIMALS - decimals);
    }

    function _config(uint8 marketId) private view returns (FeedConfig memory cfg) {
        cfg = feeds[marketId];
        if (address(cfg.feed) == address(0)) revert Errors.UnknownMarket(marketId);
    }

    function _setFeed(FeedInit memory init) private {
        if (address(init.feed) == address(0)) revert Errors.ZeroAddress();
        bytes32 actual = keccak256(bytes(init.feed.description()));
        if (actual != init.descriptionHash) revert Errors.DescriptionMismatch(init.descriptionHash, actual);
        uint8 dec = init.feed.decimals();
        if (dec > C.PRICE_DECIMALS) revert Errors.FeedDecimalsUnsupported(dec);
        if (init.clampBps == 0 || init.reopenClampBps < init.clampBps || init.heartbeat == 0) {
            revert Errors.InvalidParams();
        }
        if (address(feeds[init.marketId].feed) == address(0)) marketIds.push(init.marketId);
        feeds[init.marketId] =
            FeedConfig(init.feed, init.calendarId, dec, init.heartbeat, init.clampBps, init.reopenClampBps);
        states[init.marketId] = FeedState(0, 0, 0, 0, false, false, MarketStatus.STALE);
        emit Events.FeedSet(init.marketId, address(init.feed), init.calendarId, init.clampBps, init.reopenClampBps);
    }
}
