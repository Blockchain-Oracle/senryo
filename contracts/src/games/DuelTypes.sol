// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

// Duel (D-294), from Masayume 68f7a09:contracts/src/games/{IGameArena,ArenaCommitment,GameArena,ArenaMatches}.sol: a
// sealed deck, one pick per card per seat, a match-scoped key that swipes, forfeits and refunds, the pot to the better
// total. Re-based on Senryo: each pick is an ordinary BandReserve call the arena owns (ERC-1271), the entry is a signed
// order the matchmaker pairs, and every number lives here (invariant `sol-no-magic-numbers`).

/// @dev Three windows per deck (D-294), two seats.
uint256 constant DUEL_CARDS = 3;
uint256 constant DUEL_SEATS = 2;
/// @dev Every card filled for one seat: one bit per card.
uint8 constant DUEL_FULL_MASK = 7;

uint8 constant MATCH_NONE = 0;
uint8 constant MATCH_SEALED = 1; // both entries escrowed, the deck committed, not revealed
uint8 constant MATCH_PICKING = 2; // revealed; both seats owe picks until the pick deadline
uint8 constant MATCH_SETTLING = 3; // both seats picked every card
uint8 constant MATCH_FORFEITED = 4; // one seat missed a card: the other takes the pot
uint8 constant MATCH_REFUNDED = 5; // pots went home (no reveal, or both seats missed); picked cards still settle
uint8 constant MATCH_FINALIZED = 6; // the pot is paid

uint8 constant REFUND_NO_REVEAL = 1;
uint8 constant REFUND_BOTH_ABSENT = 2;

/// @dev Bounds on the clocks the deploy sets: a whole duel fits in a 1 h window.
uint32 constant MAX_DUEL_CLOCK_SEC = 3600;
/// @dev ERC-1271's "valid" answer and its refusal.
bytes4 constant ERC1271_MAGIC = 0x1626ba7e;
bytes4 constant ERC1271_INVALID = 0xffffffff;

/// @dev An entry price: each seat escrows `pot` (the winner takes both) and `cardStake` per card (each pick is a call of
///      exactly that stake, so both totals measure calls, not sizing). A tier with `pot == 0` is a free duel whose picks
///      are still real calls.
struct DuelTier {
    uint64 pot;
    uint64 cardStake;
    bool enabled;
}

/// @dev The duel's clocks: how long the deck may stay sealed, how long both seats have to pick, and how long every card
///      must still run at the reveal (more than the pick window plus the reserve's lockout, so every card can be picked
///      until the deadline).
struct DuelClocks {
    uint32 revealWindowSec;
    uint32 pickWindowSec;
    uint32 minCardLifeSec;
}

/// @dev A player's signed seat in the queue, before anyone is paired: the tier, the device key that may swipe this
///      seat's picks (0 = the owner only), and the player's half of the deck's randomness. Spends `pot + 3 × cardStake`,
///      so only the owner signs it (never a session delegate).
struct DuelEntry {
    address owner;
    uint8 tier;
    address delegate;
    bytes32 seed;
    uint64 deadline;
    uint256 nonce;
    uint32 epoch;
}

/// @dev One swipe: card `card` of the match, band Up or Down of its series, at least `minPayout` back on a win. Signed
///      by the player or the seat's key; a card takes one pick per seat, so it needs no nonce.
struct DuelPick {
    bytes32 matchId;
    address player;
    uint8 card;
    uint8 band;
    uint64 minPayout;
}

struct DuelSeat {
    address player;
    address delegate;
    uint32 epoch; // the owner's epoch at entry: a revoke since then silences the key
    uint8 picked; // one bit per card
    bytes32 seed;
}

struct DuelMatch {
    uint8 status;
    uint8 tier;
    uint8 settled; // one bit per card whose picks were paid out
    uint40 openedAt;
    uint40 pickDeadline; // 0 until revealed
    uint64 pot;
    uint64 cardStake;
    bytes32 deckHash;
}

/// @dev A seat's pick on a card: the reserve ticket it is, and what it returned once settled.
struct DuelCall {
    uint64 ticketId;
    uint8 band;
    bool settled;
    uint64 returned;
}
