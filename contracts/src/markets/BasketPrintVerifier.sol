// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {IPyth} from "./interfaces/IPyth.sol";
import {PythPrintVerifier} from "./PythPrintVerifier.sol";
import {BASKET_BASE_POINTS_E8, BASKET_MAX_MEMBERS, BASKET_MIN_MEMBERS, BPS} from "./MarketTypes.sol";

/// @title BasketPrintVerifier — a basket of Pyth feeds as one print, in points (D-286, D-124).
/// @notice A basket is its definition: member feed ids, weights in basis points (summing to 10,000) and each member's
///         frozen base price; its `feedId` is the hash of that definition, so a re-base is a new market. The print at
///         `t` is every member's unique print at `t` (the same rule as `PythPrintVerifier`, proved in one
///         `parsePriceFeedUpdatesUnique` call), combined as Σ wᵢ · pᵢ / baseᵢ × 1,000 points (floored per member); its
///         confidence is the same sum of the members' confidences, its publish time the latest member's. Every
///         member must pass its own quality bound, so one missing or wide member voids the basket's slot. Stateless;
///         each proof emits the members it used (the Proof page shows them).
contract BasketPrintVerifier is PythPrintVerifier {
    struct Basket {
        bytes32[] ids;
        uint16[] weightsBps;
        int64[] basesE8;
    }

    event BasketPrint(bytes32 indexed basketId, uint40 indexed t, int64[] pricesE8, uint64[] confsE8, uint40[] times);

    error WrongBasket(bytes32 feedId, bytes32 defined);
    error BadBasket();

    constructor(IPyth pyth_, uint16 graceSec_, uint16 maxConfBps_, uint32 admissionSec_)
        PythPrintVerifier(pyth_, graceSec_, maxConfBps_, admissionSec_)
    {}

    /// @notice The `feedId` a basket definition is recorded under.
    function basketId(Basket memory def) public pure returns (bytes32) {
        return keccak256(abi.encode(def.ids, def.weightsBps, def.basesE8));
    }

    /// @inheritdoc PythPrintVerifier
    function fee(bytes calldata proof) external view override returns (uint256) {
        (, bytes[] memory updates) = abi.decode(proof, (Basket, bytes[]));
        return pyth.getUpdateFee(updates);
    }

    /// @inheritdoc PythPrintVerifier
    /// @dev `proof` is `abi.encode(Basket def, bytes[] updates)`: the definition and every member's update for `t`.
    function verifyPrint(bytes calldata proof, bytes32 feedId, uint40 t)
        external
        payable
        override
        returns (int64 priceE8, uint64 confE8, uint40 publishTime)
    {
        (Basket memory def, bytes[] memory updates) = abi.decode(proof, (Basket, bytes[]));
        bytes32 defined = basketId(def);
        if (defined != feedId) revert WrongBasket(feedId, defined);
        _validate(def);
        uint256 required = pyth.getUpdateFee(updates);
        if (msg.value != required) revert WrongFee(msg.value, required);
        IPyth.PriceFeed[] memory feeds =
            pyth.parsePriceFeedUpdatesUnique{value: msg.value}(updates, def.ids, uint64(t), uint64(t) + graceSec);
        uint256 n = def.ids.length;
        if (feeds.length != n) revert NotUnique(feedId, t);
        int64[] memory prices = new int64[](n);
        uint64[] memory confs = new uint64[](n);
        uint40[] memory times = new uint40[](n);
        uint256 index;
        uint256 conf;
        for (uint256 i; i < n; ++i) {
            if (feeds[i].id != def.ids[i]) revert NotUnique(def.ids[i], t);
            (prices[i], confs[i], times[i]) = _checked(feeds[i].price, t);
            // forge-lint: disable-next-line(unsafe-typecast)
            uint256 base = uint256(uint64(def.basesE8[i]));
            uint256 weight = def.weightsBps[i];
            // forge-lint: disable-next-line(unsafe-typecast)
            index += (weight * uint256(uint64(prices[i])) * BASKET_BASE_POINTS_E8) / (BPS * base);
            conf += (weight * uint256(confs[i]) * BASKET_BASE_POINTS_E8) / (BPS * base);
            if (times[i] > publishTime) publishTime = times[i];
        }
        if (index == 0 || index > uint256(uint64(type(int64).max)) || conf > type(uint64).max) revert BadBasket();
        // forge-lint: disable-next-line(unsafe-typecast)
        priceE8 = int64(uint64(index));
        // forge-lint: disable-next-line(unsafe-typecast)
        confE8 = uint64(conf);
        emit BasketPrint(feedId, t, prices, confs, times);
    }

    /// @dev 2–8 distinct members, weights summing to 10,000 bps, positive bases.
    function _validate(Basket memory def) private pure {
        uint256 n = def.ids.length;
        if (n < BASKET_MIN_MEMBERS || n > BASKET_MAX_MEMBERS) revert BadBasket();
        if (def.weightsBps.length != n || def.basesE8.length != n) revert BadBasket();
        uint256 total;
        for (uint256 i; i < n; ++i) {
            if (def.weightsBps[i] == 0 || def.basesE8[i] <= 0 || def.ids[i] == bytes32(0)) revert BadBasket();
            for (uint256 j; j < i; ++j) {
                if (def.ids[j] == def.ids[i]) revert BadBasket();
            }
            total += def.weightsBps[i];
        }
        if (total != BPS) revert BadBasket();
    }
}
