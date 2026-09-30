// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {ICollateralSwapper, IInboxFactory} from "../interfaces/ISenryoCore.sol";
import {Constants as C} from "../libraries/Constants.sol";
import {Errors} from "../libraries/Errors.sol";
import {Events} from "../libraries/Events.sol";
import {Book, DepositSource} from "../libraries/Types.sol";
import {RiskModule} from "./RiskModule.sol";

/// @title AccountLedger — deposits, withdrawals, collateral swaps and book funding.
/// @notice Deposits credit the measured balance delta (never revert on the amount). Withdrawals and swaps are
/// risk-checked (I2). Withdraw to `msg.sender` is session-scoped; any other `to` is a client-side step-up (D-039).
abstract contract AccountLedger is RiskModule {
    using SafeERC20 for IERC20;
    using SafeCast for uint256;

    // ---------------------------------------------------------------- user

    function deposit(address token, uint256 amount) external nonReentrant {
        _deposit(msg.sender, token, amount, msg.sender, DepositSource.DIRECT);
    }

    /// @notice Credit `beneficiary` with what the caller transfers (Aurora recipe, inboxes, vouchers, router).
    function depositFor(address token, uint256 amount, address beneficiary) external nonReentrant {
        if (beneficiary == address(0)) revert Errors.ZeroAddress();
        _deposit(msg.sender, token, amount, beneficiary, _sourceOf(msg.sender, beneficiary));
    }

    function withdraw(address token, uint256 amount, address to) external nonReentrant {
        if (to == address(0)) revert Errors.ZeroAddress();
        if (amount == 0) revert Errors.ZeroAmount();
        _debit(msg.sender, token, amount);
        uint64 nonce = _bump(msg.sender);
        IERC20(token).safeTransfer(to, amount);
        emit Events.Withdrawn(msg.sender, to, token, amount, nonce);
        _emitRiskChecked(msg.sender);
    }

    /// @notice Swap collateral AUSD ↔ USDC through the allowlisted swapper (Uniswap v4, D-021); risk-checked.
    function swapCollateral(address tokenIn, uint256 amountIn, uint256 minOut) external nonReentrant {
        if (swapper == address(0)) revert Errors.SwapUnavailable();
        if (amountIn == 0) revert Errors.ZeroAmount();
        address tokenOut = tokenIn == AUSD ? USDC : AUSD;
        _debit(msg.sender, tokenIn, amountIn);
        uint256 before = IERC20(tokenOut).balanceOf(address(this));
        IERC20(tokenIn).safeTransfer(swapper, amountIn);
        ICollateralSwapper(swapper).swap(tokenIn, tokenOut, amountIn, minOut);
        uint256 received = IERC20(tokenOut).balanceOf(address(this)) - before;
        if (received < minOut) revert Errors.SlippageOut(received, minOut);
        _credit(msg.sender, tokenOut, received);
        uint64 nonce = _bump(msg.sender);
        emit Events.CollateralSwapped(msg.sender, tokenIn, tokenOut, amountIn, received, nonce);
        _emitRiskChecked(msg.sender);
    }

    // ---------------------------------------------------------------- books

    /// @notice LpVault only (POOL_ROLE): move AUSD from the vault into POOL.
    function fundPool(uint256 amount) external nonReentrant restricted {
        uint256 received = _pull(AUSD, msg.sender, amount);
        _books[Book.POOL].ausd += received.toUint128();
        emit Events.BookFunded(uint8(Book.POOL), AUSD, msg.sender, received);
    }

    /// @notice LpVault only (POOL_ROLE): pay AUSD out of POOL; the reserve (I4) must still hold afterwards.
    function drainPool(uint256 amount, address to) external nonReentrant restricted {
        uint256 cash = _books[Book.POOL].ausd;
        if (amount > cash) revert Errors.BookInsufficient(uint8(Book.POOL), cash, amount);
        _books[Book.POOL].ausd -= amount.toUint128();
        _requireReserve();
        IERC20(AUSD).safeTransfer(to, amount);
        emit Events.BookWithdrawn(uint8(Book.POOL), AUSD, to, amount);
    }

    /// @notice Anyone may fund INSURANCE or CARD_FLOAT (seeding; D-036 float).
    function fundBook(Book b, address token, uint256 amount) external nonReentrant {
        if (b == Book.POOL) revert Errors.InvalidParams();
        uint256 received = _pull(token, msg.sender, amount);
        if (token == AUSD) _books[b].ausd += received.toUint128();
        else _books[b].usdc += received.toUint128();
        emit Events.BookFunded(uint8(b), token, msg.sender, received);
    }

    /// @notice ADMIN: settle CARD_FLOAT / INSURANCE out (card network settlement, recovery).
    function withdrawBook(Book b, address token, uint256 amount, address to) external nonReentrant restricted {
        if (b == Book.POOL) revert Errors.InvalidParams();
        uint256 bal = token == AUSD ? _books[b].ausd : token == USDC ? _books[b].usdc : 0;
        if (amount > bal) revert Errors.BookInsufficient(uint8(b), bal, amount);
        if (token == AUSD) _books[b].ausd -= amount.toUint128();
        else _books[b].usdc -= amount.toUint128();
        IERC20(token).safeTransfer(to, amount);
        emit Events.BookWithdrawn(uint8(b), token, to, amount);
    }

    // ---------------------------------------------------------------- internal

    function _deposit(address payer, address token, uint256 amount, address beneficiary, DepositSource source)
        internal
    {
        uint256 received = _pull(token, payer, amount);
        _credit(beneficiary, token, received);
        uint64 nonce = _bump(beneficiary);
        emit Events.Deposited(beneficiary, payer, token, received, source, nonce);
        _emitRisk(beneficiary);
    }

    function _pull(address token, address from, uint256 amount) internal returns (uint256 received) {
        if (token != AUSD && token != USDC) revert Errors.UnsupportedToken(token);
        uint256 before = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransferFrom(from, address(this), amount);
        received = IERC20(token).balanceOf(address(this)) - before;
    }

    function _sourceOf(address caller, address beneficiary) internal view returns (DepositSource) {
        if (hasDepositSource[caller]) return depositSource[caller];
        if (inboxFactory != address(0) && IInboxFactory(inboxFactory).inboxOf(beneficiary) == caller) {
            return DepositSource.INBOX;
        }
        return caller == beneficiary ? DepositSource.DIRECT : DepositSource.AURORA;
    }

    /// @notice I4: Σ reserved max profit ≤ poolCash × MAX_RESERVE_UTIL_BPS / BPS.
    function _requireReserve() internal view {
        uint256 reserved = _reservedProfit();
        uint256 cap = _bookTotal(Book.POOL) * C.MAX_RESERVE_UTIL_BPS / C.BPS;
        if (reserved > cap) revert Errors.ReserveCapExceeded(reserved, cap);
    }
}
