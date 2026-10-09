// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

// From CWF d7b576b:contracts/src/products/parlay/ParlayReserve.sol (Masayume 68f7a09): the stake plus the house's share
// escrowed and locked against each distinct expiry, legs decided in close order (won / tied / lost / void), the payout
// to the owner. Re-based on Senryo (D-293): no order book and no supplier pool of its own — each leg is priced by
// `BandMath` at the unique print of the fill instant, and the shared pool backs it, so Earn values it.

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {BandBook} from "./BandBook.sol";
import {BandMath} from "./BandMath.sol";
import {ParlayMath} from "./ParlayMath.sol";
import {IPrintVerifier} from "./interfaces/IPrintVerifier.sol";
import "./MarketTypes.sol";

/// @title ParlayBook — 2–4 calls that must all come true, paid by the shared pool (D-293).
/// @notice A signed parlay escrows its stake now and fills at the unique print of the next second on every leg's feed:
///         each leg's band probability from the same maths as a single call, their joint chance (`ParlayMath`), the
///         spread once. The pool's share is reserved in full and locked against each distinct expiry, so Earn's roll
///         waits for every leg. Legs are decided in close order: a lost leg ends it, a void leg refunds it, a tied leg
///         drops out (the payout falls to the other legs' odds). No cash-out. Settlement and the payout are
///         permissionless, like a single call's.
abstract contract ParlayBook is BandBook {
    using SafeERC20 for IERC20;

    bytes32 public constant PARLAY_TYPEHASH = keccak256(
        "ParlayIntent(address owner,bytes32[] windowIds,uint8[] bands,uint64 stake,uint64 minPayout,address recipient,"
        "uint32 configVersion,uint64 deadline,uint256 nonce,uint32 epoch)"
    );

    Parlay[] internal _parlays;
    mapping(uint256 parlayId => ParlayLeg[]) internal _legs;

    event ParlayCommitted(
        uint256 indexed parlayId, address indexed owner, uint64 stake, uint64 minPayout, uint40 target, bool viaSession
    );
    event ParlayFilled(uint256 indexed parlayId, uint64 payout, uint32 chanceE6, uint32 priceE6, uint64 reserve);
    event ParlayRefused(uint256 indexed parlayId, uint8 reason, uint64 refunded);
    event ParlayLegDecided(uint256 indexed parlayId, uint8 leg, uint8 outcome);
    event ParlaySettled(uint256 indexed parlayId, address indexed to, uint8 outcome, uint256 amount, bool paid);

    error BadLegs();
    error UnknownParlay(uint256 parlayId);
    error ParlayNotPending(uint256 parlayId);

    // ------------------------------------------------------------------------------------------------ commit

    /// @notice Escrows a signed parlay; it fills at the unique print of the next second on every leg's feed.
    function commitParlay(ParlayIntent calldata it, bytes calldata sig, Permit calldata permit)
        external
        nonReentrant
        returns (uint256 id)
    {
        if (paused) revert IsPaused();
        if (it.configVersion != configVersion) revert WrongConfig(configVersion, it.configVersion);
        Params storage p = params;
        if (it.stake < p.minStake || it.stake > p.maxStake) revert BadStake(it.stake, p.minStake, p.maxStake);
        if (it.recipient == address(0)) revert ZeroAddress();
        id = _parlays.length + 1;
        _addLegs(id, it.windowIds, it.bands);
        bool viaSession = _authorizeSigned(
            Signed(it.owner, it.deadline, it.nonce, it.epoch, it.recipient), hashParlay(it), sig, it.stake
        );
        if (permit.deadline != 0) {
            try IERC20Permit(address(collateral))
                .permit(it.owner, address(this), permit.value, permit.deadline, permit.v, permit.r, permit.s) {}
                catch {}
        }
        collateral.safeTransferFrom(it.owner, address(this), it.stake);
        committedStakes += it.stake;
        uint40 target = uint40(block.timestamp) + FILL_DELAY_SEC;
        _parlays.push(
            Parlay({
                owner: it.owner,
                status: TICKET_COMMITTED,
                // forge-lint: disable-next-line(unsafe-typecast)
                legCount: uint8(it.windowIds.length),
                target: target,
                recipient: it.recipient,
                configVersion: it.configVersion,
                addOnE6: 0,
                stake: it.stake,
                payout: 0,
                limit: it.minPayout
            })
        );
        emit ParlayCommitted(id, it.owner, it.stake, it.minPayout, target, viaSession);
        _assertSolvent();
    }

    /// @dev 2–4 legs on trading windows with their line, in close order, one per market.
    function _addLegs(uint256 id, bytes32[] calldata windowIds, uint8[] calldata bands) private {
        uint256 n = windowIds.length;
        if (n < MIN_PARLAY_LEGS || n > MAX_PARLAY_LEGS || bands.length != n) revert BadLegs();
        ParlayLeg[] storage legs = _legs[id];
        bytes32[MAX_PARLAY_LEGS] memory markets;
        uint40 lastExpiry;
        for (uint256 i; i < n; ++i) {
            Window memory w = _tradingWindow(windowIds[i]);
            if (w.expiry < lastExpiry) revert BadLegs();
            lastExpiry = w.expiry;
            Series memory s = windows.seriesOf(w.seriesId);
            for (uint256 j; j < i; ++j) {
                if (markets[j] == s.market) revert BadLegs();
            }
            markets[i] = s.market;
            if (windows.openPrintOf(windowIds[i]).publishTime == 0) revert NoOpenPrint(windowIds[i]);
            if (bands[i] >= _menu[w.seriesId].length) revert UnknownBand(w.seriesId, bands[i]);
            if (sigmaOf[w.seriesId] == 0) revert NoVolatility(w.seriesId);
            legs.push(ParlayLeg(windowIds[i], w.expiry, bands[i], s.calendarId, LEG_PENDING, 0));
        }
    }

    function hashParlay(ParlayIntent calldata it) public view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    PARLAY_TYPEHASH,
                    it.owner,
                    keccak256(abi.encodePacked(it.windowIds)),
                    keccak256(abi.encodePacked(it.bands)),
                    it.stake,
                    it.minPayout,
                    it.recipient,
                    it.configVersion,
                    it.deadline,
                    it.nonce,
                    it.epoch
                )
            )
        );
    }

    // ------------------------------------------------------------------------------------------------ fill

    /// @notice Fills a committed parlay at the unique print of its instant on every leg's feed (`proofs` in leg order;
    ///         a print already recorded needs no fee, and what is not spent goes back). Permissionless.
    function finalizeParlay(uint256 id, bytes[] calldata proofs) external payable nonReentrant {
        Parlay storage pl = _parlay(id);
        if (pl.status != TICKET_COMMITTED) revert ParlayNotPending(id);
        ParlayLeg[] storage legs = _legs[id];
        if (proofs.length != legs.length) revert BadLegs();
        uint8 reason = _parlayExpiryReason(pl, legs, false);
        if (reason == 0 && pl.configVersion != configVersion) reason = REFUSE_CONFIG;
        uint256 spent;
        if (reason != 0) {
            _refuseParlay(id, pl, reason);
        } else {
            uint256[] memory probs;
            (spent, probs) = _pricedLegs(pl, legs, proofs);
            _fillParlay(id, pl, legs, probs);
        }
        if (msg.value > spent) Address.sendValue(payable(msg.sender), msg.value - spent);
        _assertSolvent();
    }

    /// @dev Records each leg's print (its fee only when new) and prices its band; 0 for a leg outside the pool's band.
    function _pricedLegs(Parlay storage pl, ParlayLeg[] storage legs, bytes[] calldata proofs)
        private
        returns (uint256 spent, uint256[] memory probs)
    {
        probs = new uint256[](legs.length);
        Params storage p = params;
        for (uint256 i; i < legs.length; ++i) {
            ParlayLeg storage leg = legs[i];
            PrintSource memory src = windows.primarySourceOf(leg.windowId);
            bool have = windows.printOf(src.verifier, src.feedId, pl.target).publishTime != 0;
            uint256 fee = have ? 0 : IPrintVerifier(src.verifier).fee(proofs[i]);
            spent += fee;
            Print memory print = windows.ensurePrint{value: fee}(src.verifier, src.feedId, pl.target, proofs[i]);
            Window memory w = windows.windowOf(leg.windowId);
            int64 k = windows.openPrintOf(leg.windowId).priceE8;
            uint256 prob = BandMath.probE6(
                _menu[w.seriesId][leg.band], k, print.priceE8, sigmaOf[w.seriesId], w.expiry - pl.target
            );
            if (prob >= p.minProbE6 && prob <= p.maxProbE6) probs[i] = prob;
        }
    }

    function _fillParlay(uint256 id, Parlay storage pl, ParlayLeg[] storage legs, uint256[] memory probs) private {
        Params storage p = params;
        uint8[] memory groups = new uint8[](legs.length);
        uint256 surchargeE6;
        for (uint256 i; i < legs.length; ++i) {
            if (probs[i] == 0) return _refuseParlay(id, pl, REFUSE_PRICE);
            groups[i] = legs[i].group;
            uint256 s = uint256(p.maxSurchargeE6) * reservedByExpiry[legs[i].expiry] / p.maxExpiryReserved;
            if (s > surchargeE6) surchargeE6 = s;
        }
        uint256 chance = ParlayMath.chanceE6(probs, groups);
        uint256 addOn = p.halfSpreadE6 + surchargeE6;
        uint256 priceE6 = chance + addOn;
        if (chance < p.minProbE6 || priceE6 >= P_ONE) return _refuseParlay(id, pl, REFUSE_PRICE);
        uint256 payout = BandMath.payoutFor(pl.stake, priceE6);
        if (payout <= pl.stake) return _refuseParlay(id, pl, REFUSE_PRICE);
        if (payout < pl.limit) return _refuseParlay(id, pl, REFUSE_SLIPPAGE);
        uint256 reserve = payout - pl.stake;
        if (!_parlayFits(reserve, legs)) return _refuseParlay(id, pl, REFUSE_CAPACITY);

        committedStakes -= pl.stake;
        escrowedStakes += pl.stake;
        liquid -= reserve;
        reserved += reserve;
        for (uint256 i; i < legs.length; ++i) {
            legs[i].probE6 = SafeCast.toUint32(probs[i]);
            if (_lastOnExpiry(legs, i)) reservedByExpiry[legs[i].expiry] += reserve;
        }
        pl.status = TICKET_OPEN;
        pl.payout = SafeCast.toUint64(payout);
        pl.addOnE6 = SafeCast.toUint32(addOn);
        pl.limit = 0;
        emit ParlayFilled(
            id, pl.payout, SafeCast.toUint32(chance), SafeCast.toUint32(priceE6), SafeCast.toUint64(reserve)
        );
    }

    /// @dev The pool's liquidity and total exposure, then every distinct expiry's own cap.
    function _parlayFits(uint256 reserve, ParlayLeg[] storage legs) private view returns (bool) {
        for (uint256 i; i < legs.length; ++i) {
            if (_lastOnExpiry(legs, i) && !_hasCapacity(reserve, legs[i].expiry)) return false;
        }
        return true;
    }

    /// @dev Legs are in close order, so leg `i` is its expiry's last when the next leg ends later (or there is none).
    function _lastOnExpiry(ParlayLeg[] storage legs, uint256 i) private view returns (bool) {
        return i + 1 == legs.length || legs[i + 1].expiry != legs[i].expiry;
    }

    /// @notice Refunds a committed parlay that can no longer fill: a leg's window is over, or a leg's print can't
    ///         come (its admission passed). Permissionless.
    function expireParlay(uint256 id) external nonReentrant {
        Parlay storage pl = _parlay(id);
        if (pl.status != TICKET_COMMITTED) revert ParlayNotPending(id);
        uint8 reason = _parlayExpiryReason(pl, _legs[id], true);
        if (reason != 0) _refuseParlay(id, pl, reason);
        _assertSolvent();
    }

    function _parlayExpiryReason(Parlay storage pl, ParlayLeg[] storage legs, bool printsToo)
        private
        view
        returns (uint8)
    {
        for (uint256 i; i < legs.length; ++i) {
            Window memory w = windows.windowOf(legs[i].windowId);
            // forge-lint: disable-next-line(block-timestamp)
            if (windowSettled[legs[i].windowId] || w.state != STATE_OPEN || block.timestamp >= w.expiry) {
                return REFUSE_WINDOW;
            }
            if (!printsToo) continue;
            PrintSource memory src = windows.primarySourceOf(legs[i].windowId);
            if (windows.printOf(src.verifier, src.feedId, pl.target).publishTime != 0) continue;
            // forge-lint: disable-next-line(block-timestamp)
            if (block.timestamp > uint256(pl.target) + IPrintVerifier(src.verifier).admissionSec()) {
                return REFUSE_NO_PRINT;
            }
        }
        return 0;
    }

    function _refuseParlay(uint256 id, Parlay storage pl, uint8 reason) private {
        committedStakes -= pl.stake;
        pl.status = TICKET_REFUNDED;
        pl.limit = 0;
        emit ParlayRefused(id, reason, pl.stake);
        _payOrOwe(pl.owner, pl.stake);
    }

    // ------------------------------------------------------------------------------------------------ settle

    /// @notice Decides the legs whose windows have their verdict, in close order, releasing each expiry's lock as its
    ///         last leg is decided; once the parlay is decided, pays it (or returns the escrow to the pool).
    ///         Permissionless; a parlay still waiting on a leg is left as it is.
    function settleParlay(uint256 id) external nonReentrant {
        Parlay storage pl = _parlay(id);
        if (pl.status != TICKET_OPEN) revert ParlayNotPending(id);
        ParlayLeg[] storage legs = _legs[id];
        uint256 reserve = pl.payout - pl.stake;
        uint8 verdict = LEG_WON;
        for (uint256 i; i < legs.length; ++i) {
            ParlayLeg storage leg = legs[i];
            if (leg.outcome == LEG_PENDING) {
                uint8 o = _legOutcome(leg);
                if (o == LEG_PENDING) {
                    verdict = LEG_PENDING;
                    break;
                }
                leg.outcome = o;
                // forge-lint: disable-next-line(unsafe-typecast)
                emit ParlayLegDecided(id, uint8(i), o);
                if (_lastOnExpiry(legs, i)) reservedByExpiry[leg.expiry] -= reserve;
            }
            if (leg.outcome == LEG_LOST || leg.outcome == LEG_VOID) {
                verdict = leg.outcome;
                break;
            }
        }
        if (verdict != LEG_PENDING) _finishParlay(id, pl, legs, verdict, reserve);
        _assertSolvent();
    }

    function _legOutcome(ParlayLeg storage leg) private view returns (uint8) {
        Window memory w = windows.windowOf(leg.windowId);
        if (w.state == STATE_OPEN) return LEG_PENDING;
        if (w.state == STATE_VOIDED) return LEG_VOID;
        uint8 o = BandMath.outcome(_menu[w.seriesId][leg.band], w.openE8, w.closeE8);
        return o == OUTCOME_WIN ? LEG_WON : o == OUTCOME_LOSE ? LEG_LOST : LEG_TIED;
    }

    /// @dev Releases what is still locked and the escrow; a lost parlay's escrow is the pool's, a void one refunds the
    ///      owner, a won one pays the recipient on its untied legs' odds (all tied: a refund).
    function _finishParlay(uint256 id, Parlay storage pl, ParlayLeg[] storage legs, uint8 verdict, uint256 reserve)
        private
    {
        uint256 n = legs.length;
        uint256[] memory probs = new uint256[](n);
        uint8[] memory groups = new uint8[](n);
        bool live;
        for (uint256 i; i < n; ++i) {
            if (legs[i].outcome == LEG_PENDING && _lastOnExpiry(legs, i)) reservedByExpiry[legs[i].expiry] -= reserve;
            if (legs[i].outcome == LEG_WON) {
                probs[i] = legs[i].probE6;
                groups[i] = legs[i].group;
                live = true;
            }
        }
        escrowedStakes -= pl.stake;
        reserved -= reserve;
        pl.status = TICKET_SETTLED;
        if (verdict == LEG_LOST) {
            liquid += pl.payout;
            emit ParlaySettled(id, pl.recipient, OUTCOME_LOSE, 0, true);
            return;
        }
        bool refund = verdict == LEG_VOID || !live;
        uint256 amount = pl.stake;
        if (!refund) {
            uint256 dropped = BandMath.payoutFor(pl.stake, ParlayMath.chanceE6(probs, groups) + pl.addOnE6);
            amount = dropped < pl.payout ? dropped : pl.payout;
        }
        address to = refund ? pl.owner : pl.recipient;
        liquid += pl.payout - amount;
        bool paid = _payOrOwe(to, amount);
        emit ParlaySettled(id, to, refund ? OUTCOME_REFUND : OUTCOME_WIN, amount, paid);
    }

    // ------------------------------------------------------------------------------------------------ views

    function parlayOf(uint256 id) external view returns (Parlay memory, ParlayLeg[] memory) {
        return (_parlay(id), _legs[id]);
    }

    function parlayCount() external view returns (uint256) {
        return _parlays.length;
    }

    function _parlay(uint256 id) internal view returns (Parlay storage) {
        if (id == 0 || id > _parlays.length) revert UnknownParlay(id);
        return _parlays[id - 1];
    }
}
