// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {RideMarket, RideTerms} from "../RideTypes.sol";

/// @title Rides' vocabulary (D-299): from commit to the last payout, every refusal by name.
interface IRideBook {
    event RideMarketSet(uint16 indexed marketId, bytes32 feedId, bool enabled, uint32 configVersion);
    event RideTermsSet(RideTerms terms, uint32 configVersion);
    event RideCommitted(
        uint256 indexed rideId,
        address indexed owner,
        uint16 indexed marketId,
        bool isLong,
        uint64 margin,
        uint32 leverageBps,
        uint64 openFee,
        int64 worstPriceE8,
        uint40 target,
        bool viaSession
    );
    event RideFilled(
        uint256 indexed rideId, int64 entryE8, uint128 size, uint64 reserve, uint64 openFee, int64 koE8, int64 capE8
    );
    event RideRefused(uint256 indexed rideId, uint8 reason, uint64 refunded);
    event RideCloseCommitted(uint256 indexed rideId, uint128 size, int64 worstPriceE8, uint40 target, bool viaSession);
    event RideCloseRefused(uint256 indexed rideId, uint8 reason);
    /// @notice A ride's size left at `exitE8`: `how` is the state it moved to (RIDE_OPEN for a partial close).
    event RideExited(
        uint256 indexed rideId,
        uint8 how,
        uint128 size,
        int64 exitE8,
        int256 pnl,
        uint64 fees,
        uint64 paid,
        uint64 keeperFee,
        address by
    );
    event FrontierRefreshed(uint16 indexed marketId, uint8 side, int64 koEdgeE8, int64 capEdgeE8);

    error UnknownRide(uint256 rideId);
    error UnknownRideMarket(uint16 marketId);
    error RideMarketClosed(uint16 marketId);
    error BadRideMarket();
    error BadRide();
    error NotRideOwner(uint256 rideId, address owner);
    error RideNotOpen(uint256 rideId, uint8 status);
    error RideClosePending(uint256 rideId);
    error RideHeldTooShort(uint256 rideId, uint40 canCloseAt);
    error BadRideSize(uint128 size, uint128 held);
    error BadFrontier(uint16 marketId, uint8 side);
    error PastBound(uint16 marketId, uint8 side);
    error TooEarly(uint256 rideId, uint40 at);
}
