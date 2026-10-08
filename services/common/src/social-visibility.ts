import { type ChainId, MAINNET_CHAIN_ID } from "@senryo/config";
import type { Db, Tx } from "./db.ts";

/** Shared by public reads, notification ingest and delivery: one network visibility policy. */
export function listedColumn(chainId: ChainId): "listed_mainnet" | "listed_practice" {
  return chainId === MAINNET_CHAIN_ID ? "listed_mainnet" : "listed_practice";
}

export function publicTradesColumn(chainId: ChainId): "public_trades_mainnet" | "public_trades_practice" {
  return chainId === MAINNET_CHAIN_ID ? "public_trades_mainnet" : "public_trades_practice";
}

export function visibleOn(db: Db | Tx, alias: string, chainId: ChainId) {
  return db`${db(alias)}.${db(listedColumn(chainId))} AND NOT ${db(alias)}.hidden`;
}
