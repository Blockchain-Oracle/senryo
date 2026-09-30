// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {Constants as C} from "../libraries/Constants.sol";
import {Events} from "../libraries/Events.sol";
import {DepositSource} from "../libraries/Types.sol";
import {LiquidationModule} from "./LiquidationModule.sol";

/// @title AdminModule — pauses, settle-only exit and wiring.
/// @notice Roles are assigned per selector in the AccessManager (see script/Deploy.s.sol):
/// `pause`/`unpause` GUARDIAN (pauses auto-expire after MAX_PAUSE_SECONDS) · `setSwapper` PARAM_ADMIN (timelocked) ·
/// `setSettleOnly`, `setDepositSource`, `setInboxFactory` ADMIN (Safe on mainnet).
/// The core is immutable (no proxy); the exit path is settle-only mode + redeploy + migration (F46).
abstract contract AdminModule is LiquidationModule {
    // Config events live here, not in `Events`, so the shared libraries keep their bytecode (S8.5).
    event SwapperSet(address indexed swapper);
    event InboxFactorySet(address indexed factory);

    /// @notice GUARDIAN: stop new risk until `now + MAX_PAUSE_SECONDS` (reduce, withdraw, liquidate still work).
    function pause() external restricted {
        pausedUntil = uint64(block.timestamp) + C.MAX_PAUSE_SECONDS;
        emit Events.PausedUntil(pausedUntil);
    }

    function unpause() external restricted {
        pausedUntil = 0;
        emit Events.PausedUntil(0);
    }

    /// @notice ADMIN: permanent reduce-only mode ahead of a migration.
    function setSettleOnly(bool on) external restricted {
        settleOnly = on;
        emit Events.SettleOnlySet(on);
    }

    /// @notice ADMIN: tag a trusted depositor (StarterDrip → VOUCHER, Aurora executor → AURORA).
    function setDepositSource(address caller, DepositSource source) external restricted {
        depositSource[caller] = source;
        hasDepositSource[caller] = true;
        emit Events.DepositSourceSet(caller, source);
    }

    /// @notice ADMIN: address(0) turns INBOX source detection off.
    function setInboxFactory(address factory) external restricted {
        inboxFactory = factory;
        emit InboxFactorySet(factory);
    }

    /// @notice PARAM_ADMIN (timelocked): the allowlisted collateral swap adapter; address(0) disables swaps.
    function setSwapper(address swapper_) external restricted {
        swapper = swapper_;
        emit SwapperSet(swapper_);
    }
}
