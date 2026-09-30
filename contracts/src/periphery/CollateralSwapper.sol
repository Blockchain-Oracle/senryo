// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {AccessManaged} from "@openzeppelin/contracts/access/manager/AccessManaged.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {ICollateralSwapper} from "../interfaces/ISenryoCore.sol";
import {Errors} from "../libraries/Errors.sol";

/// @dev Uniswap v4 PoolKey (currencies as addresses; `address(0)` would be native).
struct PoolKey {
    address currency0;
    address currency1;
    uint24 fee;
    int24 tickSpacing;
    address hooks;
}

/// @dev IV4Router.ExactInputSingleParams of the v4-periphery that the deployed Universal Router 2.1.2 pins (545a5d2):
/// six fields, with `minHopPriceX36` between `amountOutMinimum` and `hookData` (D-122). The five-field layout on
/// docs.uniswap.org is shorter than the router's 0x160-byte decoder minimum and reverts inside `unlockCallback`.
struct ExactInputSingleParams {
    PoolKey poolKey;
    bool zeroForOne;
    uint128 amountIn;
    uint128 amountOutMinimum;
    uint256 minHopPriceX36;
    bytes hookData;
}

interface IUniversalRouter {
    function execute(bytes calldata commands, bytes[] calldata inputs, uint256 deadline) external payable;
}

interface IPermit2 {
    function approve(address token, address spender, uint160 amount, uint48 expiration) external;
}

/// @title CollateralSwapper — AUSD ↔ USDC through the allowlisted Uniswap v4 Universal Router (D-021, D-039).
/// @notice Called only by SenryoCore.swapCollateral, which debits the user, measures the output and risk-checks.
/// Command V4_SWAP with actions SWAP_EXACT_IN_SINGLE, SETTLE_ALL, TAKE_ALL; the input is approved through Permit2.
/// The pool key (read onchain in S3, D-122) is a deploy constant; `setPoolKey` is PARAM_ADMIN (timelocked).
/// The user's protection is `minOut`, enforced three times: the router's `amountOutMinimum`, TAKE_ALL's minimum and
/// the core's measured balance delta.
contract CollateralSwapper is AccessManaged, ICollateralSwapper {
    using SafeERC20 for IERC20;
    using SafeCast for uint256;

    uint8 internal constant V4_SWAP = 0x10;
    uint8 internal constant SWAP_EXACT_IN_SINGLE = 0x06;
    uint8 internal constant SETTLE_ALL = 0x0c;
    uint8 internal constant TAKE_ALL = 0x0f;
    uint256 internal constant ACTION_COUNT = 3;
    uint256 internal constant SETTLE_INDEX = 1;
    uint256 internal constant TAKE_INDEX = 2;
    /// @dev `minHopPriceX36` disabled (D-180). For an exact-in single hop with a fixed `amountIn` the router's floor
    /// `amountOut × 1e36 / amountIn ≥ minHopPriceX36` is the same bound as `amountOut ≥ amountOutMinimum`, so `minOut`
    /// already expresses it; a contract-wide price floor would instead block a depeg exit the user chose to take.
    uint256 internal constant NO_HOP_PRICE_FLOOR = 0;

    address public immutable CORE;
    IUniversalRouter public immutable ROUTER;
    IPermit2 public immutable PERMIT2;
    PoolKey public poolKey;

    constructor(address authority, address core, IUniversalRouter router, IPermit2 permit2, PoolKey memory key)
        AccessManaged(authority)
    {
        if (core == address(0) || address(router) == address(0) || address(permit2) == address(0)) {
            revert Errors.ZeroAddress();
        }
        CORE = core;
        ROUTER = router;
        PERMIT2 = permit2;
        poolKey = key;
    }

    function setPoolKey(PoolKey calldata key) external restricted {
        poolKey = key;
    }

    /// @inheritdoc ICollateralSwapper
    function swap(address tokenIn, address tokenOut, uint256 amountIn, uint256 minOut)
        external
        returns (uint256 amountOut)
    {
        if (msg.sender != CORE) revert Errors.NotCore(msg.sender);
        PoolKey memory key = poolKey;
        bool zeroForOne = tokenIn == key.currency0;
        if (zeroForOne ? tokenOut != key.currency1 : (tokenIn != key.currency1 || tokenOut != key.currency0)) {
            revert Errors.SwapUnavailable();
        }
        uint128 amountIn128 = amountIn.toUint128();
        uint128 minOut128 = minOut.toUint128();
        IERC20(tokenIn).forceApprove(address(PERMIT2), amountIn);
        PERMIT2.approve(tokenIn, address(ROUTER), amountIn128, uint48(block.timestamp));

        bytes[] memory params = new bytes[](ACTION_COUNT);
        params[0] =
            abi.encode(ExactInputSingleParams(key, zeroForOne, amountIn128, minOut128, NO_HOP_PRICE_FLOOR, bytes("")));
        params[SETTLE_INDEX] = abi.encode(tokenIn, amountIn);
        params[TAKE_INDEX] = abi.encode(tokenOut, minOut);
        bytes[] memory inputs = new bytes[](1);
        inputs[0] = abi.encode(abi.encodePacked(SWAP_EXACT_IN_SINGLE, SETTLE_ALL, TAKE_ALL), params);
        ROUTER.execute(abi.encodePacked(V4_SWAP), inputs, block.timestamp);

        amountOut = IERC20(tokenOut).balanceOf(address(this));
        if (amountOut < minOut) revert Errors.SlippageOut(amountOut, minOut);
        IERC20(tokenOut).safeTransfer(CORE, amountOut);
    }
}
