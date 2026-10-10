// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

// New for Senryo (D-292). Mitoshi's exits (CWF D-193/D-209, contracts/src/products/vault/VaultExits.sol) let a keeper
// pick the moment and the price above a fair-value floor; here every fill is already at a unique print nobody picks, so
// the exit's own levels are checked at that print and only the trail's timing is the keeper's. Made generic for rides
// (R3.12): one book of exits keyed by (book, id), levels wide enough for a price.

import {SessionGrants} from "./SessionGrants.sol";
import "./MarketTypes.sol";

/// @title ExitOrders — a call's or a ride's standing take-profit, stop-loss and trail.
/// @notice Set by the owner's signature or, in one tap, their live session delegate's; it stays after the session ends
///         and a revoke (the owner's epoch moving on) cancels it.
abstract contract ExitOrders is SessionGrants {
    bytes32 public constant EXIT_TYPEHASH = keccak256(
        "ExitOrder(address owner,uint8 book,uint256 id,uint64 takeProfit,uint64 stopLoss,uint64 floor,uint64 trail,"
        "uint64 deadline,uint256 nonce,uint32 epoch)"
    );

    mapping(uint256 key => Exit) internal _exits;

    event ExitSet(
        uint8 indexed book,
        uint256 indexed id,
        uint64 takeProfit,
        uint64 stopLoss,
        uint64 floor,
        uint64 trail,
        bool viaSession
    );
    event ExitFired(uint8 indexed book, uint256 indexed id, uint8 kind, uint40 target, address by);

    error BadExit();
    error NoExit(uint8 book, uint256 id);
    error ExitRevoked(uint8 book, uint256 id);

    function exitOf(uint8 book, uint256 id) external view returns (Exit memory) {
        return _exits[exitKey(book, id)];
    }

    function exitKey(uint8 book, uint256 id) public pure returns (uint256) {
        return (uint256(book) << EXIT_BOOK_SHIFT) | id;
    }

    function hashExit(ExitOrder calldata o) public view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    EXIT_TYPEHASH,
                    o.owner,
                    o.book,
                    o.id,
                    o.takeProfit,
                    o.stopLoss,
                    o.floor,
                    o.trail,
                    o.deadline,
                    o.nonce,
                    o.epoch
                )
            )
        );
    }

    /// @dev Checks the order's signature and stores it under the owner's current epoch; the book checks its levels.
    function _takeExit(ExitOrder calldata o, bytes calldata sig, bool levelsOk) internal {
        bool viaSession = _authorizeSigned(Signed(o.owner, o.deadline, o.nonce, o.epoch, o.owner), hashExit(o), sig, 0);
        if (!levelsOk) revert BadExit();
        _exits[exitKey(o.book, o.id)] = Exit(o.takeProfit, o.stopLoss, o.floor, o.trail, o.epoch, EXIT_NONE);
        emit ExitSet(o.book, o.id, o.takeProfit, o.stopLoss, o.floor, o.trail, viaSession);
    }

    /// @dev A call's levels: bids below $1; the floor at or under the stop; take-profit above the stop.
    function _validCallExit(ExitOrder calldata o) internal pure returns (bool) {
        if (o.takeProfit >= P_ONE || o.stopLoss >= P_ONE || o.floor >= P_ONE || o.trail >= P_ONE) return false;
        if (o.stopLoss != 0 && o.floor > o.stopLoss) return false;
        return o.takeProfit == 0 || o.takeProfit > o.stopLoss;
    }

    /// @dev Whether a call's fill at `bidE6` meets the exit it was fired for.
    function _exitMet(Exit storage e, uint256 bidE6) internal view returns (bool) {
        if (e.takeProfit != 0 && bidE6 >= e.takeProfit) return true;
        if (e.stopLoss != 0 && bidE6 >= e.floor && bidE6 <= e.stopLoss) return true;
        return e.firing == EXIT_TRAIL && bidE6 >= e.floor;
    }
}
