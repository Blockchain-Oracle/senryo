// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

// Settlement from CWF d7b576b:contracts/src/products/range/RangeReserve.sol (`settle`, `claim`, `_refund`,
// `_release`), changed so a window settles once for all its bands (the pool's result is final the moment the verdict
// lands, so its value can never be read stale) and payouts go out by `claimFor` batches anyone may crank (D-264).

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {AccessManaged} from "@openzeppelin/contracts/access/manager/AccessManaged.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {BandBook} from "./BandBook.sol";
import {BandMath} from "./BandMath.sol";
import {BandPool} from "./BandPool.sol";
import {IWindows} from "./interfaces/IWindows.sol";
import {SessionGrants} from "./SessionGrants.sol";
import "./MarketTypes.sol";

/// @title BandReserve — live calls on a window's close against a shared pool, fully reserved, paid automatically.
/// @notice A call is a band around the window's open print K (Up, Down, Range, Moonshot, Crash). It escrows the whole
///         payout when it fills — the caller's stake plus the pool's reserve — so the pool can never owe more than it
///         holds (D-264). When the window's verdict lands, `settleWindow` decides every band at once and `claimFor`
///         pays winners and refunds ties and voids to the owners. Settlement and payouts are permissionless and never
///         pause; a late keeper is never a lost window.
contract BandReserve is BandBook {
    string public constant NAME = "Senryo Markets";
    string public constant VERSION = "1";

    mapping(bytes32 windowId => mapping(uint8 band => uint8)) public bandOutcome;

    struct Caps {
        uint64 maxPerCallCap;
        uint64 maxSessionCap;
        uint40 maxSessionSec;
    }

    constructor(address authority, IERC20 collateral_, IWindows windows_, Params memory params_, Caps memory caps)
        AccessManaged(authority)
        BandPool(collateral_, params_)
        EIP712(NAME, VERSION)
        SessionGrants(caps.maxPerCallCap, caps.maxSessionCap, caps.maxSessionSec)
        BandBook(windows_)
    {}

    // ------------------------------------------------------------------------------------------------ sessions

    /// @notice Starts the owner's session from their one Face ID signature, optionally setting the finite allowance
    ///         the session spends from in the same transaction (D-267).
    function grantSession(SessionGrant calldata g, bytes calldata sig, Permit calldata permit) external nonReentrant {
        _grant(g, sig);
        if (permit.deadline != 0) {
            try IERC20Permit(address(collateral))
                .permit(g.owner, address(this), permit.value, permit.deadline, permit.v, permit.r, permit.s) {}
                catch {}
        }
    }

    // ------------------------------------------------------------------------------------------------ settlement

    /// @notice Decides every band of a window once its verdict is in: winning bands' payouts become payable,
    ///         losing bands' escrow returns to the pool, ties at K and voided windows refund the basis.
    function settleWindow(bytes32 windowId) external nonReentrant {
        if (windowSettled[windowId]) revert WindowAlreadySettled(windowId);
        Window memory w = windows.windowOf(windowId);
        if (w.expiry == 0 || w.state == STATE_OPEN) revert WindowNotOver(windowId);
        windowSettled[windowId] = true;

        uint16 used = bandsUsed[windowId];
        BandDef[] storage menu = _menu[w.seriesId];
        uint16[OUTCOME_COUNT] memory masks; // indexed by outcome: lost, won, refunded
        uint256 toPool;
        uint256 toHolders;
        for (uint8 b; b < MAX_BANDS; ++b) {
            if (used & (uint16(1) << b) == 0) continue;
            uint8 outcome = w.state == STATE_VOIDED ? OUTCOME_REFUND : BandMath.outcome(menu[b], w.openE8, w.closeE8);
            bandOutcome[windowId][b] = outcome;
            masks[outcome] |= uint16(1) << b;
            BandTotals memory tot = bandTotals[windowId][b];
            uint256 reserve = tot.payout - tot.stake;
            _releaseEscrow(tot.stake, reserve, w.expiry);
            if (outcome == OUTCOME_WIN) {
                payableTotal += tot.payout;
                toHolders += tot.payout;
            } else if (outcome == OUTCOME_LOSE) {
                liquid += tot.payout;
                toPool += tot.payout;
            } else {
                payableTotal += tot.stake;
                liquid += reserve;
                toHolders += tot.stake;
                toPool += reserve;
            }
        }
        emit WindowSettled(windowId, masks[OUTCOME_WIN], masks[OUTCOME_REFUND], masks[OUTCOME_LOSE], toPool, toHolders);
        _assertSolvent();
    }

    /// @notice Pays out settled tickets (winnings to the recipient, refunds to the owner) and refunds commits whose
    ///         window settled before they filled. Anyone may crank it; the money only ever goes to the ticket's own
    ///         addresses, or is held as owed if they cannot receive it. Tickets not ready are skipped.
    function claimFor(uint256[] calldata ids) external nonReentrant {
        if (ids.length == 0 || ids.length > MAX_BATCH) revert BadBatch();
        for (uint256 i; i < ids.length; ++i) {
            uint256 id = ids[i];
            Ticket storage t = _ticket(id);
            if (!windowSettled[t.windowId]) continue;
            if (t.status == TICKET_COMMITTED) {
                _refuseOpen(id, t, REFUSE_WINDOW);
            } else if (t.status == TICKET_OPEN) {
                _pay(id, t);
            }
        }
        _assertSolvent();
    }

    function _pay(uint256 id, Ticket storage t) private {
        uint8 outcome = bandOutcome[t.windowId][t.band];
        uint256 amount = outcome == OUTCOME_WIN ? t.payout : outcome == OUTCOME_REFUND ? t.stake : 0;
        address to = outcome == OUTCOME_REFUND ? t.owner : t.recipient;
        payableTotal -= amount;
        t.status = TICKET_SETTLED;
        t.closing = 0;
        t.limit = 0;
        bool paid = _payOrOwe(to, amount);
        emit Claimed(id, to, outcome, amount, paid, msg.sender);
    }

    // ------------------------------------------------------------------------------------------------ views

    function ticketOf(uint256 id) external view returns (Ticket memory) {
        return _ticket(id);
    }

    function ticketCount() external view returns (uint256) {
        return _tickets.length;
    }

    function menuOf(bytes32 seriesId) external view returns (BandDef[] memory) {
        return _menu[seriesId];
    }

    /// @notice What `stake` on `band` would buy if the fill print were `spotE8` at `at` (no surcharge-free promise:
    ///         the fill prices at its own print). Returns the band probability, the price per share and the payout.
    function quoteOpen(bytes32 windowId, uint8 band, uint64 stake, int64 spotE8, uint40 at)
        external
        view
        returns (uint256 probE6, uint256 priceE6, uint256 payout)
    {
        Window memory w = windows.windowOf(windowId);
        if (w.expiry == 0 || at >= w.expiry) revert WindowNotTrading(windowId);
        if (band >= _menu[w.seriesId].length) revert UnknownBand(w.seriesId, band);
        int64 k = windows.openPrintOf(windowId).priceE8;
        if (k <= 0) revert NoOpenPrint(windowId);
        Params storage p = params;
        probE6 = BandMath.probE6(_menu[w.seriesId][band], k, spotE8, sigmaOf[w.seriesId], w.expiry - at);
        priceE6 = probE6 + p.halfSpreadE6 + uint256(p.maxSurchargeE6) * reservedByExpiry[w.expiry] / p.maxExpiryReserved;
        payout = priceE6 < P_ONE ? BandMath.payoutFor(stake, priceE6) : 0;
    }
}
