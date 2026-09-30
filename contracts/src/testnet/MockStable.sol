// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {AccessManaged} from "@openzeppelin/contracts/access/manager/AccessManaged.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Constants as C} from "../libraries/Constants.sol";
import {Errors} from "../libraries/Errors.sol";

/// @title MockStable — testnet-only 6-decimal stablecoin with a practice faucet (D-009: the testnet AUSD faucet is
/// empty). `mint` is MINTER_ROLE (StarterDrip, deployer); `faucet()` gives FAUCET_AMOUNT once per cooldown.
abstract contract MockStable is ERC20, AccessManaged {
    uint8 internal constant STABLE_DECIMALS = 6;
    uint256 public constant FAUCET_AMOUNT = 100e6;
    uint64 public constant FAUCET_COOLDOWN = 1 days;

    mapping(address account => uint64) public nextFaucetAt;

    constructor(string memory name_, string memory symbol_, address authority)
        ERC20(name_, symbol_)
        AccessManaged(authority)
    {
        if (block.chainid == C.MAINNET_CHAIN_ID) revert Errors.TestnetOnly(block.chainid);
    }

    function decimals() public pure override returns (uint8) {
        return STABLE_DECIMALS;
    }

    function mint(address to, uint256 amount) external restricted {
        _mint(to, amount);
    }

    function faucet() external {
        uint64 readyAt = nextFaucetAt[msg.sender];
        if (readyAt > block.timestamp) revert Errors.FaucetCooldown(readyAt);
        nextFaucetAt[msg.sender] = uint64(block.timestamp) + FAUCET_COOLDOWN;
        _mint(msg.sender, FAUCET_AMOUNT);
    }
}
