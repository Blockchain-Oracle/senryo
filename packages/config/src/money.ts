/**
 * The money of the prediction market (D-258): bets are in dollars.
 * - Real (mainnet 143): Circle USDC (permit and EIP-3009 verified live on 8 Oct 2026, docs/research/pivot/monad-stack.md).
 * - Practice (testnet 10143): our own Test USD (6 decimals, permit and 3009, minted by the sponsor). Its address arrives
 *   with the S2 deploy through the address book, never hard-coded here.
 * Plain data; viem lives in `@senryo/chain`.
 */
import { MAINNET_CHAIN_ID } from "./networks.ts";

/** Every dollar amount on chain uses 6 decimals (USDC and Test USD alike). */
export const DOLLAR_DECIMALS = 6;

/** Circle's native USDC on Monad mainnet. */
export const MAINNET_USDC = "0x754704Bc059F8C67012fEd69BC8A327a5aafb603" as const;

/** Circle USDC's EIP-712 domain on Monad (name "USDC", version "2"; read live with `eth_call`). */
export const USDC_DOMAIN = {
  name: "USDC",
  version: "2",
  chainId: MAINNET_CHAIN_ID,
  verifyingContract: MAINNET_USDC,
} as const;
