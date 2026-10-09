// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

// Yes/no events (D-296), from Owarine abu-pm-main 0.5.2:daml/PM/Event.daml (`EventTerms`, `EventAttestation`,
// `Event_Resolve`, `Event_Void`, `EventVerdict`) and services/ops/src/actors/resolver/event.ts (a dissenting member's
// wait), re-based on Senryo: a parimutuel book instead of a quoted one (a committee never signs a moving price, so the
// stakes on each side are the price), every answer an EIP-712 signature anyone may relay, and every number here
// (invariant `sol-no-magic-numbers`).

uint8 constant EVENT_NONE = 0;
uint8 constant EVENT_OPEN = 1; // listed: calls until `closesAt`, answers from `answerFrom` to `answerBy`
uint8 constant EVENT_DECIDED = 2; // the committee agreed: the winning side shares the losing side's stakes less the fee
uint8 constant EVENT_VOIDED = 3; // every call refunded (the reason says why)

uint8 constant EVENT_VOID_NONE = 0;
uint8 constant EVENT_VOID_DISAGREEMENT = 1; // members answered both ways
uint8 constant EVENT_VOID_QUORUM_NOT_MET = 2; // fewer agreeing answers than the quorum by the deadline (or none)
uint8 constant EVENT_VOID_NO_WINNERS = 3; // the committee answered, but nobody called that answer

uint8 constant EVENT_CALL_NONE = 0;
uint8 constant EVENT_CALL_OPEN = 1; // staked, waiting for the verdict
uint8 constant EVENT_CALL_PAID = 2; // paid, refunded or lost

/// @dev A committee is at most 16 members: one bit each in `EventMarket.answered`.
uint256 constant MAX_COMMITTEE_SIZE = 16;
/// @dev The fee is a share of the losing side only, so a winning call never gets back less than its stake.
uint16 constant MAX_EVENT_FEE_BPS = 1000;
/// @dev The longest an event may take calls (Owarine `maxEventSpanSec`: 92 days).
uint40 constant MAX_EVENT_LEAD_SEC = 7_948_800;
/// @dev The longest the committee's answer window may run (a postponed game, a late release): 30 days.
uint40 constant MAX_ANSWER_SPAN_SEC = 2_592_000;
/// @dev The longest a quorum waits for a dissenting member before it decides: a day.
uint32 constant MAX_DISSENT_WAIT_SEC = 86_400;

/// @dev A committee: its members (in `EventLedger._members`), how many must agree, and whether new events may name it.
///      A committee never changes once set — a new line-up is a new id — so no listed event's judges can be swapped.
struct Committee {
    uint8 size;
    uint8 quorum;
    bool enabled;
}

/// @dev What the lister sets for one event. The question and its rules are passed as text beside it; their hash
///      (`termsHash`) is what every call and every answer is bound to.
struct EventTerms {
    bytes32 eventId;
    uint16 committeeId;
    uint16 feeBps;
    uint40 closesAt; // calls stop here (before the thing happens)
    uint40 answerFrom; // the committee may answer from here (once it can have happened)
    uint40 answerBy; // the last moment an answer counts; after it, too few answers void the event
}

struct EventMarket {
    uint8 state;
    uint8 voidReason;
    bool answer; // the committee's answer (true = Yes); meaningful once decided, or voided with no winners
    uint8 yesVotes;
    uint8 noVotes;
    uint16 committeeId;
    uint16 feeBps;
    uint16 answered; // one bit per member, in committee order
    uint40 closesAt;
    uint40 answerFrom;
    uint40 answerBy;
    uint40 quorumAt; // when agreeing answers first reached the quorum (0 = not yet)
    uint40 decidedAt;
    uint32 openCalls; // calls not yet paid out
    uint128 yesPool;
    uint128 noPool;
    uint128 prize; // the losing side less the fee, shared by the winners pro rata
    uint128 held; // what this event still owes its calls: the stakes, then the payouts
    bytes32 termsHash;
}

/// @dev A signed Yes or No on an event, relayed by anyone. Only the owner signs it (never a session key: the stake
///      can't be cashed out, so it needs the owner's own yes), with a permit when the book's allowance is short.
struct EventCall {
    address owner;
    bytes32 eventId;
    bool yes;
    uint64 stake;
    uint64 deadline;
    uint256 nonce;
    uint32 epoch;
}

struct EventTicket {
    address owner;
    uint8 status;
    bool yes;
    uint64 stake;
    bytes32 eventId;
}

/// @dev One member's answer: signed by the member alone, bound to the event's terms, carrying the hash of the full
///      statement (question, answer, the source the member read, the member, the time) kept off chain by the member.
struct EventAnswer {
    bytes32 eventId;
    bytes32 termsHash;
    address member;
    bool yes;
    bytes32 statementHash;
    uint40 attestedAt;
}
