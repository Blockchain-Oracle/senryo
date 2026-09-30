// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Create2} from "@openzeppelin/contracts/utils/Create2.sol";
import {IInboxFactory, ISenryoCore} from "../interfaces/ISenryoCore.sol";
import {Errors} from "../libraries/Errors.sol";
import {Events} from "../libraries/Events.sol";
import {DepositInbox} from "./DepositInbox.sol";

/// @title InboxFactory — deterministic per-user deposit inboxes (salt = user address).
/// @notice `inboxOf(user)` is known before deployment, so the app can show it at once; `sweep(user)` deploys on
/// first use and sweeps. The core tags inbox deposits as DepositSource.INBOX via `inboxOf`.
contract InboxFactory is IInboxFactory {
    ISenryoCore public immutable CORE;
    IERC20 public immutable AUSD;
    IERC20 public immutable USDC;

    constructor(ISenryoCore core, IERC20 ausd, IERC20 usdc) {
        if (address(core) == address(0)) revert Errors.ZeroAddress();
        CORE = core;
        AUSD = ausd;
        USDC = usdc;
    }

    /// @inheritdoc IInboxFactory
    function inboxOf(address user) public view returns (address) {
        return Create2.computeAddress(_salt(user), keccak256(_initCode(user)));
    }

    function deploy(address user) public returns (address inbox) {
        inbox = inboxOf(user);
        if (inbox.code.length != 0) return inbox;
        if (user == address(0)) revert Errors.ZeroAddress();
        inbox = address(new DepositInbox{salt: _salt(user)}(user, CORE, AUSD, USDC));
        emit Events.InboxDeployed(user, inbox);
    }

    /// @notice Permissionless: deploy if needed, then sweep AUSD/USDC into `depositFor(user)`.
    function sweep(address user) external {
        DepositInbox(deploy(user)).sweep();
    }

    function _salt(address user) private pure returns (bytes32) {
        return bytes32(uint256(uint160(user)));
    }

    function _initCode(address user) private view returns (bytes memory) {
        return abi.encodePacked(type(DepositInbox).creationCode, abi.encode(user, CORE, AUSD, USDC));
    }
}
