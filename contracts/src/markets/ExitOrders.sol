// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

// New for Senryo (D-292). Mitoshi's exits (CWF D-193/D-209, contracts/src/products/vault/VaultExits.sol) let a keeper
// pick the moment and the price above a fair-value floor; here every fill is already at a unique print nobody picks, so
// the exit's own prices are checked at that print and only the trail's timing is the keeper's.

import {SessionGrants} from "./SessionGrants.sol";
import "./MarketTypes.sol";

/// @title ExitOrders — a ticket's standing take-profit, stop-loss and trail.
/// @notice Set by the owner's signature or, in one tap, their live session delegate's; it stays after the session ends
///         and a revoke (the owner's epoch moving on) cancels it. Prices are a share's bid, so a partial cash-out
///         leaves the exit right for the shares that remain.
abstract contract ExitOrders is SessionGrants {
    bytes32 public constant EXIT_TYPEHASH = keccak256(
        "ExitOrder(address owner,uint256 ticketId,uint32 takeProfitE6,uint32 stopLossE6,uint32 floorE6,uint32 trailE6,"
        "uint64 deadline,uint256 nonce,uint32 epoch)"
    );

    mapping(uint256 ticketId => Exit) internal _exits;

    event ExitSet(
        uint256 indexed ticketId,
        uint32 takeProfitE6,
        uint32 stopLossE6,
        uint32 floorE6,
        uint32 trailE6,
        bool viaSession
    );
    event ExitFired(uint256 indexed ticketId, uint8 kind, uint40 target, address by);

    error BadExit();
    error NoExit(uint256 ticketId);
    error ExitRevoked(uint256 ticketId);

    function exitOf(uint256 ticketId) external view returns (Exit memory) {
        return _exits[ticketId];
    }

    function hashExit(ExitOrder calldata o) public view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    EXIT_TYPEHASH,
                    o.owner,
                    o.ticketId,
                    o.takeProfitE6,
                    o.stopLossE6,
                    o.floorE6,
                    o.trailE6,
                    o.deadline,
                    o.nonce,
                    o.epoch
                )
            )
        );
    }

    /// @dev Checks the order's signature and prices and stores it under the owner's current epoch.
    function _takeExit(ExitOrder calldata o, bytes calldata sig) internal {
        // forge-lint: disable-next-line(block-timestamp)
        if (block.timestamp > o.deadline) revert SignatureExpired(o.deadline);
        uint32 epoch = epochOf[o.owner];
        if (o.epoch != epoch) revert WrongEpoch(epoch, o.epoch);
        bool viaSession = _signedBy(o.owner, hashExit(o), sig, epoch);
        _useNonce(o.owner, o.nonce);
        if (!_validExit(o)) revert BadExit();
        _exits[o.ticketId] = Exit(o.takeProfitE6, o.stopLossE6, o.floorE6, o.trailE6, epoch, EXIT_NONE);
        emit ExitSet(o.ticketId, o.takeProfitE6, o.stopLossE6, o.floorE6, o.trailE6, viaSession);
    }

    /// @dev Prices below $1 a share; the floor at or under the stop; take-profit above the stop.
    function _validExit(ExitOrder calldata o) private pure returns (bool) {
        if (o.takeProfitE6 >= P_ONE || o.stopLossE6 >= P_ONE || o.floorE6 >= P_ONE || o.trailE6 >= P_ONE) return false;
        if (o.stopLossE6 != 0 && o.floorE6 > o.stopLossE6) return false;
        return o.takeProfitE6 == 0 || o.takeProfitE6 > o.stopLossE6;
    }

    /// @dev Whether a fill at `bidE6` meets the exit it was fired for.
    function _exitMet(Exit storage e, uint256 bidE6) internal view returns (bool) {
        if (e.takeProfitE6 != 0 && bidE6 >= e.takeProfitE6) return true;
        if (e.stopLossE6 != 0 && bidE6 >= e.floorE6 && bidE6 <= e.stopLossE6) return true;
        return e.firing == EXIT_TRAIL && bidE6 >= e.floorE6;
    }
}
