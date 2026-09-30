// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Errors} from "../libraries/Errors.sol";
import {Events} from "../libraries/Events.sol";
import {PositionKind, PriceView, TriggerOrder} from "../libraries/Types.sol";
import {PerpModule} from "./PerpModule.sol";

/// @title TriggerOrders — user-signed EIP-712 take-profit / stop-loss, executed by any keeper at oracle crossing.
/// @notice No resting limit orders (D-039). A trigger only ever reduces the matching position.
abstract contract TriggerOrders is PerpModule {
    bytes32 public constant TRIGGER_TYPEHASH = keccak256(
        "TriggerOrder(address user,uint8 marketId,bool isLong,bool takeProfit,uint128 triggerPrice18,uint128 sizeDelta,uint128 acceptablePrice18,uint64 expiry,uint64 salt)"
    );

    mapping(bytes32 orderId => TriggerOrder) internal _triggers;

    /// @notice Store a signed TP/SL (anyone may relay it). `orderId` is the EIP-712 digest.
    function placeTrigger(TriggerOrder calldata order, bytes calldata signature) external returns (bytes32 orderId) {
        orderId = triggerId(order);
        if (ECDSA.recoverCalldata(orderId, signature) != order.user) revert Errors.InvalidSignature();
        if (triggerSeen[orderId]) revert Errors.TriggerExists(orderId);
        if (order.expiry <= block.timestamp) revert Errors.DeadlinePassed();
        _requireMarket(order.marketId);
        triggerSeen[orderId] = true;
        triggerActive[orderId] = true;
        _triggers[orderId] = order;
        emit Events.TriggerPlaced(
            order.user, orderId, order.marketId, order.takeProfit, order.triggerPrice18, order.sizeDelta, order.expiry
        );
    }

    function cancelTrigger(bytes32 orderId) external {
        TriggerOrder storage o = _triggers[orderId];
        if (o.user != msg.sender) revert Errors.InvalidSignature();
        if (!triggerActive[orderId]) revert Errors.TriggerInactive(orderId);
        triggerActive[orderId] = false;
        emit Events.TriggerCancelled(msg.sender, orderId);
    }

    /// @notice Permissionless: execute when the accepted oracle price has crossed the trigger.
    function executeTrigger(bytes32 orderId) external nonReentrant {
        if (!triggerActive[orderId]) revert Errors.TriggerInactive(orderId);
        TriggerOrder memory o = _triggers[orderId];
        if (o.expiry <= block.timestamp) revert Errors.DeadlinePassed();
        uint256 size = _positions[o.user][o.marketId].size;
        if (size == 0 || _positions[o.user][o.marketId].isLong != o.isLong) revert Errors.NoPosition(o.marketId);
        triggerActive[orderId] = false;
        PriceView memory pv = ORACLE.observe(o.marketId);
        bool upward = o.isLong == o.takeProfit;
        bool crossed = upward ? pv.price18 >= o.triggerPrice18 : pv.price18 <= o.triggerPrice18;
        if (!crossed || pv.price18 == 0) revert Errors.TriggerNotCrossed(o.marketId, pv.price18, o.triggerPrice18);
        uint256 sizeDelta = Math.min(o.sizeDelta, size);
        _decrease(o.user, o.marketId, sizeDelta, o.acceptablePrice18, o.expiry, PositionKind.TRIGGER);
        emit Events.TriggerExecuted(o.user, orderId, msg.sender, sizeDelta);
    }

    function triggerOrder(bytes32 orderId) external view returns (TriggerOrder memory) {
        return _triggers[orderId];
    }

    function triggerId(TriggerOrder calldata o) public view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    TRIGGER_TYPEHASH,
                    o.user,
                    o.marketId,
                    o.isLong,
                    o.takeProfit,
                    o.triggerPrice18,
                    o.sizeDelta,
                    o.acceptablePrice18,
                    o.expiry,
                    o.salt
                )
            )
        );
    }
}
