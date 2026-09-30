// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {Script} from "forge-std/Script.sol";
import {SenryoCore} from "../src/core/SenryoCore.sol";
import {LpVault} from "../src/lp/LpVault.sol";
import {StarterDrip} from "../src/periphery/StarterDrip.sol";
import {MockStable} from "../src/testnet/MockStable.sol";
import {Constants as C} from "../src/libraries/Constants.sol";
import {Book} from "../src/libraries/Types.sol";
import {SeedConstants as S} from "./SeedConstants.sol";

/// @title Seeder — idempotent testnet seeds (mock AUSD/USDC only; mainnet seeding is a separate [OK?] step in S8).
/// @notice LP: dead-address shares first, then the LP seed · INSURANCE · CARD_FLOAT · StarterDrip MON float (only
/// when the deployer stays above Monad's 10 MON reserve).
abstract contract Seeder is Script {
    uint256 internal constant RESERVE_WEI = 10 ether;

    function _seedTestnet(
        SenryoCore core,
        LpVault vault,
        StarterDrip drip,
        address ausd,
        address usdc,
        address deployer
    ) internal {
        MockStable a = MockStable(ausd);
        MockStable u = MockStable(usdc);
        if (vault.totalSupply() == 0) {
            uint256 lpTotal = S.LP_DEAD_SEED_USD6 + S.LP_SEED_USD6;
            a.mint(deployer, lpTotal);
            a.approve(address(vault), lpTotal);
            vault.deposit(S.LP_DEAD_SEED_USD6, C.DEAD_ADDRESS);
            vault.deposit(S.LP_SEED_USD6, deployer);
        }
        (uint256 insurance,) = core.book(Book.INSURANCE);
        if (insurance == 0) {
            a.mint(deployer, S.INSURANCE_SEED_USD6);
            a.approve(address(core), S.INSURANCE_SEED_USD6);
            core.fundBook(Book.INSURANCE, ausd, S.INSURANCE_SEED_USD6);
        }
        (, uint256 floatUsdc) = core.book(Book.CARD_FLOAT);
        if (floatUsdc == 0) {
            u.mint(deployer, S.CARD_FLOAT_SEED_USD6);
            u.approve(address(core), S.CARD_FLOAT_SEED_USD6);
            core.fundBook(Book.CARD_FLOAT, usdc, S.CARD_FLOAT_SEED_USD6);
        }
        if (address(drip).balance == 0 && deployer.balance > RESERVE_WEI + S.TESTNET_STARTER_FUND_WEI) {
            (bool ok,) = payable(address(drip)).call{value: S.TESTNET_STARTER_FUND_WEI}("");
            require(ok, "starter fund");
        }
    }
}
