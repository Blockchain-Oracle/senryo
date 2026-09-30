// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IPermit2, IUniversalRouter, PoolKey} from "../../src/periphery/CollateralSwapper.sol";
import {Constants as C} from "../../src/libraries/Constants.sol";
import {Account as CoreAccount} from "../../src/libraries/Types.sol";
import {SeedConstants as S} from "../../script/SeedConstants.sol";
import {ForkStack} from "./ForkStack.sol";

/// @dev The five-field layout from docs.uniswap.org that CollateralSwapper used before D-122/D-180.
struct LegacyExactInputSingleParams {
    PoolKey poolKey;
    bool zeroForOne;
    uint128 amountIn;
    uint128 amountOutMinimum;
    bytes hookData;
}

/// @title S8.4 / D-122 — SenryoCore.swapCollateral through CollateralSwapper on a Monad mainnet fork.
/// @notice `MONAD_FORK_URL=http://127.0.0.1:<port> forge test --match-path 'test/fork/*' -vv`. The received amount
/// must equal the v4 Quoter's quote at the same state, in both directions, with the user's `minOut` enforced.
contract CollateralSwapperForkTest is ForkStack {
    uint256 internal constant SWAP_USD6 = 100e6;
    /// @dev Client-side slippage used for `minOut` (the app derives it from the Quoter the same way).
    uint256 internal constant SLIPPAGE_BPS = 10;
    uint8 internal constant V4_SWAP = 0x10;
    uint8 internal constant SWAP_EXACT_IN_SINGLE = 0x06;
    uint8 internal constant SETTLE_ALL = 0x0c;
    uint8 internal constant TAKE_ALL = 0x0f;

    address internal user = makeAddr("user");

    function setUp() public {
        if (!_forkOrSkip()) return;
        _deployStack();
    }

    function test_usdcToAusd_matchesQuoter() public {
        _swapMatchesQuote(usdc, ausd);
    }

    function test_ausdToUsdc_matchesQuoter() public {
        _swapMatchesQuote(ausd, usdc);
    }

    /// @notice The user's minOut is the protection: one unit above the quote reverts and nothing moves.
    function test_minOutAboveQuote_reverts() public {
        _depositInto(user, usdc, SWAP_USD6);
        uint256 quoted = _quote(false, SWAP_USD6);
        vm.prank(user);
        vm.expectRevert();
        core.swapCollateral(address(usdc), SWAP_USD6, quoted + 1);
        CoreAccount memory a = core.account(user);
        assertEq(a.usdc, SWAP_USD6, "usdc untouched");
        assertEq(a.ausd, 0, "no ausd credited");
    }

    /// @notice D-122 evidence kept as a regression: the deployed router rejects the five-field layout.
    function test_legacyFiveFieldLayout_reverts() public {
        address holder = makeAddr("holder");
        _fund(holder, usdc, SWAP_USD6);
        vm.startPrank(holder);
        usdc.approve(S.PERMIT2, SWAP_USD6);
        IPermit2(S.PERMIT2).approve(address(usdc), S.UNIVERSAL_ROUTER, uint160(SWAP_USD6), uint48(block.timestamp));
        bytes[] memory params = new bytes[](3);
        params[0] = abi.encode(LegacyExactInputSingleParams(S.stablePoolKey(), false, uint128(SWAP_USD6), 0, bytes("")));
        params[1] = abi.encode(address(usdc), SWAP_USD6);
        params[2] = abi.encode(address(ausd), uint256(0));
        bytes[] memory inputs = new bytes[](1);
        inputs[0] = abi.encode(abi.encodePacked(SWAP_EXACT_IN_SINGLE, SETTLE_ALL, TAKE_ALL), params);
        vm.expectRevert();
        IUniversalRouter(S.UNIVERSAL_ROUTER).execute(abi.encodePacked(V4_SWAP), inputs, block.timestamp);
        vm.stopPrank();
    }

    function _swapMatchesQuote(IERC20 tokenIn, IERC20 tokenOut) internal {
        _depositInto(user, tokenIn, SWAP_USD6);
        bool zeroForOne = address(tokenIn) == S.stablePoolKey().currency0;
        uint256 quoted = _quote(zeroForOne, SWAP_USD6);
        uint256 minOut = quoted * (C.BPS - SLIPPAGE_BPS) / C.BPS;
        uint256 coreOutBefore = tokenOut.balanceOf(address(core));

        vm.prank(user);
        core.swapCollateral(address(tokenIn), SWAP_USD6, minOut);

        CoreAccount memory a = core.account(user);
        uint256 received = address(tokenOut) == S.MAINNET_AUSD ? a.ausd : a.usdc;
        uint256 left = address(tokenIn) == S.MAINNET_AUSD ? a.ausd : a.usdc;
        emit log_named_uint("amountIn (usd6)", SWAP_USD6);
        emit log_named_uint("quoter amountOut", quoted);
        emit log_named_uint("credited amountOut", received);
        assertEq(received, quoted, "credited == Quoter quote");
        assertEq(left, 0, "input fully debited");
        assertEq(tokenOut.balanceOf(address(core)) - coreOutBefore, quoted, "core custody grew by the output");
        assertEq(tokenIn.balanceOf(address(swapper)), 0, "no input left in the swapper");
        assertEq(tokenOut.balanceOf(address(swapper)), 0, "no output left in the swapper");
    }
}
