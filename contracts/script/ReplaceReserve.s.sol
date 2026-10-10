// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {console2} from "forge-std/Script.sol";
import {AccessManager} from "@openzeppelin/contracts/access/manager/AccessManager.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {DuelArena} from "../src/games/DuelArena.sol";
import {MarketCalendar} from "../src/oracle/MarketCalendar.sol";
import {BandReserve} from "../src/markets/BandReserve.sol";
import {Windows} from "../src/markets/Windows.sol";
import {MarketsV3Base} from "./MarketsV3Base.s.sol";

/// @title ReplaceReserve — testnet's v3 on the contracts the abandoned v2 deploy left (D-309, R3.21).
/// @notice Copy `~/.config/senryo/deploy/10143.partial-book.json` over `packages/contracts/src/addresses/10143.json`,
///         `node scripts/catalog-export.mjs`, then:
///         `SPONSOR=<relay> KEEPER=<keeper> forge script script/ReplaceReserve.s.sol --rpc-url monad_testnet \
///          --account senryo-deployer --broadcast --slow --gas-estimate-multiplier 105`
///         (Monad charges the gas limit, so the multiplier is the cost of headroom). Reuses the AccessManager, the
///         market calendar, the verifiers, `Windows` (its registered series) and Test USD; deploys the shape table and
///         the v3 reserve, and on it a fresh arena, Earn and event book; lists every series through `listSeries`, the
///         ride markets and their terms; wires the σ signers and the roles; seeds Practice's pool. A rerun resumes: a
///         v3 reserve in the book is kept, and what is listed, wired or deployed on it is skipped.
contract ReplaceReserve is MarketsV3Base {
    function run() external {
        _readCatalog();
        address sponsor = vm.envAddress("SPONSOR");
        address keeper = vm.envAddress("KEEPER");
        AccessManager manager = AccessManager(_need("AccessManager"));
        MarketCalendar calendar = MarketCalendar(_need("MarketCalendar"));
        Windows windows = Windows(_need("Windows"));
        IERC20 collateral = IERC20(_need("TestUSD"));

        vm.startBroadcast();
        _verifiers(false);
        BandReserve reserve = _v3Reserve();
        if (address(reserve) == address(0)) reserve = _deployReserve(manager, collateral, windows);
        _calendarRole(manager, calendar, keeper);
        _exitRole(manager, reserve, sponsor);
        _sigmaSigners(reserve, keeper, sponsor);
        if (!_arenaOn(reserve)) _duel(manager, reserve, sponsor);
        _configureCalendars(calendar);
        uint256 listed = _listSeries(windows, reserve);
        _rides(reserve);
        _seedPool(reserve, collateral, msg.sender);
        _earn(manager, reserve, msg.sender, false);
        _events(manager, reserve, keeper, false);
        vm.stopBroadcast();

        _writeBook(true);
        console2.log("BandReserve v3", address(reserve));
        console2.log("series listed", listed);
    }

    /// @dev The book's reserve if it is already v3 (it names a shape table; v2's doesn't), else none.
    function _v3Reserve() private view returns (BandReserve) {
        address addr = _bookAddress("BandReserve");
        if (addr.code.length == 0) return BandReserve(address(0));
        (bool ok, bytes memory out) = addr.staticcall(abi.encodeWithSignature("tailTable()"));
        return ok && out.length == WORD && abi.decode(out, (address)) != address(0)
            ? BandReserve(addr)
            : BandReserve(address(0));
    }

    /// @dev Whether the book's arena is already bound to this reserve (v2's is bound to v2's).
    function _arenaOn(BandReserve reserve) private view returns (bool) {
        address addr = _bookAddress("DuelArena");
        return addr.code.length != 0 && address(DuelArena(addr).reserve()) == address(reserve);
    }

    function _need(string memory name) private view returns (address addr) {
        addr = _bookAddress(name);
        require(addr.code.length != 0, string.concat(name, " is not deployed per the address book"));
    }

    uint256 private constant WORD = 32;
}
