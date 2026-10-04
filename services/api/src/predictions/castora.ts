import type { PriceContest } from "@senryo/api-client";
import { type CastoraPool, createReadClient, readCastoraPool, readCastoraPools } from "@senryo/chain";
import { CASTORA_ASSETS, MAINNET_CHAIN_ID, PREDICTION_VENUES } from "@senryo/config";
import { TtlCache } from "../anyasset/upstream.ts";

const PAGE_MAX = 100;
const DETAIL_CACHE_MAX = 128;
const MON_DECIMALS = 18;

const CACHE_MS = 300_000;
const venue = PREDICTION_VENUES.castora;
type Snapshot = Awaited<ReturnType<typeof readCastoraPools>>;
export function contestOf(
  p: CastoraPool,
  snap: Pick<Snapshot, "paused" | "blockNumber" | "observedAt">,
): PriceContest | null {
  if (p.seeds.isUnlisted) return null;
  const asset = CASTORA_ASSETS[p.seeds.predictionToken.toLowerCase()];
  // Unknown provider identifiers must never masquerade as real token identities.
  if (!asset) return null;
  const nativeStake = p.seeds.stakeToken.toLowerCase() === venue.core.toLowerCase();
  const status =
    p.completionTime > 0n
      ? "resolved"
      : p.seeds.windowCloseTime >= BigInt(snap.observedAt)
        ? "open"
        : p.noOfPredictions === 0n || p.seeds.snapshotTime > BigInt(snap.observedAt)
          ? "closed"
          : "resolving";
  return {
    kind: "price-contest",
    provider: "castora",
    settlementNetwork: "Monad",
    execution: "view-only",
    id: String(p.poolId),
    title: `${asset} price contest #${p.poolId}`,
    asset,
    status,
    closesAt: Number(p.seeds.windowCloseTime),
    opensAt: Number(p.creationTime),
    observedAt: snap.observedAt,
    sourceUpdatedAt: null,
    sourceUrl: venue.web,
    snapshotAt: Number(p.seeds.snapshotTime),
    stakeUnits: p.seeds.stakeAmount,
    stakeSymbol: nativeStake ? "MON" : "Unknown stake asset",
    stakeDecimals: nativeStake ? MON_DECIMALS : null,
    feesBps: p.seeds.feesPercent,
    multiplier100: p.seeds.multiplier,
    entries: p.noOfPredictions,
    winners: p.noOfWinners,
    claimed: p.noOfClaimedWinnings,
    paused: snap.paused,
    blockNumber: snap.blockNumber,
  };
}

export class CastoraDiscovery {
  private readonly read = createReadClient(MAINNET_CHAIN_ID);
  private readonly snapshot = new TtlCache<Snapshot>(1);
  private readonly details = new TtlCache<PriceContest | null>(DETAIL_CACHE_MAX);

  async list() {
    const snap = await this.snapshot.load("pools", CACHE_MS, () => readCastoraPools(this.read));
    const markets = snap.items
      .flatMap((p) => {
        const market = contestOf(p, snap);
        // Expired pools with no entries do not imply activity or a pending payout.
        return market && (market.status === "open" || market.entries > 0n) ? [market] : [];
      })
      .sort((a, b) => Number(b.status === "open") - Number(a.status === "open") || b.closesAt - a.closesAt)
      .slice(0, PAGE_MAX);
    return { markets, observedAt: snap.observedAt, limited: snap.limited };
  }
  detail(id: string) {
    return this.details.load(id, CACHE_MS, async () => {
      const snap = await this.snapshot.load("pools", CACHE_MS, () => readCastoraPools(this.read));
      if (BigInt(id) < 1n || BigInt(id) > snap.totalPools) return null;
      const pool = snap.items.find((p) => p.poolId === BigInt(id));
      if (pool) return contestOf(pool, snap);
      if (!snap.limited) return null;
      const result = await readCastoraPool(this.read, BigInt(id));
      return contestOf(result.item, result);
    });
  }
}
