// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

// Ledger from CWF d7b576b:contracts/src/products/range/RangeReserve.sol (`liquid`, `locked`, `lockedByExpiry`,
// `_requireCapacity`) and products/shared/Payouts.sol (pay-or-owe), split so every unit has exactly one home and the
// whole is rechecked against the token balance after each money path (D-264). Tempo's TIP-403 receive-policy check is
// gone; a blocked or reverting recipient is still held as owed through `trySafeTransfer`.

import {AccessManaged} from "@openzeppelin/contracts/access/manager/AccessManaged.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuardTransient} from "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";
import {IBandReserve} from "./interfaces/IBandReserve.sol";
import "./MarketTypes.sol";

/// @title BandPool — where every unit of collateral the reserve holds belongs.
/// @notice `balance ≥ liquid + reserved + escrowedStakes + committedStakes + payableTotal + totalOwed`:
///         - `liquid`: the pool's free capital;
///         - `reserved`: the pool's part of open tickets' escrow (payout − stake), by expiry too (D-264);
///         - `escrowedStakes`: the callers' part (their remaining basis);
///         - `committedStakes`: stakes waiting for their fill print;
///         - `payableTotal`: winnings and refunds of settled windows not yet paid out;
///         - `totalOwed`: payouts a recipient could not receive, claimable with `claimOwed`.
abstract contract BandPool is AccessManaged, ReentrancyGuardTransient, IBandReserve {
    using SafeERC20 for IERC20;

    IERC20 public immutable collateral;

    Params public params;
    /// @dev Bumped by every pricing change; an intent signs the version it saw and a fill refuses a stale one.
    uint32 public configVersion;
    /// @dev Pauses new opens only. Closes, fills of committed calls, settlement and payouts never pause.
    bool public paused;

    uint256 public liquid;
    uint256 public reserved;
    uint256 public escrowedStakes;
    uint256 public committedStakes;
    uint256 public payableTotal;
    uint256 public totalOwed;
    mapping(uint40 expiry => uint256) public reservedByExpiry;
    mapping(address account => uint256) public owedOf;

    constructor(IERC20 collateral_, Params memory params_) {
        if (address(collateral_) == address(0)) revert ZeroAddress();
        collateral = collateral_;
        _setParams(params_);
    }

    // ------------------------------------------------------------------------------------------------ pool (POOL role)

    /// @notice Adds house capital (D-260: the testnet pool in Test USD; the mainnet seed the owner funds).
    function fund(uint256 amount) external restricted nonReentrant {
        if (amount == 0) revert BadParams();
        collateral.safeTransferFrom(msg.sender, address(this), amount);
        liquid += amount;
        emit PoolFunded(msg.sender, amount, liquid);
        _assertSolvent();
    }

    /// @notice Takes free capital out. Reserved capital backs open tickets and never leaves.
    function defund(uint256 amount, address to) external restricted nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        if (amount > liquid) revert InsufficientLiquidity(amount, liquid);
        liquid -= amount;
        collateral.safeTransfer(to, amount);
        emit PoolDefunded(to, amount, liquid);
        _assertSolvent();
    }

    /// @notice Collects everything the caller is owed after a held payout (pays the caller only, CWF AD-5).
    function claimOwed() external nonReentrant returns (uint256 amount) {
        amount = owedOf[msg.sender];
        if (amount == 0) revert NothingOwed();
        owedOf[msg.sender] = 0;
        totalOwed -= amount;
        collateral.safeTransfer(msg.sender, amount);
        emit OwedClaimed(msg.sender, amount);
        _assertSolvent();
    }

    // ------------------------------------------------------------------------------------------------ params

    function setParams(Params calldata next) external restricted {
        _setParams(next);
    }

    function setPaused(bool next) external restricted {
        paused = next;
        emit PausedSet(next);
    }

    /// @dev Bounded so no admin can price outside the plan's rules (D-262: refuse outside 3–97 %, 2 pp half-spread).
    function _setParams(Params memory p) internal {
        if (p.halfSpreadE6 > MAX_HALF_SPREAD_E6 || p.maxSurchargeE6 > MAX_SURCHARGE_E6) revert BadParams();
        if (p.minProbE6 < MIN_PROB_FLOOR_E6 || p.maxProbE6 > MAX_PROB_CEIL_E6 || p.minProbE6 >= p.maxProbE6) {
            revert BadParams();
        }
        if (p.minProbE6 <= p.halfSpreadE6) revert BadParams(); // a close bid must stay positive
        if (p.maxExposureBps == 0 || p.maxExposureBps > MAX_EXPOSURE_BPS || p.maxExpiryReserved == 0) {
            revert BadParams();
        }
        if (p.minStake == 0 || p.maxStake < p.minStake) revert BadParams();
        params = p;
        configVersion += 1;
        emit ParamsSet(configVersion, p);
    }

    // ------------------------------------------------------------------------------------------------ ledger moves

    /// @dev Liquidity first, then total exposure ≤ `maxExposureBps` of the pool, then the per-expiry cap (every band
    ///      ending on one print is decided together).
    function _hasCapacity(uint256 reserve, uint40 expiry) internal view returns (bool) {
        if (liquid < reserve) return false;
        Params storage p = params;
        if ((reserved + reserve) * BPS > (liquid + reserved) * p.maxExposureBps) return false;
        return reservedByExpiry[expiry] + reserve <= p.maxExpiryReserved;
    }

    /// @dev A fill: the stake moves from committed to escrowed; the pool reserves the rest of the payout.
    function _bookFill(uint256 stake, uint256 reserve, uint40 expiry) internal {
        committedStakes -= stake;
        escrowedStakes += stake;
        liquid -= reserve;
        reserved += reserve;
        reservedByExpiry[expiry] += reserve;
    }

    /// @dev Escrow leaving open tickets: `basis` of callers' stake and `reserve` of the pool's.
    function _releaseEscrow(uint256 basis, uint256 reserve, uint40 expiry) internal {
        escrowedStakes -= basis;
        reserved -= reserve;
        reservedByExpiry[expiry] -= reserve;
    }

    /// @dev Pays `to` or books it as owed (a reverting or blocked recipient never blocks settlement).
    function _payOrOwe(address to, uint256 amount) internal returns (bool paid) {
        if (amount == 0) return true;
        if (collateral.trySafeTransfer(to, amount)) return true;
        uint256 owed = owedOf[to] + amount;
        owedOf[to] = owed;
        totalOwed += amount;
        emit PayoutHeld(to, amount, owed);
        return false;
    }

    /// @notice Everything the reserve must be able to pay or return, against its balance.
    function liabilities() public view returns (uint256) {
        return liquid + reserved + escrowedStakes + committedStakes + payableTotal + totalOwed;
    }

    /// @dev D-264: rechecked after every open, close, settle and payout.
    function _assertSolvent() internal view {
        uint256 balance = collateral.balanceOf(address(this));
        uint256 owed = liabilities();
        if (balance < owed) revert Insolvent(balance, owed);
    }
}
