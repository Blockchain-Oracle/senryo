// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {MarketStatus} from "./Types.sol";

/// @title Errors — every custom error of the Senryo contracts.
library Errors {
    // generic
    error ZeroAddress();
    error ZeroAmount();
    error DeadlinePassed();
    error InvalidSignature();
    error Paused();
    error SettleOnly();
    error NotRiskReducing();
    error AlreadyConfigured();
    error LengthMismatch();

    // collateral / ledger
    error UnsupportedToken(address token);
    error InsufficientBalance(uint256 available, uint256 requested);
    error InsufficientFreeCollateral(int256 freeToTrade);
    error BookInsufficient(uint8 book, uint256 available, uint256 requested);

    // markets
    error UnknownMarket(uint8 marketId);
    error MarketDisabled(uint8 marketId);
    error TooManyMarkets();
    error MarketNotOpen(uint8 marketId, MarketStatus status);
    error NoPrice(uint8 marketId);
    error InvalidParams();

    // positions
    error NoPosition(uint8 marketId);
    error SideMismatch(uint8 marketId);
    error SlippageExceeded(uint256 execPrice, uint256 acceptablePrice);
    error BelowMinPosition(uint256 notionalUsd6);
    error TradeCapExceeded(uint256 notionalUsd6, uint256 cap);
    error OpenInterestCapExceeded(uint256 oiUsd6, uint256 cap);
    error SkewCapExceeded(uint256 skewUsd6, uint256 cap);
    error ReserveCapExceeded(uint256 reserved, uint256 cap);
    error ImpactTooHigh(uint256 impactBps);
    error MinHoldNotElapsed(uint64 readyBlock);
    error SizeTooLarge(uint256 sizeDelta, uint256 size);

    // triggers
    error TriggerNotCrossed(uint8 marketId, uint256 price18, uint256 triggerPrice18);
    error TriggerInactive(bytes32 orderId);
    error TriggerExists(bytes32 orderId);

    // card
    error AllowanceExpired();
    error AllowanceExceeded(uint256 used, uint256 limit);
    error HoldExists(bytes32 holdId);
    error HoldNotOpen(bytes32 holdId);
    error HoldTooLarge(uint256 amount, uint256 max);
    error HoldExpired(bytes32 holdId);
    error HoldNotReleasable(bytes32 holdId);
    error CaptureTooLarge(uint256 captured, uint256 max);
    error CaptureNotAllowed(bytes32 holdId);
    error UnsafeMarketForHold(uint8 marketId, MarketStatus status);
    error RefundUsed(bytes32 refId);
    error RefundTooLarge(uint256 amount, uint256 max);
    error NonceUsed();

    // liquidation
    error NotLiquidatable(int256 equityLiq, uint256 mm);
    error LiquidationNotOpen(uint8 marketId);

    // oracle / calendar
    error DescriptionMismatch(bytes32 expected, bytes32 actual);
    error FeedDecimalsUnsupported(uint8 decimals);
    error FeedAnswerInvalid();
    error UnknownCalendar(uint8 calendarId);
    error TooManyHolidays();
    error InvalidWindow();

    // vault / periphery
    error MarketsNotOpen();
    error RedeemNotReady(uint64 claimableAt);
    error RedeemUnknown(uint256 requestId);
    error TvlCapExceeded(uint256 assets, uint256 cap);
    error AlreadyClaimed(address user);
    error BudgetExceeded(uint256 spent, uint256 budget);
    error UnknownVoucher(bytes32 codeHash);
    error VoucherCapReached();
    error SlippageOut(uint256 amountOut, uint256 minOut);
    error SwapUnavailable();
    error NotCore(address caller);
    error NativeTransferFailed();
    error FaucetCooldown(uint64 readyAt);
    error TestnetOnly(uint256 chainId);
}
