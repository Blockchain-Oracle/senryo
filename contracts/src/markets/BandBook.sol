// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

// Pricing from CWF d7b576b:contracts/src/products/range/RangePricing.sol `_price` (refuse outside the probability band,
// floored stake/payout, the pool must front something), re-based on the unique fill print instead of CWF's book centre
// (D-262). Commit-then-fill and cash-out are new for Senryo (D-261): a signed call escrows now and fills at the unique
// print of the next second; nobody — relayer, keeper or caller — can pick the price.

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {BandMath} from "./BandMath.sol";
import {BandPool} from "./BandPool.sol";
import {IPrintVerifier} from "./interfaces/IPrintVerifier.sol";
import {IWindows} from "./interfaces/IWindows.sol";
import {ExitOrders} from "./ExitOrders.sol";
import "./MarketTypes.sol";

/// @title BandBook — calls from signature to fill, cash-outs and the exits that cash out on their own.
abstract contract BandBook is BandPool, ExitOrders {
    using SafeERC20 for IERC20;

    IWindows public immutable windows;

    /// @dev Per-√second volatility × 1e8 per series (versioned through `configVersion`, bounded).
    mapping(bytes32 seriesId => uint64) public sigmaOf;
    mapping(bytes32 seriesId => BandDef[]) internal _menu;
    Ticket[] internal _tickets;
    mapping(bytes32 windowId => mapping(uint8 band => BandTotals)) public bandTotals;
    mapping(bytes32 windowId => uint16) public bandsUsed;
    mapping(bytes32 windowId => bool) public windowSettled;

    constructor(IWindows windows_) {
        if (address(windows_) == address(0)) revert ZeroAddress();
        windows = windows_;
    }

    // ------------------------------------------------------------------------------------------------ menu (PARAMS)

    /// @notice Appends a band to a series' fixed menu (D-263). Entries never change: tickets name them by index.
    function addBand(bytes32 seriesId, BandDef calldata d) external restricted {
        _requireSeries(seriesId);
        BandDef[] storage menu = _menu[seriesId];
        if (menu.length >= MAX_BANDS || !BandMath.isValid(d)) revert BadParams();
        menu.push(d);
        emit BandAdded(seriesId, uint8(menu.length - 1), d.kind, d.lowBps, d.highBps);
    }

    function setSigma(bytes32 seriesId, uint64 sigmaE8) external restricted {
        _requireSeries(seriesId);
        if (sigmaE8 == 0 || sigmaE8 > MAX_SIGMA_E8) revert BadParams();
        sigmaOf[seriesId] = sigmaE8;
        configVersion += 1;
        emit SigmaSet(seriesId, sigmaE8, configVersion);
    }

    // ------------------------------------------------------------------------------------------------ commit

    /// @notice Escrows a signed open (stake pulled now) or registers a signed close; either fills at the unique print
    ///         of the next second. `permit` (optional) sets the finite allowance in the same transaction (D-266). An
    ///         open pins the pricing config it was quoted on; a close doesn't (its minimum proceeds guard it, D-292).
    function commit(Intent calldata it, bytes calldata sig, Permit calldata permit)
        external
        nonReentrant
        returns (uint256 ticketId)
    {
        if (it.action == ACTION_OPEN) ticketId = _commitOpen(it, sig, permit);
        else if (it.action == ACTION_CLOSE) ticketId = _commitClose(it, sig);
        else revert BadAction(it.action);
        _assertSolvent();
    }

    function _commitOpen(Intent calldata it, bytes calldata sig, Permit calldata permit) private returns (uint256 id) {
        if (paused) revert IsPaused();
        if (it.configVersion != configVersion) revert WrongConfig(configVersion, it.configVersion);
        Params storage p = params;
        if (it.amount < p.minStake || it.amount > p.maxStake) revert BadStake(it.amount, p.minStake, p.maxStake);
        if (it.recipient == address(0)) revert ZeroAddress();
        Window memory w = _tradingWindow(it.windowId);
        if (windows.openPrintOf(it.windowId).publishTime == 0) revert NoOpenPrint(it.windowId);
        if (it.band >= _menu[w.seriesId].length) revert UnknownBand(w.seriesId, it.band);
        if (sigmaOf[w.seriesId] == 0) revert NoVolatility(w.seriesId);
        bool viaSession = _authorize(it, sig);
        if (permit.deadline != 0) {
            // A front-run permit only spends the same signature; the pull below is what must succeed.
            try IERC20Permit(address(collateral))
                .permit(it.owner, address(this), permit.value, permit.deadline, permit.v, permit.r, permit.s) {}
                catch {}
        }
        collateral.safeTransferFrom(it.owner, address(this), it.amount);
        committedStakes += it.amount;
        uint40 target = uint40(block.timestamp) + FILL_DELAY_SEC;
        _tickets.push(
            Ticket({
                owner: it.owner,
                status: TICKET_COMMITTED,
                band: it.band,
                target: target,
                filledAt: 0,
                windowId: it.windowId,
                recipient: it.recipient,
                configVersion: it.configVersion,
                stake: it.amount,
                payout: 0,
                limit: it.limit,
                closing: 0,
                entryE8: 0,
                entryProbE6: 0
            })
        );
        id = _tickets.length;
        emit Committed(id, it.owner, it.windowId, it.band, it.amount, it.limit, target, viaSession);
    }

    function _commitClose(Intent calldata it, bytes calldata sig) private returns (uint256 id) {
        id = it.ticketId;
        Ticket storage t = _ticket(id);
        if (t.owner != it.owner) revert NotTicketOwner(id, it.owner);
        // The owner's own cash-out replaces a fired exit's pending close (one fired by anyone never blocks it).
        if (_exits[id].firing != EXIT_NONE) {
            t.closing = 0;
            _exits[id].firing = EXIT_NONE;
        }
        _checkClosable(id, t);
        if (it.amount == 0 || it.amount > t.payout) revert BadShares(it.amount, t.payout);
        if (it.recipient != t.recipient) revert RecipientMismatch(it.recipient, t.recipient);
        bool viaSession = _authorize(it, sig);
        uint40 target = _pendClose(t, it.amount, it.limit);
        emit CloseCommitted(id, it.amount, it.limit, target, viaSession);
    }

    /// @dev Filled, no close pending, the window trading and the position held long enough.
    function _checkClosable(uint256 id, Ticket storage t) private view {
        if (t.status != TICKET_OPEN) revert TicketNotOpen(id, t.status);
        if (t.closing != 0) revert ClosePending(id);
        _tradingWindow(t.windowId);
        uint40 canCloseAt = t.filledAt + MIN_HOLD_SEC;
        // forge-lint: disable-next-line(block-timestamp)
        if (block.timestamp < canCloseAt) revert HeldTooShort(id, canCloseAt);
    }

    function _pendClose(Ticket storage t, uint64 shares, uint64 minProceeds) private returns (uint40 target) {
        target = uint40(block.timestamp) + FILL_DELAY_SEC;
        t.closing = shares;
        t.limit = minProceeds;
        t.target = target;
    }

    // ------------------------------------------------------------------------------------------------ exits (D-292)

    /// @notice Sets, replaces or (every price 0) clears a ticket's exit, from the owner's or their session's signature.
    function setExit(ExitOrder calldata o, bytes calldata sig) external nonReentrant {
        Ticket storage t = _ticket(o.ticketId);
        if (t.owner != o.owner) revert NotTicketOwner(o.ticketId, o.owner);
        if (t.status != TICKET_COMMITTED && t.status != TICKET_OPEN) revert TicketNotOpen(o.ticketId, t.status);
        if (t.closing != 0) revert ClosePending(o.ticketId);
        _takeExit(o, sig);
    }

    /// @notice Sells every remaining share of a ticket with a take-profit or stop-loss at the next print. It fills only
    ///         if that print's bid meets one of them, so anyone may fire it; a miss leaves the exit standing.
    function fireExit(uint256 id) external nonReentrant {
        Exit storage e = _exits[id];
        if (e.takeProfitE6 == 0 && e.stopLossE6 == 0) revert NoExit(id);
        _fire(id, e, EXIT_PRICE);
    }

    /// @notice The trail: the exit keeper's ratcheting stop decides when (restricted); the fill still needs the floor.
    function fireTrail(uint256 id) external restricted nonReentrant {
        Exit storage e = _exits[id];
        if (e.trailE6 == 0) revert NoExit(id);
        _fire(id, e, EXIT_TRAIL);
    }

    function _fire(uint256 id, Exit storage e, uint8 kind) private {
        Ticket storage t = _ticket(id);
        if (e.epoch != epochOf[t.owner]) revert ExitRevoked(id);
        _checkClosable(id, t);
        e.firing = kind;
        uint40 target = _pendClose(t, t.payout, 0);
        emit CloseCommitted(id, t.payout, 0, target, false);
        emit ExitFired(id, kind, target, msg.sender);
    }

    /// @dev Open, not settled, before the lockout (D-261: opens and closes stop at expiry − 20 s).
    function _tradingWindow(bytes32 windowId) internal view returns (Window memory w) {
        w = windows.windowOf(windowId);
        // forge-lint: disable-next-line(block-timestamp)
        if (
            w.expiry == 0 || w.state != STATE_OPEN || windowSettled[windowId]
                || block.timestamp + LOCKOUT_SEC >= w.expiry
        ) {
            revert WindowNotTrading(windowId);
        }
    }

    // ------------------------------------------------------------------------------------------------ fill

    /// @notice Fills every pending open or close in `ids` at the unique print of `target` (recorded here if missing;
    ///         send its fee only then). Permissionless; tickets not pending at `target` are skipped, so a repeat is a
    ///         no-op. A batch shares one window source and one instant.
    function finalize(uint40 target, uint256[] calldata ids, bytes calldata proof) external payable nonReentrant {
        if (ids.length == 0 || ids.length > MAX_BATCH) revert BadBatch();
        PrintSource memory src = windows.primarySourceOf(_ticket(ids[0]).windowId);
        Print memory print = windows.ensurePrint{value: msg.value}(src.verifier, src.feedId, target, proof);
        for (uint256 i; i < ids.length; ++i) {
            Ticket storage t = _ticket(ids[i]);
            if (t.target != target) continue;
            PrintSource memory own = windows.primarySourceOf(t.windowId);
            if (own.verifier != src.verifier || own.feedId != src.feedId) revert MixedBatch(ids[i]);
            if (t.status == TICKET_COMMITTED) _fillOpen(ids[i], t, print);
            else if (t.status == TICKET_OPEN && t.closing != 0) _fillClose(ids[i], t, print);
        }
        _assertSolvent();
    }

    /// @notice Refuses pending opens and closes that can no longer fill: their print's admission has passed with no
    ///         print, or their window is over. Permissionless (D-261: no print means a refund).
    function expire(uint256[] calldata ids) external nonReentrant {
        if (ids.length == 0 || ids.length > MAX_BATCH) revert BadBatch();
        for (uint256 i; i < ids.length; ++i) {
            Ticket storage t = _ticket(ids[i]);
            bool openPending = t.status == TICKET_COMMITTED;
            bool closePending = t.status == TICKET_OPEN && t.closing != 0;
            if (!openPending && !closePending) continue;
            uint8 reason = _expiryReason(t);
            if (reason == 0) continue;
            if (openPending) _refuseOpen(ids[i], t, reason);
            else _refuseClose(ids[i], t, reason);
        }
        _assertSolvent();
    }

    function _expiryReason(Ticket storage t) private view returns (uint8) {
        Window memory w = windows.windowOf(t.windowId);
        // forge-lint: disable-next-line(block-timestamp)
        if (windowSettled[t.windowId] || w.state != STATE_OPEN || block.timestamp >= w.expiry) return REFUSE_WINDOW;
        PrintSource memory src = windows.primarySourceOf(t.windowId);
        if (windows.printOf(src.verifier, src.feedId, t.target).publishTime != 0) return 0;
        uint256 deadline = uint256(t.target) + IPrintVerifier(src.verifier).admissionSec();
        // forge-lint: disable-next-line(block-timestamp)
        return block.timestamp > deadline ? REFUSE_NO_PRINT : 0;
    }

    /// @dev Prices the band at the fill print (D-262) and books the fill, or refuses and refunds.
    function _fillOpen(uint256 id, Ticket storage t, Print memory print) private {
        (Window memory w, uint8 reason) = _fillable(t);
        if (reason != 0) return _refuseOpen(id, t, reason);
        Params storage p = params;
        uint256 probE6 = _probAt(w, t, print.priceE8);
        if (probE6 < p.minProbE6 || probE6 > p.maxProbE6) return _refuseOpen(id, t, REFUSE_PRICE);
        uint256 surchargeE6 = uint256(p.maxSurchargeE6) * reservedByExpiry[w.expiry] / p.maxExpiryReserved;
        uint256 priceE6 = probE6 + p.halfSpreadE6 + surchargeE6;
        if (priceE6 >= P_ONE) return _refuseOpen(id, t, REFUSE_PRICE);
        uint256 payout = BandMath.payoutFor(t.stake, priceE6);
        // The pool must front something, or the call is not a bet against it (CWF `Underpriced`).
        if (payout <= t.stake) return _refuseOpen(id, t, REFUSE_PRICE);
        if (payout < t.limit) return _refuseOpen(id, t, REFUSE_SLIPPAGE);
        uint256 reserve = payout - t.stake;
        if (!_hasCapacity(reserve, w.expiry)) return _refuseOpen(id, t, REFUSE_CAPACITY);

        _bookFill(t.stake, reserve, w.expiry);
        BandTotals storage tot = bandTotals[t.windowId][t.band];
        tot.payout += SafeCast.toUint128(payout);
        tot.stake += t.stake;
        bandsUsed[t.windowId] |= uint16(1) << t.band;
        t.status = TICKET_OPEN;
        t.payout = SafeCast.toUint64(payout);
        t.limit = 0;
        t.filledAt = print.publishTime;
        t.entryE8 = print.priceE8;
        t.entryProbE6 = SafeCast.toUint32(priceE6);
        emit Filled(id, t.payout, t.stake, print.priceE8, SafeCast.toUint32(probE6), t.entryProbE6, uint64(reserve));
    }

    /// @dev Sells `closing` shares at the bid (probability − half-spread) of the close print; the pool keeps the rest
    ///      of their escrow. The basis leaving is ceiled, so the remaining basis never exceeds the remaining shares. A
    ///      fired exit fills only at a bid that meets it, and a miss leaves it standing.
    function _fillClose(uint256 id, Ticket storage t, Print memory print) private {
        (Window memory w, uint8 reason) = _fillable(t);
        if (reason != 0) return _refuseClose(id, t, reason);
        Params storage p = params;
        uint256 probE6 = _probAt(w, t, print.priceE8);
        if (probE6 < p.minProbE6 || probE6 > p.maxProbE6) return _refuseClose(id, t, REFUSE_PRICE);
        uint256 bidE6 = probE6 - p.halfSpreadE6;
        uint64 shares = t.closing;
        uint256 proceeds = BandMath.proceedsFor(shares, bidE6);
        if (_exits[id].firing != EXIT_NONE) {
            if (!_exitMet(_exits[id], bidE6)) return _refuseClose(id, t, REFUSE_EXIT);
            _exits[id].firing = EXIT_NONE;
        } else if (proceeds < t.limit) {
            return _refuseClose(id, t, REFUSE_SLIPPAGE);
        }
        uint256 basisOut = BandMath.basisPart(t.stake, shares, t.payout);

        _releaseEscrow(basisOut, shares - basisOut, w.expiry);
        liquid += shares - proceeds;
        BandTotals storage tot = bandTotals[t.windowId][t.band];
        tot.payout -= shares;
        tot.stake -= SafeCast.toUint128(basisOut);
        t.payout -= shares;
        t.stake -= SafeCast.toUint64(basisOut);
        t.closing = 0;
        t.limit = 0;
        if (t.payout == 0) {
            t.status = TICKET_CLOSED;
            delete _exits[id];
        }
        emit Closed(
            id,
            shares,
            SafeCast.toUint64(proceeds),
            SafeCast.toUint64(basisOut),
            print.priceE8,
            SafeCast.toUint32(bidE6)
        );
        _payOrOwe(t.recipient, proceeds);
    }

    /// @dev A fill needs the window still running (no fill after expiry: nobody may wait for the close and then pick
    ///      whether to fill), and an open the pricing config the caller signed.
    function _fillable(Ticket storage t) private view returns (Window memory w, uint8 reason) {
        w = windows.windowOf(t.windowId);
        // forge-lint: disable-next-line(block-timestamp)
        if (windowSettled[t.windowId] || w.state != STATE_OPEN || block.timestamp >= w.expiry) {
            return (w, REFUSE_WINDOW);
        }
        if (t.status == TICKET_COMMITTED && t.configVersion != configVersion) return (w, REFUSE_CONFIG);
    }

    function _probAt(Window memory w, Ticket storage t, int64 spotE8) private view returns (uint256) {
        int64 k = windows.openPrintOf(t.windowId).priceE8;
        return BandMath.probE6(_menu[w.seriesId][t.band], k, spotE8, sigmaOf[w.seriesId], w.expiry - t.target);
    }

    function _refuseOpen(uint256 id, Ticket storage t, uint8 reason) internal {
        uint64 stake = t.stake;
        committedStakes -= stake;
        t.status = TICKET_REFUNDED;
        t.limit = 0;
        emit Refused(id, reason, stake);
        _payOrOwe(t.owner, stake);
    }

    function _refuseClose(uint256 id, Ticket storage t, uint8 reason) internal {
        t.closing = 0;
        t.limit = 0;
        _exits[id].firing = EXIT_NONE;
        emit CloseRefused(id, reason);
    }

    // ------------------------------------------------------------------------------------------------ helpers

    function _ticket(uint256 id) internal view returns (Ticket storage) {
        if (id == 0 || id > _tickets.length) revert UnknownTicket(id);
        return _tickets[id - 1];
    }

    function _requireSeries(bytes32 seriesId) internal view {
        if (windows.seriesOf(seriesId).cadenceSec == 0) revert UnknownSeries(seriesId);
    }
}
