// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {Params} from "../MarketTypes.sol";

/// @title BandReserve's vocabulary: tickets from commit to payout, the pool, and every refusal by name.
interface IBandReserve {
    event Committed(
        uint256 indexed ticketId,
        address indexed owner,
        bytes32 indexed windowId,
        uint8 band,
        uint64 stake,
        uint64 minPayout,
        uint40 target,
        bool viaSession
    );
    event Filled(
        uint256 indexed ticketId,
        uint64 payout,
        uint64 stake,
        int64 entryE8,
        uint32 probE6,
        uint32 priceE6,
        uint64 reserve
    );
    event Refused(uint256 indexed ticketId, uint8 reason, uint64 refunded);
    event CloseCommitted(uint256 indexed ticketId, uint64 shares, uint64 minProceeds, uint40 target, bool viaSession);
    event Closed(uint256 indexed ticketId, uint64 shares, uint64 proceeds, uint64 basisOut, int64 exitE8, uint32 bidE6);
    event CloseRefused(uint256 indexed ticketId, uint8 reason);
    event WindowSettled(
        bytes32 indexed windowId, uint16 wonMask, uint16 refundMask, uint16 lostMask, uint256 toPool, uint256 toHolders
    );
    event Claimed(uint256 indexed ticketId, address indexed to, uint8 outcome, uint256 amount, bool paid, address by);
    event PayoutHeld(address indexed to, uint256 amount, uint256 owed);
    event OwedClaimed(address indexed to, uint256 amount);
    event PoolFunded(address indexed by, uint256 amount, uint256 liquid);
    event PoolDefunded(address indexed to, uint256 amount, uint256 liquid);
    event ParamsSet(uint32 configVersion, Params params);
    event SigmaSet(bytes32 indexed seriesId, uint64 sigmaE8, uint32 configVersion);
    event BandAdded(bytes32 indexed seriesId, uint8 index, uint8 kind, uint16 lowBps, uint16 highBps);
    event PausedSet(bool paused);

    error IsPaused();
    error BadAction(uint8 action);
    error BadParams();
    error WrongConfig(uint32 current, uint32 signed);
    error BadStake(uint64 amount, uint64 min, uint64 max);
    error UnknownSeries(bytes32 seriesId);
    error UnknownBand(bytes32 seriesId, uint8 band);
    error NoVolatility(bytes32 seriesId);
    error WindowNotTrading(bytes32 windowId);
    error NoOpenPrint(bytes32 windowId);
    error UnknownTicket(uint256 ticketId);
    error NotTicketOwner(uint256 ticketId, address owner);
    error TicketNotOpen(uint256 ticketId, uint8 status);
    error ClosePending(uint256 ticketId);
    error BadShares(uint64 shares, uint64 held);
    error HeldTooShort(uint256 ticketId, uint40 canCloseAt);
    error RecipientMismatch(address signed, address ticket);
    error BadBatch();
    error MixedBatch(uint256 ticketId);
    error WindowNotOver(bytes32 windowId);
    error WindowAlreadySettled(bytes32 windowId);
    error InsufficientLiquidity(uint256 amount, uint256 liquid);
    error Insolvent(uint256 balance, uint256 owed);
    error NothingOwed();
    error ZeroAddress();
}
