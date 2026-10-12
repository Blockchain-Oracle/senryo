/**
 * A yes/no event's money path (R4 acceptance, D-296): two fresh Practice wallets call the board's next game — A on
 * Yes, B on No — each signed as the apps sign it (`signEventCall`: the call and a permit of exactly the stake to the
 * event book), relayed gas-free. The committee answers after the game and the book pays the winning side; `check`
 * reads where both calls ended. Prints every transaction; exits 1 if a step didn't happen.
 *
 *   API_ORIGIN=https://api.senryo.xyz pnpm --filter @senryo/drive exec tsx src/event-path.ts
 *   API_ORIGIN=https://api.senryo.xyz pnpm --filter @senryo/drive exec tsx src/event-path.ts check <eventId> <a> <b>
 */
import {
  authNonceRoute,
  authVerifyRoute,
  createApiClient,
  eventBoardRoute,
  eventCallsRoute,
  eventDetailRoute,
  marketAccountRoute,
  placeEventCallRoute,
  practiceGrantRoute,
} from "@senryo/api-client";
import {
  addressOf,
  eventCallRequest,
  freshNonce,
  type Hex,
  type MarketEventCall,
  permitParts,
  permitRequest,
} from "@senryo/chain";
import { EVENTS, TESTNET_CHAIN_ID } from "@senryo/config";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { sleep } from "./lib.ts";

const CHAIN = TESTNET_CHAIN_ID;
const ORIGIN = process.env.API_ORIGIN ?? "https://api.senryo.xyz";
/** Unequal stakes, so the pool split and each side's share are both visible: $3 on Yes, $2 on No. */
const YES_STAKE = 3_000_000n;
const NO_STAKE = 2_000_000n;
/** A call needs its game still taking calls a while after it's signed. */
const CLOSE_MARGIN_SEC = 120;
const POLL_MS = 3_000;
const GRANT_WAIT_MS = 60_000;
const MS = 1_000;
const nowSec = () => Math.floor(Date.now() / MS);
const public_ = createApiClient({ origin: ORIGIN });

async function check(eventId: Hex, owners: Hex[]): Promise<number> {
  const { event, committee, answers } = await public_.call(eventDetailRoute, {
    params: { eventId },
    query: { chainId: CHAIN },
  });
  console.log(`${event.league} · ${event.question}`);
  console.log(`  ${event.state}${event.answer === null ? "" : ` · answer ${event.answer ? "Yes" : "No"}`}`);
  console.log(`  committee ${committee.id}: quorum ${committee.quorum} of ${committee.members.length}`);
  for (const a of answers) {
    console.log(`  ${a.member} ${a.yes ? "Yes" : "No"} posted ${a.posted} ${a.txHash ?? ""}`);
  }
  let ended = 0;
  for (const owner of owners) {
    const { calls } = await public_.call(eventCallsRoute, { query: { chainId: CHAIN, owner } });
    for (const c of calls.filter((x) => x.eventId === eventId)) {
      console.log(
        `  ${owner} ${c.yes ? "Yes" : "No"} ${c.stake}: ${c.status} ${c.amount ?? ""} call ${c.callTx ?? "?"} paid ${c.paidTx ?? "—"}`,
      );
      if (c.status !== "open") ended += 1;
    }
  }
  const done = event.state !== "open" && ended === owners.length;
  console.log(done ? "✓ decided and both calls ended" : "… not decided yet");
  return done ? 0 : 1;
}

async function place(eventId: Hex, yes: boolean, stake: bigint) {
  const wallet = privateKeyToAccount(generatePrivateKey());
  let token: string | undefined;
  const api = createApiClient({ origin: ORIGIN, getToken: () => token });
  const challenge = await api.call(authNonceRoute, { body: { address: wallet.address, chainId: CHAIN } });
  const proof = await wallet.signMessage({ message: challenge.message });
  token = (await api.call(authVerifyRoute, { body: { message: challenge.message, signature: proof } })).token;
  await api.call(practiceGrantRoute, {});
  const until = Date.now() + GRANT_WAIT_MS;
  let account = await api.call(marketAccountRoute, { query: { chainId: CHAIN, owner: wallet.address } });
  while (account.balance < stake && Date.now() < until) {
    await sleep(POLL_MS);
    account = await api.call(marketAccountRoute, { query: { chainId: CHAIN, owner: wallet.address } });
  }
  const deadline = BigInt(nowSec() + EVENTS.callTtlSec);
  const call: MarketEventCall = {
    owner: wallet.address,
    eventId,
    yes,
    stake,
    deadline,
    nonce: freshNonce(),
    epoch: account.epoch,
  };
  const permitSig = await wallet.signTypedData(
    permitRequest(CHAIN, {
      owner: wallet.address,
      spender: addressOf(CHAIN, "EventBook"),
      value: stake,
      nonce: account.permitNonce,
      deadline,
    }),
  );
  const signature = await wallet.signTypedData(eventCallRequest(CHAIN, call));
  const r = await api.call(placeEventCallRoute, {
    body: { chainId: CHAIN, call, signature, permit: { value: stake, deadline, ...permitParts(permitSig) } },
  });
  console.log(`✓ ${yes ? "Yes" : "No"} ${stake} by ${wallet.address}: ticket ${r.ticketId} ${r.txHash}`);
  return wallet.address;
}

const [mode, eventArg, ...ownerArgs] = process.argv.slice(2);
if (mode === "check") {
  process.exit(await check(eventArg as Hex, ownerArgs as Hex[]));
}

const { events } = await public_.call(eventBoardRoute, { query: { chainId: CHAIN } });
const next = events
  .filter((e) => e.state === "open" && e.closesAt > nowSec() + CLOSE_MARGIN_SEC)
  .sort((x, y) => x.closesAt - y.closesAt)[0];
if (!next) {
  console.log("✗ no open event on the board");
  process.exit(1);
}
console.log(
  `${next.league} · ${next.question} (${next.eventId}, calls close ${new Date(next.closesAt * MS).toISOString()})`,
);
const a = await place(next.eventId, true, YES_STAKE);
const b = await place(next.eventId, false, NO_STAKE);
console.log(`\nlater: event-path.ts check ${next.eventId} ${a} ${b}`);
process.exit(0);
