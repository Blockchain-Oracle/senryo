// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {AccessManaged} from "@openzeppelin/contracts/access/manager/AccessManaged.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Permit} from "./MarketTypes.sol";

/// @dev The shared pool's books, its rides' mark, and its POOL-role money doors (`BandPool`, `RideBounds`).
interface ISharedPool {
    function collateral() external view returns (IERC20);
    function liquid() external view returns (uint256);
    function reserved() external view returns (uint256);
    function reservedByExpiry(uint40 expiry) external view returns (uint256);
    function ridesOpen() external view returns (bool);
    function markRides(uint40 t) external view returns (int256);
    function fund(uint256 amount) external;
    function defund(uint256 amount, address to) external;
    function setWithdrawHold(uint256 amount) external;
}

/// @title PoolShares — Earn: supply the shared pool at settled hours (S7.6, D-287; v3 D-307).
/// @notice Shares are the pool: its value is `liquid + reserved` (open calls at the pool's cost) less what open rides
///         owe their riders, marked exactly at the roll (`markRides`: a print at most 5 s old and not before the hour,
///         the bound frontier proving no ride is past a knock-out or cap there). Supplying and withdrawing are
///         requests keyed by the hour they settle at — a request made after hour H settles at H + 1h, so nobody joins
///         or leaves knowing anything past the hour they are valued at — settled by `roll(H)` once every window ending
///         in the hour before it is settled (`reservedByExpiry` zero for each of its 60 expiries). Rolls run in order.
///         Both sides of a roll use the same price, (value + 1) / (supply + 1). Supplies always settle; a withdrawal
///         batch settles whole once the pool's liquid covers it, or moves to the next hour whole and holds that
///         liquidity from new calls and rides meanwhile (`withdrawHold`). The house's capital is the first shares
///         (`seed`, 1 share = 1 dollar unit). Claims are lazy and anyone may push them. Users hold no gas (D-266): each
///         request is also an EIP-712 `EarnRequest` the owner signs and the relayer sends (`requestFor`).
/// @dev Holds the POOL role on `fund`/`defund` (AccessManager): the only way money enters or leaves the pool.
contract PoolShares is ERC20, AccessManaged, EIP712, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint40 public constant HOUR_SEC = 3600;
    /// @dev Every window's expiry is a whole minute (contracts `MIN_CADENCE_SEC`).
    uint40 public constant EXPIRY_STEP_SEC = 60;
    /// @dev The +1 on both sides of the price (a virtual share and a virtual dollar unit).
    uint256 internal constant VIRTUAL = 1;
    /// @dev The rides' mark is at most this old at the roll (D-307).
    uint40 public constant MARK_MAX_AGE_SEC = 5;

    uint8 public constant SUPPLY = 1;
    uint8 public constant WITHDRAW = 2;
    uint8 public constant CANCEL_SUPPLY = 3;
    uint8 public constant CANCEL_WITHDRAW = 4;
    bytes32 public constant EARN_REQUEST_TYPEHASH =
        keccak256("EarnRequest(uint8 kind,address owner,uint256 amount,uint64 deadline,uint256 nonce)");

    /// @notice What the owner signs for the relayer: a supply, a withdrawal or a cancel, once (`nonce`), until `deadline`.
    struct EarnRequest {
        uint8 kind;
        address owner;
        uint256 amount;
        uint64 deadline;
        uint256 nonce;
    }

    ISharedPool public immutable pool;
    IERC20 public immutable asset;

    /// @notice The requests settling at one hour, at one rate: `total` in, out at `num / den` once `done`. A deferred
    ///         withdrawal batch `movedTo` the next hour, whole.
    struct Batch {
        uint256 total;
        uint256 num;
        uint256 den;
        bool done;
        uint40 movedTo;
    }

    struct Request {
        uint40 hour;
        uint256 amount;
    }

    /// @notice The last hour rolled (0 until the first roll).
    uint40 public lastRoll;
    mapping(uint40 hour => Batch) public supplyBatch;
    mapping(uint40 hour => Batch) public withdrawBatch;
    mapping(address account => Request) public supplyOf;
    mapping(address account => Request) public withdrawOf;
    mapping(address owner => mapping(uint256 nonce => bool)) public nonceUsed;

    event Seeded(address indexed to, uint256 shares);
    event SupplyRequested(address indexed account, uint40 indexed hour, uint256 assets);
    event WithdrawRequested(address indexed account, uint40 indexed hour, uint256 shares);
    event RequestCancelled(address indexed account, bool supply, uint256 amount);
    event Claimed(address indexed account, uint256 shares, uint256 assets);
    event EpochRolled(
        uint40 indexed hour,
        uint256 value,
        uint256 supply,
        uint256 suppliedAssets,
        uint256 withdrawnAssets,
        bool deferred,
        int256 ridesOwed
    );

    error NotAnHour(uint40 hour);
    error AlreadyRolled(uint40 hour);
    error RollOutOfOrder(uint40 hour, uint40 next);
    error StaleMark(uint40 markAt);
    error HourNotSettled(uint40 expiry);
    error NotSeeded();
    error AlreadySeeded();
    error NothingToDo();
    error Settled();
    error ZeroAmount();
    error SignatureExpired(uint64 deadline);
    error SignatureInvalid();
    error NonceUsed(address owner, uint256 nonce);
    error BadKind(uint8 kind);

    constructor(address authority, ISharedPool pool_)
        ERC20("Senryo pool share", "SPS")
        AccessManaged(authority)
        EIP712("Senryo Earn", "1")
    {
        pool = pool_;
        asset = pool_.collateral();
    }

    function decimals() public view override returns (uint8) {
        return ERC20(address(asset)).decimals();
    }

    // ------------------------------------------------------------------------------------------------ the house

    /// @notice Mints the pool's existing value as the house's shares, once (1 share = 1 dollar unit).
    function seed(address to) external restricted {
        if (totalSupply() != 0) revert AlreadySeeded();
        uint256 value = poolValue();
        if (value == 0) revert NothingToDo();
        _mint(to, value);
        emit Seeded(to, value);
    }

    // ------------------------------------------------------------------------------------------------ requests

    /// @notice Supply dollars at the next roll (they wait here, not at risk, until then).
    function requestSupply(uint256 assets) external nonReentrant {
        _supply(msg.sender, assets);
    }

    /// @notice Withdraw shares at the next roll that can pay them (the shares wait here until then).
    function requestWithdraw(uint256 shares) external nonReentrant {
        _withdraw(msg.sender, shares);
    }

    /// @notice Takes back a request its roll hasn't settled.
    function cancel(bool supply) external nonReentrant {
        _cancel(msg.sender, supply);
    }

    /// @notice The relayed form of every request: the owner's signature instead of their gas (D-266); `permit`
    ///         (optional) sets the supply's allowance in the same transaction.
    function requestFor(EarnRequest calldata r, bytes calldata sig, Permit calldata permit) external nonReentrant {
        if (block.timestamp > r.deadline) revert SignatureExpired(r.deadline);
        bytes32 digest = _hashTypedDataV4(
            keccak256(abi.encode(EARN_REQUEST_TYPEHASH, r.kind, r.owner, r.amount, r.deadline, r.nonce))
        );
        if (!SignatureChecker.isValidSignatureNowCalldata(r.owner, digest, sig)) revert SignatureInvalid();
        if (nonceUsed[r.owner][r.nonce]) revert NonceUsed(r.owner, r.nonce);
        nonceUsed[r.owner][r.nonce] = true;
        if (r.kind == SUPPLY) {
            if (permit.deadline != 0) {
                // A front-run permit only spends the same signature; the pull in `_supply` is what must succeed.
                try IERC20Permit(address(asset))
                    .permit(r.owner, address(this), permit.value, permit.deadline, permit.v, permit.r, permit.s) {}
                    catch {}
            }
            _supply(r.owner, r.amount);
        } else if (r.kind == WITHDRAW) {
            _withdraw(r.owner, r.amount);
        } else if (r.kind == CANCEL_SUPPLY || r.kind == CANCEL_WITHDRAW) {
            _cancel(r.owner, r.kind == CANCEL_SUPPLY);
        } else {
            revert BadKind(r.kind);
        }
    }

    /// @notice The EIP-712 domain separator requests are signed under.
    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    function _supply(address owner, uint256 assets) private {
        if (assets == 0) revert ZeroAmount();
        if (totalSupply() == 0) revert NotSeeded();
        _claim(owner);
        asset.safeTransferFrom(owner, address(this), assets);
        _join(supplyOf[owner], supplyBatch, assets);
        emit SupplyRequested(owner, nextHour(), assets);
    }

    function _withdraw(address owner, uint256 shares) private {
        if (shares == 0) revert ZeroAmount();
        _claim(owner);
        _transfer(owner, address(this), shares);
        _join(withdrawOf[owner], withdrawBatch, shares);
        emit WithdrawRequested(owner, nextHour(), shares);
    }

    /// @dev A request joins the batch of the next hour. One still waiting in an earlier batch moves with it (it only
    ///      waits longer), so an account has one request a side.
    function _join(Request storage r, mapping(uint40 => Batch) storage batches, uint256 amount) private {
        uint40 hour = nextHour();
        if (r.amount != 0) {
            (, Batch storage held) = _current(batches, r.hour);
            held.total -= r.amount;
            amount += r.amount;
        }
        (r.hour, r.amount) = (hour, amount);
        batches[hour].total += amount;
    }

    function _cancel(address owner, bool supply) private {
        Request storage r = supply ? supplyOf[owner] : withdrawOf[owner];
        if (r.amount == 0) revert NothingToDo();
        (, Batch storage b) = _current(supply ? supplyBatch : withdrawBatch, r.hour);
        if (b.done) revert Settled();
        uint256 amount = r.amount;
        b.total -= amount;
        r.amount = 0;
        if (supply) asset.safeTransfer(owner, amount);
        else _transfer(address(this), owner, amount);
        emit RequestCancelled(owner, supply, amount);
    }

    /// @dev The batch a request keyed `hour` is in now (following a deferred withdrawal's moves).
    function _current(mapping(uint40 => Batch) storage batches, uint40 hour)
        private
        view
        returns (uint40 at, Batch storage b)
    {
        at = hour;
        b = batches[at];
        while (b.movedTo != 0) {
            at = b.movedTo;
            b = batches[at];
        }
    }

    /// @notice Delivers an account's settled requests (shares for a supply, dollars for a withdrawal).
    function claim(address account) external nonReentrant {
        _claim(account);
    }

    // ------------------------------------------------------------------------------------------------ the roll

    /// @notice Settles the requests keyed `hour` (anyone; the keeper calls it each hour, in order). With rides open,
    ///         `markAt` is the instant their prints are recorded at: not before the hour and at most 5 s old.
    function roll(uint40 hour, uint40 markAt) external nonReentrant {
        if (hour % HOUR_SEC != 0 || hour > block.timestamp) revert NotAnHour(hour);
        if (hour <= lastRoll) revert AlreadyRolled(hour);
        if (lastRoll != 0 && hour != lastRoll + HOUR_SEC) revert RollOutOfOrder(hour, lastRoll + HOUR_SEC);
        if (totalSupply() == 0) revert NotSeeded();
        for (uint40 e = hour - HOUR_SEC + EXPIRY_STEP_SEC; e <= hour; e += EXPIRY_STEP_SEC) {
            if (pool.reservedByExpiry(e) != 0) revert HourNotSettled(e);
        }
        lastRoll = hour;
        int256 owed = _ridesOwed(hour, markAt);
        uint256 atCost = poolValue();
        uint256 value = owed >= int256(atCost) ? 0 : uint256(int256(atCost) - owed);
        uint256 supply = totalSupply();
        uint256 supplied = _settleSupply(hour, value, supply);
        (uint256 withdrawn, bool deferred) = _settleWithdraw(hour, value, supply);
        emit EpochRolled(hour, value, supply, supplied, withdrawn, deferred, owed);
    }

    /// @dev What open rides owe their riders at `markAt` (0 with none open).
    function _ridesOwed(uint40 hour, uint40 markAt) private view returns (int256) {
        if (!pool.ridesOpen()) return 0;
        // forge-lint: disable-next-line(block-timestamp)
        if (markAt < hour || markAt > block.timestamp || block.timestamp - markAt > MARK_MAX_AGE_SEC) {
            revert StaleMark(markAt);
        }
        return pool.markRides(markAt);
    }

    function _settleSupply(uint40 hour, uint256 value, uint256 supply) private returns (uint256 assets) {
        Batch storage b = supplyBatch[hour];
        assets = b.total;
        (b.num, b.den, b.done) = (supply + VIRTUAL, value + VIRTUAL, true);
        if (assets == 0) return 0;
        _mint(address(this), (assets * b.num) / b.den);
        asset.forceApprove(address(pool), assets);
        pool.fund(assets);
    }

    /// @dev Pays the hour's withdrawals whole, or moves them to the next hour whole and holds the liquid they need.
    function _settleWithdraw(uint40 hour, uint256 value, uint256 supply)
        private
        returns (uint256 assets, bool deferred)
    {
        Batch storage b = withdrawBatch[hour];
        if (b.total == 0) {
            if (pool.liquid() != 0) pool.setWithdrawHold(0);
            return (0, false);
        }
        assets = (b.total * (value + VIRTUAL)) / (supply + VIRTUAL);
        if (assets > pool.liquid()) {
            uint40 next = hour + HOUR_SEC;
            withdrawBatch[next].total += b.total;
            b.movedTo = next;
            pool.setWithdrawHold(assets);
            return (0, true);
        }
        (b.num, b.den, b.done) = (value + VIRTUAL, supply + VIRTUAL, true);
        _burn(address(this), b.total);
        pool.setWithdrawHold(0);
        pool.defund(assets, address(this));
    }

    function _claim(address account) private {
        uint256 shares;
        uint256 assets;
        Request storage s = supplyOf[account];
        (, Batch storage sb) = _current(supplyBatch, s.hour);
        if (s.amount != 0 && sb.done) {
            shares = (s.amount * sb.num) / sb.den;
            s.amount = 0;
            _transfer(address(this), account, shares);
        }
        Request storage w = withdrawOf[account];
        (, Batch storage wb) = _current(withdrawBatch, w.hour);
        if (w.amount != 0 && wb.done) {
            assets = (w.amount * wb.num) / wb.den;
            w.amount = 0;
            asset.safeTransfer(account, assets);
        }
        if (shares != 0 || assets != 0) emit Claimed(account, shares, assets);
    }

    // ------------------------------------------------------------------------------------------------ views

    /// @notice The hour a request made now settles at: the next whole hour (D-307's cutoff).
    function nextHour() public view returns (uint40) {
        // forge-lint: disable-next-line(block-timestamp)
        return uint40(block.timestamp - block.timestamp % HOUR_SEC + HOUR_SEC);
    }

    /// @notice The pool's value at cost: liquid plus what open calls and rides hold (a roll also marks rides).
    function poolValue() public view returns (uint256) {
        return pool.liquid() + pool.reserved();
    }

    /// @notice An account's shares valued now (its settled-but-unclaimed supply included).
    function valueOf(address account) external view returns (uint256) {
        uint256 shares = balanceOf(account);
        Request memory s = supplyOf[account];
        (, Batch storage sb) = _current(supplyBatch, s.hour);
        if (s.amount != 0 && sb.done) shares += (s.amount * sb.num) / sb.den;
        return (shares * (poolValue() + VIRTUAL)) / (totalSupply() + VIRTUAL);
    }
}
