import {
  addressOf,
  contractCall,
  describeError,
  isDeployed,
  type OracleState,
  type OracleView,
  readFeedRound,
  readOpenInterest,
  readOracleStates,
  readOracles,
  sendAndFinalize,
  sendTx,
} from "@senryo/chain";
import { ENGINE_MARKETS, engineMarketsOn, TESTNET_CHAIN_ID } from "@senryo/config";
import { MS_PER_SECOND } from "@senryo/service-common";
import { BPS, MIRROR_CONFIRM_PUSH_SEC } from "../constants.ts";
import { type KeeperContext, loadJobState, saveJobState } from "../context.ts";
import type { Job } from "../runner.ts";

type PokeReason = "edge" | "drift";

/**
 * Why a market needs a poke, or undefined (S8.23, D-188). A poke costs GAS_LIMITS.observe (≈ 0.0255 MON at 102 gwei);
 * poking every round of five 240 s FX feeds would cost ≥ 46 MON/day on mainnet, so:
 *  - `edge`: the evaluated status differs from the persisted one. Persists CLOSED + closedSeen (the reopen clamp),
 *    CIRCUIT, and the indexer's MarketStatusChanged; with open interest it also closes the funding interval.
 *  - `drift`: open interest and the feed has moved ≥ OBSERVE_DRIFT_BPS from the persisted price. Keeps the clamp
 *    reference close enough that a sustained move never parks a market with positions in CIRCUIT (which pauses
 *    liquidations).
 * Price changes alone never poke: a trade's own `observe` evaluates the feed, and a calm drift past the clamp is
 * confirmed in that same call; borrow and funding accrue lazily and exactly between trades.
 */
export function pokeReason(
  view: OracleView,
  state: OracleState,
  hasOpenInterest: boolean,
  driftBps: bigint,
): PokeReason | undefined {
  if (view.status !== state.lastStatus) return "edge";
  if (!hasOpenInterest || state.lastPrice18 === 0n || view.latest18 === 0n) return undefined;
  const moved =
    view.latest18 > state.lastPrice18 ? view.latest18 - state.lastPrice18 : state.lastPrice18 - view.latest18;
  return moved * BPS >= driftBps * state.lastPrice18 ? "drift" : undefined;
}

/**
 * Budgeted `observe` pokes (see `pokeReason`). With open interest the poke is `SenryoCore.poke` (observe + accrue), so
 * funding for the interval that just ended is accrued under its own status — funding accrues only while OPEN.
 */
export function observeJob(ctx: KeeperContext): Job {
  return {
    name: "observe",
    intervalMs: ctx.env.OBSERVE_MS,
    async run() {
      const marketIds = engineMarketsOn(ctx.chainId).map((m) => m.id);
      const [views, states, interest] = await Promise.all([
        readOracles(ctx.read, ctx.chainId, marketIds),
        readOracleStates(ctx.read, ctx.chainId, marketIds),
        readOpenInterest(ctx.read, ctx.chainId, marketIds),
      ]);
      for (const view of views) {
        const state = states.find((s) => s.marketId === view.marketId);
        if (!state) continue;
        const hasOpenInterest = interest.get(view.marketId) === true;
        const reason = pokeReason(view, state, hasOpenInterest, BigInt(ctx.env.OBSERVE_DRIFT_BPS));
        if (!reason) continue;
        const call = hasOpenInterest
          ? contractCall(ctx.chainId, "SenryoCore", "poke", [view.marketId], "poke")
          : contractCall(ctx.chainId, "SessionOracle", "observe", [view.marketId], "observe");
        try {
          const sent = await sendAndFinalize(ctx.sender, call);
          ctx.recent.add({ job: "observe", subject: String(view.marketId), tx: sent.hash, stage: sent.final.stage });
          ctx.log.info(
            {
              market: view.marketId,
              reason,
              via: hasOpenInterest ? "core.poke" : "oracle.observe",
              from: state.lastStatus,
              to: view.status,
              price18: view.price18,
              tx: sent.hash,
            },
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
 * Testnet MirrorAggregator relay (D-055): mirror the mainnet Chainlink answer onto 10143 when it moved by
 * ≥ MIRROR_DEVIATION_BPS or the mirror is older than its category's heartbeat (metals MIRROR_HEARTBEAT_SEC under the
 * oracle's 3,600 s + FEED_GRACE; FX MIRROR_FX_HEARTBEAT_SEC under 10,800 s + FEED_GRACE). The first push after a long gap may trip the clamp; the oracle self-confirms after 3
 * in-band rounds over ≥ 300 s. Relays every MIRROR_MARKETS market whose mirror is deployed — FX mirrors are relayed
 * from `AddMarkets.s.sol` run 1, before the timelocked listing, so the feeds are fresh when the markets go live.
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
      const listed = engineMarketsOn(ctx.chainId);
      const views = await readOracles(
        ctx.read,
        ctx.chainId,
        listed.map((m) => m.id),
      );
      const relayed = ENGINE_MARKETS.filter(
        (m) => ctx.env.MIRROR_MARKETS.includes(m.symbol) && isDeployed(ctx.chainId, m.testnetMirror),
      );
      for (const market of relayed) {
        const [source, mirror] = await Promise.all([
          readFeedRound(ctx.mainnet, market.mainnetFeed),
          readFeedRound(ctx.read, addressOf(ctx.chainId, market.testnetMirror)),
        ]);
        const moved = source.answer - mirror.answer;
        const movedBps = mirror.answer === 0n ? BPS : ((moved < 0n ? -moved : moved) * BPS) / mirror.answer;
        const age = nowSec - mirror.updatedAt;
        const heartbeat = market.category === "fx" ? ctx.env.MIRROR_FX_HEARTBEAT_SEC : ctx.env.MIRROR_HEARTBEAT_SEC;
        const stale = age >= BigInt(heartbeat);
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
