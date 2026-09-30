import {
  addressOf,
  contractCall,
  describeError,
  readFeedRound,
  readOracleStates,
  readOracles,
  sendAndFinalize,
  sendTx,
} from "@senryo/chain";
import { ENGINE_MARKETS, TESTNET_CHAIN_ID } from "@senryo/config";
import { MS_PER_SECOND } from "@senryo/service-common";
import { BPS, MIRROR_CONFIRM_PUSH_SEC } from "../constants.ts";
import { type KeeperContext, loadJobState, saveJobState } from "../context.ts";
import type { Job } from "../runner.ts";

const MARKET_IDS = ENGINE_MARKETS.map((m) => m.id);

/**
 * `observe` pokes: `peek` is stateless, so a new accepted round, a CIRCUIT confirmation or a session edge only becomes
 * persistent state (and a `MarketStatusChanged` / `PriceAccepted` event for the indexer, D-057 funding edges) when
 * someone calls `observe`. Poke only when it would change state — each poke costs gas.
 */
export function observeJob(ctx: KeeperContext): Job {
  return {
    name: "observe",
    intervalMs: ctx.env.OBSERVE_MS,
    async run() {
      const [views, states] = await Promise.all([
        readOracles(ctx.read, ctx.chainId, MARKET_IDS),
        readOracleStates(ctx.read, ctx.chainId, MARKET_IDS),
      ]);
      for (const view of views) {
        const state = states.find((s) => s.marketId === view.marketId);
        if (!state) continue;
        const changed = view.status !== state.lastStatus || view.price18 !== state.lastPrice18;
        if (!changed) continue;
        try {
          const sent = await sendAndFinalize(
            ctx.sender,
            contractCall(ctx.chainId, "SessionOracle", "observe", [view.marketId], "observe"),
          );
          ctx.recent.add({ job: "observe", subject: String(view.marketId), tx: sent.hash, stage: sent.final.stage });
          ctx.log.info(
            { market: view.marketId, from: state.lastStatus, to: view.status, price18: view.price18, tx: sent.hash },
            "observe poke",
          );
        } catch (error) {
          ctx.log.warn({ market: view.marketId, err: describeError(error) }, "observe poke failed");
        }
      }
    },
  };
}

interface MirrorCursor extends Record<string, unknown> {
  /** Last mainnet round mirrored, per market symbol. */
  rounds?: Record<string, string>;
}

/**
 * Testnet MirrorAggregator relay (D-055): mirror the mainnet Chainlink XAU/XAG answer onto 10143 when it moved by
 * ≥ MIRROR_DEVIATION_BPS or the mirror is older than MIRROR_HEARTBEAT_SEC (stay under 3,600 s + FEED_GRACE). The
 * first push after a long gap may trip the clamp; the oracle self-confirms after 3 in-band rounds over ≥ 300 s.
 */
export function mirrorJob(ctx: KeeperContext): Job {
  return {
    name: "mirror",
    intervalMs: ctx.env.MIRROR_MS,
    async run() {
      if (ctx.chainId !== TESTNET_CHAIN_ID) return;
      const cursor = (await loadJobState<MirrorCursor>(ctx.db, "mirror")) ?? {};
      const rounds = { ...(cursor.rounds ?? {}) };
      const nowSec = BigInt(Math.floor(Date.now() / MS_PER_SECOND));
      const views = await readOracles(ctx.read, ctx.chainId, MARKET_IDS);
      for (const market of ENGINE_MARKETS.filter((m) => ctx.env.MIRROR_MARKETS.includes(m.symbol))) {
        const [source, mirror] = await Promise.all([
          readFeedRound(ctx.mainnet, market.mainnetFeed),
          readFeedRound(ctx.read, addressOf(ctx.chainId, market.testnetMirror)),
        ]);
        const moved = source.answer - mirror.answer;
        const movedBps = mirror.answer === 0n ? BPS : ((moved < 0n ? -moved : moved) * BPS) / mirror.answer;
        const age = nowSec - mirror.updatedAt;
        const stale = age >= BigInt(ctx.env.MIRROR_HEARTBEAT_SEC);
        const confirming = views.find((v) => v.marketId === market.id)?.status === "CIRCUIT";
        const confirmDue = confirming && age >= BigInt(MIRROR_CONFIRM_PUSH_SEC);
        const newRound = rounds[market.symbol] !== source.roundId.toString();
        if (!(stale || confirmDue || (newRound && movedBps >= BigInt(ctx.env.MIRROR_DEVIATION_BPS)))) continue;
        const sent = await sendTx(
          ctx.sender,
          contractCall(ctx.chainId, market.testnetMirror, "pushAnswer", [source.answer], "pushAnswer"),
        );
        rounds[market.symbol] = source.roundId.toString();
        ctx.recent.add({ job: "mirror", subject: market.symbol, tx: sent.hash, stage: sent.stage });
        ctx.log.info(
          {
            market: market.symbol,
            answer: source.answer,
            movedBps,
            stale,
            confirming,
            tx: sent.hash,
            stage: sent.stage,
          },
          "mirror push",
        );
      }
      await saveJobState(ctx.db, "mirror", { rounds });
    },
  };
}
