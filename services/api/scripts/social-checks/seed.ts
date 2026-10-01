import { randomBytes, randomUUID } from "node:crypto";
import { type ProfileUpdate, profilePutRoute } from "@senryo/api-client";
import { type ChainId, TESTNET_CHAIN_ID } from "@senryo/config";
import type { FeedFill } from "@senryo/indexer-client";
import { MS_PER_SECOND } from "@senryo/service-common";
import type { MockPosition } from "../mock-indexer.ts";
import { freshHandle, type Harness, type User } from "../social-harness.ts";

/** Seed helpers shared by the social check suites. */

/** Block numbers unique to this run (a stored feed cursor from an earlier run is always behind them). */
let nextBlock = Date.now();
const TX_HASH_BYTES = 32;

export const nowSec = (): number => Math.floor(Date.now() / MS_PER_SECOND);
const USD6 = 1_000_000n;
const DEFAULT_NOTIONAL_DOLLARS = 100;
export const usd = (dollars: number): bigint => BigInt(dollars) * USD6;

/** A fresh account with a handle (practice listed + sharing by default) and optional settings. */
export async function member(h: Harness, update: ProfileUpdate = {}, chainId: ChainId = TESTNET_CHAIN_ID) {
  const u = h.user(chainId);
  await u.api.call(profilePutRoute, { body: { handle: freshHandle(), ...update } });
  return u;
}

/** Make `u` a trusted reporter: a landed starter claim. */
export async function claimed(h: Harness, u: User): Promise<void> {
  await h.db`
    INSERT INTO starter_claims (id, kind, chain_id, user_address, tx_hash, stage)
    VALUES (${randomUUID()}, 'claim', ${TESTNET_CHAIN_ID}, ${u.lower}, ${`0x${randomBytes(TX_HASH_BYTES).toString("hex")}`},
            'finalized')`;
}

export interface FillSeed {
  chainId?: ChainId;
  user: User;
  kind?: FeedFill["kind"];
  side?: FeedFill["side"];
  /** usd6 */
  notional?: bigint;
  pnl?: bigint;
  fee?: bigint;
  funding?: bigint;
  borrow?: bigint;
  at: number;
  market?: { id: string; symbol: string };
  positionId?: string;
}

export const XAU = { id: "ours-0", symbol: "XAU" };
export const XAG = { id: "ours-1", symbol: "XAG" };

/** Push one indexed fill (unique block) into the mock and return it. */
export function fill(h: Harness, s: FillSeed): FeedFill {
  nextBlock += 1;
  const market = s.market ?? XAU;
  const row: FeedFill & { chainId: ChainId } = {
    chainId: s.chainId ?? TESTNET_CHAIN_ID,
    id: `${nextBlock}_0`,
    user_id: s.user.lower,
    venue: "OURS",
    kind: s.kind ?? "OPEN",
    side: s.side ?? "LONG",
    size: 1n,
    price: 1n,
    notional: s.notional ?? usd(DEFAULT_NOTIONAL_DOLLARS),
    fee: s.fee ?? 0n,
    realizedPnl: s.pnl ?? 0n,
    funding: s.funding ?? 0n,
    borrow: s.borrow ?? 0n,
    timestamp: s.at,
    block: nextBlock,
    txHash: `0x${randomBytes(TX_HASH_BYTES).toString("hex")}`,
    market: { ...market, venue: "OURS" },
    position: {
      id: s.positionId ?? `${market.id}-${s.user.lower}-${nextBlock}_0`,
      status: s.kind === "CLOSE" ? "CLOSED" : "OPEN",
      realizedPnl: s.pnl ?? 0n,
      feesPaid: s.fee ?? 0n,
      fundingPaid: s.funding ?? 0n,
      borrowPaid: s.borrow ?? 0n,
    },
  };
  h.mock.fills.push(row);
  return row;
}

/** Push one closed (or open) position into the mock. */
export function position(
  h: Harness,
  s: { user: User; pnl: bigint; notional: bigint; closedAt?: number; chainId?: ChainId; market?: typeof XAU },
): MockPosition {
  nextBlock += 1;
  const market = s.market ?? XAU;
  const row: MockPosition = {
    chainId: s.chainId ?? TESTNET_CHAIN_ID,
    id: `${market.id}-${s.user.lower}-${nextBlock}_0`,
    user_id: s.user.lower,
    venue: "OURS",
    side: "LONG",
    status: s.closedAt === undefined ? "OPEN" : "CLOSED",
    realizedPnl: s.pnl,
    feesPaid: 0n,
    fundingPaid: 0n,
    borrowPaid: 0n,
    openedAt: (s.closedAt ?? nowSec()) - 1,
    closedAt: s.closedAt,
    updatedAt: s.closedAt ?? nowSec(),
    market: { ...market, venue: "OURS" },
    fills: [
      { kind: "OPEN", notional: s.notional, txHash: `0x${"a".repeat(TX_HASH_BYTES * 2)}`, block: nextBlock },
      { kind: "CLOSE", notional: s.notional, txHash: `0x${"b".repeat(TX_HASH_BYTES * 2)}`, block: nextBlock + 1 },
    ],
  };
  h.mock.positions.push(row);
  return row;
}
