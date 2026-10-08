/**
 * D1 Perpl check — read-only against Monad mainnet (no transaction is signed or sent):
 *  1. the Exchange: version, halt flag, collateral and the live account-open minimum against `@senryo/config`
 *  2. every listed market: decimals against `PERPL_MARKET_SCALES`, mark, max leverage, taker fee, and the IOC price
 *     bounds + lots a `NOTIONAL_USD` order would send at the default slippage
 *  3. a fresh address with no Perpl account: the IOC open built by `@senryo/chain`, decoded back by the session policy
 *     (independent ABI path), then `eth_call` → must revert `AccountDoesNotExist(<that address>)`
 *  4. from an existing account (`HOLDER`): price 0 → `PriceOutOfRange(0, 1, 16777215)`; `lastExecutionBlock` already
 *     passed → `ExceedsLastExecutionBlock`; head + 20 → executes
 *  5. the whole journey in one `eth_simulateV1` block for a throwaway wallet credited AUSD by state override: approve →
 *     createAccount → an IOC priced 10 % away (must SUCCEED and fill nothing) → IOC open → IOC close → withdraw, each
 *     outcome read by the fill decoder, never from the status alone
 *  6. the open planner for both wallets (steps it would send, or why it wouldn't)
 *   pnpm --filter @senryo/drive perpl-check            (PERPL_CHECK_MARKET=10 for MON; default BTC = 1)
 */
import { evaluateTransaction } from "@senryo/account";
import {
  createReadClient,
  decodePerplCollateral,
  decodePerplOrder,
  decodeRevert,
  mappingSlotOverride,
  type PerplOrderOutcome,
  perplApproveRequest,
  perplCreateAccountRequest,
  perplLimitPrice,
  perplLotsFor,
  perplOrderRequest,
  perplWithdrawRequest,
  readPerplAccount,
  readPerplExchange,
  readPerplMarketTerms,
  simulatePerplSteps,
} from "@senryo/chain";
import {
  MAINNET_CHAIN_ID,
  PERPL_COLLATERAL,
  PERPL_MARKET_SCALES,
  PERPL_MARKETS,
  PERPL_MIN_ACCOUNT_OPEN_CNS,
  PERPL_ORDER_TTL_BLOCKS,
  PERPL_PRICE_PNS_MAX,
  PERPL_PRICE_PNS_MIN,
  PERPL_SLIPPAGE_BPS,
} from "@senryo/config";
import { DECIMALS, formatUnits, ONE_USD6 } from "@senryo/core";
import { perplOpenOperation } from "@senryo/query";

const chainId = MAINNET_CHAIN_ID;
const read = createReadClient(chainId);
const MARKET = Number.parseInt(process.env.PERPL_CHECK_MARKET ?? "1", 10);
/** $20 of exposure at 5x — the smallest demo order with room for fees. */
const NOTIONAL_USD = 20n;
const NOTIONAL_CNS = NOTIONAL_USD * ONE_USD6;
const LEVERAGE_HDTHS = 500n;
/** Account 100 on mainnet (≈ 1,175 AUSD on the Exchange, no positions on 2 Oct 2026): a real account for reverts. */
const HOLDER = "0x52e1284bd9E676d24100F1504Ccb1F78b407dd84";
/** Never used onchain: random-looking, holds nothing, no Perpl account. */
const FRESH = "0x5e9104c0c0a0b0000000000000000000000dd1d0";
/**
 * AUSD (`0x00000000eFE3…012a`) keeps balances at keccak256(abi.encode(owner, BASE)) as `balance << 8` (low byte =
 * flags) — found 2 Oct 2026 with `debug_traceCall` + `prestateTracer` on `balanceOf(HOLDER)` (slot value 0x19f600 for
 * 6,646 units) and matched against the implementation's PUSH32 constants. Simulation only.
 */
const AUSD_BALANCE_BASE = "0x455730fed596673e69db1907be2e521374ba893f1a04cc5f5dd931616cd6b700";
const AUSD_BALANCE_SHIFT = 8n;
/** The throwaway wallet's AUSD, what it opens the account with, and what it takes back. */
const CREDIT_USD = 50n;
const DEPOSIT_USD = 30n;
const WITHDRAW_USD = 10n;
const CREDIT_CNS = CREDIT_USD * ONE_USD6;
const DEPOSIT_CNS = DEPOSIT_USD * ONE_USD6;
const WITHDRAW_CNS = WITHDRAW_USD * ONE_USD6;
/** The "unfillable" order sits this far on the wrong side of the mark (bps). */
const FAR_BPS = 1_000n;
const BPS = 10_000n;
const STALE_BLOCKS = 2n;

let failures = 0;
function expect(ok: boolean, what: string): void {
  console.log(`${ok ? "✓" : "✗"} ${what}`);
  if (!ok) failures += 1;
}
const usd = (cns: bigint) => `$${formatUnits(cns, DECIMALS.usd6, 2)}`;

