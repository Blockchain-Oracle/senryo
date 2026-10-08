// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {Script, console2} from "forge-std/Script.sol";
import {stdJson} from "forge-std/StdJson.sol";
import {AccessManager} from "@openzeppelin/contracts/access/manager/AccessManager.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {CALENDAR_WORD_COUNT} from "../src/libraries/Constants.sol";
import {MarketCalendar} from "../src/oracle/MarketCalendar.sol";
import {IMarketCalendar} from "../src/oracle/interfaces/IMarketCalendar.sol";
import {BandReserve} from "../src/markets/BandReserve.sol";
import {PythPrintVerifier} from "../src/markets/PythPrintVerifier.sol";
import {Windows} from "../src/markets/Windows.sol";
import {IPyth} from "../src/markets/interfaces/IPyth.sol";
import {IWindows} from "../src/markets/interfaces/IWindows.sol";
import {TestUSD} from "../src/markets/testnet/TestUSD.sol";
import "../src/markets/MarketTypes.sol";

/// @title DeployMarkets — the markets on one network, from `script/catalog/<chainId>.json` (D-268).
/// @notice `node scripts/catalog-export.mjs` first, then:
///         `forge script script/DeployMarkets.s.sol --rpc-url monad_testnet --account senryo-deployer --broadcast`
///         with `SPONSOR` set to the relayer that mints Practice dollars. Writes `packages/contracts/src/addresses/
///         <chainId>.json` (address, init-code hash, start block, indexed) for `pnpm contracts:export`.
contract DeployMarkets is Script {
    using stdJson for string;

    /// @dev AccessManager role that may mint Test USD (the sponsor's Practice grant, D-258).
    uint64 internal constant MINTER_ROLE = 1;

    struct Entry {
        string name;
        address addr;
        bytes32 initCodeHash;
        bool isIndexed;
    }

    Entry[] internal _entries;
    string internal _json;
    uint256 internal _startBlock;

    function run() external {
        _json = vm.readFile(string.concat(vm.projectRoot(), "/script/catalog/", vm.toString(block.chainid), ".json"));
        require(_json.readUint(".chainId") == block.chainid, "catalog is for another chain");
        address sponsor = vm.envAddress("SPONSOR");
        _startBlock = block.number;

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

        PythPrintVerifier verifier = _deployVerifier();
        Windows windows = new Windows(address(manager), IMarketCalendar(address(calendar)));
        _record(
            "Windows",
            address(windows),
            abi.encodePacked(type(Windows).creationCode, abi.encode(address(manager), address(calendar))),
            true
        );

        IERC20 collateral = _collateral(manager, sponsor);
        BandReserve reserve = _deployReserve(manager, collateral, windows);
        _listSeries(windows, reserve, verifier);
        _seedPool(reserve, collateral, admin);
        vm.stopBroadcast();

        _writeBook();
        console2.log("BandReserve", address(reserve));
    }

    function _deployVerifier() internal returns (PythPrintVerifier verifier) {
        IPyth pyth = IPyth(_json.readAddress(".pyth"));
        uint16 grace = uint16(_json.readUint(".verifier.graceSec"));
        uint16 maxConf = uint16(_json.readUint(".verifier.maxConfBps"));
        uint32 admission = uint32(_json.readUint(".verifier.admissionSec"));
        verifier = new PythPrintVerifier(pyth, grace, maxConf, admission);
        _record(
            "PythPrintVerifier",
            address(verifier),
            abi.encodePacked(type(PythPrintVerifier).creationCode, abi.encode(address(pyth), grace, maxConf, admission)),
            false
        );
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

    /// @dev Every catalogue series: its policy (the Pyth verifier, no cross-check yet), σ and its band menu.
    function _listSeries(Windows windows, BandReserve reserve, PythPrintVerifier verifier) internal {
        uint256 count = abi.decode(_json.parseRaw(".series[*].cadenceSec"), (uint256[])).length;
        for (uint256 i; i < count; ++i) {
            string memory at = string.concat(".series[", vm.toString(i), "]");
            PolicyVersion memory v0;
            v0.validUntil = OPEN_ENDED;
            v0.primary = PrintSource(address(verifier), _json.readBytes32(string.concat(at, ".feedId")));
            bytes32 seriesId = windows.registerSeries(
                _json.readBytes32(string.concat(at, ".market")),
                uint32(_json.readUint(string.concat(at, ".cadenceSec"))),
                uint8(_json.readUint(string.concat(at, ".calendarId"))),
                v0
            );
            reserve.setSigma(seriesId, uint64(_json.readUint(string.concat(at, ".sigmaE8"))));
            uint256 bands = abi.decode(_json.parseRaw(string.concat(at, ".bands[*].kind")), (uint256[])).length;
            for (uint256 b; b < bands; ++b) {
                string memory band = string.concat(at, ".bands[", vm.toString(b), "]");
                reserve.addBand(
                    seriesId,
                    BandDef(
                        uint8(_json.readUint(string.concat(band, ".kind"))),
                        uint16(_json.readUint(string.concat(band, ".lowBps"))),
                        uint16(_json.readUint(string.concat(band, ".highBps")))
                    )
                );
            }
        }
    }

    /// @dev Practice's pool in Test USD (D-260). Mainnet's seed waits for the owner's funding (S9).
    function _seedPool(BandReserve reserve, IERC20 collateral, address admin) internal {
        uint256 seed = _json.readUint(".poolSeed");
        if (seed == 0) return;
        TestUSD(address(collateral)).mint(admin, seed);
        collateral.approve(address(reserve), seed);
        reserve.fund(seed);
    }

    // ------------------------------------------------------------------------------------------------ book

    function _record(string memory name, address addr, bytes memory initCode, bool isIndexed) internal {
        _entries.push(Entry(name, addr, keccak256(initCode), isIndexed));
    }

    function _writeBook() internal {
        string memory contracts = "contracts";
        string memory out;
        for (uint256 i; i < _entries.length; ++i) {
            Entry memory e = _entries[i];
            vm.serializeAddress(e.name, "address", e.addr);
            vm.serializeBytes32(e.name, "initCodeHash", e.initCodeHash);
            vm.serializeUint(e.name, "startBlock", _startBlock);
            string memory obj = vm.serializeBool(e.name, "indexed", e.isIndexed);
            out = vm.serializeString(contracts, e.name, obj);
        }
        vm.serializeUint("root", "chainId", block.chainid);
        string memory root = vm.serializeString("root", "contracts", out);
        vm.writeJson(
            root,
            string.concat(vm.projectRoot(), "/../packages/contracts/src/addresses/", vm.toString(block.chainid), ".json")
        );
    }
}
