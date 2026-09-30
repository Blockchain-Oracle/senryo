// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {Script} from "forge-std/Script.sol";
import {stdJson} from "forge-std/StdJson.sol";

/// @title DeployBase — ensure-style bookkeeping over `packages/contracts/src/addresses/<chainId>.json`.
/// @notice `_ensure` reuses a recorded contract when it has code AND its recorded init-code hash (bytecode +
/// constructor arguments) matches what this run would deploy; a mismatch is parameter/code drift and reverts.
/// Missing (or code-less, e.g. a broadcast that never landed) entries are deployed with CREATE.
abstract contract DeployBase is Script {
    using stdJson for string;

    struct Entry {
        string name;
        address addr;
        bytes32 initCodeHash;
        uint256 startBlock;
        bool isIndexed;
    }

    error Drift(string name, bytes32 recorded, bytes32 expected);
    error DeployFailed(string name);

    string internal _path;
    string internal _json;
    bool internal _hasFile;
    Entry[] internal _entries;
    uint256 internal _created;

    function _load() internal {
        _path = string.concat(
            vm.projectRoot(), "/../packages/contracts/src/addresses/", vm.toString(block.chainid), ".json"
        );
        _hasFile = vm.exists(_path);
        if (_hasFile) _json = vm.readFile(_path);
    }

    /// @return a the recorded (and matching) or newly deployed address.
    function _ensure(string memory name, bytes memory initCode, bool isIndexed) internal returns (address a) {
        bytes32 h = keccak256(initCode);
        string memory key = string.concat(".contracts.", name);
        if (_hasFile && vm.keyExistsJson(_json, key)) {
            address recorded = _json.readAddress(string.concat(key, ".address"));
            if (recorded.code.length != 0) {
                bytes32 recordedHash = _json.readBytes32(string.concat(key, ".initCodeHash"));
                if (recordedHash != h) revert Drift(name, recordedHash, h);
                _record(name, recorded, h, _json.readUint(string.concat(key, ".startBlock")), isIndexed);
                return recorded;
            }
        }
        assembly ("memory-safe") {
            a := create(0, add(initCode, 0x20), mload(initCode))
        }
        if (a == address(0)) revert DeployFailed(name);
        ++_created;
        _record(name, a, h, block.number, isIndexed);
    }

    /// @notice Record an external (not deployed here) address, e.g. mainnet AUSD or a Chainlink feed.
    function _external(string memory name, address a, bool isIndexed) internal {
        _record(name, a, bytes32(0), 0, isIndexed);
    }

    function _record(string memory name, address a, bytes32 h, uint256 startBlock, bool isIndexed) internal {
        _entries.push(Entry(name, a, h, startBlock, isIndexed));
    }

    function _write() internal {
        string memory contracts = "contracts";
        string memory out;
        for (uint256 i; i < _entries.length; ++i) {
            Entry memory e = _entries[i];
            vm.serializeAddress(e.name, "address", e.addr);
            vm.serializeBytes32(e.name, "initCodeHash", e.initCodeHash);
            vm.serializeUint(e.name, "startBlock", e.startBlock);
            string memory obj = vm.serializeBool(e.name, "indexed", e.isIndexed);
            out = vm.serializeString(contracts, e.name, obj);
        }
        vm.serializeUint("root", "chainId", block.chainid);
        string memory root = vm.serializeString("root", "contracts", out);
        vm.writeJson(root, _path);
    }
}
