import { MAINNET_CHAIN_ID, TESTNET_CHAIN_ID } from "@senryo/config";
import * as z from "zod";

/**
 * Wire primitives. JSON has no bigint, so every integer amount (usd6, wei, 1e18 prices, block numbers) travels as a
 * decimal string and decodes to `bigint` through a zod 4 codec (`schema.decode(json)` / `schema.encode(value)`).
 * Never a JS number for money (CLAUDE.md).
 */

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const HEX_RE = /^0x[0-9a-fA-F]*$/;
const BYTES32_RE = /^0x[0-9a-fA-F]{64}$/;
/** 65-byte ECDSA signature (r ‖ s ‖ v). Mera accounts are EOAs, so no ERC-1271/6492 blobs. */
const SIGNATURE_RE = /^0x[0-9a-fA-F]{130}$/;
const UINT_RE = /^\d+$/;
const INT_RE = /^-?\d+$/;
/** base64url without padding (WebAuthn credential ids, ciphertexts). */
const BASE64URL_RE = /^[A-Za-z0-9_-]+$/;

export type Address = `0x${string}`;
export type Hex = `0x${string}`;

/** `z.custom` (not `.transform`) so the schema stays bidirectional for `encode` (transforms cannot encode). */
function hexString<T extends Hex>(pattern: RegExp, message: string) {
  return z.custom<T>((value) => typeof value === "string" && pattern.test(value), message);
}

export const addressSchema = hexString<Address>(ADDRESS_RE, "expected a 0x-prefixed 20-byte address");
export const hexSchema = hexString<Hex>(HEX_RE, "expected 0x-prefixed hex");
export const bytes32Schema = hexString<Hex>(BYTES32_RE, "expected 32 bytes of hex");
export const signatureSchema = hexString<Hex>(SIGNATURE_RE, "expected a 65-byte signature");
export const base64UrlSchema = z.string().regex(BASE64URL_RE, "expected base64url");

export const chainIdSchema = z.union([z.literal(MAINNET_CHAIN_ID), z.literal(TESTNET_CHAIN_ID)]);

/** Non-negative integer amount: `"12000000"` ⇄ `12000000n`. */
export const uintCodec = z.codec(z.string().regex(UINT_RE, "expected a non-negative integer string"), z.bigint(), {
  decode: (text) => BigInt(text),
  encode: (value) => value.toString(),
});

/** Signed integer amount (PnL, free-to-trade can be negative): `"-5"` ⇄ `-5n`. */
export const intCodec = z.codec(z.string().regex(INT_RE, "expected an integer string"), z.bigint(), {
  decode: (text) => BigInt(text),
  encode: (value) => value.toString(),
});

/** Unix seconds (uint64 in contracts; always inside JS's safe integer range). */
export const unixSecondsSchema = z.int().nonnegative();

/** ISO-8601 timestamp (server clocks). */
export const isoTimeSchema = z.iso.datetime();

export const txHashSchema = bytes32Schema;
