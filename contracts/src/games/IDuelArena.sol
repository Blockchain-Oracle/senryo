// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {DUEL_CARDS} from "./DuelTypes.sol";

/// @title DuelArena's vocabulary: matches from pairing to pot, every refusal by name.
interface IDuelArena {
    event TierSet(uint8 indexed tier, uint64 pot, uint64 cardStake, bool enabled);
    event MatchOpened(
        bytes32 indexed matchId,
        address indexed playerA,
        address indexed playerB,
        uint8 tier,
        uint64 pot,
        uint64 cardStake,
        bytes32 deckHash,
        uint40 revealBy
    );
    event DeckRevealed(bytes32 indexed matchId, bytes32 serverSeed, bytes32[DUEL_CARDS] cards, uint40 pickDeadline);
    event PickPlaced(
        bytes32 indexed matchId, address indexed player, uint8 card, uint8 band, uint256 ticketId, bool viaKey
    );
    event PicksLocked(bytes32 indexed matchId, uint8 status, address forfeitedBy);
    event BudgetReturned(bytes32 indexed matchId, address indexed player, uint256 amount);
    event CardSettled(bytes32 indexed matchId, address indexed player, uint8 card, uint64 returned, int256 result);
    event MatchFinalized(bytes32 indexed matchId, address winner, int256 resultA, int256 resultB, uint256 pot);
    event MatchRefunded(bytes32 indexed matchId, uint8 reason, uint256 perSeat);
    event PayoutHeld(address indexed to, uint256 amount, uint256 owed);
    event OwedClaimed(address indexed to, uint256 amount);

    error ZeroAddress();
    error BadClocks();
    error BadTier(uint8 tier);
    error UnknownTier(uint8 tier);
    error BadMatch();
    error MatchExists(bytes32 matchId);
    error NoSuchMatch(bytes32 matchId);
    error WrongStatus(bytes32 matchId, uint8 status);
    error SelfDuel();
    error TierMismatch(uint8 a, uint8 b);
    error EntryExpired(uint64 deadline);
    error EntryUsed(address owner, uint256 nonce);
    error WrongEpoch(uint32 expected, uint32 got);
    error SignatureInvalid();
    error DeckMismatch(bytes32 want, bytes32 got);
    error DuplicateCard(bytes32 windowId);
    error CardNotReady(bytes32 windowId);
    error CardTooShort(bytes32 windowId, uint40 expiry);
    error DeadlinePassed(uint40 deadline);
    error DeadlineNotPassed(uint40 deadline);
    error NotAPlayer(address who);
    error BadCard(uint8 card);
    error AlreadyPicked(bytes32 matchId, uint8 card, address player);
    error NotUpOrDown(bytes32 windowId, uint8 band);
    error CardNotSettled(bytes32 windowId);
    error AlreadySettled(bytes32 matchId, uint8 card);
    error CardsOutstanding(bytes32 matchId);
    error NothingOwed();
    error Insolvent(uint256 balance, uint256 owed);
}
