/**
 * A duel's money path (R4 acceptance, D-294): two fresh Practice wallets each sign an entry for tier 1 (a $10 pot,
 * $10 a card) with a permit to the arena and a seat key for their swipes; the matchmaker pairs them, the api reveals
 * the deck, each seat's key signs one pick per card (A all Up, B all Down, so one side wins), and the keeper settles
 * every card and the pot. Prints the match and its transactions; exits 1 if it doesn't end finalized.
 *
 *   API_ORIGIN=https://api.senryo.xyz pnpm --filter @senryo/drive exec tsx src/duel-path.ts
 */
import {
  authNonceRoute,
  authVerifyRoute,
  createApiClient,
  duelPickRoute,
  duelQueueRoute,
  duelRoute,
  enterDuelRoute,
  marketAccountRoute,
  practiceGrantRoute,
} from "@senryo/api-client";
import {
  addressOf,
  duelEntryRequest,
  duelPickRequest,
  freshNonce,
  freshSeed,
  type Hex,
  type MarketDuelEntry,
  permitParts,
  permitRequest,
} from "@senryo/chain";
import { DUEL, duelEntryCost, duelTierOf, TESTNET_CHAIN_ID } from "@senryo/config";
import { generatePrivateKey, type PrivateKeyAccount, privateKeyToAccount } from "viem/accounts";
import { sleep } from "./lib.ts";

const CHAIN = TESTNET_CHAIN_ID;
const ORIGIN = process.env.API_ORIGIN ?? "https://api.senryo.xyz";
const TIER = 1;
const UP = 0;
const DOWN = 1;
const POLL_MS = 3_000;
const PAIR_WAIT_MS = 120_000;
/** The deck's cards run up to five minutes past the reveal, then the keeper settles them and the pot. */
const FINAL_WAIT_MS = 900_000;
const FINAL_POLL_MS = 15_000;
const MS = 1_000;

const tier = duelTierOf(CHAIN, TIER);
if (!tier) throw new Error(`no tier ${TIER}`);
const cost = duelEntryCost(tier);
const nowSec = () => Math.floor(Date.now() / MS);

interface Seat {
  name: string;
  owner: PrivateKeyAccount;
  key: PrivateKeyAccount;
  band: number;
  api: ReturnType<typeof createApiClient>;
}

async function seat(name: string, band: number): Promise<Seat> {
  const owner = privateKeyToAccount(generatePrivateKey());
  const key = privateKeyToAccount(generatePrivateKey());
  let token: string | undefined;
  const api = createApiClient({ origin: ORIGIN, getToken: () => token });
  const challenge = await api.call(authNonceRoute, { body: { address: owner.address, chainId: CHAIN } });
  const signature = await owner.signMessage({ message: challenge.message });
  token = (await api.call(authVerifyRoute, { body: { message: challenge.message, signature } })).token;
  const grant = await api.call(practiceGrantRoute, {});
  console.log(`  ${name} ${owner.address} practice grant ${grant.state} ${grant.txHash ?? ""}`);
  for (;;) {
    const a = await api.call(marketAccountRoute, { query: { chainId: CHAIN, owner: owner.address } });
    if (a.balance >= cost) break;
    await sleep(POLL_MS);
  }
  return { name, owner, key, band, api };
}

async function enter(s: Seat) {
  const a = await s.api.call(marketAccountRoute, { query: { chainId: CHAIN, owner: s.owner.address } });
  const deadline = BigInt(nowSec() + DUEL.entryTtlSec);
  const entry: MarketDuelEntry = {
    owner: s.owner.address,
    tier: TIER,
    delegate: s.key.address,
    seed: freshSeed(),
    deadline,
    nonce: freshNonce(),
    epoch: a.epoch,
  };
  const permitSig = await s.owner.signTypedData(
    permitRequest(CHAIN, {
      owner: s.owner.address,
      spender: addressOf(CHAIN, "DuelArena"),
      value: cost,
      nonce: a.permitNonce,
      deadline,
    }),
  );
  const signature = await s.owner.signTypedData(duelEntryRequest(CHAIN, entry));
  const q = await s.api.call(enterDuelRoute, {
    body: { chainId: CHAIN, entry, signature, permit: { value: cost, deadline, ...permitParts(permitSig) } },
  });
  console.log(`  ${s.name} entered tier ${TIER}: ${q.state}`);
}

async function matchOf(s: Seat): Promise<Hex | null> {
  const deadline = Date.now() + PAIR_WAIT_MS;
  while (Date.now() < deadline) {
    const { entry } = await s.api.call(duelQueueRoute, { query: { chainId: CHAIN, owner: s.owner.address } });
    if (entry?.matchId) return entry.matchId;
    if (entry && entry.state !== "queued" && entry.state !== "paired")
      throw new Error(`${s.name}: ${entry.state} ${entry.reason ?? ""}`);
    await sleep(POLL_MS);
  }
  return null;
}

console.log(`duel on ${CHAIN} through ${ORIGIN}, tier ${TIER} (cost ${cost})`);
const a = await seat("A", UP);
const b = await seat("B", DOWN);
await enter(a);
await enter(b);
const matchId = await matchOf(a);
if (!matchId) {
  console.log("✗ not paired");
  process.exit(1);
}
console.log(`  paired: match ${matchId}`);

// The reveal publishes the cards; each seat then picks every card with its key (no prompt).
let cards = 0;
for (let waited = 0; waited < PAIR_WAIT_MS && cards === 0; waited += POLL_MS) {
  const m = await a.api.call(duelRoute, { params: { matchId }, query: { chainId: CHAIN } });
  cards = m.cards.length;
  if (cards === 0) await sleep(POLL_MS);
}
if (cards === 0) {
  console.log("✗ the deck was never revealed");
  process.exit(1);
}
for (const s of [a, b]) {
  for (let card = 0; card < cards; card++) {
    const pick = { matchId, player: s.owner.address, card, band: s.band, minPayout: 0n };
    const signature = await s.key.signTypedData(duelPickRequest(CHAIN, pick));
    await s.api.call(duelPickRoute, { body: { chainId: CHAIN, pick, signature } });
  }
  console.log(`  ${s.name} picked ${cards} cards ${s.band === UP ? "Up" : "Down"}`);
}

const deadline = Date.now() + FINAL_WAIT_MS;
let last = "";
while (Date.now() < deadline) {
  const m = await a.api.call(duelRoute, { params: { matchId }, query: { chainId: CHAIN } });
  if (m.state !== last) console.log(`  match ${m.state}`);
  last = m.state;
  if (m.state === "finalized" || m.state === "forfeited" || m.state === "refunded" || m.state === "failed") break;
  await sleep(FINAL_POLL_MS);
}
console.log(last === "finalized" ? `✓ duel ${matchId} finalized` : `✗ duel ended ${last}`);
process.exit(last === "finalized" ? 0 : 1);
