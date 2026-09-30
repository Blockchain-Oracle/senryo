// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {AccessManaged} from "@openzeppelin/contracts/access/manager/AccessManaged.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ReentrancyGuardTransient} from "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";
import {ISenryoCore} from "../interfaces/ISenryoCore.sol";
import {Constants as C} from "../libraries/Constants.sol";
import {Errors} from "../libraries/Errors.sol";
import {Events} from "../libraries/Events.sol";

interface IMintable {
    function mint(address to, uint256 amount) external;
}

/// @title StarterDrip — sponsor-relayed starter funds (D-030). The user signs, the sponsor (RELAYER_ROLE) submits.
/// @notice One claim per address: a gas-only MON drip, plus (practice/testnet only) mock AUSD credited to the core.
/// Mainnet AUSD only via voucher codes (hash allowlist, capped count). Every native outflow counts against an onchain
/// daily budget; gas top-ups are additionally capped per address per day.
contract StarterDrip is AccessManaged, EIP712, ReentrancyGuardTransient {
    using SafeERC20 for IERC20;

    struct Config {
        uint256 dripWei;
        uint256 dailyBudgetWei;
        uint256 topUpCapWei;
        address practiceToken;
        uint256 practiceAmount;
        address voucherToken;
        uint256 voucherAmount;
        uint256 maxVouchers;
    }

    // Config events live here, not in `Events`, so the shared libraries keep their bytecode (S8.5).
    event DripConfigSet(uint256 dripWei, uint256 dailyBudgetWei, uint256 topUpCapWei);
    event GasToppedUp(address indexed user, uint256 amount);
    /// @dev `token` is address(0) for native MON.
    event DripWithdrawn(address indexed token, address indexed to, uint256 amount);

    bytes32 public constant CLAIM_TYPEHASH = keccak256("Claim(address user,uint64 deadline)");
    bytes32 public constant VOUCHER_TYPEHASH = keccak256("Voucher(address user,bytes32 codeHash,uint64 deadline)");

    ISenryoCore public immutable CORE;
    Config public config;
    mapping(address user => bool) public claimed;
    mapping(bytes32 codeHash => bool) public voucherValid;
    mapping(bytes32 codeHash => bool) public voucherUsed;
    uint256 public vouchersRedeemed;
    uint64 public budgetDay;
    uint256 public spentToday;
    mapping(address user => mapping(uint64 day => uint256)) public toppedUp;

    constructor(address authority, ISenryoCore core, Config memory cfg)
        AccessManaged(authority)
        EIP712("SenryoStarterDrip", "1")
    {
        if (address(core) == address(0)) revert Errors.ZeroAddress();
        CORE = core;
        config = cfg;
    }

    receive() external payable {}

    // ---------------------------------------------------------------- relayed (RELAYER_ROLE)

    function claimFor(address user, uint64 deadline, bytes calldata signature) external nonReentrant restricted {
        if (deadline < block.timestamp) revert Errors.DeadlinePassed();
        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(CLAIM_TYPEHASH, user, deadline)));
        if (ECDSA.recoverCalldata(digest, signature) != user) revert Errors.InvalidSignature();
        if (claimed[user]) revert Errors.AlreadyClaimed(user);
        claimed[user] = true;
        Config memory cfg = config;
        uint256 practice;
        if (cfg.practiceToken != address(0) && cfg.practiceAmount != 0) {
            IMintable(cfg.practiceToken).mint(address(this), cfg.practiceAmount);
            _credit(cfg.practiceToken, cfg.practiceAmount, user);
            practice = cfg.practiceAmount;
        }
        _sendNative(user, cfg.dripWei);
        emit Events.StarterClaimed(user, cfg.dripWei, practice);
    }

    function redeemVoucher(address user, bytes calldata code, uint64 deadline, bytes calldata signature)
        external
        nonReentrant
        restricted
    {
        if (deadline < block.timestamp) revert Errors.DeadlinePassed();
        bytes32 codeHash = keccak256(code);
        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(VOUCHER_TYPEHASH, user, codeHash, deadline)));
        if (ECDSA.recoverCalldata(digest, signature) != user) revert Errors.InvalidSignature();
        if (!voucherValid[codeHash] || voucherUsed[codeHash]) revert Errors.UnknownVoucher(codeHash);
        Config memory cfg = config;
        if (vouchersRedeemed >= cfg.maxVouchers) revert Errors.VoucherCapReached();
        voucherUsed[codeHash] = true;
        ++vouchersRedeemed;
        _credit(cfg.voucherToken, cfg.voucherAmount, user);
        emit Events.VoucherRedeemed(user, codeHash, cfg.voucherAmount);
    }

    /// @notice Auto gas top-up (D-030), capped per address per day and by the daily budget.
    function topUp(address user, uint256 amount) external nonReentrant restricted {
        uint64 day = uint64(block.timestamp / C.SECONDS_PER_DAY);
        uint256 total = toppedUp[user][day] + amount;
        if (total > config.topUpCapWei) revert Errors.BudgetExceeded(total, config.topUpCapWei);
        toppedUp[user][day] = total;
        _sendNative(user, amount);
        emit GasToppedUp(user, amount);
    }

    // ---------------------------------------------------------------- admin

    function addVouchers(bytes32[] calldata codeHashes) external restricted {
        for (uint256 i; i < codeHashes.length; ++i) {
            voucherValid[codeHashes[i]] = true;
        }
        emit Events.VouchersAdded(codeHashes.length);
    }

    function setConfig(Config calldata cfg) external restricted {
        config = cfg;
        emit DripConfigSet(cfg.dripWei, cfg.dailyBudgetWei, cfg.topUpCapWei);
    }

    /// @notice ADMIN (the Safe on mainnet): recover MON. The recipient is the admin's choice by design.
    function withdrawNative(address payable to, uint256 amount) external nonReentrant restricted {
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert Errors.NativeTransferFailed();
        emit DripWithdrawn(address(0), to, amount);
    }

    function withdrawToken(IERC20 token, address to, uint256 amount) external restricted {
        token.safeTransfer(to, amount);
        emit DripWithdrawn(address(token), to, amount);
    }

    // ---------------------------------------------------------------- internal

    function _credit(address token, uint256 amount, address user) private {
        IERC20(token).forceApprove(address(CORE), amount);
        CORE.depositFor(token, amount, user);
    }

    function _sendNative(address to, uint256 amount) private {
        if (amount == 0) return;
        uint64 day = uint64(block.timestamp / C.SECONDS_PER_DAY);
        if (day != budgetDay) {
            budgetDay = day;
            spentToday = 0;
        }
        uint256 spent = spentToday + amount;
        if (spent > config.dailyBudgetWei) revert Errors.BudgetExceeded(spent, config.dailyBudgetWei);
        spentToday = spent;
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert Errors.NativeTransferFailed();
    }
}
