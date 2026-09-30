// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {DepositSource, MarketStatus, PositionKind, ReleaseReason} from "./Types.sol";

/// @title Events — Envio-friendly events (every event carries `address indexed user` where a user exists).
library Events {
    // ---------------------------------------------------------------- ledger
    event Deposited(
        address indexed user,
        address indexed payer,
        address indexed token,
        uint256 amount,
        DepositSource source,
        uint64 nonce
    );
    event Withdrawn(address indexed user, address indexed to, address indexed token, uint256 amount, uint64 nonce);
    event AccountRiskUpdated(
        address indexed user,
        uint64 nonce,
        int256 equityInit,
        uint256 imTotal,
        uint256 mmTotal,
        uint256 holds,
        uint256 cardDebt,
        uint256 envelope,
        int256 freeToTrade,
        int256 freeToSpend
    );
    event CollateralSwapped(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint64 nonce
    );
    event BookFunded(uint8 indexed book, address indexed token, address indexed payer, uint256 amount);
    event BookWithdrawn(uint8 indexed book, address indexed token, address indexed to, uint256 amount);

    // ---------------------------------------------------------------- markets
    event MarketConfigured(uint8 indexed marketId, bool enabled);
    event MarketStateUpdated(
        uint8 indexed marketId,
        uint256 longSize,
        uint256 shortSize,
        int256 fundingIndex,
        uint256 borrowIndex,
        int256 fundingRate,
        uint256 borrowRate
    );
    event CollateralConfigured(address indexed token, bool enabled, uint16 haircutBps, address usdFeed);

    // ---------------------------------------------------------------- positions
    event PositionUpdated(
        address indexed user,
        uint8 indexed marketId,
        PositionKind kind,
        bool isLong,
        uint256 sizeDelta,
        uint256 execPrice,
        uint256 oraclePrice,
        uint256 fee,
        int256 realizedPnl,
        int256 funding,
        uint256 borrow,
        uint256 sizeAfter,
        uint256 entryAfter,
        uint64 nonce
    );
    event TriggerPlaced(
        address indexed user,
        bytes32 indexed orderId,
        uint8 indexed marketId,
        bool takeProfit,
        uint256 triggerPrice18,
        uint256 sizeDelta,
        uint64 expiry
    );
    event TriggerCancelled(address indexed user, bytes32 indexed orderId);
    event TriggerExecuted(address indexed user, bytes32 indexed orderId, address indexed keeper, uint256 sizeDelta);

    // ---------------------------------------------------------------- card
    event AllowanceSet(address indexed user, uint256 dailyLimit, uint64 expiry, uint64 nonce);
    event CardEnvelopeSet(address indexed user, uint256 envelope, uint64 nonce);
    event HoldPlaced(
        bytes32 indexed holdId, address indexed user, uint256 amount, uint64 expiry, bool fromEnvelope, uint64 nonce
    );
    event HoldIncreased(bytes32 indexed holdId, address indexed user, uint256 delta, uint256 amount, uint64 nonce);
    event HoldCaptured(
        bytes32 indexed holdId, address indexed user, uint256 captured, uint256 released, uint256 debtCreated
    );
    event HoldReleased(bytes32 indexed holdId, address indexed user, uint256 amount, ReleaseReason reason);
    event CardRefunded(address indexed user, bytes32 indexed refId, uint256 amount, uint256 debtRepaid);
    event CardDebtRepaid(address indexed user, uint256 amount, uint256 debtAfter);
    event ReleaseOnlySet(bytes32 indexed issuer, bool releaseOnly);

    // ---------------------------------------------------------------- liquidation
    event Liquidated(
        address indexed user,
        address indexed liquidator,
        uint256 penalty,
        uint256 liquidatorFee,
        uint256 shortfall,
        uint64 nonce
    );
    event InsuranceCovered(address indexed user, uint256 covered, uint256 socialized);

    // ---------------------------------------------------------------- admin
    event PausedUntil(uint64 until);
    event SettleOnlySet(bool settleOnly);
    event DepositSourceSet(address indexed caller, DepositSource source);

    // ---------------------------------------------------------------- oracle / calendar
    event MarketStatusChanged(uint8 indexed marketId, MarketStatus previous, MarketStatus current, uint256 price18);
    event PriceRejected(uint8 indexed marketId, uint80 roundId, uint256 answer18, uint256 lastAccepted18);
    event PriceAccepted(uint8 indexed marketId, uint80 roundId, uint256 price18, uint64 updatedAt);
    event FeedSet(
        uint8 indexed marketId, address indexed feed, uint8 calendarId, uint16 clampBps, uint16 reopenClampBps
    );
    event MarketHalted(uint8 indexed marketId, uint64 until);
    event CalendarSet(uint8 indexed calendarId);
    event HolidayAdded(uint8 indexed calendarId, uint64 start, uint64 end);
    event HolidayRemoved(uint8 indexed calendarId, uint64 start, uint64 end);

    // ---------------------------------------------------------------- periphery
    event RedeemRequested(
        address indexed owner, address indexed receiver, uint256 indexed requestId, uint256 shares, uint64 claimableAt
    );
    event Redeemed(
        address indexed owner, address indexed receiver, uint256 indexed requestId, uint256 shares, uint256 assets
    );
    event StarterClaimed(address indexed user, uint256 nativeAmount, uint256 practiceAmount);
    event VoucherRedeemed(address indexed user, bytes32 indexed codeHash, uint256 amount);
    event VouchersAdded(uint256 count);
    event OrderExecuted(address indexed user, bytes32 indexed orderHash, uint8 indexed marketId, uint256 notionalUsd6);
    event OrderSkipped(address indexed user, bytes32 indexed orderHash, bytes reason);
    event InboxDeployed(address indexed user, address inbox);
    event Swept(address indexed user, address indexed inbox, address indexed token, uint256 amount);
}
