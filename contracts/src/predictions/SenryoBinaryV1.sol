// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {BinaryMath} from "./BinaryMath.sol";
import {PythBoundaryOracle} from "./PythBoundaryOracle.sol";

/// @notice Practice test-MON only. Seed is dedicated collateral, never pair LP/card funds.
contract SenryoBinaryV1 is ReentrancyGuard {
    bytes32 public constant BTC = 0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43;
    bytes32 public constant ETH = 0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace;
    uint256 public constant SUPPLY_CAP = 1000 ether;
    // Version commits all fixed protocol economics; actual immutable deployment dependencies are also hashed below.
    bytes32 public constant POLICY_HASH = keccak256(
        "senryo-binary-testnet-v1:chain=10143;durations=300,900;create=30,3600;cutoff=10;tolerance=5;open=30;close=120;expo=-8;confidenceBps=25;priceMax=1e16;weights=2,0|0,2|1,1;fee=0;seed=10e18,100e18;buy=1e16,5e18;supply=1000e18;active=8;quote=15;dust=locked"
    );
    bytes32 public immutable configHash;
    PythBoundaryOracle public immutable oracle;
    address public immutable roundCreator;
    address public immutable guardian;
    address public immutable liquidityBeneficiary;
    bool public riskPaused = true;
    uint256 public activeRounds;
    uint256 public totalEscrow;
    uint256 public totalCredits;
    enum State {
        Missing,
        Scheduled,
        Open,
        OpeningInvalid,
        ClosingInvalid,
        Up,
        Down,
        Tie,
        Void
    }

    enum ResolutionReason {
        PriceComparison,
        OpeningMissing,
        OpeningQuality,
        ClosingMissing,
        ClosingQuality
    }

    struct Round {
        bytes32 feed;
        uint64 start;
        uint64 end;
        uint64 cutoff;
        uint32 duration;
        State state;
        uint256 up;
        uint256 down;
        uint256 totalUp;
        uint256 totalDown;
        uint256 escrow;
        uint256 revision;
        uint256 seed;
        PythBoundaryOracle.Observation opening;
        PythBoundaryOracle.Observation closing;
    }

    struct Position {
        uint256 up;
        uint256 down;
    }

    struct Quote {
        uint256 input;
        uint256 output;
        uint256 up;
        uint256 down;
        uint256 revision;
        uint64 cutoff;
        State state;
        uint256 blockNumber;
        uint256 timestamp;
        uint256 marginalPriceE18;
        uint256 executionPriceE18;
        uint256 priceImpactBps;
    }
    mapping(bytes32 => Round) private rounds;
    mapping(bytes32 => mapping(address => Position)) private positions;
    mapping(address => uint256) public creditOf;
    mapping(address => mapping(bytes32 => bool)) public usedOperation;
    error Invalid();
    error Unauthorized();
    error Closed();
    error Slippage();
    error Duplicate();
    event RoundCreated(
        bytes32 indexed roundId,
        bytes32 indexed feed,
        bytes32 configHash,
        uint32 duration,
        uint64 start,
        uint64 end,
        uint64 cutoff,
        address beneficiary,
        uint256 seedWei
    );
    event OpeningRecorded(bytes32 indexed roundId, PythBoundaryOracle.Observation observation);
    event BoundaryRejected(bytes32 indexed roundId, bool opening, PythBoundaryOracle.Observation observation);
    event RoundResolved(
        bytes32 indexed roundId,
        State outcome,
        ResolutionReason reason,
        PythBoundaryOracle.Observation opening,
        PythBoundaryOracle.Observation closing
    );
    event Bought(
        bytes32 indexed roundId,
        address indexed owner,
        bytes32 indexed operationId,
        bool isUp,
        uint256 monWei,
        uint256 sharesWei,
        uint256 up,
        uint256 down,
        uint256 revision
    );
    event Sold(
        bytes32 indexed roundId,
        address indexed owner,
        bytes32 indexed operationId,
        bool isUp,
        uint256 sharesWei,
        uint256 monCreditWei,
        uint256 up,
        uint256 down,
        uint256 revision
    );
    event SharesClaimed(
        bytes32 indexed roundId,
        address indexed owner,
        bytes32 indexed operationId,
        uint256 up,
        uint256 down,
        uint256 monCreditWei
    );
    event LiquidityClaimed(
        bytes32 indexed roundId, address indexed beneficiary, uint256 up, uint256 down, uint256 monCreditWei
    );
    event Withdrawal(address indexed owner, bytes32 indexed operationId, uint256 monWei);
    event WithdrawalFailed(address indexed owner, bytes32 indexed operationId, uint256 monWei);
    event RiskPaused(bool paused);

    /// @dev Local tests use vm.chainId(10143); no alternate-chain or runtime fixture bypass exists here.
    constructor(PythBoundaryOracle oracle_, address creator_, address guardian_, address beneficiary_) {
        if (
            block.chainid != 10143 || address(oracle_).code.length == 0 || creator_ == address(0)
                || guardian_ == address(0) || beneficiary_ == address(0)
        ) revert Invalid();
        oracle = oracle_;
        roundCreator = creator_;
        guardian = guardian_;
        liquidityBeneficiary = beneficiary_;
        configHash = keccak256(
            abi.encode(
                POLICY_HASH, BTC, ETH, address(oracle_), address(oracle_.receiver()), creator_, guardian_, beneficiary_
            )
        );
    }

    function round(bytes32 id) external view returns (Round memory) {
        return rounds[id];
    }

    function position(bytes32 id, address owner) external view returns (Position memory) {
        return positions[id][owner];
    }

    function setRiskPaused(bool paused) external {
        if (msg.sender != guardian) revert Unauthorized();
        riskPaused = paused;
        emit RiskPaused(paused);
    }

    function createRound(bytes32 asset, uint32 duration, uint64 start, address beneficiary)
        external
        payable
        nonReentrant
        returns (bytes32 id)
    {
        if (msg.sender != roundCreator) revert Unauthorized();
        if (riskPaused || activeRounds >= 8) revert Closed();
        if (
            (asset != BTC && asset != ETH) || (duration != 300 && duration != 900) || start % duration != 0
                // Fixed consensus-time schedule/deadline; proof price selection uses signed unique observations.
                // forge-lint: disable-next-line(block-timestamp)
                || start < block.timestamp + 30 || start > block.timestamp + 3600 || beneficiary != liquidityBeneficiary
                || msg.value < 10 ether || msg.value > 100 ether
        ) {
            revert Invalid();
        }
        id = keccak256(abi.encode(block.chainid, address(this), configHash, asset, duration, start));
        Round storage r = rounds[id];
        if (r.state != State.Missing) revert Duplicate();
        r.feed = asset;
        r.start = start;
        r.end = start + duration;
        r.cutoff = r.end - 10;
        r.duration = duration;
        r.state = State.Scheduled;
        r.up = msg.value;
        r.down = msg.value;
        r.totalUp = msg.value;
        r.totalDown = msg.value;
        r.escrow = msg.value;
        r.seed = msg.value;
        totalEscrow += msg.value;
        activeRounds++;
        emit RoundCreated(id, asset, configHash, duration, start, r.end, r.cutoff, beneficiary, msg.value);
    }

    function recordOpening(bytes32 id, bytes[] calldata proof) external payable nonReentrant {
        Round storage r = rounds[id];
        // Fixed consensus-time schedule/deadline; proof price selection uses signed unique observations.
        // forge-lint: disable-next-line(block-timestamp)
        if (r.state != State.Scheduled || block.timestamp < r.start || block.timestamp >= r.start + 30) {
            revert Closed();
        }
        r.opening = oracle.verify{value: msg.value}(r.feed, r.start, proof);
        if (!r.opening.quality) {
            r.state = State.OpeningInvalid;
            // All reaching mutation paths are nonReentrant; this event records the completed guarded outcome.
            // forge-lint: disable-next-line(reentrancy-events)
            emit BoundaryRejected(id, true, r.opening);
        } else {
            r.state = State.Open;
            // All reaching mutation paths are nonReentrant; this event records the completed guarded outcome.
            // forge-lint: disable-next-line(reentrancy-events)
            emit OpeningRecorded(id, r.opening);
        }
    }

    function resolve(bytes32 id, bytes[] calldata proof) external payable nonReentrant {
        Round storage r = rounds[id];
        // Fixed consensus-time schedule/deadline; proof price selection uses signed unique observations.
        // forge-lint: disable-next-line(block-timestamp)
        if (r.state != State.Open || block.timestamp < r.end || block.timestamp >= r.end + 120) revert Closed();
        r.closing = oracle.verify{value: msg.value}(r.feed, r.end, proof);
        if (!r.closing.quality) {
            r.state = State.ClosingInvalid;
            // All reaching mutation paths are nonReentrant; this event records the completed guarded outcome.
            // forge-lint: disable-next-line(reentrancy-events)
            emit BoundaryRejected(id, false, r.closing);
            return;
        }
        _finalize(
            id,
            r,
            r.closing.price > r.opening.price ? State.Up : r.closing.price < r.opening.price ? State.Down : State.Tie,
            ResolutionReason.PriceComparison
        );
    }

    function voidExpired(bytes32 id) external nonReentrant {
        Round storage r = rounds[id];
        bool opening = r.state == State.Scheduled || r.state == State.OpeningInvalid;
        if (
            (!opening && r.state != State.Open && r.state != State.ClosingInvalid)
                // Fixed consensus-time schedule/deadline; proof price selection uses signed unique observations.
                // forge-lint: disable-next-line(block-timestamp)
                || block.timestamp < (opening ? r.start + 30 : r.end + 120)
        ) {
            revert Closed();
        }
        ResolutionReason reason = opening
            ? (r.state == State.Scheduled ? ResolutionReason.OpeningMissing : ResolutionReason.OpeningQuality)
            : (r.state == State.Open ? ResolutionReason.ClosingMissing : ResolutionReason.ClosingQuality);
        _finalize(id, r, State.Void, reason);
    }

    function _finalize(bytes32 id, Round storage r, State outcome, ResolutionReason reason) private {
        r.state = outcome;
        activeRounds--;
        // All reaching mutation paths are nonReentrant; this event records the completed guarded outcome.
        // forge-lint: disable-next-line(reentrancy-events)
        emit RoundResolved(id, outcome, reason, r.opening, r.closing);
    }

    function _trade(Round storage r) private view {
        // Fixed consensus-time schedule/deadline; proof price selection uses signed unique observations.
        // forge-lint: disable-next-line(block-timestamp)
        if (r.state != State.Open || block.timestamp >= r.cutoff) revert Closed();
    }

    function _deadline(Round storage r, uint64 deadline) private view {
        // Fixed consensus-time schedule/deadline; proof price selection uses signed unique observations.
        // forge-lint: disable-next-line(block-timestamp)
        if (deadline <= block.timestamp || deadline > block.timestamp + 15 || deadline >= r.cutoff) revert Closed();
    }

    function _operation(bytes32 op) private {
        if (op == bytes32(0) || usedOperation[msg.sender][op]) revert Duplicate();
        usedOperation[msg.sender][op] = true;
    }

    function quoteBuy(bytes32 id, bool isUp, uint256 amount) public view returns (Quote memory q) {
        Round storage r = rounds[id];
        _trade(r);
        if (riskPaused || amount < 0.01 ether || amount > 5 ether || r.escrow + amount > SUPPLY_CAP) revert Invalid();
        q = _quote(r, amount, BinaryMath.buy(isUp ? r.up : r.down, isUp ? r.down : r.up, amount), isUp, true);
    }

    function quoteSell(bytes32 id, bool isUp, uint256 shares) public view returns (Quote memory q) {
        Round storage r = rounds[id];
        _trade(r);
        // Caller-independent quote, but never quote more than all issued shares outside the pool.
        if (shares > (isUp ? r.totalUp - r.up : r.totalDown - r.down)) revert Invalid();
        uint256 output = BinaryMath.sell(isUp ? r.up : r.down, isUp ? r.down : r.up, shares);
        if (output == 0 || output > r.escrow) revert Invalid();
        q = _quote(r, shares, output, isUp, false);
    }

    function _quote(Round storage r, uint256 input, uint256 output, bool isUp, bool isBuy)
        private
        view
        returns (Quote memory)
    {
        uint256 marginal = (isUp ? r.down : r.up) * 1e18 / (r.up + r.down);
        uint256 execution = isBuy ? input * 1e18 / output : output * 1e18 / input;
        uint256 difference = execution > marginal ? execution - marginal : marginal - execution;
        // An extreme pool can round the marginal price to zero; report unbounded impact explicitly.
        uint256 impact = marginal == 0 ? type(uint256).max : difference * 10000 / marginal;
        return Quote(
            input,
            output,
            r.up,
            r.down,
            r.revision,
            r.cutoff,
            r.state,
            block.number,
            block.timestamp,
            marginal,
            execution,
            impact
        );
    }

    function buy(bytes32 id, bool isUp, uint256 minSharesOut, uint64 deadline, bytes32 op)
        external
        payable
        nonReentrant
        returns (uint256 out)
    {
        Round storage r = rounds[id];
        out = quoteBuy(id, isUp, msg.value).output;
        _deadline(r, deadline);
        _operation(op);
        if (out < minSharesOut || minSharesOut == 0) revert Slippage();
        r.up += msg.value;
        r.down += msg.value;
        r.totalUp += msg.value;
        r.totalDown += msg.value;
        r.escrow += msg.value;
        totalEscrow += msg.value;
        if (isUp) {
            r.up -= out;
            positions[id][msg.sender].up += out;
        } else {
            r.down -= out;
            positions[id][msg.sender].down += out;
        }
        r.revision++;
        // Internal quote/math calls cannot reenter; mutation is also nonReentrant.
        // forge-lint: disable-next-line(reentrancy-events)
        emit Bought(id, msg.sender, op, isUp, msg.value, out, r.up, r.down, r.revision);
    }

    function sell(bytes32 id, bool isUp, uint256 shares, uint256 minMonOut, uint64 deadline, bytes32 op)
        external
        nonReentrant
        returns (uint256 out)
    {
        Round storage r = rounds[id];
        out = quoteSell(id, isUp, shares).output;
        _deadline(r, deadline);
        _operation(op);
        Position storage p = positions[id][msg.sender];
        if (shares > (isUp ? p.up : p.down)) revert Invalid();
        if (out < minMonOut || minMonOut == 0) revert Slippage();
        if (isUp) {
            p.up -= shares;
            r.up += shares;
        } else {
            p.down -= shares;
            r.down += shares;
        }
        r.up -= out;
        r.down -= out;
        r.totalUp -= out;
        r.totalDown -= out;
        _credit(r, msg.sender, out);
        r.revision++;
        // Internal quote/math calls cannot reenter; mutation is also nonReentrant.
        // forge-lint: disable-next-line(reentrancy-events)
        emit Sold(id, msg.sender, op, isUp, shares, out, r.up, r.down, r.revision);
    }

    function _credit(Round storage r, address owner, uint256 amount) private {
        r.escrow -= amount;
        totalEscrow -= amount;
        creditOf[owner] += amount;
        totalCredits += amount;
    }

    function _payout(Round storage r, uint256 up, uint256 down) private returns (uint256 value) {
        if (uint8(r.state) < uint8(State.Up)) revert Closed();
        value = r.state == State.Up ? up : r.state == State.Down ? down : (up + down) / 2;
        r.totalUp -= up;
        r.totalDown -= down;
    }

    function claim(bytes32 id, bytes32 op) external nonReentrant returns (uint256 value) {
        _operation(op);
        Round storage r = rounds[id];
        Position memory p = positions[id][msg.sender];
        if (p.up == 0 && p.down == 0) revert Invalid();
        delete positions[id][msg.sender];
        value = _payout(r, p.up, p.down);
        _credit(r, msg.sender, value);
        emit SharesClaimed(id, msg.sender, op, p.up, p.down, value);
    }

    function claimLiquidity(bytes32 id) external nonReentrant returns (uint256 value) {
        Round storage r = rounds[id];
        uint256 up = r.up;
        uint256 down = r.down;
        if (up == 0 && down == 0) revert Duplicate();
        r.up = 0;
        r.down = 0;
        value = _payout(r, up, down);
        _credit(r, liquidityBeneficiary, value);
        emit LiquidityClaimed(id, liquidityBeneficiary, up, down, value);
    }

    function withdraw(uint256 amount, bytes32 op) external nonReentrant returns (bool paid) {
        _operation(op);
        if (amount == 0 || amount > creditOf[msg.sender]) revert Invalid();
        creditOf[msg.sender] -= amount;
        totalCredits -= amount;
        // Effects precede interaction; nonReentrant protects both oracle and recipient callbacks.
        // forge-lint: disable-next-line(reentrancy-eth)
        (paid,) = payable(msg.sender).call{value: amount}("");
        if (!paid) {
            creditOf[msg.sender] += amount;
            totalCredits += amount;
            // All reaching mutation paths are nonReentrant; this event records the completed guarded outcome.
            // forge-lint: disable-next-line(reentrancy-events)
            emit WithdrawalFailed(msg.sender, op, amount);
        } else {
            // All reaching mutation paths are nonReentrant; this event records the completed guarded outcome.
            // forge-lint: disable-next-line(reentrancy-events)
            emit Withdrawal(msg.sender, op, amount);
        }
    }
}
