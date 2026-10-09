// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {Test} from "forge-std/Test.sol";
import {RedStoneBasketVerifier} from "../../src/markets/RedStoneBasketVerifier.sol";
import {RedStonePrintVerifier} from "../../src/markets/RedStonePrintVerifier.sol";

/// @notice RedStone prints (D-284) against a real payload: NVDA from redstone-primary-prod's gateway (9 Oct 2026),
///         signed by its five production signers — so the port reads RedStone's actual wire format.
contract RedStoneTest is Test {
    bytes internal constant NVDA_LIVE = hex"4e5644410000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000005585d8c4d01a121696e0000000020000001d84bb8139a87cb4cb5a55eb66737686ae1693e4561aabc801fd18485486265e47277ac4f361aef314c2fc127177583a44eae20bcba594b00c485301cf60217ee1c4e5644410000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000005586915b601a121696e0000000020000001f9e87cf4b7bbc1b26ca1586a24eca904d2a98fb224af0a18745d5f2f118cf5cd1bf31ab9e4b765af35017d0acf972cf41a60d1ed130ef6af4aee4af275c97ae41b4e5644410000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000005585d8a5401a121696e000000002000000142eacb3a4c4739e44c440a04b142f8de726bd8d89d66ac2fa43511f6720e524a52a21528c03f52959cbca605d076eb58232264a546a70449959540b1fbba9de11b4e5644410000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000005586c374101a121696e00000000200000010efdada3a63bd2742c6fe90d948c5cab4fe1cfcab11c7a0f20aa4d9a3bf0e2ed7822e40bc36659c3e90c4cf49e586885c46dccbffe74909e786808f757d3e7f51b4e56444100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000055866d5bb01a121696e0000000020000001e7536084c992bdf41764e3e3b649dce973b1f9f85f37f26c4d7c11f7b4e57925613334d7aa5cce2bec52d361ca08080ab11c2c2d941968867df9e48a82e49fd31c0005000000000002ed57011e0000";
    bytes internal constant AAPL_LIVE = hex"4141504c0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000007c92f50cc01a121696e0000000020000001960de1d3e898079b8c5f9ef185e7fac49a496f9457d3e2a937db9a4a09371f7173716ade1191098e112cf2846c07cf8e21c3b30841ee82fed8c084cdde33bdc81c4141504c0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000007c8f4f6f201a121696e0000000020000001b3b3face79ce3d6c06d69339c5bb3f789e7198c5835f2fe7498364a1f5ea4f8873b346b899555f64787e742dcf4ba3dfeb7b5d0c42e331c137ea26acaf0a8d7c1c4141504c0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000007c8ede14001a121696e0000000020000001cbbdca5dfe7d5402d3f88c3226bd9ff31aa597dac119cef6c44d28038a362561054820e79393752e7fd40f1fbd8e16e8f1f0025485c477b507f5338ea53cc7731c4141504c0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000007c926186501a121696e00000000200000019d508570ff2d959978a40189c20b93f1ce30e771351de0ba385e04e8e406d49e39848e101afbd56b45b3038d3f6453b7fc84b37c268ca90d136eddfe8711e0e41b4141504c0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000007c94c53ab01a121696e000000002000000184536e5b2440b9cbc52aba34bd5dd13f87b2efb22ab70c18ec730a13244b9e744ef67b39601a91507efc033c531d8c59a48d9d91917a8cfeb94440d1ff5aee951b0005000000000002ed57011e0000";
    bytes32 internal constant NVDA = bytes32("NVDA");
    bytes32 internal constant AAPL = bytes32("AAPL");
    uint40 internal constant AT = 1_791_561_920; // the packages' grid point
    uint256 internal constant PACKAGE_LEN = 142;
    uint32 internal constant STRICT = 60;
    uint32 internal constant ADMISSION = 900;

    RedStonePrintVerifier internal verifier;

    function setUp() public {
        address[] memory signers = new address[](5);
        signers[0] = 0x8BB8F32Df04c8b654987DAaeD53D6B6091e3B774;
        signers[1] = 0xdEB22f54738d54976C4c0fe5ce6d408E40d88499;
        signers[2] = 0x51Ce04Be4b3E32572C4Ec9135221d0691Ba7d202;
        signers[3] = 0xDD682daEC5A90dD295d14DA4b0bec9281017b5bE;
        signers[4] = 0x9c5AE89C4Af6aA32cE58588DBaF90d18a855B6de;
        verifier = new RedStonePrintVerifier(signers, 3, STRICT, ADMISSION);
        vm.warp(AT + 1);
    }

    /// @dev The first `k` packages of a payload with its trailer rewritten for `k`.
    function first(bytes memory full, uint256 k) internal pure returns (bytes memory out) {
        out = new bytes(k * PACKAGE_LEN + 14);
        for (uint256 i; i < k * PACKAGE_LEN; ++i) out[i] = full[i];
        uint256 at = k * PACKAGE_LEN;
        out[at] = bytes1(uint8(k >> 8));
        out[at + 1] = bytes1(uint8(k));
        bytes9 marker = 0x000002ed57011e0000;
        for (uint256 i; i < 9; ++i) out[at + 5 + i] = marker[i];
    }

    function test_aLiveNvdaPrintIsTheMedianOfItsFiveSigners() public {
        (int64 price, uint64 conf, uint40 at) = verifier.verifyPrint(NVDA_LIVE, NVDA, AT);
        assertEq(price, 22_957_970_875, "median of the five signed values");
        assertEq(conf, 480_886, "half the signers' spread");
        assertEq(at, AT);
    }

    function test_anInstantOffTheGridTakesTheNextGridPoint() public {
        (,, uint40 at) = verifier.verifyPrint(NVDA_LIVE, NVDA, AT - 7);
        assertEq(at, AT);
        assertEq(verifier.printTimeOf(AT - 7), AT);
    }

    function test_theGridPointIsFixedByTheInstant() public {
        vm.warp(AT + 30);
        vm.expectRevert(abi.encodeWithSelector(RedStonePrintVerifier.TimestampMismatch.selector, uint256(AT + 10) * 1000));
        verifier.verifyPrint(NVDA_LIVE, NVDA, AT + 1);
    }

    function test_anotherFeedIsRefused() public {
        vm.expectRevert(abi.encodeWithSelector(RedStonePrintVerifier.FeedIdMismatch.selector, bytes32("AAPL")));
        verifier.verifyPrint(NVDA_LIVE, bytes32("AAPL"), AT);
    }

    function test_noPrintFromTheFuture() public {
        vm.warp(AT - 1);
        vm.expectRevert(abi.encodeWithSelector(RedStonePrintVerifier.NotYet.selector, AT));
        verifier.verifyPrint(NVDA_LIVE, NVDA, AT);
    }

    function test_whileFreshEverySignerMustBeThere() public {
        bytes memory three = first(NVDA_LIVE, 3);
        vm.expectRevert(abi.encodeWithSelector(RedStonePrintVerifier.TooFewSigners.selector, 3, 5));
        verifier.verifyPrint(three, NVDA, AT);
        vm.warp(AT + STRICT);
        (int64 price,,) = verifier.verifyPrint(three, NVDA, AT);
        assertGt(price, 0, "the threshold is enough once the grid point is no longer fresh");
    }

    function test_aSignerOutsideTheSetIsRefused() public {
        address[] memory others = new address[](1);
        others[0] = makeAddr("not redstone");
        RedStonePrintVerifier stranger = new RedStonePrintVerifier(others, 1, STRICT, ADMISSION);
        vm.warp(AT + STRICT);
        vm.expectRevert(RedStonePrintVerifier.UnknownSigner.selector);
        stranger.verifyPrint(first(NVDA_LIVE, 1), NVDA, AT);
    }

    function test_itCostsNothing() public view {
        assertEq(verifier.fee(NVDA_LIVE), 0);
    }

    function test_aRedStoneBasketIsItsMembersInPoints() public {
        RedStoneBasketVerifier basket = new RedStoneBasketVerifier(verifier);
        RedStoneBasketVerifier.Basket memory def;
        def.ids = new bytes32[](2);
        def.weightsBps = new uint16[](2);
        def.basesE8 = new int64[](2);
        (def.ids[0], def.ids[1]) = (NVDA, AAPL);
        (def.weightsBps[0], def.weightsBps[1]) = (5000, 5000);
        // Bases at the live medians: the basket is exactly 1,000 points at this grid point.
        (def.basesE8[0], def.basesE8[1]) = (22_957_970_875, 33_439_488_101);
        bytes[] memory payloads = new bytes[](2);
        (payloads[0], payloads[1]) = (NVDA_LIVE, AAPL_LIVE);
        (int64 price,, uint40 at) = basket.verifyPrint(abi.encode(def, payloads), basket.basketId(def), AT);
        assertEq(price, 1_000e8);
        assertEq(at, AT);
        assertEq(basket.admissionSec(), ADMISSION);
    }
}
