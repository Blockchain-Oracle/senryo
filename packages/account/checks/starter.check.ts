/**
 * Targeted check (money): the starter `Claim` / `Voucher` typed data we sign is byte-for-byte what StarterDrip verifies.
 * The type strings and the EIP-712 domain are read from the Solidity source, the digest is rebuilt the way OZ
 * `_hashTypedDataV4` does, and compared with viem's `hashTypedData` over our definitions. A drift in either side fails.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { TESTNET_CHAIN_ID } from "@senryo/config";
import {
  type Address,
  concat,
  encodeAbiParameters,
  type Hex,
  hashTypedData,
  keccak256,
  recoverTypedDataAddress,
  toHex,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { scopeTargets } from "../src/policy/targets.ts";
import { canonicalVoucherCode, claimTypedData, voucherCodeBytes, voucherTypedData } from "../src/starter/typed-data.ts";

const SOURCE = readFileSync(new URL("../../../contracts/src/periphery/StarterDrip.sol", import.meta.url), "utf8");
const DOMAIN_TYPE = "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)";
const EIP712_PREFIX: Hex = "0x1901";
const DEADLINE = 2_000_000_000n;

function solidityString(pattern: RegExp): string {
  const m = SOURCE.match(pattern);
  assert.ok(m?.[1], `pattern ${pattern} not found in StarterDrip.sol`);
  return m[1];
}

const claimType = solidityString(/CLAIM_TYPEHASH = keccak256\("([^"]+)"\)/);
const voucherType = solidityString(/VOUCHER_TYPEHASH = keccak256\("([^"]+)"\)/);
const [domainName, domainVersion] = solidityString(/EIP712\(("[^)]+)\)/)
  .split(",")
  .map((s) => s.trim().replaceAll('"', ""));

const verifyingContract = scopeTargets(TESTNET_CHAIN_ID).starterDrip as Address;
const user = privateKeyToAccount(generatePrivateKey());

function ozDigest(structHash: Hex): Hex {
  const separator = keccak256(
    encodeAbiParameters(
      [{ type: "bytes32" }, { type: "bytes32" }, { type: "bytes32" }, { type: "uint256" }, { type: "address" }],
      [
        keccak256(toHex(DOMAIN_TYPE)),
        keccak256(toHex(domainName ?? "")),
        keccak256(toHex(domainVersion ?? "")),
        BigInt(TESTNET_CHAIN_ID),
        verifyingContract,
      ],
    ),
  );
  return keccak256(concat([EIP712_PREFIX, separator, structHash]));
}

test("source declares the types we sign", () => {
  assert.equal(claimType, "Claim(address user,uint64 deadline)");
  assert.equal(voucherType, "Voucher(address user,bytes32 codeHash,uint64 deadline)");
  assert.deepEqual([domainName, domainVersion], ["SenryoStarterDrip", "1"]);
});

test("Claim digest == OZ _hashTypedDataV4(keccak256(abi.encode(CLAIM_TYPEHASH, user, deadline)))", async () => {
  const def = claimTypedData(TESTNET_CHAIN_ID, user.address, DEADLINE);
  const struct = keccak256(
    encodeAbiParameters(
      [{ type: "bytes32" }, { type: "address" }, { type: "uint64" }],
      [keccak256(toHex(claimType)), user.address, DEADLINE],
    ),
  );
  assert.equal(hashTypedData(def), ozDigest(struct));
  const signature = await user.signTypedData(def);
  assert.equal(await recoverTypedDataAddress({ ...def, signature }), user.address);
});

test("Voucher digest matches, codes normalise before hashing", () => {
  assert.equal(canonicalVoucherCode("  gold-12 "), "GOLD-12");
  assert.equal(canonicalVoucherCode("ab"), undefined);
  assert.equal(canonicalVoucherCode("gold 12!"), undefined);
  const code = voucherCodeBytes("  gold-12 ");
  assert.equal(code, voucherCodeBytes("GOLD-12"));
  assert.equal(code, toHex("GOLD-12"));
  const def = voucherTypedData(TESTNET_CHAIN_ID, user.address, code, DEADLINE);
  const struct = keccak256(
    encodeAbiParameters(
      [{ type: "bytes32" }, { type: "address" }, { type: "bytes32" }, { type: "uint64" }],
      [keccak256(toHex(voucherType)), user.address, keccak256(code), DEADLINE],
    ),
  );
  assert.equal(hashTypedData(def), ozDigest(struct));
});
