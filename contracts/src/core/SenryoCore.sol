// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {IPriceSource} from "../oracle/interfaces/IPriceSource.sol";
import {CollateralCfg, MarketParams} from "../libraries/Types.sol";
import {AdminModule} from "./AdminModule.sol";
import {CoreStorage} from "./CoreStorage.sol";

/// @title SenryoCore — one custody, one storage space, one transient lock, one nonce per account.
/// @notice Built from AccountLedger, CollateralConfig, RiskModule, MarketRegistry, MarketAccounting, PerpModule,
/// TriggerOrders, CardModule, LiquidationModule and AdminModule. "The same dollar is never spendable twice" is a
/// single-contract invariant (I2). Markets (gold, silver) and collateral (AUSD, USDC) are configured at construction;
/// market ids match SessionOracle's.
contract SenryoCore is AdminModule {
    constructor(
        address authority,
        address ausd,
        address usdc,
        IPriceSource oracle,
        MarketParams[] memory markets,
        CollateralCfg memory ausdCfg,
        CollateralCfg memory usdcCfg
    ) CoreStorage(authority, ausd, usdc, oracle) {
        for (uint256 i; i < markets.length; ++i) {
            _addMarket(markets[i]);
        }
        _setCollateral(ausd, ausdCfg);
        _setCollateral(usdc, usdcCfg);
    }
}
