/**
 * Targeted check (not a test suite): does the PerplCursor pairing attribute every real Perpl fill? Replays mainnet
 * Perpl logs through the exact pairing function the handlers use (src/lib/perpl-math.ts) and prints the rate.
 * Public RPC eth_getLogs is capped at 100 blocks, so it samples WINDOWS windows spread over the last SPAN blocks.
 *
 *   pnpm check:perpl-cursor            # read-only; no key, no token
 */
import { type AbiItem, createPublicClient, http } from "viem";
import perplAbi from "../abis/PerplExchange.json" with { type: "json" };
import { type CursorState, pairFill } from "../src/lib/perpl-math.ts";

const RPC = process.env.ENVIO_RPC_URL_143 || "https://rpc.monad.xyz";
const EXCHANGE = "0x34B6552d57a35a1D042CcAe1951BD1C370112a6F";
const WINDOW_BLOCKS = 100n;
const WINDOWS = 30n;
const SPAN = 300_000n;
const POSITION_EVENTS = new Set([
  "PositionOpenedV2",
  "PositionIncreasedV2",
  "PositionDecreased",
  "PositionClosed",
  "PositionInverted",
  "PositionLiquidated",
  "PositionDeleveragedV2",
]);

type Args = { accountId?: bigint; posAccountId?: bigint; perpId?: bigint };
type AbiEvent = Extract<AbiItem, { type: "event" }>;

const FILL_EVENTS = new Set(["MakerOrderFilledV2", "TakerOrderFilledV2"]);
const wanted = (perplAbi as AbiItem[]).filter(
  (item): item is AbiEvent => item.type === "event" && (POSITION_EVENTS.has(item.name) || FILL_EVENTS.has(item.name)),
);
const client = createPublicClient({ transport: http(RPC) });
const head = await client.getBlockNumber();
const stats = { positions: 0, maker: 0, taker: 0, paired: 0, unattributed: 0 };
const reasons = new Map<string, number>();

for (let i = 1n; i <= WINDOWS; i++) {
  const toBlock = head - (i * SPAN) / WINDOWS;
  const fromBlock = toBlock - WINDOW_BLOCKS + 1n;
  const logs = await client.getLogs({ address: EXCHANGE, events: wanted, fromBlock, toBlock, strict: false });
  const events = [...logs].sort((a, b) =>
    a.blockNumber === b.blockNumber ? (a.logIndex ?? 0) - (b.logIndex ?? 0) : Number(a.blockNumber - b.blockNumber),
  );
  let cursor: CursorState | undefined;
  for (const e of events) {
    const name = (e as { eventName?: string }).eventName ?? "";
    const args = ((e as { args?: Args }).args ?? {}) as Args;
    const at = { txHash: e.transactionHash ?? "", logIndex: e.logIndex ?? 0 };
    if (POSITION_EVENTS.has(name)) {
      stats.positions++;
      const account = args.accountId ?? args.posAccountId;
      cursor = { ...at, accountId: String(account), marketId: String(args.perpId), fillId: undefined };
    } else if (name === "MakerOrderFilledV2" || name === "TakerOrderFilledV2") {
      const maker = name === "MakerOrderFilledV2";
      stats[maker ? "maker" : "taker"]++;
      const pairing = pairFill(cursor, maker ? { ...at, accountId: String(args.accountId) } : at);
      if (pairing.ok) {
        stats.paired++;
        cursor = undefined;
      } else {
        stats.unattributed++;
        reasons.set(pairing.reason, (reasons.get(pairing.reason) ?? 0) + 1);
      }
    }
  }
}

const fills = stats.maker + stats.taker;
console.log(`head ${head} · ${WINDOWS} windows × ${WINDOW_BLOCKS} blocks over the last ${SPAN} blocks`);
console.log(`Position* ${stats.positions} · maker fills ${stats.maker} · taker fills ${stats.taker}`);
console.log(`paired ${stats.paired}/${fills} · unattributed ${stats.unattributed}`, Object.fromEntries(reasons));
process.exitCode = stats.unattributed === 0 ? 0 : 1;
