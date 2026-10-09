// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {Script} from "forge-std/Script.sol";
import {stdJson} from "forge-std/StdJson.sol";
import {AccessManager} from "@openzeppelin/contracts/access/manager/AccessManager.sol";
import {CALENDAR_WORD_COUNT} from "../src/libraries/Constants.sol";
import {MarketCalendar} from "../src/oracle/MarketCalendar.sol";
import {BandReserve} from "../src/markets/BandReserve.sol";
import {BasketPrintVerifier} from "../src/markets/BasketPrintVerifier.sol";
import {RedStoneBasketVerifier} from "../src/markets/RedStoneBasketVerifier.sol";
import {RedStonePrintVerifier} from "../src/markets/RedStonePrintVerifier.sol";
import {PythPrintVerifier} from "../src/markets/PythPrintVerifier.sol";
import {ISharedPool, PoolShares} from "../src/markets/PoolShares.sol";
import {Windows} from "../src/markets/Windows.sol";
import {IPyth} from "../src/markets/interfaces/IPyth.sol";
import "../src/markets/MarketTypes.sol";

/// @title MarketsBase — what `DeployMarkets` (a fresh network) and `AddMarkets` (the live one) share (D-284, D-289).
/// @notice Reads `script/catalog/<chainId>.json` (`node scripts/catalog-export.mjs`): a verifier per print class, the
///         market calendars (the week for the current US offset and the coming holidays), and every series with its
///         σ and band menu. Listing is idempotent: a registered series, a set week and a known holiday are skipped.
abstract contract MarketsBase is Script {
    using stdJson for string;

    /// @dev Address-book names of each print class's verifier (mirrors `PRINT_VERIFIER` in packages/config).
    string internal constant CRYPTO_VERIFIER = "PythPrintVerifier";
    string internal constant EQUITY_VERIFIER = "PythPrintVerifierEquity";
    string internal constant BASKET_VERIFIER = "BasketPrintVerifier";
    string internal constant REDSTONE_VERIFIER = "RedStonePrintVerifier";
    string internal constant REDSTONE_BASKET_VERIFIER = "RedStoneBasketVerifier";
    /// @dev The print classes a catalogue may name (mirrors `PRINT_VERIFIER`); a RedStone basket wraps the RedStone
    ///      verifier, so "redstone" comes before it and is deployed whenever either is named.
    string[5] internal CLASSES = ["crypto", "equity", "basket", "redstone", "redstone-basket"];
    /// @dev AccessManager role that keeps market calendars current (the keeper's job, D-289); the admin holds it too.
    uint64 internal constant CALENDAR_ROLE = 2;
    /// @dev AccessManager role on the pool's money doors (`fund`, `defund`): held by `PoolShares` alone (D-287).
    uint64 internal constant POOL_ROLE = 3;

    struct Entry {
        string name;
        address addr;
        bytes32 initCodeHash;
        bool isIndexed;
        uint256 startBlock;
    }

    Entry[] internal _entries;
    string internal _json;
    /// @dev Each print class's verifier for this run (deployed now or read from the book).
    mapping(bytes32 classHash => address) internal _verifierOf;

    function _readCatalog() internal {
        _json = vm.readFile(string.concat(vm.projectRoot(), "/script/catalog/", vm.toString(block.chainid), ".json"));
        require(_json.readUint(".chainId") == block.chainid, "catalog is for another chain");
    }

    function _bookPath() internal view returns (string memory) {
        return string.concat(vm.projectRoot(), "/../packages/contracts/src/addresses/", vm.toString(block.chainid), ".json");
    }

    // ------------------------------------------------------------------------------------------------ verifiers

    function _bookName(string memory cls) internal pure returns (string memory) {
        bytes32 h = keccak256(bytes(cls));
        if (h == keccak256("equity")) return EQUITY_VERIFIER;
        if (h == keccak256("basket")) return BASKET_VERIFIER;
        if (h == keccak256("redstone")) return REDSTONE_VERIFIER;
        if (h == keccak256("redstone-basket")) return REDSTONE_BASKET_VERIFIER;
        return CRYPTO_VERIFIER;
    }

    /// @dev One verifier per class (`.verifiers.<cls>`): a `BasketPrintVerifier` for baskets, else a
    ///      `PythPrintVerifier`; recorded under its book name.
    function _deployVerifier(string memory cls) internal returns (address addr) {
        bytes32 h = keccak256(bytes(cls));
        if (h == keccak256("redstone")) return _deployRedStone();
        if (h == keccak256("redstone-basket")) {
            RedStonePrintVerifier single = RedStonePrintVerifier(_verifierOf[keccak256("redstone")]);
            addr = address(new RedStoneBasketVerifier(single));
            _record(
                _bookName(cls),
                addr,
                abi.encodePacked(type(RedStoneBasketVerifier).creationCode, abi.encode(address(single))),
                false
            );
            _verifierOf[h] = addr;
            return addr;
        }
        IPyth pyth = IPyth(_json.readAddress(".pyth"));
        string memory at = string.concat(".verifiers.", cls);
        uint16 grace = uint16(_json.readUint(string.concat(at, ".graceSec")));
        uint16 maxConf = uint16(_json.readUint(string.concat(at, ".maxConfBps")));
        uint32 admission = uint32(_json.readUint(string.concat(at, ".admissionSec")));
        bytes memory args = abi.encode(address(pyth), grace, maxConf, admission);
        if (h == keccak256("basket")) {
            addr = address(new BasketPrintVerifier(pyth, grace, maxConf, admission));
            _record(_bookName(cls), addr, abi.encodePacked(type(BasketPrintVerifier).creationCode, args), false);
        } else {
            addr = address(new PythPrintVerifier(pyth, grace, maxConf, admission));
            _record(_bookName(cls), addr, abi.encodePacked(type(PythPrintVerifier).creationCode, args), false);
        }
        _verifierOf[h] = addr;
    }

    /// @dev `RedStonePrintVerifier` from `.redstone` (D-284): the five production signers, threshold, strict, admission.
    function _deployRedStone() internal returns (address addr) {
        address[] memory signers = _json.readAddressArray(".redstone.signers");
        uint8 threshold = uint8(_json.readUint(".redstone.threshold"));
        uint32 strict = uint32(_json.readUint(".redstone.strictSec"));
        uint32 admission = uint32(_json.readUint(".redstone.admissionSec"));
        addr = address(new RedStonePrintVerifier(signers, threshold, strict, admission));
        _record(
            REDSTONE_VERIFIER,
            addr,
            abi.encodePacked(type(RedStonePrintVerifier).creationCode, abi.encode(signers, threshold, strict, admission)),
            false
        );
        _verifierOf[keccak256("redstone")] = addr;
    }

    /// @dev Every class some series names: its verifier from the book, or deployed when the book has none (`fresh`
    ///      ignores the book — a new network).
    function _verifiers(bool fresh) internal {
        string[] memory named = abi.decode(_json.parseRaw(".series[*].verifierClass"), (string[]));
        for (uint256 c; c < CLASSES.length; ++c) {
            string memory cls = CLASSES[c];
            bool used = keccak256(bytes(cls)) == keccak256("crypto");
            for (uint256 i; i < named.length && !used; ++i) {
                bytes32 n = keccak256(bytes(named[i]));
                used = n == keccak256(bytes(cls))
                    || (keccak256(bytes(cls)) == keccak256("redstone") && n == keccak256("redstone-basket"));
            }
            if (!used) continue;
            address known = fresh ? address(0) : _bookAddress(_bookName(cls));
            if (known == address(0)) _deployVerifier(cls);
            else _verifierOf[keccak256(bytes(cls))] = known;
        }
    }

    // ------------------------------------------------------------------------------------------------ calendars

    /// @dev `setWeek` and `addHoliday` under CALENDAR_ROLE, held by the keeper (`KEEPER`) and the admin. Idempotent.
    function _calendarRole(AccessManager manager, MarketCalendar calendar, address keeper) internal {
        bytes4[] memory fns = new bytes4[](2);
        fns[0] = MarketCalendar.setWeek.selector;
        fns[1] = MarketCalendar.addHoliday.selector;
        if (manager.getTargetFunctionRole(address(calendar), fns[0]) != CALENDAR_ROLE) {
            manager.labelRole(CALENDAR_ROLE, "CALENDAR");
            manager.setTargetFunctionRole(address(calendar), fns, CALENDAR_ROLE);
        }
        (bool admin,) = manager.hasRole(CALENDAR_ROLE, msg.sender);
        if (!admin) manager.grantRole(CALENDAR_ROLE, msg.sender, 0);
        (bool kept,) = manager.hasRole(CALENDAR_ROLE, keeper);
        if (!kept) manager.grantRole(CALENDAR_ROLE, keeper, 0);
    }

    /// @dev Each catalogue calendar's week (set when it differs) and its coming holidays (added when missing).
    function _configureCalendars(MarketCalendar calendar) internal {
        uint256 count = abi.decode(_json.parseRaw(".calendars[*].id"), (uint256[])).length;
        for (uint256 i; i < count; ++i) {
            string memory at = string.concat(".calendars[", vm.toString(i), "]");
            uint8 id = uint8(_json.readUint(string.concat(at, ".id")));
            uint256[] memory words = _json.readUintArray(string.concat(at, ".week"));
            uint256[CALENDAR_WORD_COUNT] memory bits;
            for (uint256 w; w < CALENDAR_WORD_COUNT; ++w) {
                bits[w] = words[w];
            }
            if (!calendar.configured(id) || keccak256(abi.encode(calendar.week(id))) != keccak256(abi.encode(bits))) {
                calendar.setWeek(id, bits);
            }
            _addHolidays(calendar, id, at);
        }
    }

    function _addHolidays(MarketCalendar calendar, uint8 id, string memory at) internal {
        uint256[] memory starts = _json.readUintArray(string.concat(at, ".holidayStarts"));
        uint256[] memory ends = _json.readUintArray(string.concat(at, ".holidayEnds"));
        MarketCalendar.Window[] memory known = calendar.holidays(id);
        for (uint256 h; h < starts.length; ++h) {
            if (ends[h] <= block.timestamp) continue;
            bool have;
            for (uint256 k; k < known.length; ++k) {
                if (known[k].start == starts[h] && known[k].end == ends[h]) have = true;
            }
            if (!have) calendar.addHoliday(id, uint64(starts[h]), uint64(ends[h]));
        }
    }

    // ------------------------------------------------------------------------------------------------ Earn

    /// @dev `PoolShares` on the reserve (D-287), once: the pool's money doors under POOL_ROLE held by it alone, and the
    ///      pool's value minted as the house's shares (`house`) — on mainnet that waits for the owner's seed (S9).
    ///      Skipped when the book already has it, unless `fresh` (a new network ignores the old book).
    function _earn(AccessManager manager, BandReserve reserve, address house, bool fresh) internal {
        if (!fresh && _bookAddress("PoolShares") != address(0)) return;
        PoolShares shares = new PoolShares(address(manager), ISharedPool(address(reserve)));
        _record(
            "PoolShares",
            address(shares),
            abi.encodePacked(type(PoolShares).creationCode, abi.encode(address(manager), address(reserve))),
            true
        );
        bytes4[] memory doors = new bytes4[](2);
        doors[0] = reserve.fund.selector;
        doors[1] = reserve.defund.selector;
        manager.labelRole(POOL_ROLE, "POOL");
        manager.setTargetFunctionRole(address(reserve), doors, POOL_ROLE);
        manager.grantRole(POOL_ROLE, address(shares), 0);
        if (shares.poolValue() > 0) shares.seed(house);
    }

    // ------------------------------------------------------------------------------------------------ series

    /// @dev One catalogue series as forge decodes it: fields in key order (the export sorts keys).
    struct BandJson {
        uint256 highBps;
        uint256 kind;
        uint256 lowBps;
    }

    struct SeriesJson {
        BandJson[] bands;
        uint256 cadenceSec;
        uint256 calendarId;
        bytes32 feedId;
        bytes32 market;
        uint256 sigmaE8;
        string symbol;
        string verifierClass;
    }

    /// @dev Every catalogue series not yet registered: its policy (its class's verifier), σ and band menu. The series
    ///      list is decoded once — each JSON cheatcode call copies the whole catalogue into memory, which a script
    ///      never frees.
    function _listSeries(Windows windows, BandReserve reserve) internal returns (uint256 listed) {
        SeriesJson[] memory all = abi.decode(vm.parseJson(_json, ".series"), (SeriesJson[]));
        for (uint256 i; i < all.length; ++i) {
            SeriesJson memory s = all[i];
            uint32 cadence = uint32(s.cadenceSec);
            if (windows.seriesOf(windows.seriesIdOf(s.market, cadence)).cadenceSec != 0) continue;
            PolicyVersion memory v0;
            v0.validUntil = OPEN_ENDED;
            v0.primary = PrintSource(_verifierOf[keccak256(bytes(s.verifierClass))], s.feedId);
            bytes32 seriesId = windows.registerSeries(s.market, cadence, uint8(s.calendarId), v0);
            reserve.setSigma(seriesId, uint64(s.sigmaE8));
            for (uint256 b; b < s.bands.length; ++b) {
                BandJson memory d = s.bands[b];
                reserve.addBand(seriesId, BandDef(uint8(d.kind), uint16(d.lowBps), uint16(d.highBps)));
            }
            ++listed;
        }
    }

    // ------------------------------------------------------------------------------------------------ book

    function _record(string memory name, address addr, bytes memory initCode, bool isIndexed) internal {
        _entries.push(Entry(name, addr, keccak256(initCode), isIndexed, block.number));
    }

    /// @dev Writes the address book; `keep` carries the existing book's entries this run did not replace.
    function _writeBook(bool keep) internal {
        string memory path = _bookPath();
        if (keep && vm.exists(path)) {
            string memory book = vm.readFile(path);
            string[] memory names = vm.parseJsonKeys(book, ".contracts");
            for (uint256 i; i < names.length; ++i) {
                if (!_replaced(names[i])) _carry(book, names[i]);
            }
        }
        string memory out;
        for (uint256 i; i < _entries.length; ++i) {
            Entry memory e = _entries[i];
            vm.serializeAddress(e.name, "address", e.addr);
            vm.serializeBytes32(e.name, "initCodeHash", e.initCodeHash);
            vm.serializeUint(e.name, "startBlock", e.startBlock);
            string memory obj = vm.serializeBool(e.name, "indexed", e.isIndexed);
            out = vm.serializeString("contracts", e.name, obj);
        }
        vm.serializeUint("root", "chainId", block.chainid);
        vm.writeJson(vm.serializeString("root", "contracts", out), path);
    }

    function _replaced(string memory name) private view returns (bool) {
        for (uint256 i; i < _entries.length; ++i) {
            if (keccak256(bytes(_entries[i].name)) == keccak256(bytes(name))) return true;
        }
        return false;
    }

    function _carry(string memory book, string memory name) private {
        string memory at = string.concat(".contracts.", name);
        _entries.push(
            Entry(
                name,
                book.readAddress(string.concat(at, ".address")),
                book.readBytes32(string.concat(at, ".initCodeHash")),
                book.readBool(string.concat(at, ".indexed")),
                book.readUint(string.concat(at, ".startBlock"))
            )
        );
    }

    /// @dev An address from the existing book, or zero when it holds no such contract.
    function _bookAddress(string memory name) internal view returns (address) {
        string memory path = _bookPath();
        if (!vm.exists(path)) return address(0);
        string memory book = vm.readFile(path);
        string memory key = string.concat(".contracts.", name, ".address");
        return vm.keyExistsJson(book, key) ? book.readAddress(key) : address(0);
    }
}
