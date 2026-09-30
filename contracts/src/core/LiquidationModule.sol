// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {Constants as C} from "../libraries/Constants.sol";
import {Errors} from "../libraries/Errors.sol";
import {Events} from "../libraries/Events.sol";
import {PerpMath} from "../libraries/PerpMath.sol";
import {Account, Book, MarketStatus, Position, PositionKind, PriceView, Risk} from "../libraries/Types.sol";
import {CardModule} from "./CardModule.sol";

/// @title LiquidationModule — permissionless liquidation with the risk-math.md waterfall.
/// @notice 1 close all positions at bid/ask + LIQ_PENALTY · 2 repay card debt to CARD_FLOAT (senior) · 3 holds stay
/// reserved · 4 trader losses to POOL · 5 liquidator gets min(share × penalty, cap), the rest → INSURANCE ·
/// 6 shortfall → INSURANCE, then socialised to POOL · 7 later over-capture beyond collateral → INSURANCE covers
/// CARD_FLOAT (`coverCardDebt`). Requires every held market OPEN.
abstract contract LiquidationModule is CardModule {
    using SafeCast for uint256;
    using SafeCast for int256;

    function liquidate(address user) external nonReentrant {
        Account storage a = _accounts[user];
        if (a.positionBitmap == 0) revert Errors.NoPosition(0);
        _prepareMarkets(a.positionBitmap);
        Risk memory r = _risk(user);
        if (r.equityLiq >= r.mm.toInt256()) revert Errors.NotLiquidatable(r.equityLiq, r.mm);

        int256 net;
        uint256 penalty;
        uint32 bitmap = a.positionBitmap;
        for (uint8 id; bitmap != 0; ++id) {
            if (bitmap & 1 == 1) {
                (int256 n, uint256 pen) = _closeForLiquidation(user, id);
                net += n;
                penalty += pen;
            }
            bitmap >>= 1;
        }
        a.positionBitmap = 0;

        if (net > 0) _payUser(user, net.toUint256(), Book.POOL);
        uint256 debtPaid = _chargeUser(user, a.cardDebt, Book.CARD_FLOAT);
        a.cardDebt -= debtPaid.toUint128();
        uint256 shortfall;
        if (net < 0) {
            uint256 loss = (-net).toUint256();
            uint256 lossPaid = _chargeAboveHolds(user, loss, Book.POOL);
            shortfall = loss - lossPaid;
            if (shortfall != 0) _coverShortfall(user, shortfall);
        }
        uint256 penaltyPaid = _chargeAboveHolds(user, penalty, Book.INSURANCE);
        uint256 liqFee = Math.min(PerpMath.bpsDown(penaltyPaid, C.LIQ_FEE_SHARE_BPS), C.LIQ_FEE_CAP_USD6);
        if (liqFee != 0) _payUser(msg.sender, liqFee, Book.INSURANCE);

        emit Events.Liquidated(user, msg.sender, penaltyPaid, liqFee, shortfall, _bump(user));
        _emitRisk(user);
        if (liqFee != 0 && msg.sender != user) {
            _bump(msg.sender);
            _emitRisk(msg.sender);
        }
    }

    /// @notice Step 7: once an account holds no collateral and no positions, INSURANCE covers its card debt.
    function coverCardDebt(address user) external nonReentrant {
        Account storage a = _accounts[user];
        if (a.positionBitmap != 0 || _balanceOf(a) != 0 || a.cardDebt == 0) revert Errors.InvalidParams();
        uint256 covered = _moveBooks(Book.INSURANCE, Book.CARD_FLOAT, a.cardDebt);
        a.cardDebt -= covered.toUint128();
        emit Events.InsuranceCovered(user, covered, 0);
        _bump(user);
        _emitRisk(user);
    }

    function isLiquidatable(address user) external view returns (bool) {
        Account storage a = _accounts[user];
        if (a.positionBitmap == 0) return false;
        Risk memory r = _risk(user);
        return r.allOpen && r.equityLiq < r.mm.toInt256();
    }

    // ---------------------------------------------------------------- internal

    function _prepareMarkets(uint32 bitmap) internal {
        for (uint8 id; bitmap != 0; ++id) {
            if (bitmap & 1 == 1) {
                PriceView memory pv = ORACLE.observe(id);
                if (pv.status != MarketStatus.OPEN) revert Errors.LiquidationNotOpen(id);
                _accrue(id, true);
            }
            bitmap >>= 1;
        }
    }

    /// @return net realised PnL minus funding and borrow (signed), and the penalty owed.
    function _closeForLiquidation(address user, uint8 marketId) internal returns (int256 net, uint256 penalty) {
        Position memory p = _positions[user][marketId];
        PriceView memory pv = ORACLE.peek(marketId);
        Fill memory f;
        f.kind = PositionKind.LIQUIDATE;
        f.isLong = p.isLong;
        f.sizeDelta = p.size;
        f.oraclePrice = pv.price18;
        (f.funding, f.borrow) = _owed(marketId, p);
        f.execPrice = _exitPrice(marketId, p.isLong, pv);
        f.realizedPnl = PerpMath.pnl(p.isLong, p.size, p.entry, f.execPrice);
        if (f.realizedPnl > 0) {
            uint256 cap = PerpMath.bpsDown(PerpMath.notional(p.size, p.entry), _markets[marketId].maxProfitBps);
            if (f.realizedPnl.toUint256() > cap) f.realizedPnl = cap.toInt256();
        }
        penalty = PerpMath.bpsUp(PerpMath.notional(p.size, f.execPrice), C.LIQ_PENALTY_BPS);
        f.fee = penalty;
        net = f.realizedPnl - f.funding - f.borrow.toInt256();
        _removeAggregate(marketId, p);
        delete _positions[user][marketId];
        Position memory closed;
        _emitFill(user, marketId, f, closed);
    }

    /// @dev Charge only what exceeds the user's open holds (holds are senior to pool losses and the penalty).
    function _chargeAboveHolds(address user, uint256 amount, Book b) internal returns (uint256) {
        Account storage a = _accounts[user];
        uint256 bal = _balanceOf(a);
        uint256 available = bal > a.holds ? bal - a.holds : 0;
        return _chargeUser(user, Math.min(amount, available), b);
    }

    /// @dev Shortfall owed to POOL: INSURANCE covers what it can, the rest is socialised to LPs.
    function _coverShortfall(address user, uint256 shortfall) internal override {
        uint256 covered = _moveBooks(Book.INSURANCE, Book.POOL, shortfall);
        emit Events.InsuranceCovered(user, covered, shortfall - covered);
    }
}
