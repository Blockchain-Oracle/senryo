// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {Test} from "forge-std/Test.sol";

/// @notice `eth_estimateGas` inside a fork test: binary-search the smallest gas the call frame needs (each attempt
/// from the same state, under `forge test --isolate` so a top-level call is its own cold transaction), then add the
/// intrinsic cost (21,000 + calldata 4/16 per zero/non-zero byte). Unlike gas used this includes refunds and the 63/64
/// reserve. Checked against D-122: mainnet USDC `approve` → 87.3k here vs 87k from `eth_estimateGas` on anvil.
abstract contract GasEstimate is Test {
    uint256 internal constant EST_LO = 0;
    uint256 internal constant EST_HI = 5_000_000;
    uint256 internal constant EST_STEP = 64;
    uint256 internal constant TX_BASE = 21_000;
    uint256 internal constant CALLDATA_ZERO = 4;
    uint256 internal constant CALLDATA_NONZERO = 16;

    function _estimateAndCall(string memory label, address from, address to, bytes memory data)
        internal
        returns (uint256 estimate)
    {
        uint256 lo = EST_LO;
        uint256 hi = EST_HI;
        while (hi - lo > EST_STEP) {
            uint256 mid = (lo + hi) / 2;
            uint256 snap = vm.snapshotState();
            vm.prank(from);
            (bool ok,) = to.call{gas: mid}(data);
            vm.revertToState(snap);
            if (ok) hi = mid;
            else lo = mid;
        }
        estimate = hi + _intrinsic(data);
        vm.prank(from);
        (bool done, bytes memory ret) = to.call(data);
        if (!done) {
            assembly ("memory-safe") {
                revert(add(ret, 0x20), mload(ret))
            }
        }
        emit log_named_uint(string.concat("estimate ", label), estimate);
    }

    function _intrinsic(bytes memory data) internal pure returns (uint256 gas) {
        gas = TX_BASE;
        for (uint256 i; i < data.length; ++i) {
            gas += data[i] == 0 ? CALLDATA_ZERO : CALLDATA_NONZERO;
        }
    }
}
