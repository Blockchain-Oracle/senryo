// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {Constants as C} from "../libraries/Constants.sol";
import {Errors} from "../libraries/Errors.sol";
import {Events} from "../libraries/Events.sol";
import {PerpMath} from "../libraries/PerpMath.sol";
import {
    Account,
    Allowance,
    Book,
    MarketParams,
    MarketState,
    MarketStatus,
    Position,
    PriceView,
    Risk
} from "../libraries/Types.sol";
import {MarketAccounting} from "./MarketAccounting.sol";

/// @title RiskModule — the account equations of risk-math.md, enforced onchain.
/// @notice E_init = C_adj + Σ min(uPnL, 0) − Σ max(F, 0) − D;  E_liq = C_liq + Σ uPnL − Σ F − D − H;
/// FreeToTrade = E_init − Σ IM − max(R, H) − B;  FreeToSpend = FreeToTrade + max(R − H, 0), capped by the live
/// spend allowance. I2 (no double pledge) ⇔ FreeToTrade ≥ 0 after every risk-increasing action.
abstract contract RiskModule is MarketAccounting {
    using SafeCast for uint256;

    function accountRisk(address user) external view returns (Risk memory) {
        return _risk(user);
    }

    function account(address user) external view returns (Account memory) {
        return _accounts[user];
    }

    function position(address user, uint8 marketId) external view returns (Position memory) {
        return _positions[user][marketId];
    }

    function book(Book b) external view returns (uint256 ausd, uint256 usdc) {
        return (_books[b].ausd, _books[b].usdc);
    }

    // ---------------------------------------------------------------- risk

    function _risk(address user) internal view returns (Risk memory r) {
        Account storage a = _accounts[user];
        int256 negUpnl;
        int256 upnl;
        int256 posFees;
        int256 fees;
        r.allOpen = true;
        uint32 bitmap = a.positionBitmap;
        for (uint8 id; bitmap != 0; ++id) {
            if (bitmap & 1 == 1) {
                Position memory p = _positions[user][id];
                PriceView memory pv = ORACLE.peek(id);
                if (pv.price18 == 0) revert Errors.NoPrice(id);
                if (pv.status != MarketStatus.OPEN) r.allOpen = false;
                if (_unsafe(pv.status)) r.anyUnsafe = true;
                int256 u = PerpMath.pnl(p.isLong, p.size, p.entry, _exitPrice(id, p.isLong, pv));
                (int256 funding, uint256 borrow) = _owed(id, p);
                int256 f = funding + borrow.toInt256();
                upnl += u;
                if (u < 0) negUpnl += u;
                fees += f;
                if (f > 0) posFees += f;
                uint256 n = PerpMath.notional(p.size, pv.price18);
                MarketParams storage m = _markets[id];
                uint256 mult = pv.status == MarketStatus.OPEN ? 1 : C.CLOSED_IM_MULTIPLIER;
                r.im += PerpMath.bpsUp(n, uint256(m.imBps) * mult);
                r.mm += PerpMath.bpsUp(n, m.mmBps);
            }
            bitmap >>= 1;
        }
        int256 debt = uint256(a.cardDebt).toInt256();
        int256 holds = uint256(a.holds).toInt256();
        int256 envelope = uint256(a.envelope).toInt256();
        r.equityInit = _collateralValue(a, true).toInt256() + negUpnl - posFees - debt;
        r.equityLiq = _collateralValue(a, false).toInt256() + upnl - fees - debt - holds;
        // The safety buffer applies only while the account carries risk, so an idle account can withdraw in full.
        bool atRisk = a.positionBitmap != 0 || holds != 0 || envelope != 0 || debt != 0;
        int256 buffer = atRisk ? C.SAFETY_BUFFER_USD6.toInt256() : int256(0);
        r.freeToTrade = r.equityInit - r.im.toInt256() - (envelope > holds ? envelope : holds) - buffer;
        int256 spend = r.freeToTrade + (envelope > holds ? envelope - holds : int256(0));
        int256 allowanceLeft = _allowanceLeft(user).toInt256();
        r.freeToSpend = spend < allowanceLeft ? spend : allowanceLeft;
    }

    function _requireHealthy(Risk memory r) internal pure {
        if (r.freeToTrade < 0) revert Errors.InsufficientFreeCollateral(r.freeToTrade);
    }

    /// @notice Emit AccountRiskUpdated (end of every mutation) and return the snapshot.
    function _emitRisk(address user) internal returns (Risk memory r) {
        r = _risk(user);
        Account storage a = _accounts[user];
        emit Events.AccountRiskUpdated(
            user, a.nonce, r.equityInit, r.im, r.mm, a.holds, a.cardDebt, a.envelope, r.freeToTrade, r.freeToSpend
        );
    }

    /// @notice Risk-increasing epilogue: emit and enforce I2.
    function _emitRiskChecked(address user) internal {
        _requireHealthy(_emitRisk(user));
    }

    // ---------------------------------------------------------------- prices

    /// @notice Conservative exit price (bid for longs, ask for shorts) per the status matrix. No impact.
    function _exitPrice(uint8 marketId, bool isLong, PriceView memory pv) internal view returns (uint256) {
        MarketParams storage m = _markets[marketId];
        uint256 base = Math.max(m.baseSpreadBps, m.devSpreadBps);
        MarketStatus st = pv.status;
        uint256 price = pv.price18;
        uint256 spread;
        if (st == MarketStatus.OPEN || st == MarketStatus.STALE) {
            spread = base + pv.spreadBps;
        } else if (st == MarketStatus.CLOSED) {
            spread = pv.spreadBps;
        } else {
            spread = base;
            if (pv.latest18 != 0) price = isLong ? Math.min(price, pv.latest18) : Math.max(price, pv.latest18);
        }
        return PerpMath.applySpread(price, spread, !isLong);
    }

    /// @notice Entry price for a new/increased position (OPEN only): P ± (max(base, dev) + age + impact).
    function _entryPrice(uint8 marketId, bool isLong, PriceView memory pv, uint256 impactBps)
        internal
        view
        returns (uint256)
    {
        MarketParams storage m = _markets[marketId];
        uint256 spread = Math.max(m.baseSpreadBps, m.devSpreadBps) + pv.spreadBps + impactBps;
        return PerpMath.applySpread(pv.price18, spread, isLong);
    }

    // ---------------------------------------------------------------- funding / borrow

    /// @notice Funding (signed, + = the account pays) and borrow owed by a position, borrow accrued to now.
    function _owed(uint8 marketId, Position memory p) internal view returns (int256 funding, uint256 borrow) {
        if (p.size == 0) return (0, 0);
        MarketState storage s = _marketState[marketId];
        uint256 n = PerpMath.notional(p.size, p.entry);
        funding = PerpMath.fundingOwed(p.isLong, n, s.fundingIndex, p.fundingSnap);
        borrow = PerpMath.borrowOwed(n, _borrowIndexNow(marketId), p.borrowSnap);
    }

    function _borrowIndexNow(uint8 marketId) internal view returns (uint256) {
        MarketState storage s = _marketState[marketId];
        MarketParams storage m = _markets[marketId];
        uint256 dt = block.timestamp - s.lastAccrual;
        uint256 open = uint256(s.longNotional) + s.shortNotional;
        return s.borrowIndex + PerpMath.borrowRate(open, _bookTotal(Book.POOL), m.borrowBase, m.borrowSlope) * dt;
    }

    // ---------------------------------------------------------------- card allowance

    function _allowanceLeft(address user) internal view returns (uint256) {
        Allowance storage al = _allowances[user];
        if (al.expiry <= block.timestamp) return 0;
        uint256 used = al.day == _today() ? al.usedToday : 0;
        return used >= al.dailyLimit ? 0 : al.dailyLimit - used;
    }

    function _today() internal view returns (uint64) {
        return uint64(block.timestamp / C.SECONDS_PER_DAY);
    }

    function _unsafe(MarketStatus st) internal pure returns (bool) {
        return st == MarketStatus.STALE || st == MarketStatus.CIRCUIT || st == MarketStatus.HALTED;
    }
}
