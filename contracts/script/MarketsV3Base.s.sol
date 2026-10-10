// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {stdJson} from "forge-std/StdJson.sol";
import {AccessManager} from "@openzeppelin/contracts/access/manager/AccessManager.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SSTORE2} from "solady/utils/SSTORE2.sol";
import {DuelArena} from "../src/games/DuelArena.sol";
import {DuelClocks, DuelTier} from "../src/games/DuelTypes.sol";
import {BandReserve} from "../src/markets/BandReserve.sol";
import {TailTableData} from "../src/markets/TailTableData.sol";
import {Windows} from "../src/markets/Windows.sol";
import {IWindows} from "../src/markets/interfaces/IWindows.sol";
import "../src/markets/MarketTypes.sol";
import "../src/markets/RideTypes.sol";
import {MarketsBase} from "./MarketsBase.s.sol";

/// @title MarketsV3Base — the v3 reserve's own deploy steps (D-299…D-313), shared by `DeployMarkets` (a fresh network)
///        and `ReplaceReserve` (testnet's v3 on the contracts v2 left, D-309): the shape table and the reserve, the
///        arena on it, the σ signers, the ride markets and their terms.
abstract contract MarketsV3Base is MarketsBase {
    using stdJson for string;

    /// @dev AccessManager role that pairs duel entries (`DuelArena.openMatch`): the api's matchmaker, on the sponsor (D-294).
    uint64 internal constant DUEL_ROLE = 5;

    /// @dev The network's ride terms as forge decodes the catalogue (fields in key order) — decoded once: every JSON
    ///      cheatcode copies the whole catalogue into memory, which a script never frees (Monad caps it at 8 MB).
    struct RideTermsJson {
        uint256 earlyFeeBps;
        uint256 earlyWindowSec;
        uint256 marketReserveBps;
        uint256 marketReserveCap;
        uint256 maxHourlyLossBps;
        uint256 maxLifeSec;
        uint256 maxLinearBps;
        uint256 maxMargin;
        uint256 maxMoveBps;
        uint256 maxProfitBps;
        uint256 minMargin;
        uint256 skewCapBps;
    }

    /// @dev One ride market as forge decodes the catalogue (fields in key order).
    struct RideJson {
        bytes32 feedId;
        uint256 makerFeeBps;
        uint256 maxLeverageBps;
        string symbol;
        uint256 takerFeeBps;
    }

    function _deployReserve(AccessManager manager, IERC20 collateral, Windows windows)
        internal
        returns (BandReserve reserve)
    {
        Params memory p = Params({
            minHalfSpreadE6: uint32(_json.readUint(".params.minHalfSpreadE6")),
            maxSurchargeE6: uint32(_json.readUint(".params.maxSurchargeE6")),
            minProbE6: uint32(_json.readUint(".params.minProbE6")),
            maxProbE6: uint32(_json.readUint(".params.maxProbE6")),
            maxExposureBps: uint16(_json.readUint(".params.maxExposureBps")),
            maxExpiryReserved: uint64(_json.readUint(".params.maxExpiryReserved")),
            minStake: uint64(_json.readUint(".params.minStake")),
            maxStake: uint64(_json.readUint(".params.maxStake")),
            fillDelaySec: uint8(_json.readUint(".params.fillDelaySec"))
        });
        BandReserve.Caps memory caps = BandReserve.Caps({
            maxPerCallCap: uint64(_json.readUint(".session.maxPerCallCap")),
            maxSessionCap: uint64(_json.readUint(".session.maxSessionCap")),
            maxSessionSec: uint40(_json.readUint(".session.maxSessionSec"))
        });
        // The calibrated shape table lives in its own data contract, so a recalibration is `setTailTable` (D-300).
        address table = SSTORE2.write(TailTableData.BLOB);
        _record("TailTable", table, TailTableData.BLOB, false);
        // Testnet's v3 numbers its tickets after v1's (D-314).
        uint256 ticketBase = _json.readUint(".ticketBase");
        reserve = new BandReserve(address(manager), collateral, IWindows(address(windows)), table, p, caps, ticketBase);
        _record(
            "BandReserve",
            address(reserve),
            abi.encodePacked(
                type(BandReserve).creationCode,
                abi.encode(address(manager), address(collateral), address(windows), table, p, caps, ticketBase)
            ),
            true
        );
    }

    /// @dev The duel arena (D-294) on this reserve: its clocks and tiers from `.duel`, `openMatch` for the matchmaker.
    function _duel(AccessManager manager, BandReserve reserve, address sponsor) internal {
        DuelClocks memory clocks = DuelClocks({
            revealWindowSec: uint32(_json.readUint(".duel.revealWindowSec")),
            pickWindowSec: uint32(_json.readUint(".duel.pickWindowSec")),
            minCardLifeSec: uint32(_json.readUint(".duel.minCardLifeSec"))
        });
        DuelArena arena = new DuelArena(address(manager), reserve, clocks);
        _record(
            "DuelArena",
            address(arena),
            abi.encodePacked(type(DuelArena).creationCode, abi.encode(address(manager), address(reserve), clocks)),
            true
        );
        uint256[] memory pots = _json.readUintArray(".duel.pots");
        uint256[] memory stakes = _json.readUintArray(".duel.cardStakes");
        for (uint256 i; i < pots.length; ++i) {
            arena.setTier(uint8(i), DuelTier({pot: uint64(pots[i]), cardStake: uint64(stakes[i]), enabled: true}));
        }
        bytes4[] memory fns = new bytes4[](1);
        fns[0] = DuelArena.openMatch.selector;
        manager.labelRole(DUEL_ROLE, "DUEL");
        manager.setTargetFunctionRole(address(arena), fns, DUEL_ROLE);
        manager.grantRole(DUEL_ROLE, sponsor, 0);
    }

    /// @dev Keys that sign σ marks (D-300, D-313): the keeper's (each minute) and the relay's (so a fill never waits on
    ///      one service). Idempotent.
    function _sigmaSigners(BandReserve reserve, address keeper, address relay) internal {
        if (!reserve.sigmaSigner(keeper)) reserve.setSigmaSigner(keeper, true);
        if (!reserve.sigmaSigner(relay)) reserve.setSigmaSigner(relay, true);
    }

    /// @dev Rides (D-299, D-301): the network's terms, then each ride market in on-chain order on the crypto
    ///      verifier — only those not yet listed, so a rerun resumes.
    function _rides(BandReserve reserve) internal {
        RideTermsJson memory tj = abi.decode(vm.parseJson(_json, ".rides.terms"), (RideTermsJson));
        RideTerms memory t = RideTerms({
            maxLinearBps: uint16(tj.maxLinearBps),
            maxHourlyLossBps: uint16(tj.maxHourlyLossBps),
            earlyFeeBps: uint16(tj.earlyFeeBps),
            earlyWindowSec: uint32(tj.earlyWindowSec)
        });
        (uint16 linear,,,) = reserve.rideTerms();
        if (linear != t.maxLinearBps) reserve.setRideTerms(t);
        RideJson[] memory all = abi.decode(vm.parseJson(_json, ".rides.markets"), (RideJson[]));
        for (uint256 i = reserve.rideMarketCount(); i < all.length; ++i) {
            reserve.addRideMarket(_rideMarket(all[i], tj));
        }
    }

    function _rideMarket(RideJson memory j, RideTermsJson memory tj) internal view returns (RideMarket memory) {
        return RideMarket({
            verifier: _verifierOf[keccak256(bytes("crypto"))],
            enabled: true,
            maxLeverageBps: uint32(j.maxLeverageBps),
            takerFeeBps: uint16(j.takerFeeBps),
            makerFeeBps: uint16(j.makerFeeBps),
            feedId: j.feedId,
            maxProfitBps: uint32(tj.maxProfitBps),
            maxMoveBps: uint16(tj.maxMoveBps),
            marketReserveBps: uint16(tj.marketReserveBps),
            skewCapBps: uint16(tj.skewCapBps),
            maxLifeSec: uint32(tj.maxLifeSec),
            marketReserveCap: uint64(tj.marketReserveCap),
            minMargin: uint64(tj.minMargin),
            maxMargin: uint64(tj.maxMargin)
        });
    }
}
