// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Constants as C} from "../libraries/Constants.sol";
import {Errors} from "../libraries/Errors.sol";

/// @title PracticeSwap — testnet-only AUSD ↔ USDC at par for Practice (D-252, UNDEFINED-6). Not a market: no price,
/// no fee, no curve — one practice dollar for one, so the swap ticket, its review, the slide, the journal and Activity
/// run for real on 10143.
/// @notice It pays out from its own float of both mocks, and every swap leaves the float's total unchanged (the input
/// stays here). No roles and no owner: the float is refilled by anyone transferring (or a MINTER minting) mocks to it.
/// Only the two mocks swap, in raw units: the constructor refuses tokens whose decimals differ, so par holds by
/// construction. Refuses to deploy on mainnet.
contract PracticeSwap {
    using SafeERC20 for IERC20;

    event PracticeSwapped(
        address indexed sender,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        address to
    );

    IERC20 public immutable AUSD;
    IERC20 public immutable USDC;

    constructor(IERC20 ausd, IERC20 usdc) {
        if (block.chainid == C.MAINNET_CHAIN_ID) revert Errors.TestnetOnly(block.chainid);
        if (address(ausd) == address(0) || address(usdc) == address(0)) revert Errors.ZeroAddress();
        if (address(ausd) == address(usdc)) revert Errors.InvalidParams();
        if (IERC20Metadata(address(ausd)).decimals() != IERC20Metadata(address(usdc)).decimals()) {
            revert Errors.InvalidParams();
        }
        AUSD = ausd;
        USDC = usdc;
    }

    /// @return tokenOut the other mock; the amount out is always `amountIn` (par).
    function counterpart(address tokenIn) public view returns (IERC20 tokenOut) {
        if (tokenIn == address(AUSD)) return USDC;
        if (tokenIn == address(USDC)) return AUSD;
        revert Errors.UnsupportedToken(tokenIn);
    }

    /// @notice Pull `amountIn` of `tokenIn` from the caller (exact approval) and pay `amountIn` of the other mock to
    /// `to`. Reverts on any other token, a zero amount or recipient, `minOut` above par, or a float short of the output.
    function swap(address tokenIn, uint256 amountIn, uint256 minOut, address to) external returns (uint256 amountOut) {
        IERC20 tokenOut = counterpart(tokenIn);
        if (amountIn == 0) revert Errors.ZeroAmount();
        if (to == address(0)) revert Errors.ZeroAddress();
        amountOut = amountIn;
        if (amountOut < minOut) revert Errors.SlippageOut(amountOut, minOut);
        uint256 float = tokenOut.balanceOf(address(this));
        if (float < amountOut) revert Errors.InsufficientBalance(float, amountOut);
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        tokenOut.safeTransfer(to, amountOut);
        emit PracticeSwapped(msg.sender, tokenIn, address(tokenOut), amountIn, amountOut, to);
    }
}
