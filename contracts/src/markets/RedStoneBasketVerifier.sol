// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {IPrintVerifier} from "./interfaces/IPrintVerifier.sol";
import {RedStonePrintVerifier} from "./RedStonePrintVerifier.sol";
import {BASKET_BASE_POINTS_E8, BASKET_MAX_MEMBERS, BASKET_MIN_MEMBERS, BPS} from "./MarketTypes.sol";

/// @title RedStoneBasketVerifier — a basket of RedStone feeds as one print, in points (D-286, D-284).
/// @notice `BasketPrintVerifier`'s rule over RedStone's signed packages: a basket is its definition (member feed ids,
///         weights summing to 10,000 bps, frozen bases) and its `feedId` the definition's hash; its print of `t` is every
///         member's print of `t` as `single` proves it — the same 10-second grid point, the same signer rules — combined
///         as Σ wᵢ · pᵢ / baseᵢ × 1,000 points, the confidence the same sum, the publish time the grid point. One member
///         short of signers voids the slot. Stateless and free, like `single`.
contract RedStoneBasketVerifier is IPrintVerifier {
    struct Basket {
        bytes32[] ids;
        uint16[] weightsBps;
        int64[] basesE8;
    }

    RedStonePrintVerifier public immutable single;

    event BasketPrint(bytes32 indexed basketId, uint40 indexed t, int64[] pricesE8, uint64[] confsE8);

    error WrongBasket(bytes32 feedId, bytes32 defined);
    error BadBasket();
    error FeeNotTaken();

    constructor(RedStonePrintVerifier single_) {
        single = single_;
    }

    /// @inheritdoc IPrintVerifier
    function admissionSec() external view returns (uint32) {
        return single.admissionSec();
    }

    /// @inheritdoc IPrintVerifier
    function fee(bytes calldata) external pure returns (uint256) {
        return 0;
    }

    /// @notice The `feedId` a basket definition is recorded under (the same hash as `BasketPrintVerifier.basketId`).
    function basketId(Basket memory def) public pure returns (bytes32) {
        return keccak256(abi.encode(def.ids, def.weightsBps, def.basesE8));
    }

    /// @inheritdoc IPrintVerifier
    /// @dev `proof` is `abi.encode(Basket def, bytes[] payloads)`: each member's RedStone payload for `t`.
    function verifyPrint(bytes calldata proof, bytes32 feedId, uint40 t)
        external
        payable
        returns (int64 priceE8, uint64 confE8, uint40 publishTime)
    {
        if (msg.value != 0) revert FeeNotTaken();
        (Basket memory def, bytes[] memory payloads) = abi.decode(proof, (Basket, bytes[]));
        bytes32 defined = basketId(def);
        if (defined != feedId) revert WrongBasket(feedId, defined);
        uint256 n = def.ids.length;
        if (n < BASKET_MIN_MEMBERS || n > BASKET_MAX_MEMBERS || def.weightsBps.length != n) revert BadBasket();
        if (def.basesE8.length != n || payloads.length != n) revert BadBasket();
        int64[] memory prices = new int64[](n);
        uint64[] memory confs = new uint64[](n);
        uint256 index;
        uint256 conf;
        uint256 total;
        for (uint256 i; i < n; ++i) {
            if (def.weightsBps[i] == 0 || def.basesE8[i] <= 0) revert BadBasket();
            for (uint256 j; j < i; ++j) {
                if (def.ids[j] == def.ids[i]) revert BadBasket();
            }
            total += def.weightsBps[i];
            (prices[i], confs[i], publishTime) = single.verifyPrint(payloads[i], def.ids[i], t);
            // forge-lint: disable-next-line(unsafe-typecast)
            uint256 base = uint256(uint64(def.basesE8[i]));
            // forge-lint: disable-next-line(unsafe-typecast)
            index += (uint256(def.weightsBps[i]) * uint256(uint64(prices[i])) * BASKET_BASE_POINTS_E8) / (BPS * base);
            conf += (uint256(def.weightsBps[i]) * uint256(confs[i]) * BASKET_BASE_POINTS_E8) / (BPS * base);
        }
        if (total != BPS || index == 0 || index > uint256(uint64(type(int64).max)) || conf > type(uint64).max) {
            revert BadBasket();
        }
        // forge-lint: disable-next-line(unsafe-typecast)
        priceE8 = int64(uint64(index));
        // forge-lint: disable-next-line(unsafe-typecast)
        confE8 = uint64(conf);
        emit BasketPrint(feedId, t, prices, confs);
    }
}
