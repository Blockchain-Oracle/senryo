/**
 * The money-paths drive's session (R4): one Practice wallet signing as the apps sign, the api it talks to, and the
 * waits and checks every path shares. Drive scripts only — never shipped.
 */
import {
  authNonceRoute,
  authVerifyRoute,
  catalogRoute,
  createApiClient,
  intentStatusRoute,
  marketAccountRoute,
  recentPricesRoute,
  setExitRoute,
} from "@senryo/api-client";
import {
  type ACTION_CLOSE,
  type ACTION_OPEN,
  exitOrderRequest,
  freshNonce,
  type Hex,
  type MarketExitOrder,
  permitParts,
  permitRequest,
} from "@senryo/chain";
import { MIN_HOLD_SEC, TESTNET_CHAIN_ID } from "@senryo/config";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { sleep } from "./lib.ts";

export const CHAIN = TESTNET_CHAIN_ID;
export const ORIGIN = process.env.API_ORIGIN ?? "http://127.0.0.1:3901";
export const SYMBOL = "BTC";
export const CADENCE = 60;
export const UP = 0;
export const RIDE_MARKET = 0;
export const STAKE = 2_000_000n;
export const MARGIN = 5_000_000n;
export const LEVERAGE_BPS = 100_000;
/** The quote may move this much between the signature and the fill print. */
export const TOLERANCE_BPS = 300n;
export const BPS = 10_000n;
/** A long ride accepts an entry up to 2 % above the price it saw, a close down to 2 % below. */
export const SLIPPAGE_BPS = 200n;
/** A stop-loss 5 % above a long ride's price: met at the next print, so the exit fires at once. */
export const STOP_ABOVE_BPS = 500n;
/** Every call bid is under $1 a share, so this stop-loss is met at once. */
export const STOP_ANY_BID_E6 = 999_999n;
/** Two $2 calls and two $5 rides with their fees, with room to spare ($30). */
export const NEEDED = 30_000_000n;
export const LABEL_WIDTH = 28;
export const INTENT_TTL_SEC = 60;
export const PERMIT_TTL_SEC = 600;
export const POLL_MS = 1_000;
export const WAIT_SEC = 45;
export const MS = 1_000;

/** A signed action names OPEN or CLOSE (the api's schemas take exactly those). */
export type Act<T> = Omit<T, "action"> & { action: typeof ACTION_OPEN | typeof ACTION_CLOSE };

const key = (process.env.DRIVE_PK as Hex | undefined) ?? generatePrivateKey();
export const wallet = privateKeyToAccount(key);
export const owner = wallet.address;
let token: string | undefined;
export const api = createApiClient({ origin: ORIGIN, getToken: () => token });
export const nowSec = () => Math.floor(Date.now() / MS);
export const txs: [string, string][] = [];
let failures = 0;

/** How many checks failed so far. */
export const failed = () => failures;

export function check(ok: boolean, what: string): void {
  console.log(`${ok ? "✓" : "✗"} ${what}`);
  if (!ok) failures += 1;
}

export async function until<T>(what: string, read: () => Promise<T | undefined>): Promise<T | undefined> {
  const deadline = Date.now() + WAIT_SEC * MS;
  while (Date.now() < deadline) {
    const v = await read().catch(() => undefined);
    if (v !== undefined) return v;
    await sleep(POLL_MS);
  }
  console.log(`  … gave up waiting for ${what}`);
  return undefined;
}

export async function signIn(): Promise<void> {
  const challenge = await api.call(authNonceRoute, { body: { address: owner, chainId: CHAIN } });
  const signature = await wallet.signMessage({ message: challenge.message });
  token = (await api.call(authVerifyRoute, { body: { message: challenge.message, signature } })).token;
}

export async function account() {
  return api.call(marketAccountRoute, { query: { chainId: CHAIN, owner } });
}

/** A permit for exactly `value` to the reserve (the apps' Face ID step when the allowance is short). */
export async function permitFor(reserve: Hex, value: bigint) {
  const a = await account();
  const deadline = BigInt(nowSec() + PERMIT_TTL_SEC);
  const sig = await wallet.signTypedData(
    permitRequest(CHAIN, { owner, spender: reserve, value, nonce: a.permitNonce, deadline }),
  );
  return { value, deadline, ...permitParts(sig) };
}

/** Waits for an intent to end and records its transactions. */
export async function settled(digest: Hex, what: string) {
  const s = await until(what, async () => {
    const r = await api.call(intentStatusRoute, { params: { digest } });
    return r.state === "filled" || r.state === "refused" || r.state === "failed" ? r : undefined;
  });
  if (s?.txHash) txs.push([what, s.txHash]);
  return s;
}

export async function spotE8(): Promise<bigint> {
  const r = await api.call(recentPricesRoute, { query: { symbols: SYMBOL } });
  const last = r.feeds[0]?.points.at(-1);
  if (!last) throw new Error("no live price");
  return BigInt(last[1]);
}

export async function setExit(order: Omit<MarketExitOrder, "deadline" | "nonce" | "epoch">, what: string) {
  await sleep((MIN_HOLD_SEC + 1) * MS);
  const a = await account();
  const full: MarketExitOrder = {
    ...order,
    deadline: BigInt(nowSec() + INTENT_TTL_SEC),
    nonce: freshNonce(),
    epoch: a.epoch,
  };
  const signature = await wallet.signTypedData(exitOrderRequest(CHAIN, full));
  const r = await api.call(setExitRoute, { body: { chainId: CHAIN, order: full, signature } });
  txs.push([`${what} set`, r.txHash]);
  check(r.state === "proposed", `${what}: set on chain`);
}

export async function loadCatalog() {
  const c = await api.call(catalogRoute, { query: { chainId: CHAIN } });
  const market = c.markets.find((m) => m.symbol === SYMBOL);
  const series = market?.series.find((s) => s.cadenceSec === CADENCE);
  if (!series) throw new Error(`${SYMBOL} ${CADENCE}s is not in the catalogue`);
  return { configVersion: c.configVersion, reserve: c.contracts.reserve, terms: c.terms, series };
}
