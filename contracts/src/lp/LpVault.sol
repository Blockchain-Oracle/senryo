// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {AccessManaged} from "@openzeppelin/contracts/access/manager/AccessManaged.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {ISenryoCore} from "../interfaces/ISenryoCore.sol";
import {Constants as C} from "../libraries/Constants.sol";
import {Errors} from "../libraries/Errors.sol";
import {Events} from "../libraries/Events.sol";

/// @title LpVault — ERC-4626 on AUSD whose assets live in SenryoCore's POOL book.
/// @notice Mint prices at the pool-favourable value (cash + receivables − trader PnL); redeem at the conservative one
/// (cash − max(trader PnL, 0)). Redeem is delayed (`requestRedeem` → `claimRedeem` after LP_REDEEM_DELAY) and blocked
/// unless every market is OPEN; the standard `withdraw`/`redeem` are disabled (max = 0). Virtual-share offset
/// LP_VIRTUAL_SHARE_OFFSET; the deploy seeds shares to the dead address. Deposits are capped at `tvlCap`.
contract LpVault is ERC4626, AccessManaged {
    using SafeERC20 for IERC20;

    struct RedeemRequest {
        address owner;
        address receiver;
        uint128 shares;
        uint64 claimableAt;
    }

    // Config events live here, not in `Events`, so the shared libraries keep their bytecode (S8.5).
    event TvlCapSet(uint256 cap);

    ISenryoCore public immutable CORE;
    uint256 public tvlCap;
    uint256 public nextRequestId;
    mapping(uint256 requestId => RedeemRequest) public requests;

    constructor(address authority, IERC20 ausd, ISenryoCore core, uint256 tvlCap_)
        ERC4626(ausd)
        ERC20("Senryo LP", "sLP")
        AccessManaged(authority)
    {
        if (address(core) == address(0)) revert Errors.ZeroAddress();
        CORE = core;
        tvlCap = tvlCap_;
    }

    // ---------------------------------------------------------------- valuation

    /// @notice Conservative value (used for redeem and display).
    function totalAssets() public view override returns (uint256) {
        return CORE.poolValue(false);
    }

    function previewDeposit(uint256 assets) public view override returns (uint256) {
        return _toShares(assets, CORE.poolValue(true), Math.Rounding.Floor);
    }

    function previewMint(uint256 shares) public view override returns (uint256) {
        return _toAssets(shares, CORE.poolValue(true), Math.Rounding.Ceil);
    }

    function maxDeposit(address) public view override returns (uint256) {
        uint256 value = CORE.poolValue(true);
        return value >= tvlCap ? 0 : tvlCap - value;
    }

    function maxMint(address receiver) public view override returns (uint256) {
        return _toShares(maxDeposit(receiver), CORE.poolValue(true), Math.Rounding.Floor);
    }

    /// @dev Instant exits are disabled; use requestRedeem/claimRedeem.
    function maxWithdraw(address) public pure override returns (uint256) {
        return 0;
    }

    function maxRedeem(address) public pure override returns (uint256) {
        return 0;
    }

    // ---------------------------------------------------------------- delayed redeem

    /// @notice Escrow `shares` now; claim after LP_REDEEM_DELAY at the conservative value then.
    function requestRedeem(uint256 shares, address receiver) external returns (uint256 requestId) {
        if (shares == 0) revert Errors.ZeroAmount();
        if (receiver == address(0)) revert Errors.ZeroAddress();
        _transfer(msg.sender, address(this), shares);
        requestId = nextRequestId++;
        uint64 claimableAt = uint64(block.timestamp) + C.LP_REDEEM_DELAY;
        requests[requestId] = RedeemRequest(msg.sender, receiver, uint128(shares), claimableAt);
        emit Events.RedeemRequested(msg.sender, receiver, requestId, shares, claimableAt);
    }

    function claimRedeem(uint256 requestId) external returns (uint256 assets) {
        RedeemRequest memory r = requests[requestId];
        if (r.shares == 0) revert Errors.RedeemUnknown(requestId);
        if (r.claimableAt > block.timestamp) revert Errors.RedeemNotReady(r.claimableAt);
        if (!CORE.allMarketsOpen()) revert Errors.MarketsNotOpen();
        delete requests[requestId];
        assets = _toAssets(r.shares, totalAssets(), Math.Rounding.Floor);
        _withdraw(address(this), r.receiver, address(this), assets, r.shares);
        emit Events.Redeemed(r.owner, r.receiver, requestId, r.shares, assets);
    }

    /// @notice PARAM_ADMIN (timelocked): raise or lower the TVL cap.
    function setTvlCap(uint256 cap) external restricted {
        tvlCap = cap;
        emit TvlCapSet(cap);
    }

    // ---------------------------------------------------------------- ERC-4626 hooks

    /// @dev Assets pass through the vault into the core's POOL book.
    function _transferIn(address from, uint256 assets) internal override {
        IERC20 token = IERC20(asset());
        token.safeTransferFrom(from, address(this), assets);
        token.forceApprove(address(CORE), assets);
        CORE.fundPool(assets);
    }

    function _transferOut(address to, uint256 assets) internal override {
        CORE.drainPool(assets, to);
    }

    function _decimalsOffset() internal pure override returns (uint8) {
        return C.LP_VIRTUAL_SHARE_OFFSET;
    }

    function _toShares(uint256 assets, uint256 value, Math.Rounding rounding) private view returns (uint256) {
        return Math.mulDiv(assets, totalSupply() + C.DECIMAL_BASE ** _decimalsOffset(), value + 1, rounding);
    }

    function _toAssets(uint256 shares, uint256 value, Math.Rounding rounding) private view returns (uint256) {
        return Math.mulDiv(shares, value + 1, totalSupply() + C.DECIMAL_BASE ** _decimalsOffset(), rounding);
    }
}
