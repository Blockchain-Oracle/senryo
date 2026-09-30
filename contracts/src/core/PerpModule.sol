// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {Constants as C} from "../libraries/Constants.sol";
import {Errors} from "../libraries/Errors.sol";
import {Events} from "../libraries/Events.sol";
import {PerpMath} from "../libraries/PerpMath.sol";
import {Book, MarketParams, MarketState, MarketStatus, Position, PositionKind, PriceView} from "../libraries/Types.sol";
import {AccountLedger} from "./AccountLedger.sol";

/// @title PerpModule — one net position per (user, market) against the LP pool at the oracle price.
/// @notice Opens need OPEN status; every other status is reduce-only (risk-math.md status matrix).
/// A profitable reduce waits MIN_HOLD_BLOCKS after the last increase (anti-flash, block numbers not timestamps).
abstract contract PerpModule is AccountLedger {
    using SafeCast for uint256;
    using SafeCast for int256;

    /// @dev Everything `PositionUpdated` carries, kept in memory to stay off the stack.
    struct Fill {
        PositionKind kind;
        bool isLong;
        uint256 sizeDelta;
        uint256 execPrice;
        uint256 oraclePrice;
        uint256 fee;
        int256 realizedPnl;
        int256 funding;
        uint256 borrow;
    }

    // ---------------------------------------------------------------- user entry points

    function increase(uint8 marketId, bool isLong, uint256 notionalUsd6, uint256 acceptablePrice18, uint64 deadline)
        external
        nonReentrant
    {
        _increase(msg.sender, marketId, isLong, notionalUsd6, acceptablePrice18, deadline);
    }

    /// @notice IntentRouter only (ROUTER_ROLE): open for a user whose EIP-712 OpenOrder the router verified.
    function increaseFor(
        address user,
        uint8 marketId,
        bool isLong,
        uint256 notionalUsd6,
        uint256 acceptablePrice18,
        uint64 deadline
    ) external nonReentrant restricted {
        _increase(user, marketId, isLong, notionalUsd6, acceptablePrice18, deadline);
    }

    function decrease(uint8 marketId, uint256 sizeDelta, uint256 acceptablePrice18, uint64 deadline)
        external
        nonReentrant
    {
        _decrease(msg.sender, marketId, sizeDelta, acceptablePrice18, deadline, PositionKind.DECREASE);
    }

    function close(uint8 marketId, uint256 acceptablePrice18, uint64 deadline) external nonReentrant {
        uint256 size = _positions[msg.sender][marketId].size;
        _decrease(msg.sender, marketId, size, acceptablePrice18, deadline, PositionKind.CLOSE);
    }

    /// @notice Preview an increase at the current oracle view (no state change).
    function quote(uint8 marketId, bool isLong, uint256 notionalUsd6)
        external
        view
        returns (uint256 execPrice, uint256 sizeDelta, uint256 fee, uint256 impactBps, MarketStatus status)
    {
        _requireMarket(marketId);
        PriceView memory pv = ORACLE.peek(marketId);
        status = pv.status;
        if (pv.price18 == 0) revert Errors.NoPrice(marketId);
        (, impactBps) = _skewAndImpact(marketId, isLong, notionalUsd6, pv.price18);
        execPrice = _entryPrice(marketId, isLong, pv, impactBps);
        sizeDelta = PerpMath.sizeFor(notionalUsd6, execPrice);
        fee = PerpMath.bpsUp(notionalUsd6, _markets[marketId].feeBps);
    }

    // ---------------------------------------------------------------- increase

    function _increase(
        address user,
        uint8 marketId,
        bool isLong,
        uint256 notionalUsd6,
        uint256 acceptablePrice18,
        uint64 deadline
    ) internal {
        _requireNewRiskAllowed();
        if (deadline < block.timestamp) revert Errors.DeadlinePassed();
        MarketParams storage m = _requireMarket(marketId);
        if (!m.enabled) revert Errors.MarketDisabled(marketId);
        PriceView memory pv = ORACLE.observe(marketId);
        if (pv.status != MarketStatus.OPEN) revert Errors.MarketNotOpen(marketId, pv.status);
        _accrue(marketId, true);

        Position memory p = _positions[user][marketId];
        if (p.size != 0 && p.isLong != isLong) revert Errors.SideMismatch(marketId);
        Fill memory f;
        f.kind = p.size == 0 ? PositionKind.OPEN : PositionKind.INCREASE;
        f.isLong = isLong;
        f.oraclePrice = pv.price18;
        (f.funding, f.borrow) = _settleFees(user, marketId, p);

        (int256 skewAfter, uint256 impact) = _skewAndImpact(marketId, isLong, notionalUsd6, pv.price18);
        if (impact > C.MAX_IMPACT_BPS) revert Errors.ImpactTooHigh(impact);
        f.execPrice = _entryPrice(marketId, isLong, pv, impact);
        if (isLong ? f.execPrice > acceptablePrice18 : f.execPrice < acceptablePrice18) {
            revert Errors.SlippageExceeded(f.execPrice, acceptablePrice18);
        }
        f.sizeDelta = PerpMath.sizeFor(notionalUsd6, f.execPrice);
        _checkCaps(marketId, isLong, notionalUsd6, f.sizeDelta, skewAfter, pv.price18);

        _removeAggregate(marketId, p);
        p.entry = PerpMath.averageEntry(p.size, p.entry, f.sizeDelta, f.execPrice, isLong).toUint128();
        p.size += f.sizeDelta.toUint128();
        p.isLong = isLong;
        p.openedBlock = uint64(block.number);
        _snap(marketId, p);
        if (PerpMath.notional(p.size, p.entry) < C.MIN_POSITION_NOTIONAL_USD6) {
            revert Errors.BelowMinPosition(PerpMath.notional(p.size, p.entry));
        }
        _addAggregate(marketId, p);
        _positions[user][marketId] = p;
        _accounts[user].positionBitmap |= _positionBit(marketId);

        f.fee = PerpMath.bpsUp(notionalUsd6, m.feeBps);
        _chargeFee(user, f.fee);
        _requireReserve();
        _emitFill(user, marketId, f, p);
        _emitRiskChecked(user);
    }

    function _checkCaps(
        uint8 marketId,
        bool isLong,
        uint256 notionalUsd6,
        uint256 sizeDelta,
        int256 skewAfter,
        uint256 price18
    ) internal view {
        MarketParams storage m = _markets[marketId];
        MarketState storage s = _marketState[marketId];
        uint256 pool = _bookTotal(Book.POOL);
        uint256 tradeCap = PerpMath.bpsDown(pool, m.tradeCapPoolBps);
        if (notionalUsd6 > tradeCap) revert Errors.TradeCapExceeded(notionalUsd6, tradeCap);
        uint256 sideSize = (isLong ? uint256(s.longSize) : uint256(s.shortSize)) + sizeDelta;
        uint256 oi = PerpMath.notional(sideSize, price18);
        uint256 oiCap = Math.min(m.oiCapAbsUsd6, PerpMath.bpsDown(pool, m.oiCapPoolBps));
        if (oi > oiCap) revert Errors.OpenInterestCapExceeded(oi, oiCap);
        uint256 skewAbs = skewAfter >= 0 ? uint256(skewAfter) : uint256(-skewAfter);
        uint256 skewCap = PerpMath.bpsDown(pool, m.skewCapPoolBps);
        if (skewAbs > skewCap) revert Errors.SkewCapExceeded(skewAbs, skewCap);
    }

    /// @notice Skew after the trade (usd6, + = net long) and the impact in bps (only when |skew| grows).
    function _skewAndImpact(uint8 marketId, bool isLong, uint256 notionalUsd6, uint256 price18)
        internal
        view
        returns (int256 skewAfter, uint256 impact)
    {
        MarketState storage s = _marketState[marketId];
        int256 skewBefore =
            PerpMath.notional(s.longSize, price18).toInt256() - PerpMath.notional(s.shortSize, price18).toInt256();
        skewAfter = isLong ? skewBefore + notionalUsd6.toInt256() : skewBefore - notionalUsd6.toInt256();
        impact = PerpMath.impactBps(skewBefore, skewAfter, _bookTotal(Book.POOL));
    }

    // ---------------------------------------------------------------- decrease

    function _decrease(
        address user,
        uint8 marketId,
        uint256 sizeDelta,
        uint256 acceptablePrice18,
        uint64 deadline,
        PositionKind kind
    ) internal {
        if (deadline < block.timestamp) revert Errors.DeadlinePassed();
        MarketParams storage m = _requireMarket(marketId);
        Position memory p = _positions[user][marketId];
        if (p.size == 0) revert Errors.NoPosition(marketId);
        if (sizeDelta == 0) revert Errors.ZeroAmount();
        if (sizeDelta > p.size) revert Errors.SizeTooLarge(sizeDelta, p.size);
        PriceView memory pv = ORACLE.observe(marketId);
        if (pv.price18 == 0) revert Errors.NoPrice(marketId);
        _accrue(marketId, pv.status == MarketStatus.OPEN);

        Fill memory f;
        f.kind = kind == PositionKind.DECREASE && sizeDelta == p.size ? PositionKind.CLOSE : kind;
        f.isLong = p.isLong;
        f.sizeDelta = sizeDelta;
        f.oraclePrice = pv.price18;
        (f.funding, f.borrow) = _settleFees(user, marketId, p);
        f.execPrice = _exitPrice(marketId, p.isLong, pv);
        if (p.isLong ? f.execPrice < acceptablePrice18 : f.execPrice > acceptablePrice18) {
            revert Errors.SlippageExceeded(f.execPrice, acceptablePrice18);
        }
        f.realizedPnl = PerpMath.pnl(p.isLong, sizeDelta, p.entry, f.execPrice);
        if (f.realizedPnl > 0) {
            uint64 ready = p.openedBlock + C.MIN_HOLD_BLOCKS;
            if (block.number < ready) revert Errors.MinHoldNotElapsed(ready);
            uint256 cap = PerpMath.bpsDown(PerpMath.notional(sizeDelta, p.entry), m.maxProfitBps);
            if (f.realizedPnl.toUint256() > cap) f.realizedPnl = cap.toInt256();
        }

        _removeAggregate(marketId, p);
        p.size -= sizeDelta.toUint128();
        if (p.size == 0) {
            delete _positions[user][marketId];
            _accounts[user].positionBitmap &= ~_positionBit(marketId);
        } else {
            _snap(marketId, p);
            _addAggregate(marketId, p);
            _positions[user][marketId] = p;
        }

        if (f.realizedPnl > 0) _payUser(user, f.realizedPnl.toUint256(), Book.POOL);
        else if (f.realizedPnl < 0) _settleLoss(user, (-f.realizedPnl).toUint256());
        f.fee = PerpMath.bpsUp(PerpMath.notional(sizeDelta, f.execPrice), m.feeBps);
        _chargeFee(user, f.fee);
        _emitFill(user, marketId, f, p);
        _emitRisk(user);
    }

    // ---------------------------------------------------------------- shared

    /// @notice Realise accrued funding + borrow of an existing position against POOL; snapshots reset by caller.
    function _settleFees(address user, uint8 marketId, Position memory p)
        internal
        returns (int256 funding, uint256 borrow)
    {
        (funding, borrow) = _owed(marketId, p);
        int256 total = funding + borrow.toInt256();
        if (total > 0) _settleLoss(user, total.toUint256());
        else if (total < 0) _payUser(user, (-total).toUint256(), Book.POOL);
        _snap(marketId, p);
    }

    function _snap(uint8 marketId, Position memory p) internal view {
        MarketState storage s = _marketState[marketId];
        p.fundingSnap = s.fundingIndex.toInt128();
        p.borrowSnap = s.borrowIndex.toUint128();
    }

    /// @notice Fees go to POOL, with FEE_TO_INSURANCE_BPS forwarded to INSURANCE.
    function _chargeFee(address user, uint256 fee) internal {
        if (fee == 0) return;
        uint256 paid = _chargeUser(user, fee, Book.POOL);
        _moveBooks(Book.POOL, Book.INSURANCE, PerpMath.bpsDown(paid, C.FEE_TO_INSURANCE_BPS));
    }

    function _emitFill(address user, uint8 marketId, Fill memory f, Position memory p) internal {
        uint64 nonce = _bump(user);
        emit Events.PositionUpdated(
            user,
            marketId,
            f.kind,
            f.isLong,
            f.sizeDelta,
            f.execPrice,
            f.oraclePrice,
            f.fee,
            f.realizedPnl,
            f.funding,
            f.borrow,
            p.size,
            p.entry,
            nonce
        );
    }
}
