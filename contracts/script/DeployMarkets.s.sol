// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {console2} from "forge-std/Script.sol";
import {stdJson} from "forge-std/StdJson.sol";
import {AccessManager} from "@openzeppelin/contracts/access/manager/AccessManager.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {CALENDAR_WORD_COUNT} from "../src/libraries/Constants.sol";
import {MarketCalendar} from "../src/oracle/MarketCalendar.sol";
import {IMarketCalendar} from "../src/oracle/interfaces/IMarketCalendar.sol";
import {BandReserve} from "../src/markets/BandReserve.sol";
import {Windows} from "../src/markets/Windows.sol";
import {IWindows} from "../src/markets/interfaces/IWindows.sol";
import {TestUSD} from "../src/markets/testnet/TestUSD.sol";
import "../src/markets/MarketTypes.sol";
import {MarketsBase} from "./MarketsBase.s.sol";

/// @title DeployMarkets — the markets on one network, from `script/catalog/<chainId>.json` (D-268).
/// @notice `node scripts/catalog-export.mjs` first, then:
///         `forge script script/DeployMarkets.s.sol --rpc-url monad_testnet --account senryo-deployer --broadcast`
///         with `SPONSOR` set to the relayer that mints Practice dollars and `KEEPER` to the keeper. Writes `packages/contracts/src/addresses/
///         <chainId>.json` (address, init-code hash, start block, indexed) for `pnpm contracts:export`. Markets added
///         later go through `AddMarkets` on the live deployment (the same listing, in `MarketsBase`).
contract DeployMarkets is MarketsBase {
    using stdJson for string;

    /// @dev AccessManager role that may mint Test USD (the sponsor's Practice grant, D-258).
    uint64 internal constant MINTER_ROLE = 1;

    function run() external {
        _readCatalog();
        address sponsor = vm.envAddress("SPONSOR");
        address keeper = vm.envAddress("KEEPER");

        vm.startBroadcast();
        address admin = msg.sender;
        AccessManager manager = new AccessManager(admin);
        _record("AccessManager", address(manager), abi.encodePacked(type(AccessManager).creationCode, abi.encode(admin)), false);

        uint8[] memory noIds = new uint8[](0);
        uint256[CALENDAR_WORD_COUNT][] memory noWeeks = new uint256[CALENDAR_WORD_COUNT][](0);
        MarketCalendar calendar = new MarketCalendar(address(manager), noIds, noWeeks);
        _record(
            "MarketCalendar",
            address(calendar),
            abi.encodePacked(type(MarketCalendar).creationCode, abi.encode(address(manager), noIds, noWeeks)),
            false
        );

        _verifiers(true);
        Windows windows = new Windows(address(manager), IMarketCalendar(address(calendar)));
        _record(
            "Windows",
            address(windows),
            abi.encodePacked(type(Windows).creationCode, abi.encode(address(manager), address(calendar))),
            true
        );

        IERC20 collateral = _collateral(manager, sponsor);
        BandReserve reserve = _deployReserve(manager, collateral, windows);
        _calendarRole(manager, calendar, keeper);
        _configureCalendars(calendar);
        _listSeries(windows, reserve);
        _seedPool(reserve, collateral, admin);
        _earn(manager, reserve, admin, true);
        vm.stopBroadcast();

        _writeBook(false);
        console2.log("BandReserve", address(reserve));
    }

    /// @dev Mainnet: Circle USDC. Testnet: a fresh Test USD whose `mint` only the sponsor's role may call.
    function _collateral(AccessManager manager, address sponsor) internal returns (IERC20) {
        address usdc = _json.readAddress(".collateral");
        if (usdc != address(0)) return IERC20(usdc);
        TestUSD usd = new TestUSD(address(manager));
        _record("TestUSD", address(usd), abi.encodePacked(type(TestUSD).creationCode, abi.encode(address(manager))), true);
        bytes4[] memory mint = new bytes4[](1);
        mint[0] = TestUSD.mint.selector;
        manager.labelRole(MINTER_ROLE, "MINTER");
        manager.setTargetFunctionRole(address(usd), mint, MINTER_ROLE);
        manager.grantRole(MINTER_ROLE, sponsor, 0);
        // The admin seeds (and can top up) Practice's pool.
        manager.grantRole(MINTER_ROLE, msg.sender, 0);
        return IERC20(address(usd));
    }

    function _deployReserve(AccessManager manager, IERC20 collateral, Windows windows)
        internal
        returns (BandReserve reserve)
    {
        Params memory p = Params({
            halfSpreadE6: uint32(_json.readUint(".params.halfSpreadE6")),
            maxSurchargeE6: uint32(_json.readUint(".params.maxSurchargeE6")),
            minProbE6: uint32(_json.readUint(".params.minProbE6")),
            maxProbE6: uint32(_json.readUint(".params.maxProbE6")),
            maxExposureBps: uint16(_json.readUint(".params.maxExposureBps")),
            maxExpiryReserved: uint64(_json.readUint(".params.maxExpiryReserved")),
            minStake: uint64(_json.readUint(".params.minStake")),
            maxStake: uint64(_json.readUint(".params.maxStake"))
        });
        BandReserve.Caps memory caps = BandReserve.Caps({
            maxPerCallCap: uint64(_json.readUint(".session.maxPerCallCap")),
            maxSessionCap: uint64(_json.readUint(".session.maxSessionCap")),
            maxSessionSec: uint40(_json.readUint(".session.maxSessionSec"))
        });
        reserve = new BandReserve(address(manager), collateral, IWindows(address(windows)), p, caps);
        _record(
            "BandReserve",
            address(reserve),
            abi.encodePacked(
                type(BandReserve).creationCode, abi.encode(address(manager), address(collateral), address(windows), p, caps)
            ),
            true
        );
    }

    /// @dev Practice's pool in Test USD (D-260). Mainnet's seed waits for the owner's funding (S9).
    function _seedPool(BandReserve reserve, IERC20 collateral, address admin) internal {
        uint256 seed = _json.readUint(".poolSeed");
        if (seed == 0) return;
        TestUSD(address(collateral)).mint(admin, seed);
        collateral.approve(address(reserve), seed);
        reserve.fund(seed);
    }
}