// ---------------------------------------------------------------- 1. exchange
const exchange = await readPerplExchange(read, chainId);
expect(!exchange.halted, "Exchange not halted");
expect(
  exchange.minAccountOpenCNS === PERPL_MIN_ACCOUNT_OPEN_CNS[chainId],
  `account-open minimum ${usd(exchange.minAccountOpenCNS)} matches config`,
);

// ---------------------------------------------------------------- 2. markets
const ids = Object.values(PERPL_MARKETS[chainId] ?? {});
const rows = [];
for (const id of ids) {
  const t = await readPerplMarketTerms(read, chainId, id);
  const scale = PERPL_MARKET_SCALES[chainId]?.[id];
  expect(
    scale?.priceDecimals === t.priceDecimals && scale.lotDecimals === t.lotDecimals,
    `market ${id} decimals ${t.priceDecimals}/${t.lotDecimals} match PERPL_MARKET_SCALES`,
  );
  const buy = perplLimitPrice(t.markPNS, "buy", PERPL_SLIPPAGE_BPS);
  const sell = perplLimitPrice(t.markPNS, "sell", PERPL_SLIPPAGE_BPS);
  rows.push({
    market: id,
    mark: formatUnits(t.markPNS, t.priceDecimals, t.priceDecimals),
    "buy ≤ (PNS)": `${buy} (${formatUnits(buy, t.priceDecimals, t.priceDecimals)})`,
    "sell ≥ (PNS)": `${sell} (${formatUnits(sell, t.priceDecimals, t.priceDecimals)})`,
    [`lots for $${NOTIONAL_USD}`]: perplLotsFor(NOTIONAL_CNS, buy, t).toString(),
    maxLeverage: `${formatUnits(t.maxLeverageHdths, 2, 0)}x`,
    takerFeePpm: t.takerFeePpm.toString(),
    paused: t.paused,
  });
}
console.table(rows);

// ---------------------------------------------------------------- 3. fresh address: encodes, reverts as expected
const terms = await readPerplMarketTerms(read, chainId, MARKET);
const head = await read.getBlockNumber();
const limit = perplLimitPrice(terms.markPNS, "buy", PERPL_SLIPPAGE_BPS);
const lots = perplLotsFor(NOTIONAL_CNS, limit, terms);
const open = perplOrderRequest(chainId, {
  marketId: MARKET,
  intent: "open",
  side: "long",
  lots,
  limitPricePNS: limit,
  leverageHdths: LEVERAGE_HDTHS,
  headBlock: head,
});
const policyCtx = {
  chainId,
  self: FRESH,
  faceId: "off",
  marketRoomUsd6: () => undefined,
  equityUsd6: () => undefined,
} as const;
const verdict = evaluateTransaction(
  { chainId, to: open.to, data: open.data, value: 0n, authorizationList: undefined },
  policyCtx,
  { spentUsd6: 0n, signedAt: [] },
  Date.now(),
);
const decoded = verdict.action;
expect(
  decoded?.kind === "perpl-open" &&
    decoded.marketId === MARKET &&
    decoded.isLong &&
    decoded.leverageHdths === LEVERAGE_HDTHS &&
    decoded.notionalUsd6 <= NOTIONAL_CNS,
  `IOC calldata decodes back: market ${MARKET}, long, ${lots} lots at ≤ ${limit} PNS, 5x (${verdict.kind})`,
);
expect((await readPerplAccount(read, chainId, FRESH)) === undefined, "fresh address has no Perpl account");
const revertOf = async (from: string, data: `0x${string}`) =>
  read
    .call({ account: from as `0x${string}`, to: open.to, data })
    .then(() => undefined)
    .catch((e: unknown) => decodeRevert(e));
const noAccount = await revertOf(FRESH, open.data);
expect(
  noAccount?.name === "AccountDoesNotExist" && String(noAccount.args[0]).toLowerCase() === FRESH.toLowerCase(),
  `eth_call from the fresh address reverts ${noAccount?.message}`,
);

// ---------------------------------------------------------------- 4. reverts that pin the order rules
const order = (patch: { limitPricePNS?: bigint; headBlock?: bigint }) =>
  perplOrderRequest(chainId, {
    marketId: MARKET,
    intent: "open",
    side: "long",
    lots,
    limitPricePNS: patch.limitPricePNS ?? limit,
    leverageHdths: LEVERAGE_HDTHS,
    headBlock: patch.headBlock,
  }).data;
