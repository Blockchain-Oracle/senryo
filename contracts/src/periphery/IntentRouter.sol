// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ReentrancyGuardTransient} from "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";
import {ISenryoCore} from "../interfaces/ISenryoCore.sol";
import {Errors} from "../libraries/Errors.sol";
import {Events} from "../libraries/Events.sol";

/// @title IntentRouter — `depositAndOpen` for Aurora recipes and relays (EIP-712 OpenOrder, v/r/s split).
/// @notice The deposit always lands; an invalid, stale, replayed or unfillable order is skipped with `OrderSkipped`
/// and never reverts the deposit. The core trusts this router via ROUTER_ROLE on `increaseFor`.
contract IntentRouter is EIP712, ReentrancyGuardTransient {
    using SafeERC20 for IERC20;

    struct OpenOrder {
        address user;
        uint8 marketId;
        bool isLong;
        uint256 notionalUsd6;
        uint256 acceptablePrice18;
        uint64 deadline;
        uint64 nonce;
    }

    bytes32 public constant OPEN_ORDER_TYPEHASH = keccak256(
        "OpenOrder(address user,uint8 marketId,bool isLong,uint256 notionalUsd6,uint256 acceptablePrice18,uint64 deadline,uint64 nonce)"
    );

    ISenryoCore public immutable CORE;
    mapping(address user => mapping(uint64 nonce => bool)) public nonceUsed;

    constructor(ISenryoCore core) EIP712("SenryoIntentRouter", "1") {
        if (address(core) == address(0)) revert Errors.ZeroAddress();
        CORE = core;
    }

    /// @notice Pull `amount` of `token` from the caller, credit `order.user` in the core, then try the order.
    function depositAndOpen(address token, uint256 amount, OpenOrder calldata order, uint8 v, bytes32 r, bytes32 s)
        external
        nonReentrant
    {
        if (order.user == address(0)) revert Errors.ZeroAddress();
        uint256 before = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = IERC20(token).balanceOf(address(this)) - before;
        IERC20(token).forceApprove(address(CORE), received);
        CORE.depositFor(token, received, order.user);
        _tryOpen(order, v, r, s);
    }

    /// @notice Relay a signed order without a deposit.
    function openWithSig(OpenOrder calldata order, uint8 v, bytes32 r, bytes32 s) external nonReentrant {
        _tryOpen(order, v, r, s);
    }

    function orderHash(OpenOrder calldata o) public view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    OPEN_ORDER_TYPEHASH,
                    o.user,
                    o.marketId,
                    o.isLong,
                    o.notionalUsd6,
                    o.acceptablePrice18,
                    o.deadline,
                    o.nonce
                )
            )
        );
    }

    function _tryOpen(OpenOrder calldata o, uint8 v, bytes32 r, bytes32 s) private {
        bytes32 digest = orderHash(o);
        (address signer, ECDSA.RecoverError err,) = ECDSA.tryRecover(digest, v, r, s);
        if (err != ECDSA.RecoverError.NoError || signer != o.user) {
            emit Events.OrderSkipped(o.user, digest, abi.encodeWithSelector(Errors.InvalidSignature.selector));
            return;
        }
        if (nonceUsed[o.user][o.nonce]) {
            emit Events.OrderSkipped(o.user, digest, abi.encodeWithSelector(Errors.NonceUsed.selector));
            return;
        }
        nonceUsed[o.user][o.nonce] = true;
        try CORE.increaseFor(o.user, o.marketId, o.isLong, o.notionalUsd6, o.acceptablePrice18, o.deadline) {
            emit Events.OrderExecuted(o.user, digest, o.marketId, o.notionalUsd6);
        } catch (bytes memory reason) {
            emit Events.OrderSkipped(o.user, digest, reason);
        }
    }
}
