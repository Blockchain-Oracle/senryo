/**
 * D8 wallet activity check — live and read-only (nothing is signed or sent). `/v1/activity/wallet` runs in-process
 * (services/api/scripts/anyasset-harness.ts, with a local Postgres for `wallet_transfers`) and is called through
 * `@senryo/api-client`, as the app does, for an active mainnet address and the Practice account. The HyperSync token's
 * budget is shared, so it asks again the moment the scanner's back-off ends, until the scan reaches the newest final
 * block (or SCAN_WAIT_MIN runs out); then it pages through the history and prints each item in Activity's words,
 * checking: newest first, no transaction twice, every leg > 0, swap = out + in, received = only in, sent = only out.
 *   DATABASE_URL=postgres://…local… HYPERSYNC_API_TOKEN=… pnpm --filter @senryo/drive wallet-activity-check
 *   ADDRESS=0x… / PRACTICE_ADDRESS=0x… pick other accounts. Never point DATABASE_URL at a shared database.
 */
import { type WalletActivity, type WalletActivityItem, type WalletLeg, walletActivityRoute } from "@senryo/api-client";
import { getAddress } from "@senryo/chain";
import { type ChainId, MAINNET_CHAIN_ID, TESTNET_CHAIN_ID } from "@senryo/config";
import { formatUnits } from "@senryo/core";
import { createDb } from "@senryo/service-common";
import { openAnyAssetHarness } from "../../../services/api/scripts/anyasset-harness.ts";

/** An active mainnet EOA (USDC in, MON swaps and WMON unwraps through routers; ~380 txs on 3 Oct). */
const ADDRESS = getAddress(process.env.ADDRESS ?? "0xdfaa4a2413bc51d0260862762d82eba812ecca0d");
/** The Practice account used on the simulator (acceptance log, 1 Oct). */
const PRACTICE_ADDRESS = getAddress(process.env.PRACTICE_ADDRESS ?? "0x17f356db5f7ffc1aed64d9bfc38e19f1633504e1");
const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60_000;
const SCAN_WAIT_MS = Number(process.env.SCAN_WAIT_MIN ?? "20") * MS_PER_MINUTE;
/** While the scanner backs off, ask this often (a back-off answer costs no HyperSync query). */
const BACKOFF_POLL_MS = 200;
const PAGE = 50;
const PAGES_MAX = 20;
const SHOWN = 4;
const SHORT_HEAD = 6;
const SHORT_TAIL = 4;
const PAGES_PER_SCAN = 3;
/** ISO-8601 slices: "HH:MM:SS" and "YYYY-MM-DDTHH:MM". */
const CLOCK_FROM = 11;
const CLOCK_TO = 19;
const MINUTE_STAMP = 16;

const failures: string[] = [];
function check(ok: boolean, what: string): void {
  console.log(`${ok ? "✓" : "✗"} ${what}`);
  if (!ok) failures.push(what);
}

const short = (a: string) => `${a.slice(0, SHORT_HEAD)}…${a.slice(-SHORT_TAIL)}`;
const amount = (l: WalletLeg) =>
  `${formatUnits(l.amount, l.token.decimals, Math.min(l.token.decimals, SHOWN))} ${l.token.symbol}${l.token.verified ? "" : " (unverified)"}`;

/** The row title the app builds (apps/mobile/src/features/activity/wallet-item.ts), for reading the output. */
function words(item: WalletActivityItem): string {
  const sent = item.legs.find((l) => l.direction === "out");
  const got = item.legs.find((l) => l.direction === "in");
  if (item.kind === "swap" && sent && got) return `Swapped ${amount(sent)} → ${amount(got)}`;
  if (item.kind === "received" && got)
    return `Received ${amount(got)}${got.counterparty ? ` from ${short(got.counterparty)}` : ""}`;
  return sent ? `Sent ${amount(sent)}${sent.counterparty ? ` to ${short(sent.counterparty)}` : ""}` : "?";
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL (a local Postgres) is required");
const db = createDb(databaseUrl, "wallet-activity-check");
const live = await openAnyAssetHarness({ hypersyncToken: process.env.HYPERSYNC_API_TOKEN }, undefined, {
  db,
  pagesPerScan: PAGES_PER_SCAN,
});

async function scanned(chainId: ChainId, address: `0x${string}`): Promise<WalletActivity> {
  const deadline = Date.now() + SCAN_WAIT_MS;
  let said = "";
  for (;;) {
    const page = await live.api.call(walletActivityRoute, { query: { chainId, address, limit: PAGE } });
    const line = `scan complete=${page.scan.complete} below=${page.scan.scannedToBlock ?? "—"} ${page.scan.note ?? ""}`;
    if (line !== said) console.log(`  ${new Date().toISOString().slice(CLOCK_FROM, CLOCK_TO)} ${line}`);
    said = line;
    if (page.scan.complete || Date.now() > deadline) return page;
    if (/rate-limited|429|unreachable/.test(page.scan.note ?? "")) await sleep(BACKOFF_POLL_MS);
  }
}

async function walk(label: string, chainId: ChainId, address: `0x${string}`): Promise<void> {
  console.log(`\n${label} ${address} on ${chainId}`);
  const first = await scanned(chainId, address);
  check(first.scan.complete, `${label}: the scan reached the newest final block`);
  const items: WalletActivityItem[] = [];
  let page: WalletActivity = first;
  for (let n = 0; n < PAGES_MAX; n += 1) {
    items.push(...page.items);
    if (!page.next) break;
    page = await live.api.call(walletActivityRoute, {
      query: { chainId, address, limit: PAGE, before: page.next },
    });
  }
  const kinds = { received: 0, sent: 0, swap: 0 };
  for (const item of items) kinds[item.kind] += 1;
  console.log(`  ${items.length} items: ${JSON.stringify(kinds)}`);
  for (const item of items.slice(0, PAGE)) {
    const flags = [item.internal ? "internal" : "", item.spam ? "spam" : ""].filter(Boolean).join(",");
    const when = new Date(item.timestamp * MS_PER_SECOND).toISOString().slice(0, MINUTE_STAMP);
    console.log(`  ${when} ${short(item.txHash)} ${words(item)}${flags ? `  [${flags}]` : ""}`);
  }
  const hashes = items.map((i) => i.txHash);
  check(new Set(hashes).size === hashes.length, `${label}: no transaction twice across pages`);
  check(
    items.every((item, i) => i === 0 || (items[i - 1]?.blockNumber ?? 0n) >= item.blockNumber),
    `${label}: newest first`,
  );
  check(
    items.every((item) => item.legs.every((l) => l.amount > 0n)),
    `${label}: every leg moves a positive amount`,
  );
  check(
    items.every((item) => {
      const outs = item.legs.some((l) => l.direction === "out");
      const ins = item.legs.some((l) => l.direction === "in");
      return item.kind === "swap" ? outs && ins : item.kind === "received" ? ins && !outs : outs && !ins;
    }),
    `${label}: kinds match their legs`,
  );
}

try {
  await walk("mainnet", MAINNET_CHAIN_ID, ADDRESS);
  await walk("practice", TESTNET_CHAIN_ID, PRACTICE_ADDRESS);
} finally {
  await live.close();
  await db.end();
}
if (failures.length > 0) {
  console.log(`\n${failures.length} check(s) failed`);
  process.exitCode = 1;
} else console.log("\nall checks passed");
