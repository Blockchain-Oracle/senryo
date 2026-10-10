// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

// New for rides (D-299, D-301; 07 §2.4). The commit-then-fill rule is the calls' (D-261): a signed action escrows now
// and fills at the unique print of a later second, so nobody — relayer, keeper or rider — can pick the price.

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {ExitOrders} from "./ExitOrders.sol";
import {LinearMath} from "./LinearMath.sol";
import {RideLedger} from "./RideLedger.sol";
import {IPrintVerifier} from "./interfaces/IPrintVerifier.sol";
import "./MarketTypes.sol";
import "./RideTypes.sol";

/// @title LinearBook — rides from signature to fill, and their closes.
abstract contract LinearBook is RideLedger, ExitOrders {
    using SafeERC20 for IERC20;

    bytes32 public constant RIDE_TYPEHASH = keccak256(
        "RideIntent(uint8 action,address owner,uint16 marketId,bool isLong,uint256 rideId,uint64 margin,"
        "uint32 leverageBps,uint128 size,int64 worstPriceE8,address recipient,uint32 configVersion,uint64 deadline,"
        "uint256 nonce,uint32 epoch)"
    );

    Ride[] internal _rides;

    // ------------------------------------------------------------------------------------------------ commit

    /// @notice Escrows a signed open (margin + open fee pulled now) or registers a signed close; either fills at the
    ///         unique print `fillDelaySec` later. An open spends margin + fee from the session's caps (D-267).
    function commitRide(RideIntent calldata it, bytes calldata sig, Permit calldata permit)
        external
        nonReentrant
        returns (uint256 id)
    {
        if (it.action == ACTION_OPEN) id = _commitRideOpen(it, sig, permit);
        else if (it.action == ACTION_CLOSE) id = _commitRideClose(it, sig);
        else revert BadAction(it.action);
        _assertSolvent();
    }

    function _commitRideOpen(RideIntent calldata it, bytes calldata sig, Permit calldata permit)
        private
        returns (uint256 id)
    {
        if (paused) revert IsPaused();
        if (it.configVersion != configVersion) revert WrongConfig(configVersion, it.configVersion);
        RideMarket storage m = _rideMarket(it.marketId);
        if (!m.enabled) revert RideMarketClosed(it.marketId);
        if (it.margin < m.minMargin || it.margin > m.maxMargin) revert BadStake(it.margin, m.minMargin, m.maxMargin);
        if (it.leverageBps < MIN_LEVERAGE_BPS || it.leverageBps > m.maxLeverageBps || it.worstPriceE8 <= 0) {
            revert BadRide();
        }
        if (it.recipient == address(0)) revert ZeroAddress();
        uint64 fee = SafeCast.toUint64(LinearMath.feeOf(LinearMath.notional(it.margin, it.leverageBps), m.takerFeeBps));
        bool viaSession = _authorizeSigned(
            Signed(it.owner, it.deadline, it.nonce, it.epoch, it.recipient), hashRide(it), sig, it.margin + fee
        );
        _pull(it.owner, uint256(it.margin) + fee, permit);
        uint40 target = uint40(block.timestamp) + params.fillDelaySec;
        _rides.push(_newRide(it, fee, target));
        id = _rides.length;
        emit RideCommitted(
            id, it.owner, it.marketId, it.isLong, it.margin, it.leverageBps, fee, it.worstPriceE8, target, viaSession
        );
    }

    function _newRide(RideIntent calldata it, uint64 fee, uint40 target) private view returns (Ride memory r) {
        r.owner = it.owner;
        r.status = RIDE_COMMITTED;
        r.isLong = it.isLong;
        r.marketId = it.marketId;
        r.target = target;
        r.recipient = it.recipient;
        r.configVersion = configVersion;
        r.leverageBps = it.leverageBps;
        r.margin = it.margin;
        r.openFee = fee;
        r.limitE8 = it.worstPriceE8;
    }

    function _commitRideClose(RideIntent calldata it, bytes calldata sig) private returns (uint256 id) {
        id = it.rideId;
        Ride storage r = _ride(id);
        if (r.owner != it.owner) revert NotRideOwner(id, it.owner);
        // The owner's own close replaces a fired exit's pending one.
        if (_exits[_rideKey(id)].firing != EXIT_NONE) {
            r.closing = 0;
            _exits[_rideKey(id)].firing = EXIT_NONE;
        }
        _checkRideClosable(id, r);
        uint128 size = it.size == 0 ? r.size : it.size;
        if (size > r.size || it.worstPriceE8 <= 0) revert BadRideSize(size, r.size);
        if (it.recipient != r.recipient) revert RecipientMismatch(it.recipient, r.recipient);
        bool viaSession =
            _authorizeSigned(Signed(it.owner, it.deadline, it.nonce, it.epoch, it.recipient), hashRide(it), sig, 0);
        uint40 target = _pendRideClose(r, size, it.worstPriceE8);
        emit RideCloseCommitted(id, size, it.worstPriceE8, target, viaSession);
    }

    function _checkRideClosable(uint256 id, Ride storage r) internal view {
        if (r.status != RIDE_OPEN) revert RideNotOpen(id, r.status);
        if (r.closing != 0) revert RideClosePending(id);
        uint40 canCloseAt = r.filledAt + MIN_HOLD_SEC;
        // forge-lint: disable-next-line(block-timestamp)
        if (block.timestamp < canCloseAt) revert RideHeldTooShort(id, canCloseAt);
    }

    function _pendRideClose(Ride storage r, uint128 size, int64 worstE8) internal returns (uint40 target) {
        target = uint40(block.timestamp) + params.fillDelaySec;
        (r.closing, r.limitE8, r.target) = (size, worstE8, target);
    }

    function hashRide(RideIntent calldata it) public view returns (bytes32) {
        bytes memory head = abi.encode(
            RIDE_TYPEHASH, it.action, it.owner, it.marketId, it.isLong, it.rideId, it.margin, it.leverageBps, it.size
        );
        return _hashTypedDataV4(
            keccak256(
                bytes.concat(
                    head, abi.encode(it.worstPriceE8, it.recipient, it.configVersion, it.deadline, it.nonce, it.epoch)
                )
            )
        );
    }

    // ------------------------------------------------------------------------------------------------ fill

    /// @notice Fills every pending open or close in `ids` at the unique print of `target` on their market's feed
    ///         (recorded here if missing; send its fee only then). Permissionless; rides not pending at `target` are
    ///         skipped. A batch is one market.
    function finalizeRides(uint40 target, uint256[] calldata ids, bytes calldata proof) external payable nonReentrant {
        if (ids.length == 0 || ids.length > MAX_RIDE_BATCH) revert BadBatch();
        uint16 marketId = _ride(ids[0]).marketId;
        RideMarket storage m = _rideMarkets[marketId];
        Print memory print = windows.ensurePrint{value: msg.value}(m.verifier, m.feedId, target, proof);
        for (uint256 i; i < ids.length; ++i) {
            Ride storage r = _ride(ids[i]);
            if (r.target != target) continue;
            if (r.marketId != marketId) revert MixedBatch(ids[i]);
            if (r.status == RIDE_COMMITTED) _fillRideOpen(ids[i], r, print);
            else if (r.status == RIDE_OPEN && r.closing != 0) _fillRideClose(ids[i], r, print);
        }
        _assertSolvent();
    }

    /// @notice Refunds pending opens and drops pending closes whose fill print can no longer come (its admission
    ///         passed). Permissionless (D-261: no print means a refund).
    function expireRides(uint256[] calldata ids) external nonReentrant {
        if (ids.length == 0 || ids.length > MAX_RIDE_BATCH) revert BadBatch();
        for (uint256 i; i < ids.length; ++i) {
            Ride storage r = _ride(ids[i]);
            bool openPending = r.status == RIDE_COMMITTED;
            if (!openPending && !(r.status == RIDE_OPEN && r.closing != 0)) continue;
            RideMarket storage m = _rideMarkets[r.marketId];
            if (windows.printOf(m.verifier, m.feedId, r.target).publishTime != 0) continue;
            // forge-lint: disable-next-line(block-timestamp)
            if (block.timestamp <= uint256(r.target) + IPrintVerifier(m.verifier).admissionSec()) continue;
            if (openPending) _refuseRideOpen(ids[i], r, REFUSE_NO_PRINT);
            else _refuseRideClose(ids[i], r, REFUSE_NO_PRINT);
        }
        _assertSolvent();
    }

    /// @dev Fills at the print (D-301: no spread — the entry is the print; the fee is the pool's edge) if it is within
    ///      the rider's limit, the terms they signed still hold and the pool can take it; else refunds.
    function _fillRideOpen(uint256 id, Ride storage r, Print memory print) private {
        RideMarket storage m = _rideMarkets[r.marketId];
        if (!m.enabled || r.configVersion != configVersion) return _refuseRideOpen(id, r, REFUSE_CONFIG);
        int64 p = print.priceE8;
        if (r.isLong ? p > r.limitE8 : p < r.limitE8) return _refuseRideOpen(id, r, REFUSE_SLIPPAGE);
        uint256 notional = LinearMath.notional(r.margin, r.leverageBps);
        uint256 size = LinearMath.sizeOf(notional, p);
        uint256 reserve = LinearMath.reserveOf(r.margin, r.leverageBps, m.maxProfitBps, m.maxMoveBps);
        if (size == 0 || !_rideFits(r.marketId, r.isLong, reserve, notional)) {
            return _refuseRideOpen(id, r, REFUSE_CAPACITY);
        }
        (uint256 before, uint256 next) = _skewMove(r.marketId, r.isLong, notional);
        uint64 charged = r.openFee;
        uint64 fee = next < before ? SafeCast.toUint64(LinearMath.feeOf(notional, m.makerFeeBps)) : charged;

        _bookRideFill(uint256(r.margin) + charged, r.margin, fee, reserve);
        r.status = RIDE_OPEN;
        (r.filledAt, r.updatedAt) = (r.target, r.target);
        r.size = SafeCast.toUint128(size);
        r.reserve = SafeCast.toUint64(reserve);
        r.openFee = fee;
        r.entryE8 = p;
        r.koE8 = LinearMath.koPrice(r.isLong, p, size, r.margin);
        r.capE8 = LinearMath.capPrice(r.isLong, p, size, reserve);
        r.limitE8 = 0;
        _addToSide(r);
        emit RideFilled(id, p, r.size, r.reserve, fee, r.koE8, r.capE8);
        // The maker rate (D-301: the trade reduces the pool's skew) gives back what the taker fee over-collected.
        _payOrOwe(r.owner, charged - fee);
    }

    /// @dev A close fills at the print within the rider's limit (a fired exit at a print meeting it). A print past
    ///      the ride's knock-out or cap settles it as that instead: the bound was crossed by the close's own print.
    function _fillRideClose(uint256 id, Ride storage r, Print memory print) private {
        int64 p = print.priceE8;
        Exit storage e = _exits[_rideKey(id)];
        if (e.firing != EXIT_NONE) {
            if (!_rideExitMet(e, r.isLong, p)) return _refuseRideClose(id, r, REFUSE_EXIT);
            e.firing = EXIT_NONE;
        } else if (r.isLong ? p < r.limitE8 : p > r.limitE8) {
            return _refuseRideClose(id, r, REFUSE_SLIPPAGE);
        }
        if (LinearMath.pastKo(r.isLong, p, r.koE8)) return _knockOut(id, r, p, msg.sender);
        if (LinearMath.pastCap(r.isLong, p, r.capE8)) return _settleWhole(id, r, p, RIDE_CAPPED, false);
        _exitPart(id, r, r.closing, p, RIDE_CLOSED, true);
    }

    // ------------------------------------------------------------------------------------------------ exits

    /// @dev `sizeOut` of the ride leaves at `p`: margin and reserve pro rata (ceiled), its PnL clamped to the ride's
    ///      equity, the close fee (maker if it reduces skew) and, on an owner's close, the early-close fee.
    function _exitPart(uint256 id, Ride storage r, uint256 sizeOut, int64 p, uint8 doneState, bool early) internal {
        bool last = sizeOut == r.size;
        uint256 marginOut = last ? r.margin : LinearMath.share(r.margin, sizeOut, r.size);
        uint256 reserveOut = last ? r.reserve : LinearMath.share(r.reserve, sizeOut, r.size);
        int256 pnl = LinearMath.pnl(r.isLong, sizeOut, r.entryE8, p);
        uint256 equity = LinearMath.equity(marginOut, reserveOut, pnl);
        uint256 fees = _exitFees(r, sizeOut, p, pnl, early);
        if (fees > equity) fees = equity;
        _closeOut(id, r, sizeOut, marginOut, reserveOut, last ? doneState : RIDE_OPEN, p, pnl, fees, equity - fees, 0);
    }

    function _exitFees(Ride storage r, uint256 sizeOut, int64 p, int256 pnl, bool early)
        private
        view
        returns (uint256 fees)
    {
        RideMarket storage m = _rideMarkets[r.marketId];
        uint256 exitNotional = LinearMath.notionalAt(sizeOut, p);
        bool maker = _closeReducesSkew(r.marketId, r.isLong, _entryNotional(sizeOut, r.entryE8));
        fees = LinearMath.feeOf(exitNotional, maker ? m.makerFeeBps : m.takerFeeBps);
        if (early) {
            RideTerms storage t = rideTerms;
            fees += LinearMath.earlyFee(exitNotional, pnl, r.target - r.filledAt, t.earlyFeeBps, t.earlyWindowSec);
        }
    }

    /// @dev The whole ride leaves at `p` as `state` (capped: its whole reserve; ended: its clamped equity).
    function _settleWhole(uint256 id, Ride storage r, int64 p, uint8 state, bool early) internal {
        int256 pnl = LinearMath.pnl(r.isLong, r.size, r.entryE8, p);
        uint256 equity = LinearMath.equity(r.margin, r.reserve, pnl);
        if (state == RIDE_CAPPED) equity = uint256(r.margin) + r.reserve;
        uint256 fees = _exitFees(r, r.size, p, pnl, early);
        if (fees > equity) fees = equity;
        _closeOut(id, r, r.size, r.margin, r.reserve, state, p, pnl, fees, equity - fees, 0);
    }

    /// @dev Knocked out: the rider gets nothing; whoever proved the crossing gets the keeper fee from the margin.
    function _knockOut(uint256 id, Ride storage r, int64 p, address prover) internal {
        uint256 keeperFee = LinearMath.keeperFee(r.margin);
        int256 pnl = LinearMath.pnl(r.isLong, r.size, r.entryE8, p);
        _closeOut(id, r, r.size, r.margin, r.reserve, RIDE_KNOCKED_OUT, p, pnl, 0, 0, keeperFee);
        _payOrOwe(prover, keeperFee);
    }

    function _closeOut(
        uint256 id,
        Ride storage r,
        uint256 sizeOut,
        uint256 marginOut,
        uint256 reserveOut,
        uint8 state,
        int64 p,
        int256 pnl,
        uint256 fees,
        uint256 paid,
        uint256 keeperFee
    ) private {
        bool last = state != RIDE_OPEN;
        _takeFromSide(r, sizeOut, marginOut, reserveOut, last);
        _bookRideExit(marginOut, reserveOut, paid, keeperFee);
        r.size -= SafeCast.toUint128(sizeOut);
        r.margin -= SafeCast.toUint64(marginOut);
        r.reserve -= SafeCast.toUint64(reserveOut);
        (r.closing, r.limitE8, r.updatedAt) = (0, 0, r.target);
        if (last) {
            r.status = state;
            delete _exits[_rideKey(id)];
        }
        emit RideExited(
            id,
            state,
            SafeCast.toUint128(sizeOut),
            p,
            pnl,
            SafeCast.toUint64(fees),
            SafeCast.toUint64(paid),
            SafeCast.toUint64(keeperFee),
            msg.sender
        );
        _payOrOwe(r.recipient, paid);
    }

    function _refuseRideOpen(uint256 id, Ride storage r, uint8 reason) private {
        uint64 back = r.margin + r.openFee;
        committedStakes -= back;
        r.status = RIDE_REFUNDED;
        r.limitE8 = 0;
        emit RideRefused(id, reason, back);
        _payOrOwe(r.owner, back);
    }

    function _refuseRideClose(uint256 id, Ride storage r, uint8 reason) private {
        (r.closing, r.limitE8) = (0, 0);
        _exits[_rideKey(id)].firing = EXIT_NONE;
        emit RideCloseRefused(id, reason);
    }

    // ------------------------------------------------------------------------------------------------ helpers

    function rideOf(uint256 id) external view returns (Ride memory) {
        return _ride(id);
    }

    function rideCount() external view returns (uint256) {
        return _rides.length;
    }

    function _ride(uint256 id) internal view returns (Ride storage) {
        if (id == 0 || id > _rides.length) revert UnknownRide(id);
        return _rides[id - 1];
    }

    function _pull(address owner, uint256 amount, Permit calldata permit) private {
        if (permit.deadline != 0) {
            // A front-run permit only spends the same signature; the pull below is what must succeed.
            try IERC20Permit(address(collateral))
                .permit(owner, address(this), permit.value, permit.deadline, permit.v, permit.r, permit.s) {}
                catch {}
        }
        collateral.safeTransferFrom(owner, address(this), amount);
        committedStakes += amount;
    }

    /// @dev A ride's exit lives in the same book as tickets' under its own key (R3.12).
    function _rideKey(uint256 id) internal pure virtual returns (uint256);

    /// @dev Whether a fill at `p` meets the ride's fired exit (R3.12).
    function _rideExitMet(Exit storage e, bool isLong, int64 p) internal view virtual returns (bool);
}
