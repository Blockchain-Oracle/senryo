// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {console2} from "forge-std/Script.sol";
import {AccessManager} from "@openzeppelin/contracts/access/manager/AccessManager.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MarketCalendar} from "../src/oracle/MarketCalendar.sol";
import {BandReserve} from "../src/markets/BandReserve.sol";
import {Windows} from "../src/markets/Windows.sol";
import {MarketsBase} from "./MarketsBase.s.sol";

/// @title AddMarkets — list the catalogue's new markets on the live deployment (S7, D-284).
/// @notice `node scripts/catalog-export.mjs` first, then:
///         `KEEPER=<keeper address> forge script script/AddMarkets.s.sol --rpc-url monad_testnet \
///          --account senryo-deployer --broadcast`
///         Deploys a print class's verifier (crypto, equity, basket) the first time a series needs it, sets the market calendars, and registers
///         every series not yet on chain with its σ and menu (finishing a menu a stopped run left short). Existing
///         series, weeks and holidays are left as they are; the Practice pool is seeded once, Earn's `PoolShares` and
///         the event book arrive once — so it also finishes a `DeployMarkets` run that stopped part way (a book entry
///         with no code on chain is deployed). The address book keeps every entry and gains what was deployed.
contract AddMarkets is MarketsBase {
    function run() external {
        _readCatalog();
        Windows windows = Windows(_need("Windows"));
        BandReserve reserve = BandReserve(_need("BandReserve"));
        MarketCalendar calendar = MarketCalendar(_need("MarketCalendar"));
        AccessManager manager = AccessManager(_need("AccessManager"));
        address keeper = vm.envAddress("KEEPER");

        vm.startBroadcast();
        _calendarRole(manager, calendar, keeper);
        _verifiers(false);
        _configureCalendars(calendar);
        uint256 listed = _listSeries(windows, reserve);
        _seedPool(reserve, IERC20(address(reserve.collateral())), msg.sender);
        _earn(manager, reserve, msg.sender, false);
        _events(manager, reserve, keeper, false);
        vm.stopBroadcast();

        _writeBook(true);
        console2.log("series listed", listed);
    }

    function _need(string memory name) private view returns (address addr) {
        addr = _bookAddress(name);
        require(addr != address(0), string.concat(name, " is not in the address book"));
    }
}
