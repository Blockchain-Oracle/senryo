// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

/// @title EventBook's vocabulary: committees, events from listing to payout, every refusal by name.
interface IEventBook {
    event CommitteeSet(uint16 indexed committeeId, address[] members, uint8 quorum, string[] names);
    event CommitteeEnabled(uint16 indexed committeeId, bool enabled);
    event LimitsSet(uint64 minStake, uint64 maxStake);
    event EventListed(
        bytes32 indexed eventId,
        uint16 indexed committeeId,
        uint16 feeBps,
        uint40 closesAt,
        uint40 answerFrom,
        uint40 answerBy,
        bytes32 termsHash,
        string question,
        string rules
    );
    event Called(
        bytes32 indexed eventId,
        uint256 indexed ticketId,
        address indexed owner,
        bool yes,
        uint64 stake,
        uint128 yesPool,
        uint128 noPool
    );
    event Answered(bytes32 indexed eventId, address indexed member, bool yes, bytes32 statementHash, uint40 attestedAt);
    event EventDecided(bytes32 indexed eventId, bool yes, uint128 yesPool, uint128 noPool, uint256 fee, uint128 prize);
    event EventVoided(bytes32 indexed eventId, uint8 reason, bool answer);
    event CallPaid(
        uint256 indexed ticketId,
        bytes32 indexed eventId,
        address indexed owner,
        uint8 outcome,
        uint256 amount,
        bool paid
    );
    event FeesSwept(uint256 amount);
    event PayoutHeld(address indexed to, uint256 amount, uint256 owed);
    event OwedClaimed(address indexed to, uint256 amount);

    error ZeroAddress();
    error BadCommittee();
    error CommitteeExists(uint16 committeeId);
    error UnknownCommittee(uint16 committeeId);
    error BadLimits();
    error BadTerms();
    error EventExists(bytes32 eventId);
    error NoSuchEvent(bytes32 eventId);
    error NotOpen(bytes32 eventId, uint8 state);
    error CallsClosed(bytes32 eventId, uint40 closesAt);
    error StakeOutOfRange(uint64 stake, uint64 min, uint64 max);
    error CallExpired(uint64 deadline);
    error CallUsed(address owner, uint256 nonce);
    error WrongEpoch(uint32 expected, uint32 got);
    error SignatureInvalid();
    error WrongTerms(bytes32 eventId);
    error NotAMember(bytes32 eventId, address member);
    error AlreadyAnswered(bytes32 eventId, address member);
    error OutsideAnswerWindow(bytes32 eventId, uint40 attestedAt);
    error NotReady(bytes32 eventId);
    error BadBatch();
    error NothingOwed();
    error NothingToSweep();
    error Insolvent(uint256 balance, uint256 owed);
}
