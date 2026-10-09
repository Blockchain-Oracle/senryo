// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

// The trading half of Masayume 68f7a09:contracts/src/games/GameArena.sol (entry, reveal, picks, lock, card settlement,
// the pot), re-based on Senryo (D-294): no order book and no outcome tokens — each pick is an ordinary BandReserve call
// the arena owns and signs for itself (ERC-1271, one digest at a time), filled at the unique print of the next second
// like anyone's, and paid by the shared pool. The entry is a signed order the matchmaker pairs (players hold no gas);
// Masayume's match-scoped agent becomes the seat's key named in that entry.

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessManaged} from "@openzeppelin/contracts/access/manager/AccessManaged.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {BandReserve} from "../markets/BandReserve.sol";
import "../markets/MarketTypes.sol";
import {DuelLedger} from "./DuelLedger.sol";
import "./DuelTypes.sol";

/// @title DuelArena — two players, a sealed deck of three windows, one Up or Down call per card each; the better total
///        result takes both pots.
/// @notice The matchmaker pairs two signed entries (`openMatch`, which escrows each seat's pot and card stakes and seals
///         the deck's commitment); anyone holding the preimage reveals it; each swipe is a signed pick the arena places
///         as a real call. When every picked card's window has settled, the pot goes to the better total — a tie splits
///         it, a seat that missed a card forfeits it, and if both missed, both pots go home. Card results never depend
///         on the pot: a pick is a real call and pays its owner whatever happens to the match.
contract DuelArena is DuelLedger {
    using SafeERC20 for IERC20;

    string public constant NAME = "Senryo Duel";
    string public constant VERSION = "1";

    /// @dev The one reserve intent digest the arena vouches for, inside the call that commits it.
    bytes32 private transient _approving;
    /// @dev The arena's own unordered nonces at the reserve, used in sequence.
    uint256 private _reserveNonce;

    constructor(address authority, BandReserve reserve_, DuelClocks memory clocks)
        AccessManaged(authority)
        EIP712(NAME, VERSION)
        DuelLedger(reserve_, clocks)
    {
        // The reserve pulls from the arena only for an open intent the arena itself vouched for (`isValidSignature`).
        reserve_.collateral().forceApprove(address(reserve_), type(uint256).max);
    }

    // ------------------------------------------------------------------------------------------------ entry

    /// @notice Pairs two signed entries of one tier into a match (the matchmaker's role): escrows each seat's pot and
    ///         three card stakes, and seals the deck's commitment. Nothing is revealed yet.
    function openMatch(
        bytes32 matchId,
        DuelEntry calldata a,
        bytes calldata sigA,
        Permit calldata permitA,
        DuelEntry calldata b,
        bytes calldata sigB,
        Permit calldata permitB,
        bytes32 deckHash
    ) external restricted nonReentrant {
        if (matchId == bytes32(0) || deckHash == bytes32(0)) revert BadMatch();
        DuelMatch storage m = _matches[matchId];
        if (m.status != MATCH_NONE) revert MatchExists(matchId);
        if (a.tier != b.tier) revert TierMismatch(a.tier, b.tier);
        if (a.owner == b.owner) revert SelfDuel();
        DuelTier memory t = tierOf[a.tier];
        if (!t.enabled) revert UnknownTier(a.tier);
        uint256 budget = uint256(t.cardStake) * DUEL_CARDS;
        _enter(matchId, 0, a, sigA, permitA, t.pot + budget);
        _enter(matchId, 1, b, sigB, permitB, t.pot + budget);
        m.status = MATCH_SEALED;
        m.tier = a.tier;
        m.openedAt = uint40(block.timestamp);
        m.pot = t.pot;
        m.cardStake = t.cardStake;
        m.deckHash = deckHash;
        potsHeld += uint256(t.pot) * DUEL_SEATS;
        budgetsHeld += budget * DUEL_SEATS;
        emit MatchOpened(matchId, a.owner, b.owner, a.tier, t.pot, t.cardStake, deckHash, m.openedAt + revealWindowSec);
        _assertSolvent();
    }

    /// @dev The owner's own signature (an entry spends money; a session key never signs one), at their current epoch,
    ///      unexpired and unused; an optional permit sets the arena's allowance in the same transaction.
    function _enter(
        bytes32 matchId,
        uint8 seat,
        DuelEntry calldata e,
        bytes calldata sig,
        Permit calldata permit,
        uint256 amount
    ) private {
        if (e.owner == address(0)) revert ZeroAddress();
        // forge-lint: disable-next-line(block-timestamp)
        if (block.timestamp > e.deadline) revert EntryExpired(e.deadline);
        uint32 epoch = reserve.epochOf(e.owner);
        if (e.epoch != epoch) revert WrongEpoch(epoch, e.epoch);
        if (entryUsed[e.owner][e.nonce]) revert EntryUsed(e.owner, e.nonce);
        if (!SignatureChecker.isValidSignatureNowCalldata(e.owner, hashEntry(e), sig)) revert SignatureInvalid();
        entryUsed[e.owner][e.nonce] = true;
        if (permit.deadline != 0) {
            // A front-run permit only spends the same signature; the pull below is what must succeed.
            try IERC20Permit(address(collateral))
                .permit(e.owner, address(this), permit.value, permit.deadline, permit.v, permit.r, permit.s) {}
                catch {}
        }
        collateral.safeTransferFrom(e.owner, address(this), amount);
        _seats[matchId][seat] = DuelSeat(e.owner, e.delegate, e.epoch, 0, e.seed);
    }

    /// @notice Opens the sealed deck and starts the pick clock. Permissionless: the commitment, not a key, proves the
    ///         deck was fixed before either player saw it. Every card must be a running window with its line and room
    ///         to play past the pick deadline.
    function revealDeck(bytes32 matchId, bytes32 serverSeed, bytes32[DUEL_CARDS] calldata cards) external nonReentrant {
        DuelMatch storage m = _match(matchId);
        if (m.status != MATCH_SEALED) revert WrongStatus(matchId, m.status);
        uint40 deadline = m.openedAt + revealWindowSec;
        // forge-lint: disable-next-line(block-timestamp)
        if (block.timestamp > deadline) revert DeadlinePassed(deadline);
        DuelSeat[DUEL_SEATS] storage seats = _seats[matchId];
        bytes32 got = deckHashOf(matchId, serverSeed, [seats[0].seed, seats[1].seed], cards);
        if (got != m.deckHash) revert DeckMismatch(m.deckHash, got);
        bytes32[DUEL_CARDS] storage deck = _decks[matchId];
        for (uint256 i; i < DUEL_CARDS; ++i) {
            bytes32 id = cards[i];
            Window memory w = windows.windowOf(id);
            if (w.expiry == 0 || w.state != STATE_OPEN || windows.openPrintOf(id).publishTime == 0) {
                revert CardNotReady(id);
            }
            // forge-lint: disable-next-line(block-timestamp)
            if (w.expiry < block.timestamp + minCardLifeSec) revert CardTooShort(id, w.expiry);
            // One window twice settles on one print: a read right once would count twice.
            for (uint256 j; j < i; ++j) {
                if (cards[j] == id) revert DuplicateCard(id);
            }
            deck[i] = id;
        }
        m.status = MATCH_PICKING;
        m.pickDeadline = uint40(block.timestamp) + pickWindowSec;
        emit DeckRevealed(matchId, serverSeed, cards, m.pickDeadline);
    }

    /// @notice Returns both seats' pots and card stakes when the deck was never opened (an operator failure, so nobody
    ///         is punished). Permissionless once the reveal window has closed.
    function refundUnrevealed(bytes32 matchId) external nonReentrant {
        DuelMatch storage m = _match(matchId);
        if (m.status != MATCH_SEALED) revert WrongStatus(matchId, m.status);
        uint40 deadline = m.openedAt + revealWindowSec;
        // forge-lint: disable-next-line(block-timestamp)
        if (block.timestamp <= deadline) revert DeadlineNotPassed(deadline);
        _refund(matchId, m, REFUND_NO_REVEAL, true);
        _assertSolvent();
    }

    // ------------------------------------------------------------------------------------------------ picks

    /// @notice One swipe: the seat's call on one card, signed by the player or the seat's key and relayed by anyone.
    ///         The arena places it at the reserve as its own call of the tier's card stake, filled at the next print.
    function pick(DuelPick calldata p, bytes calldata sig) external nonReentrant returns (uint256 ticketId) {
        DuelMatch storage m = _match(p.matchId);
        if (m.status != MATCH_PICKING) revert WrongStatus(p.matchId, m.status);
        // forge-lint: disable-next-line(block-timestamp)
        if (block.timestamp > m.pickDeadline) revert DeadlinePassed(m.pickDeadline);
        if (p.card >= DUEL_CARDS) revert BadCard(p.card);
        DuelSeat[DUEL_SEATS] storage seats = _seats[p.matchId];
        uint8 seat = _seatOf(seats, p.player);
        DuelSeat storage s = seats[seat];
        uint8 bit = uint8(1) << p.card;
        if (s.picked & bit != 0) revert AlreadyPicked(p.matchId, p.card, p.player);
        bool viaKey = _pickSigner(s, hashPick(p), sig);
        bytes32 windowId = _decks[p.matchId][p.card];
        _requireUpOrDown(windowId, p.band);

        ticketId = _placeCall(windowId, p.band, m.cardStake, p.minPayout);
        s.picked |= bit;
        budgetsHeld -= m.cardStake;
        _calls[p.matchId][_slot(p.card, seat)] = DuelCall(SafeCast.toUint64(ticketId), p.band, false, 0);
        emit PickPlaced(p.matchId, p.player, p.card, p.band, ticketId, viaKey);
        // The last pick locks the match itself, so a complete deck never waits on a crank.
        if (seats[0].picked == DUEL_FULL_MASK && seats[1].picked == DUEL_FULL_MASK) {
            m.status = MATCH_SETTLING;
            emit PicksLocked(p.matchId, MATCH_SETTLING, address(0));
        }
        _assertSolvent();
    }

    /// @dev The player, or the seat's key while the player's epoch is the one they entered at (a revoke silences it).
    function _pickSigner(DuelSeat storage s, bytes32 digest, bytes calldata sig) private view returns (bool viaKey) {
        if (SignatureChecker.isValidSignatureNowCalldata(s.player, digest, sig)) return false;
        if (
            s.delegate != address(0) && s.epoch == reserve.epochOf(s.player)
                && SignatureChecker.isValidSignatureNowCalldata(s.delegate, digest, sig)
        ) return true;
        revert SignatureInvalid();
    }

    function _requireUpOrDown(bytes32 windowId, uint8 band) private view {
        BandDef[] memory menu = reserve.menuOf(windows.windowOf(windowId).seriesId);
        if (band >= menu.length || (menu[band].kind != BAND_UP && menu[band].kind != BAND_DOWN)) {
            revert NotUpOrDown(windowId, band);
        }
    }

    /// @dev Commits an open at the reserve as the arena (owner and recipient), vouching for exactly that digest.
    function _placeCall(bytes32 windowId, uint8 band, uint64 stake, uint64 minPayout) private returns (uint256) {
        Intent memory it = Intent({
            action: ACTION_OPEN,
            owner: address(this),
            windowId: windowId,
            band: band,
            ticketId: 0,
            amount: stake,
            limit: minPayout,
            recipient: address(this),
            configVersion: reserve.configVersion(),
            deadline: uint64(block.timestamp),
            nonce: ++_reserveNonce,
            epoch: reserve.epochOf(address(this))
        });
        Permit memory none;
        _approving = reserve.hashIntent(it);
        uint256 ticketId = reserve.commit(it, "", none);
        _approving = bytes32(0);
        return ticketId;
    }

    /// @notice ERC-1271: the arena signs only the open it is committing right now.
    function isValidSignature(bytes32 hash, bytes calldata) external view returns (bytes4) {
        return hash != bytes32(0) && hash == _approving ? ERC1271_MAGIC : ERC1271_INVALID;
    }

    /// @notice Closes the pick window once its deadline has passed (permissionless). Unplaced card stakes go home; one
    ///         seat short forfeits the pot; both short and the pots go home. Placed calls settle either way.
    function lockPicks(bytes32 matchId) external nonReentrant {
        DuelMatch storage m = _match(matchId);
        if (m.status != MATCH_PICKING) revert WrongStatus(matchId, m.status);
        // forge-lint: disable-next-line(block-timestamp)
        if (block.timestamp <= m.pickDeadline) revert DeadlineNotPassed(m.pickDeadline);
        DuelSeat[DUEL_SEATS] storage seats = _seats[matchId];
        _returnUnplaced(matchId, m, seats[0]);
        _returnUnplaced(matchId, m, seats[1]);
        bool aDone = seats[0].picked == DUEL_FULL_MASK;
        bool bDone = seats[1].picked == DUEL_FULL_MASK;
        if (aDone || bDone) {
            m.status = MATCH_FORFEITED;
            emit PicksLocked(matchId, MATCH_FORFEITED, aDone ? seats[1].player : seats[0].player);
        } else {
            _refund(matchId, m, REFUND_BOTH_ABSENT, false);
            emit PicksLocked(matchId, MATCH_REFUNDED, address(0));
        }
        _assertSolvent();
    }

    function _returnUnplaced(bytes32 matchId, DuelMatch storage m, DuelSeat storage s) private {
        uint256 amount = _missing(s.picked) * m.cardStake;
        if (amount == 0) return;
        budgetsHeld -= amount;
        _payOrOwe(s.player, amount);
        emit BudgetReturned(matchId, s.player, amount);
    }

    // ------------------------------------------------------------------------------------------------ settlement

    /// @notice Settles both seats' calls on one card once its window has settled at the reserve: collects what each
    ///         returned (the payout on a win, the stake on a tie, a void or a refused fill, nothing on a loss), pays it
    ///         to the player and adds `returned − stake` to their total. Permissionless and once per card.
    function settleCard(bytes32 matchId, uint8 card) external nonReentrant {
        DuelMatch storage m = _match(matchId);
        if (m.status < MATCH_PICKING) revert WrongStatus(matchId, m.status);
        if (card >= DUEL_CARDS) revert BadCard(card);
        uint8 bit = uint8(1) << card;
        if (m.settled & bit != 0) revert AlreadySettled(matchId, card);
        bytes32 windowId = _decks[matchId][card];
        if (!reserve.windowSettled(windowId)) revert CardNotSettled(windowId);
        m.settled |= bit;
        _collect(matchId, card);
        DuelSeat[DUEL_SEATS] storage seats = _seats[matchId];
        for (uint8 seat; seat < DUEL_SEATS; ++seat) {
            DuelCall storage c = _calls[matchId][_slot(card, seat)];
            if (c.ticketId == 0) continue;
            uint64 returned = _returnOf(windowId, c);
            c.settled = true;
            c.returned = returned;
            int256 result = int256(uint256(returned)) - int256(uint256(m.cardStake));
            _results[matchId][seat] += result;
            _payOrOwe(seats[seat].player, returned);
            emit CardSettled(matchId, seats[seat].player, card, returned, result);
        }
        _assertSolvent();
    }

    /// @dev Pulls the card's calls the reserve hasn't paid yet (and anything it held for the arena).
    function _collect(bytes32 matchId, uint8 card) private {
        uint256[] memory ids = new uint256[](DUEL_SEATS);
        uint256 n;
        for (uint8 seat; seat < DUEL_SEATS; ++seat) {
            uint64 id = _calls[matchId][_slot(card, seat)].ticketId;
            if (id == 0) continue;
            uint8 status = reserve.ticketOf(id).status;
            if (status == TICKET_COMMITTED || status == TICKET_OPEN) ids[n++] = id;
        }
        if (n != 0) {
            assembly ("memory-safe") {
                mstore(ids, n)
            }
            reserve.claimFor(ids);
        }
        if (reserve.owedOf(address(this)) != 0) reserve.claimOwed();
    }

    function _returnOf(bytes32 windowId, DuelCall storage c) private view returns (uint64) {
        Ticket memory t = reserve.ticketOf(c.ticketId);
        if (t.status == TICKET_REFUNDED) return t.stake;
        uint8 outcome = reserve.bandOutcome(windowId, c.band);
        return outcome == OUTCOME_WIN ? t.payout : outcome == OUTCOME_REFUND ? t.stake : 0;
    }

    /// @notice Pays the pot once every placed card has settled (permissionless): the better total takes both, a tie
    ///         returns each seat's own, and after a forfeit the seat that picked every card takes both.
    function finalize(bytes32 matchId) external nonReentrant {
        DuelMatch storage m = _match(matchId);
        if (m.status != MATCH_SETTLING && m.status != MATCH_FORFEITED) revert WrongStatus(matchId, m.status);
        DuelSeat[DUEL_SEATS] storage seats = _seats[matchId];
        if ((seats[0].picked | seats[1].picked) & ~m.settled != 0) revert CardsOutstanding(matchId);
        int256 resultA = _results[matchId][0];
        int256 resultB = _results[matchId][1];
        address winner;
        if (m.status == MATCH_FORFEITED) {
            winner = seats[0].picked == DUEL_FULL_MASK ? seats[0].player : seats[1].player;
        } else if (resultA != resultB) {
            winner = resultA > resultB ? seats[0].player : seats[1].player;
        }
        m.status = MATCH_FINALIZED;
        uint256 pot = uint256(m.pot) * DUEL_SEATS;
        potsHeld -= pot;
        if (winner != address(0)) {
            _payOrOwe(winner, pot);
        } else {
            _payOrOwe(seats[0].player, m.pot);
            _payOrOwe(seats[1].player, m.pot);
        }
        emit MatchFinalized(matchId, winner, resultA, resultB, pot);
        _assertSolvent();
    }
}
