// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {Test} from "forge-std/Test.sol";
import {AccessManager} from "@openzeppelin/contracts/access/manager/AccessManager.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Constants as C} from "../../src/libraries/Constants.sol";
import {Errors} from "../../src/libraries/Errors.sol";
import {MockAUSD} from "../../src/testnet/MockAUSD.sol";
import {MockUSDC} from "../../src/testnet/MockUSDC.sol";
import {PracticeSwap} from "../../src/testnet/PracticeSwap.sol";

/// @dev An 18-decimal token: par in raw units would be wrong, so the swap must refuse to pair it.
contract EighteenDecimals is ERC20 {
    constructor() ERC20("Eighteen", "E18") {}
}

/// @title PracticeSwap (D-252) — AUSD ↔ USDC at par from the float, nothing else, no way to take the float out.
contract PracticeSwapTest is Test {
    uint256 internal constant FLOAT_USD6 = 1000e6;
    uint256 internal constant WALLET_USD6 = 50e6;
    uint256 internal constant SWAP_USD6 = 12_345_678;

    AccessManager internal am;
    MockAUSD internal ausd;
    MockUSDC internal usdc;
    PracticeSwap internal practice;
    address internal user = makeAddr("user");
    address internal friend = makeAddr("friend");

    event PracticeSwapped(
        address indexed sender,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        address to
    );

    function setUp() public {
        vm.chainId(C.TESTNET_CHAIN_ID);
        am = new AccessManager(address(this));
        ausd = new MockAUSD(address(am));
        usdc = new MockUSDC(address(am));
        practice = new PracticeSwap(IERC20(address(ausd)), IERC20(address(usdc)));
        ausd.mint(address(practice), FLOAT_USD6);
        usdc.mint(address(practice), FLOAT_USD6);
        ausd.mint(user, WALLET_USD6);
        usdc.mint(user, WALLET_USD6);
    }

    function _swap(address tokenIn, uint256 amount, uint256 minOut, address to) internal returns (uint256 out) {
        vm.startPrank(user);
        IERC20(tokenIn).approve(address(practice), amount);
        out = practice.swap(tokenIn, amount, minOut, to);
        vm.stopPrank();
    }

    function test_ausdToUsdcAtPar() public {
        vm.startPrank(user);
        ausd.approve(address(practice), SWAP_USD6);
        vm.expectEmit(address(practice));
        emit PracticeSwapped(user, address(ausd), address(usdc), SWAP_USD6, SWAP_USD6, user);
        uint256 out = practice.swap(address(ausd), SWAP_USD6, SWAP_USD6, user);
        vm.stopPrank();
        assertEq(out, SWAP_USD6, "par");
        assertEq(ausd.balanceOf(user), WALLET_USD6 - SWAP_USD6, "AUSD paid");
        assertEq(usdc.balanceOf(user), WALLET_USD6 + SWAP_USD6, "USDC received");
        assertEq(ausd.allowance(user, address(practice)), 0, "exact approval spent");
    }

    function test_usdcToAusdAtPar() public {
        _swap(address(usdc), SWAP_USD6, SWAP_USD6, user);
        assertEq(usdc.balanceOf(user), WALLET_USD6 - SWAP_USD6, "USDC paid");
        assertEq(ausd.balanceOf(user), WALLET_USD6 + SWAP_USD6, "AUSD received");
    }

    function test_floatTotalNeverMoves() public {
        _swap(address(ausd), SWAP_USD6, 0, user);
        _swap(address(usdc), WALLET_USD6, 0, user);
        uint256 total = ausd.balanceOf(address(practice)) + usdc.balanceOf(address(practice));
        assertEq(total, 2 * FLOAT_USD6, "the input stays, the output leaves: total unchanged");
    }

    function test_paysAnotherRecipient() public {
        _swap(address(ausd), SWAP_USD6, SWAP_USD6, friend);
        assertEq(usdc.balanceOf(friend), SWAP_USD6, "paid to `to`");
        assertEq(usdc.balanceOf(user), WALLET_USD6, "not to the sender");
    }

    function test_refusesAnyOtherToken() public {
        EighteenDecimals other = new EighteenDecimals();
        vm.expectRevert(abi.encodeWithSelector(Errors.UnsupportedToken.selector, address(other)));
        practice.swap(address(other), SWAP_USD6, 0, user);
        vm.expectRevert(abi.encodeWithSelector(Errors.UnsupportedToken.selector, address(0)));
        practice.swap(address(0), SWAP_USD6, 0, user);
    }

    function test_refusesMinOutAbovePar() public {
        vm.startPrank(user);
        ausd.approve(address(practice), SWAP_USD6);
        vm.expectRevert(abi.encodeWithSelector(Errors.SlippageOut.selector, SWAP_USD6, SWAP_USD6 + 1));
        practice.swap(address(ausd), SWAP_USD6, SWAP_USD6 + 1, user);
        vm.stopPrank();
    }

    function test_refusesZeroAmountAndRecipient() public {
        vm.expectRevert(Errors.ZeroAmount.selector);
        practice.swap(address(ausd), 0, 0, user);
        vm.expectRevert(Errors.ZeroAddress.selector);
        practice.swap(address(ausd), SWAP_USD6, 0, address(0));
    }

    function test_refusesAShortFloat() public {
        uint256 big = FLOAT_USD6 + 1;
        ausd.mint(user, big);
        vm.startPrank(user);
        ausd.approve(address(practice), big);
        vm.expectRevert(abi.encodeWithSelector(Errors.InsufficientBalance.selector, FLOAT_USD6, big));
        practice.swap(address(ausd), big, big, user);
        vm.stopPrank();
    }

    function test_needsTheApproval() public {
        vm.prank(user);
        vm.expectRevert();
        practice.swap(address(ausd), SWAP_USD6, SWAP_USD6, user);
    }

    function test_constructorRefusesMismatchedPairs() public {
        EighteenDecimals other = new EighteenDecimals();
        vm.expectRevert(Errors.InvalidParams.selector);
        new PracticeSwap(IERC20(address(ausd)), IERC20(address(other)));
        vm.expectRevert(Errors.InvalidParams.selector);
        new PracticeSwap(IERC20(address(ausd)), IERC20(address(ausd)));
        vm.expectRevert(Errors.ZeroAddress.selector);
        new PracticeSwap(IERC20(address(0)), IERC20(address(usdc)));
    }

    function test_refusesMainnet() public {
        vm.chainId(C.MAINNET_CHAIN_ID);
        vm.expectRevert(abi.encodeWithSelector(Errors.TestnetOnly.selector, C.MAINNET_CHAIN_ID));
        new PracticeSwap(IERC20(address(ausd)), IERC20(address(usdc)));
    }

    /// @dev Any amount the wallet holds swaps at exactly par, both ways.
    function testFuzz_parBothWays(uint256 amount, bool fromAusd) public {
        amount = bound(amount, 1, WALLET_USD6);
        (address tokenIn, IERC20 tokenOut) = fromAusd ? (address(ausd), IERC20(usdc)) : (address(usdc), IERC20(ausd));
        uint256 before = tokenOut.balanceOf(user);
        uint256 out = _swap(tokenIn, amount, amount, user);
        assertEq(out, amount, "par");
        assertEq(tokenOut.balanceOf(user) - before, amount, "received par");
    }
}
