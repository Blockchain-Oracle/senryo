/**
 * Earn's money path (R4 acceptance): a Practice wallet supplies, the hourly roll mints its shares and the keeper
 * delivers them; later it withdraws, the next roll settles it and the keeper delivers the dollars. Hours apart, so the
 * run has two steps on one wallet whose key stays in `EARN_STATE` (a scratch file, never printed):
 *
 *   EARN_STATE=… API_ORIGIN=https://api.senryo.xyz pnpm --filter @senryo/drive exec tsx src/earn-path.ts supply
 *   EARN_STATE=… API_ORIGIN=https://api.senryo.xyz pnpm --filter @senryo/drive exec tsx src/earn-path.ts withdraw
 *
 * Each step waits (up to `WAIT_HOURS`) for its roll and delivery and prints the transactions; exits 1 if it doesn't
 * end where it should.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import {
  authNonceRoute,
  authVerifyRoute,
  createApiClient,
  earnRequestRoute,
  earnRoute,
  marketAccountRoute,
  practiceGrantRoute,
} from "@senryo/api-client";
import {
  addressOf,
  EARN_KIND,
  earnRequestTypedData,
  freshNonce,
  type Hex,
  permitParts,
  permitRequest,
} from "@senryo/chain";
import { TESTNET_CHAIN_ID } from "@senryo/config";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { sleep } from "./lib.ts";

const CHAIN = TESTNET_CHAIN_ID;
const ORIGIN = process.env.API_ORIGIN ?? "https://api.senryo.xyz";
const STATE = process.env.EARN_STATE;
const SUPPLY = 20_000_000n;
const TTL_SEC = 600;
const POLL_MS = 15_000;
const WAIT_HOURS = 2;
const MS = 1_000;
const HOUR_MS = 3_600_000;

if (!STATE) throw new Error("EARN_STATE (a scratch file for the wallet) is required");
const step = process.argv[2];
const key: Hex = existsSync(STATE)
  ? (JSON.parse(readFileSync(STATE, "utf8")) as { key: Hex }).key
  : generatePrivateKey();
if (!existsSync(STATE)) writeFileSync(STATE, JSON.stringify({ key }), { mode: 0o600 });
const wallet = privateKeyToAccount(key);
const owner = wallet.address;
let token: string | undefined;
const api = createApiClient({ origin: ORIGIN, getToken: () => token });
const nowSec = () => Math.floor(Date.now() / MS);
const view = () => api.call(earnRoute, { query: { chainId: CHAIN, owner } });

async function request(kind: (typeof EARN_KIND)["supply" | "withdraw"], amount: bigint) {
  const a = (await view()).account;
  if (!a) throw new Error("Earn isn't live on this network");
  const r = { kind, owner, amount, deadline: BigInt(nowSec() + TTL_SEC), nonce: freshNonce() };
  const signature = await wallet.signTypedData(earnRequestTypedData(CHAIN, r));
  let permit = null;
  if (kind === EARN_KIND.supply && a.allowance < amount) {
    const deadline = BigInt(nowSec() + TTL_SEC);
    const spender = addressOf(CHAIN, "PoolShares");
    const sig = await wallet.signTypedData(
      permitRequest(CHAIN, { owner, spender, value: amount, nonce: a.permitNonce, deadline }),
    );
    permit = { value: amount, deadline, ...permitParts(sig) };
  }
  return api.call(earnRequestRoute, { body: { chainId: CHAIN, request: r, signature, permit } });
}

async function until(what: string, done: () => Promise<boolean>): Promise<boolean> {
  const deadline = Date.now() + WAIT_HOURS * HOUR_MS;
  while (Date.now() < deadline) {
    if (await done().catch(() => false)) return true;
    await sleep(POLL_MS);
  }
  console.log(`✗ gave up waiting for ${what}`);
  return false;
}

console.log(`earn ${step} on ${CHAIN} through ${ORIGIN} as ${owner}`);
if (step === "supply") {
  const challenge = await api.call(authNonceRoute, { body: { address: owner, chainId: CHAIN } });
  const signature = await wallet.signMessage({ message: challenge.message });
  token = (await api.call(authVerifyRoute, { body: { message: challenge.message, signature } })).token;
  const grant = await api.call(practiceGrantRoute, {});
  console.log(`  practice grant ${grant.state} ${grant.txHash ?? ""}`);
  await until("the dollars", async () => {
    const a = await api.call(marketAccountRoute, { query: { chainId: CHAIN, owner } });
    return a.balance >= SUPPLY;
  });
  const sent = await request(EARN_KIND.supply, SUPPLY);
  console.log(`  supply request ${sent.state} ${sent.txHash}`);
  const ok = await until("the roll and the shares", async () => ((await view()).account?.shares ?? 0n) > 0n);
  const v = await view();
  console.log(
    `${ok ? "✓" : "✗"} supplied: ${v.account?.shares} shares worth ${v.account?.value} (rolled ${v.pool?.lastRoll})`,
  );
  process.exit(ok ? 0 : 1);
} else if (step === "withdraw") {
  const before = await view();
  const shares = before.account?.shares ?? 0n;
  if (shares === 0n) throw new Error("no shares to withdraw: run `supply` first");
  const sent = await request(EARN_KIND.withdraw, shares);
  console.log(`  withdraw request ${sent.state} ${sent.txHash} (${shares} shares)`);
  const ok = await until("the roll and the dollars", async () => {
    const a = (await view()).account;
    return a !== null && a.shares === 0n && a.withdraw.amount === 0n;
  });
  const v = await view();
  console.log(`${ok ? "✓" : "✗"} withdrawn: shares ${v.account?.shares} (rolled ${v.pool?.lastRoll})`);
  process.exit(ok ? 0 : 1);
} else {
  throw new Error("usage: earn-path.ts supply|withdraw");
}
