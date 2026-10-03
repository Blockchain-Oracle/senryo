// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {console} from "forge-std/console.sol";
import {VmSafe} from "forge-std/Vm.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MockStable} from "../src/testnet/MockStable.sol";
import {PracticeSwap} from "../src/testnet/PracticeSwap.sol";
import {Constants as C} from "../src/libraries/Constants.sol";
import {DeployBase} from "./DeployBase.sol";

/// @title DeployPracticeSwap — the Practice AUSD ↔ USDC par swap on 10143 (D-252, UNDEFINED-6).
/// @notice `forge script script/PracticeSwap.s.sol --rpc-url monad_testnet --account senryo-deployer --password-file
/// ~/.config/senryo/deployer.password --sender <addr> --broadcast --slow --gas-estimate-multiplier 110`.
/// Ensure-style: deploys PracticeSwap over the recorded mocks once (a recorded, matching one is reused; drift reverts),
/// then mints each mock up to FLOAT_USD6 on it — the deployer is MINTER, the swap itself holds no role. Every other
/// entry of the address book is carried over untouched. Testnet only.
contract DeployPracticeSwap is DeployBase {
    error TestnetOnly();

    /// @dev The float of each mock the swap pays out from: P$1,000,000 a side (the input stays, so it only shifts).
    uint256 internal constant FLOAT_USD6 = 1_000_000e6;

    function run() external {
        if (block.chainid != C.TESTNET_CHAIN_ID) revert TestnetOnly();
        _load();
        _keepRecorded();
        address ausd = _recorded("MockAUSD");
        address usdc = _recorded("MockUSDC");

        vm.startBroadcast();
        address swap = _ensure(
            "PracticeSwap",
            abi.encodePacked(type(PracticeSwap).creationCode, abi.encode(IERC20(ausd), IERC20(usdc))),
            false
        );
        _fill(MockStable(ausd), swap);
        _fill(MockStable(usdc), swap);
        vm.stopBroadcast();

        console.log("PracticeSwap", swap);
        if (!vm.isContext(VmSafe.ForgeContext.ScriptDryRun)) _write();
    }

    /// @dev Tops the swap's float of `token` up to FLOAT_USD6 (skipped once it is there).
    function _fill(MockStable token, address swap) internal {
        uint256 held = token.balanceOf(swap);
        if (held >= FLOAT_USD6) return;
        token.mint(swap, FLOAT_USD6 - held);
        console.log("float minted (usd6):", FLOAT_USD6 - held);
    }
}
