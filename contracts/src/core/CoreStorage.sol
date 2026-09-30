// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {AccessManaged} from "@openzeppelin/contracts/access/manager/AccessManaged.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ReentrancyGuardTransient} from "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";
import {IPriceSource} from "../oracle/interfaces/IPriceSource.sol";
import {Constants as C} from "../libraries/Constants.sol";
import {Errors} from "../libraries/Errors.sol";
import {
    Account,
    Allowance,
    Book,
    BookBalance,
    CollateralCfg,
    DepositSource,
    Hold,
    MarketParams,
    MarketState,
    Position
} from "../libraries/Types.sol";

/// @title CoreStorage — the single storage space, lock and nonce of SenryoCore.
/// @notice Internal books (POOL, INSURANCE, CARD_FLOAT) are ledger entries; value moves between books and users only
/// through the helpers below, which keep I1 (token balance = Σ users + books) by construction.
/// Settlement is at par between AUSD and USDC (both usd6): debits take AUSD first, then USDC.
abstract contract CoreStorage is AccessManaged, ReentrancyGuardTransient, EIP712 {
    using SafeCast for uint256;

    string internal constant EIP712_NAME = "SenryoCore";
    string internal constant EIP712_VERSION = "1";

    address public immutable AUSD;
    address public immutable USDC;
    IPriceSource public immutable ORACLE;

    mapping(address user => Account) internal _accounts;
    mapping(address user => mapping(uint8 marketId => Position)) internal _positions;
    mapping(uint8 marketId => MarketParams) internal _markets;
    mapping(uint8 marketId => MarketState) internal _marketState;
    uint8 public marketCount;
    mapping(address token => CollateralCfg) internal _collateral;
    mapping(Book book => BookBalance) internal _books;

    // card
    mapping(address user => Allowance) internal _allowances;
    mapping(address user => uint64) public allowanceNonce;
    mapping(bytes32 holdId => Hold) internal _holds;
    mapping(bytes32 issuer => bool) public releaseOnly;
    mapping(address user => uint256) public cardCaptured;
    mapping(address user => uint256) public cardRefunded;
    mapping(bytes32 refId => bool) public refundUsed;

    // triggers
    mapping(bytes32 orderId => bool) public triggerActive;
    mapping(bytes32 orderId => bool) public triggerSeen;

    // admin
    mapping(address caller => DepositSource) public depositSource;
    mapping(address caller => bool) public hasDepositSource;
    address public inboxFactory;
    address public swapper;
    uint64 public pausedUntil;
    bool public settleOnly;

    constructor(address authority, address ausd, address usdc, IPriceSource oracle)
        AccessManaged(authority)
        EIP712(EIP712_NAME, EIP712_VERSION)
    {
        if (ausd == address(0) || usdc == address(0) || address(oracle) == address(0)) {
            revert Errors.ZeroAddress();
        }
        AUSD = ausd;
        USDC = usdc;
        ORACLE = oracle;
    }

    /// @notice EIP-712 domain separator for SpendAllowance and TriggerOrder signatures.
    // forge-lint: disable-next-line(mixed-case-function)
    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    // ---------------------------------------------------------------- guards

    function _requireNewRiskAllowed() internal view {
        if (settleOnly) revert Errors.SettleOnly();
        if (pausedUntil > block.timestamp) revert Errors.Paused();
    }

    function _bump(address user) internal returns (uint64 nonce) {
        nonce = ++_accounts[user].nonce;
    }

    // ---------------------------------------------------------------- token balances

    function _balanceOf(Account storage a) internal view returns (uint256) {
        return uint256(a.ausd) + a.usdc;
    }

    function _credit(address user, address token, uint256 amount) internal {
        Account storage a = _accounts[user];
        if (token == AUSD) a.ausd += amount.toUint128();
        else if (token == USDC) a.usdc += amount.toUint128();
        else revert Errors.UnsupportedToken(token);
    }

    function _debit(address user, address token, uint256 amount) internal {
        Account storage a = _accounts[user];
        uint256 bal = token == AUSD ? a.ausd : token == USDC ? a.usdc : 0;
        if (bal < amount) revert Errors.InsufficientBalance(bal, amount);
        if (token == AUSD) a.ausd -= amount.toUint128();
        else a.usdc -= amount.toUint128();
    }

    // ---------------------------------------------------------------- value moves (user ↔ book)

    /// @notice Take up to `amount` from the user into `book` (AUSD first). Returns what was actually paid.
    function _chargeUser(address user, uint256 amount, Book book) internal returns (uint256 paid) {
        Account storage a = _accounts[user];
        BookBalance storage b = _books[book];
        uint256 fromAusd = amount < a.ausd ? amount : a.ausd;
        uint256 rest = amount - fromAusd;
        uint256 fromUsdc = rest < a.usdc ? rest : a.usdc;
        a.ausd -= uint128(fromAusd);
        a.usdc -= uint128(fromUsdc);
        b.ausd += uint128(fromAusd);
        b.usdc += uint128(fromUsdc);
        paid = fromAusd + fromUsdc;
    }

    /// @notice Pay exactly `amount` from `book` to the user (AUSD first); reverts if the book is short.
    function _payUser(address user, uint256 amount, Book book) internal {
        uint256 moved = _moveBookTo(book, amount, _accounts[user]);
        if (moved < amount) revert Errors.BookInsufficient(uint8(book), moved, amount);
    }

    /// @notice Move up to `amount` between books (AUSD first). Returns what moved.
    function _moveBooks(Book from, Book to, uint256 amount) internal returns (uint256 moved) {
        BookBalance storage src = _books[from];
        BookBalance storage dst = _books[to];
        uint256 fromAusd = amount < src.ausd ? amount : src.ausd;
        uint256 rest = amount - fromAusd;
        uint256 fromUsdc = rest < src.usdc ? rest : src.usdc;
        src.ausd -= uint128(fromAusd);
        src.usdc -= uint128(fromUsdc);
        dst.ausd += uint128(fromAusd);
        dst.usdc += uint128(fromUsdc);
        moved = fromAusd + fromUsdc;
    }

    function _moveBookTo(Book book, uint256 amount, Account storage a) private returns (uint256 moved) {
        BookBalance storage b = _books[book];
        uint256 fromAusd = amount < b.ausd ? amount : b.ausd;
        uint256 rest = amount - fromAusd;
        uint256 fromUsdc = rest < b.usdc ? rest : b.usdc;
        b.ausd -= uint128(fromAusd);
        b.usdc -= uint128(fromUsdc);
        a.ausd += uint128(fromAusd);
        a.usdc += uint128(fromUsdc);
        moved = fromAusd + fromUsdc;
    }

    function _bookTotal(Book book) internal view returns (uint256) {
        BookBalance storage b = _books[book];
        return uint256(b.ausd) + b.usdc;
    }

    /// @notice A user loss owed to POOL: charge the user; INSURANCE covers any shortfall, the rest is socialised.
    function _settleLoss(address user, uint256 amount) internal returns (uint256 shortfall) {
        uint256 paid = _chargeUser(user, amount, Book.POOL);
        shortfall = amount - paid;
        if (shortfall != 0) _coverShortfall(user, shortfall);
    }

    function _coverShortfall(address user, uint256 shortfall) internal virtual;

    function _positionBit(uint8 marketId) internal pure returns (uint32) {
        return uint32(1) << marketId;
    }

    function _maxMarkets() internal pure returns (uint256) {
        return C.MAX_MARKETS;
    }
}