const zero = await revertOf(HOLDER, order({ limitPricePNS: 0n }));
expect(
  zero?.name === "PriceOutOfRange" && zero.args[1] === PERPL_PRICE_PNS_MIN && zero.args[2] === PERPL_PRICE_PNS_MAX,
  `price 0 reverts ${zero?.message}`,
);
const now = await read.getBlockNumber();
const stale = await revertOf(HOLDER, order({ headBlock: now - PERPL_ORDER_TTL_BLOCKS - STALE_BLOCKS }));
expect(
  stale?.name === "ExceedsLastExecutionBlock",
  `lastExecutionBlock head − ${STALE_BLOCKS} reverts ${stale?.message}`,
);
const fresh = await revertOf(HOLDER, order({ headBlock: now }));
expect(
  fresh === undefined,
  `lastExecutionBlock head + ${PERPL_ORDER_TTL_BLOCKS} executes (${fresh?.message ?? "no revert"})`,
);

// ---------------------------------------------------------------- 5. the journey, simulated end to end
const far = perplLimitPrice(terms.markPNS, "sell", 0n); // mark, then pushed down below
const steps = [
  perplApproveRequest(chainId, DEPOSIT_CNS),
  perplCreateAccountRequest(chainId, DEPOSIT_CNS),
  perplOrderRequest(chainId, {
    marketId: MARKET,
    intent: "open",
    side: "long",
    lots,
    limitPricePNS: (far * (BPS - FAR_BPS)) / BPS,
    leverageHdths: LEVERAGE_HDTHS,
  }),
  perplOrderRequest(chainId, {
    marketId: MARKET,
    intent: "open",
    side: "long",
    lots,
    limitPricePNS: limit,
    leverageHdths: LEVERAGE_HDTHS,
  }),
  perplOrderRequest(chainId, {
    marketId: MARKET,
    intent: "close",
    side: "long",
    lots,
    limitPricePNS: perplLimitPrice(terms.markPNS, "sell", PERPL_SLIPPAGE_BPS),
    leverageHdths: LEVERAGE_HDTHS,
  }),
  perplWithdrawRequest(chainId, WITHDRAW_CNS),
];
const credit = mappingSlotOverride(
  PERPL_COLLATERAL[chainId],
  AUSD_BALANCE_BASE,
  FRESH,
  CREDIT_CNS << AUSD_BALANCE_SHIFT,
);
const sim = await simulatePerplSteps(read, FRESH, steps, [credit]);
const show = (o: PerplOrderOutcome) =>
  o.kind === "no-order"
    ? "no order"
    : `${o.kind}: ${o.filledLots}/${o.requestedLots} lots @ ${o.avgPricePNS} PNS, fee ${usd(o.feeCNS)}, unmatched ${o.unmatchedLots}, position ${o.position.map((p) => p.kind).join("→") || "—"}`;
const [approve, create, unfillable, filled, closed, withdrawn] = sim;
expect(approve?.ok === true, "approve (exact amount) succeeds");
const created = decodePerplCollateral(create?.logs ?? [], chainId);
expect(
  create?.ok === true && created.some((e) => e.kind === "account-created") && created.some((e) => e.kind === "deposit"),
  `createAccount(${usd(DEPOSIT_CNS)}) → ${created.map((e) => e.kind).join(", ")}`,
);
const miss = decodePerplOrder(unfillable?.logs ?? [], chainId);
expect(unfillable?.ok === true && miss.kind === "unfilled", `IOC 10 % below mark: status ok, decoded ${show(miss)}`);
const hit = decodePerplOrder(filled?.logs ?? [], chainId);
expect(
  filled?.ok === true && hit.kind === "filled" && hit.position.some((p) => p.kind === "opened"),
  `IOC open: ${show(hit)}`,
);
const out = decodePerplOrder(closed?.logs ?? [], chainId);
expect(
  closed?.ok === true && out.kind === "filled" && out.position.some((p) => p.kind === "closed"),
  `IOC close: ${show(out)}`,
);
const back = decodePerplCollateral(withdrawn?.logs ?? [], chainId);
expect(
  withdrawn?.ok === true && back.some((e) => e.kind === "withdrawal"),
  `withdraw ${usd(WITHDRAW_CNS)} to the wallet`,
);

// ---------------------------------------------------------------- 6. the planner
for (const [who, owner] of [
  ["existing account", HOLDER],
  ["fresh wallet", FRESH],
] as const) {
  const plan = await perplOpenOperation(read, owner, {
    chainId,
    marketId: MARKET,
    side: "long",
    notionalCNS: NOTIONAL_CNS,
    leverageHdths: LEVERAGE_HDTHS,
  });
  console.log(
    `plan (${who}): ${plan.blocker ? `blocked: ${plan.blocker}` : plan.plannedActions.join(" → ")} · ${plan.lots} lots ≤ ${plan.limitPricePNS} PNS · notional ${usd(plan.notionalCNS)} · margin ${usd(plan.marginCNS)} · deposit ${usd(plan.depositCNS)} · wallet short ${usd(plan.walletShortCNS)}`,
  );
}

console.log(failures === 0 ? "perpl-check: all checks passed" : `perpl-check: ${failures} check(s) failed`);
process.exitCode = failures === 0 ? 0 : 1;
