// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ISenryoCore} from "../interfaces/ISenryoCore.sol";
import {Events} from "../libraries/Events.sol";

/// @title DepositInbox — a per-user CREATE2 address that accepts AUSD/USDC from any Monad wallet (D-041).
/// @notice `sweep()` is permissionless and can only ever credit its one `USER` in the core.
contract DepositInbox {
    using SafeERC20 for IERC20;

    address public immutable USER;
    ISenryoCore public immutable CORE;
    IERC20 public immutable AUSD;
    IERC20 public immutable USDC;

    constructor(address user, ISenryoCore core, IERC20 ausd, IERC20 usdc) {
        USER = user;
        CORE = core;
        AUSD = ausd;
        USDC = usdc;
    }

    function sweep() external {
        _sweep(AUSD);
        _sweep(USDC);
    }

    function _sweep(IERC20 token) private {
        uint256 bal = token.balanceOf(address(this));
        if (bal == 0) return;
        token.forceApprove(address(CORE), bal);
        CORE.depositFor(address(token), bal, USER);
        emit Events.Swept(USER, address(this), address(token), bal);
    }
}
