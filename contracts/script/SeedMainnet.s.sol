// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Script} from "forge-std/Script.sol";
import {stdJson} from "forge-std/StdJson.sol";
import {SenryoCore} from "../src/core/SenryoCore.sol";
import {Constants as C} from "../src/libraries/Constants.sol";
import {Book} from "../src/libraries/Types.sol";
import {LpVault} from "../src/lp/LpVault.sol";
import {SeedConstants as S} from "./SeedConstants.sol";

/// @title SeedMainnet — the S8.19 [OK?] seed on Monad mainnet with the deployer's REAL AUSD/USDC (never minted).
/// @notice Idempotent like the testnet Seeder: LP dead-address shares + the LP seed (only while the vault is empty),
/// INSURANCE (only while empty), CARD_FLOAT (only with SEED_CARD_FLOAT=true — the card is S10), StarterDrip MON float
/// (STARTER_FUND_WEI, kept above Monad's 10 MON reserve). Requires SENRYO_MAINNET_OK=true like Deploy.s.sol.
///   forge script script/SeedMainnet.s.sol --rpc-url monad_mainnet --account senryo-deployer --broadcast --slow
contract SeedMainnet is Script {
    using stdJson for string;

    uint256 internal constant RESERVE_WEI = 10 ether;

    error MainnetOnly();
    error MainnetNotApproved();
    error InsufficientBalance(address token, uint256 have, uint256 need);

    function run() external {
        if (block.chainid != C.MAINNET_CHAIN_ID) revert MainnetOnly();
        if (!vm.envOr("SENRYO_MAINNET_OK", false)) revert MainnetNotApproved();
        string memory json = vm.readFile(
            string.concat(
                vm.projectRoot(), "/../packages/contracts/src/addresses/", vm.toString(block.chainid), ".json"
            )
        );
        SenryoCore core = SenryoCore(json.readAddress(".contracts.SenryoCore.address"));
        LpVault vault = LpVault(json.readAddress(".contracts.LpVault.address"));
        address drip = json.readAddress(".contracts.StarterDrip.address");
        address deployer = msg.sender;

        vm.startBroadcast();
        if (vault.totalSupply() == 0) {
            uint256 lpTotal = S.LP_DEAD_SEED_USD6 + S.LP_SEED_USD6;
            _need(S.MAINNET_AUSD, deployer, lpTotal);
            IERC20(S.MAINNET_AUSD).approve(address(vault), lpTotal);
            vault.deposit(S.LP_DEAD_SEED_USD6, C.DEAD_ADDRESS);
            vault.deposit(S.LP_SEED_USD6, deployer);
        }
        (uint256 insurance,) = core.book(Book.INSURANCE);
        if (insurance == 0) {
            _need(S.MAINNET_AUSD, deployer, S.INSURANCE_SEED_USD6);
            IERC20(S.MAINNET_AUSD).approve(address(core), S.INSURANCE_SEED_USD6);
            core.fundBook(Book.INSURANCE, S.MAINNET_AUSD, S.INSURANCE_SEED_USD6);
        }
        (, uint256 floatUsdc) = core.book(Book.CARD_FLOAT);
        if (floatUsdc == 0 && vm.envOr("SEED_CARD_FLOAT", false)) {
            _need(S.MAINNET_USDC, deployer, S.CARD_FLOAT_SEED_USD6);
            IERC20(S.MAINNET_USDC).approve(address(core), S.CARD_FLOAT_SEED_USD6);
            core.fundBook(Book.CARD_FLOAT, S.MAINNET_USDC, S.CARD_FLOAT_SEED_USD6);
        }
        uint256 dripFund = vm.envOr("STARTER_FUND_WEI", uint256(0));
        if (dripFund != 0 && deployer.balance > RESERVE_WEI + dripFund) {
            (bool ok,) = payable(drip).call{value: dripFund}("");
            require(ok, "starter fund");
        }
        vm.stopBroadcast();
    }

    function _need(address token, address holder, uint256 amount) internal view {
        uint256 have = IERC20(token).balanceOf(holder);
        if (have < amount) revert InsufficientBalance(token, have, amount);
    }
}
