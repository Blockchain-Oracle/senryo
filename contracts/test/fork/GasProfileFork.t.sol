// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {AggregatorV3Interface} from "../../src/oracle/interfaces/AggregatorV3Interface.sol";
import {MirrorAggregator} from "../../src/testnet/MirrorAggregator.sol";
import {Constants as C} from "../../src/libraries/Constants.sol";
import {Book, TriggerOrder} from "../../src/libraries/Types.sol";
import {SeedConstants as S} from "../../script/SeedConstants.sol";
import {ForkStack} from "./ForkStack.sol";
import {GasEstimate} from "./GasEstimate.sol";

/// @title S8.6 gas profile (D-119 re-calibration → D-185) on a Monad-rules fork.
/// @notice Every user / operator / keeper action at 0, 1 and 2 open positions (`_risk` and the AccountRiskUpdated
/// epilogue read every held market; on mainnet each pass also reads the AUSD/USDC Chainlink feeds). Each measured
/// call logs `estimate <action>.p<positions>` = the transaction-level `eth_estimateGas` (see GasEstimate):
///   MONAD_FORK_URL=http://127.0.0.1:<port> forge test --match-path test/fork/GasProfileFork.t.sol --isolate -vv
/// Fork 143 = mainnet (real tokens, Chainlink XAU/XAG + stable feeds, Uniswap v4); 10143 = testnet mocks + mirrors.
contract GasProfileForkTest is ForkStack, GasEstimate {
    uint256 internal constant DEPOSIT_USD6 = 60e6;
    uint256 internal constant LEG_USD6 = 20e6;
    uint256 internal constant ADD_USD6 = 10e6;
    uint256 internal constant SMALL_USD6 = 1e6;
    uint256 internal constant LIQ_DEPOSIT_USD6 = 8e6;
    uint128 internal constant HOLD_USD6 = 5e6;
    uint128 internal constant HOLD_ADD_USD6 = 1e6;
    uint128 internal constant DAILY_LIMIT_USD6 = 50e6;
    uint256 internal constant BOOK_SEED_USD6 = 50e6;
    uint256 internal constant DRIP_FLOAT = 10 ether;
    uint256 internal constant TOPUP_WEI = 0.1 ether;
    /// @dev GUARDIAN `raiseMargins` to 99 % / 98 % makes a healthy account liquidatable without moving a real feed.
    uint16 internal constant LIQ_IM_BPS = 9900;
    uint16 internal constant LIQ_MM_BPS = 9800;
    uint256 internal constant HALF = 2;
    /// @dev Beyond the 2 % clamp: trips CIRCUIT.
    uint16 internal constant JUMP_BPS = 500;
    bytes32 internal constant ISSUER = keccak256("senryo.gas-profile.issuer");
    bytes32 internal constant DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");

    address internal user;
    uint256 internal userPk;
    address internal liquidator = makeAddr("liquidator");
    uint256 internal nonce;

    function setUp() public {
        if (!_forkOrSkip()) return;
        _deployStack();
        (user, userPk) = makeAddrAndKey("gas-user");
        _seedBooks();
    }

    // ---------------------------------------------------------------- scenarios

    /// @notice No positions: first deposits (fresh account page), ledger, envelope hold, swaps, keeper poke, drip, LP.
    function test_gas_p0() public {
        _deposit("deposit.first", ausd, DEPOSIT_USD6);
        _deposit("deposit.p0", usdc, DEPOSIT_USD6);
        _core("withdraw.p0", user, abi.encodeCall(core.withdraw, (address(usdc), SMALL_USD6, user)));
        _allow("setSpendAllowance.p0");
        uint128 envelope = HOLD_USD6 * uint128(HALF);
        _core("setCardEnvelope.p0", user, abi.encodeCall(core.setCardEnvelope, (envelope)));
        _hold("placeHold.envelope");
        if (mainnet) {
            _core("swapCollateral.p0", user, abi.encodeCall(core.swapCollateral, (address(usdc), ADD_USD6, 0)));
            _core("swapCollateral.p0", user, abi.encodeCall(core.swapCollateral, (address(ausd), ADD_USD6, 0)));
        }
        _core("poke", address(this), abi.encodeCall(core.poke, (S.GOLD_MARKET)));
        _drip();
        _lp();
    }

    function test_gas_p1() public {
        _deposit("deposit.first", ausd, DEPOSIT_USD6);
        _open("increase.p1", S.GOLD_MARKET, true, LEG_USD6);
        _open("increase.p1", S.GOLD_MARKET, true, ADD_USD6);
        _cardAndLedger(".p1");
        _reduce("decrease.p1", S.GOLD_MARKET, true);
        _trigger(".p1", S.GOLD_MARKET, true);
        _close("close.p1", S.GOLD_MARKET, true);
    }

    function test_gas_p2() public {
        _deposit("deposit.first", ausd, DEPOSIT_USD6);
        _open("increase.p1", S.GOLD_MARKET, true, LEG_USD6);
        _open("increase.p2", S.SILVER_MARKET, false, LEG_USD6);
        _open("increase.p2", S.SILVER_MARKET, false, ADD_USD6);
        _cardAndLedger(".p2");
        _reduce("decrease.p2", S.GOLD_MARKET, true);
        _trigger(".p2", S.SILVER_MARKET, false);
        _close("close.p2", S.GOLD_MARKET, true);
        _open("increase.p2", S.GOLD_MARKET, true, LEG_USD6);
        bytes32 h = _hold("placeHold.p2");
        vm.warp(vm.getBlockTimestamp() + C.HOLD_TTL + C.HOLD_RELEASE_GRACE);
        _core("releaseExpiredHold.p2", liquidator, abi.encodeCall(core.releaseExpiredHold, (h)));
    }

    function test_gas_liquidate_p1() public {
        _liquidateWith("liquidate.p1", false);
    }

    function test_gas_liquidate_p2() public {
        _liquidateWith("liquidate.p2", true);
    }

    // ---------------------------------------------------------------- actions

    function _core(string memory label, address from, bytes memory data) internal {
        _estimateAndCall(label, from, address(core), data);
    }

    function _deposit(string memory label, IERC20 token, uint256 amount) internal {
        _fund(user, token, amount);
        vm.prank(user);
        token.approve(address(core), amount);
        _core(label, user, abi.encodeCall(core.deposit, (address(token), amount)));
    }

    function _open(string memory label, uint8 m, bool isLong, uint256 notional) internal {
        uint256 limit = isLong ? type(uint256).max : 0;
        _core(label, user, abi.encodeCall(core.increase, (m, isLong, notional, limit, _deadline())));
        vm.roll(vm.getBlockNumber() + C.MIN_HOLD_BLOCKS + 1);
    }

    function _reduce(string memory label, uint8 m, bool isLong) internal {
        uint256 half = core.position(user, m).size / HALF;
        uint256 limit = isLong ? 0 : type(uint256).max;
        _core(label, user, abi.encodeCall(core.decrease, (m, half, limit, _deadline())));
    }

    function _close(string memory label, uint8 m, bool isLong) internal {
        uint256 limit = isLong ? 0 : type(uint256).max;
        _core(label, user, abi.encodeCall(core.close, (m, limit, _deadline())));
    }

    /// @dev A stop-loss that has already crossed: `placeTrigger` (relayed) then the keeper's `executeTrigger`.
    function _trigger(string memory suffix, uint8 m, bool isLong) internal {
        TriggerOrder memory o = TriggerOrder({
            user: user,
            marketId: m,
            isLong: isLong,
            takeProfit: false,
            triggerPrice18: isLong ? type(uint128).max : 1,
            sizeDelta: uint128(core.position(user, m).size / HALF),
            acceptablePrice18: isLong ? 0 : type(uint128).max,
            expiry: _deadline(),
            salt: uint64(++nonce)
        });
        bytes32 id = core.triggerId(o);
        _core(string.concat("placeTrigger", suffix), address(this), abi.encodeCall(core.placeTrigger, (o, _sign(id))));
        _core(string.concat("executeTrigger", suffix), liquidator, abi.encodeCall(core.executeTrigger, (id)));
    }

    /// @dev Allowance relay, non-envelope hold + increase + over-capture, hold + release, refund, deposit, withdraw.
    function _cardAndLedger(string memory p) internal {
        _allow(string.concat("setSpendAllowance", p));
        bytes32 h = _hold(string.concat("placeHold", p));
        _core(string.concat("increaseHold", p), address(this), abi.encodeCall(core.increaseHold, (h, HOLD_ADD_USD6)));
        uint128 over = HOLD_USD6 + HOLD_ADD_USD6 + HOLD_ADD_USD6;
        _core(string.concat("captureHold", p), address(this), abi.encodeCall(core.captureHold, (h, over)));
        bytes32 h2 = _hold(string.concat("placeHold", p));
        _core(string.concat("releaseHold", p), address(this), abi.encodeCall(core.releaseHold, (h2)));
        bytes32 refId = bytes32(++nonce);
        _core(string.concat("refund", p), address(this), abi.encodeCall(core.refund, (user, refId, HOLD_ADD_USD6)));
        _deposit(string.concat("deposit", p), usdc, ADD_USD6);
        _core(string.concat("withdraw", p), user, abi.encodeCall(core.withdraw, (address(usdc), SMALL_USD6, user)));
        _core(string.concat("setCardEnvelope", p), user, abi.encodeCall(core.setCardEnvelope, (HOLD_USD6)));
        _core(string.concat("setCardEnvelope", p), user, abi.encodeCall(core.setCardEnvelope, (0)));
        if (mainnet) {
            bytes memory swap = abi.encodeCall(core.swapCollateral, (address(usdc), SMALL_USD6, 0));
            _core(string.concat("swapCollateral", p), user, swap);
        }
    }

    /// @notice Keeper `SessionOracle.observe`: a fresh round, then (testnet mirrors, which this test may push) the
    /// worst case — CIRCUIT with CONFIRM_LOOKBACK_ROUNDS rounds inside the band but spanning < CONFIRM_SECONDS, so
    /// the confirm walk reads every lookback round.
    function test_gas_observe() public {
        _freshPrices();
        bytes memory observe = abi.encodeCall(oracle.observe, (S.GOLD_MARKET));
        _estimateAndCall("observe", liquidator, address(oracle), observe);
        if (mainnet) return;
        (, int256 answer,,,) = AggregatorV3Interface(xauFeed).latestRoundData();
        int256 jumped = answer + answer * int256(uint256(JUMP_BPS)) / int256(C.BPS);
        MirrorAggregator(xauFeed).pushAnswer(jumped);
        oracle.observe(S.GOLD_MARKET);
        for (uint256 i = 1; i < C.CONFIRM_LOOKBACK_ROUNDS; ++i) {
            MirrorAggregator(xauFeed).pushAnswer(jumped);
        }
        _estimateAndCall("observe.confirmWalk", liquidator, address(oracle), observe);
    }

    function _liquidateWith(string memory label, bool both) internal {
        _deposit("deposit.first", ausd, LIQ_DEPOSIT_USD6);
        _open("increase.p1", S.GOLD_MARKET, true, LEG_USD6);
        if (both) _open("increase.p2", S.SILVER_MARKET, false, LEG_USD6);
        core.raiseMargins(S.GOLD_MARKET, LIQ_IM_BPS, LIQ_MM_BPS, S.BASE_SPREAD_BPS, S.DEV_SPREAD_BPS);
        core.raiseMargins(S.SILVER_MARKET, LIQ_IM_BPS, LIQ_MM_BPS, S.BASE_SPREAD_BPS, S.DEV_SPREAD_BPS);
        _core(label, liquidator, abi.encodeCall(core.liquidate, (user)));
    }

    function _allow(string memory label) internal {
        uint64 expiry = _deadline();
        bytes32 structHash =
            keccak256(abi.encode(core.ALLOWANCE_TYPEHASH(), user, DAILY_LIMIT_USD6, expiry, core.allowanceNonce(user)));
        bytes memory sig = _sign(_typed(core.DOMAIN_SEPARATOR(), structHash));
        _core(label, address(this), abi.encodeCall(core.setSpendAllowance, (user, DAILY_LIMIT_USD6, expiry, sig)));
    }

    function _hold(string memory label) internal returns (bytes32 holdId) {
        bytes32 txn = bytes32(++nonce);
        holdId = keccak256(abi.encode(ISSUER, txn));
        _core(label, address(this), abi.encodeCall(core.placeHold, (ISSUER, txn, user, HOLD_USD6)));
    }

    /// @dev StarterDrip: claim (mainnet: MON drip; testnet: + practice AUSD), voucher, gas top-up.
    function _drip() internal {
        vm.deal(address(drip), DRIP_FLOAT);
        _fund(address(drip), ausd, S.VOUCHER_AMOUNT_USD6);
        bytes32 domain = keccak256(
            abi.encode(DOMAIN_TYPEHASH, keccak256("SenryoStarterDrip"), keccak256("1"), block.chainid, address(drip))
        );
        uint64 deadline = _deadline();
        bytes memory claimSig = _sign(_typed(domain, keccak256(abi.encode(drip.CLAIM_TYPEHASH(), user, deadline))));
        _estimateAndCall(
            "claimFor", address(this), address(drip), abi.encodeCall(drip.claimFor, (user, deadline, claimSig))
        );
        bytes memory code = bytes("senryo-gas-profile");
        bytes32[] memory hashes = new bytes32[](1);
        hashes[0] = keccak256(code);
        drip.addVouchers(hashes);
        bytes32 voucher = keccak256(abi.encode(drip.VOUCHER_TYPEHASH(), user, hashes[0], deadline));
        bytes memory redeem = abi.encodeCall(drip.redeemVoucher, (user, code, deadline, _sign(_typed(domain, voucher))));
        _estimateAndCall("redeemVoucher", address(this), address(drip), redeem);
        bytes memory top = abi.encodeCall(drip.topUp, (makeAddr("newcomer"), TOPUP_WEI));
        _estimateAndCall("topUp", address(this), address(drip), top);
    }

    /// @dev Second LP: deposit, request; claim after the delay (testnet only — real mainnet feeds go stale on a warp).
    function _lp() internal {
        address lp2 = makeAddr("lp2");
        _fund(lp2, ausd, DEPOSIT_USD6);
        vm.prank(lp2);
        ausd.approve(address(vault), DEPOSIT_USD6);
        _estimateAndCall("lpDeposit", lp2, address(vault), abi.encodeCall(vault.deposit, (DEPOSIT_USD6, lp2)));
        uint256 shares = vault.balanceOf(lp2) / HALF;
        uint256 id = vault.nextRequestId();
        _estimateAndCall("lpRequestRedeem", lp2, address(vault), abi.encodeCall(vault.requestRedeem, (shares, lp2)));
        if (mainnet) return;
        vm.warp(vm.getBlockTimestamp() + C.LP_REDEEM_DELAY);
        _freshPrices();
        _estimateAndCall("lpClaimRedeem", lp2, address(vault), abi.encodeCall(vault.claimRedeem, (id)));
    }

    function _seedBooks() internal {
        _fund(address(this), ausd, S.LP_SEED_USD6 + BOOK_SEED_USD6);
        _fund(address(this), usdc, BOOK_SEED_USD6);
        ausd.approve(address(vault), S.LP_SEED_USD6);
        vault.deposit(S.LP_SEED_USD6, address(this));
        ausd.approve(address(core), BOOK_SEED_USD6);
        core.fundBook(Book.INSURANCE, address(ausd), BOOK_SEED_USD6);
        usdc.approve(address(core), BOOK_SEED_USD6);
        core.fundBook(Book.CARD_FLOAT, address(usdc), BOOK_SEED_USD6);
    }

    function _typed(bytes32 domain, bytes32 structHash) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19\x01", domain, structHash));
    }

    function _sign(bytes32 digest) internal view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(userPk, digest);
        return abi.encodePacked(r, s, v);
    }

    function _deadline() internal view returns (uint64) {
        return uint64(vm.getBlockTimestamp() + 1 days);
    }
}
