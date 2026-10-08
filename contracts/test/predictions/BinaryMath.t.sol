// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;
import {Test} from "forge-std/Test.sol";
import {BinaryMath} from "../../src/predictions/BinaryMath.sol";

contract BinaryMathTest is Test {
    function testExhaustiveSmallIntegersA() public pure {
        exhaustive(1, 11);
    }

    function testExhaustiveSmallIntegersB() public pure {
        exhaustive(12, 22);
    }

    function testExhaustiveSmallIntegersC() public pure {
        exhaustive(23, 33);
    }

    function testExhaustiveSmallIntegersD() public pure {
        exhaustive(34, 44);
    }

    function exhaustive(uint256 first, uint256 last) internal pure {
        for (uint256 x = first; x <= last; x++) {
            for (uint256 y = 1; y <= 44; y++) {
                for (uint256 s = 1; s <= 89; s++) {
                    uint256 c = BinaryMath.sell(x, y, s);
                    assertGt(x + s - c, 0);
                    assertGt(y - c, 0);
                    assertGe((x + s - c) * (y - c), x * y);
                    if (c + 1 < y && c + 1 < x + s) assertLt((x + s - c - 1) * (y - c - 1), x * y);
                    uint256 out = BinaryMath.buy(x, y, s);
                    assertLe(BinaryMath.sell(x + s - out, y + s, out), s);
                }
            }
        }
    }

    function testFuzzSolvencyAndMaximality(uint256 a, uint256 b, uint256 input) public pure {
        uint256 x = bound(a, 1, 500 ether);
        uint256 y = bound(b, 1, 500 ether);
        uint256 s = bound(input, 1, 500 ether);
        uint256 c = BinaryMath.sell(x, y, s);
        assertGe((x + s - c) * (y - c), x * y);
        if (c + 1 < y && c + 1 < x + s) assertLt((x + s - c - 1) * (y - c - 1), x * y);
        uint256 out = BinaryMath.buy(x, y, s);
        assertLe(BinaryMath.sell(x + s - out, y + s, out), s);
    }
}
