/**
 * D1 / C4 planner check — the Perpl ticket's logic without the UI, read-only against Monad mainnet (nothing is signed
 * or sent; state overrides exist only inside `eth_simulateV1`):
 *  1. liquidation price: Perpl's own formula (dex-sdk position.rs) against the docs' worked example, both sides, with
 *     funding, and "none" for an over-collateralised long
 *  2. a first open simulated end to end for a throwaway wallet credited AUSD (approve → createAccount → IOC): the
 *     contract books at least `notional ÷ leverage` as the position's deposit (it adds the fill's loss against the
 *     mark), so the ticket's estimate — which assumes the lower bound at the IOC's bound — sits on the entry side of
 *     the position's real liquidation price
 *  3. how the operation is confirmed (`evaluateSequence`, what the slide names): a $10 × 2 first open signs in session;
 *     above 10×, above $250 notional, a > $250 deposit or past the session total asks for the passkey; reduce-only
 *     orders and withdrawals always sign in session
 *  4. the planner for an existing account: the order is built at signing time with head + 20 as its window
 *   pnpm --filter @senryo/drive perpl-plan-check
 */
import { evaluateSequence, type PolicyContext, type PolicyUsage } from "@senryo/account";
import {
  createReadClient,
  decodePerplOrder,
  mappingSlotOverride,
  perplApproveRequest,
  perplCreateAccountRequest,
  perplDepositRequest,
  perplLimitPrice,
  perplLiquidationPrice,
  perplLotsFor,
  perplNotional,
  perplOpenLiquidationPrice,
  perplOrderRequest,
  perplWithdrawRequest,
  readPerplMarketTerms,
  simulatePerplSteps,
  type TxRequest,
} from "@senryo/chain";
import { MAINNET_CHAIN_ID, PERPL_COLLATERAL, PERPL_ORDER_TTL_BLOCKS, PERPL_SLIPPAGE_BPS } from "@senryo/config";
import { DECIMALS, formatUnits } from "@senryo/core";
import { perplOpenOperation } from "@senryo/query";

const chainId = MAINNET_CHAIN_ID;
const read = createReadClient(chainId);
const BTC = 1;
const ETH = 20;
/** Account 100 on mainnet (≈ 1,175 AUSD on the Exchange, 2 Oct 2026). */
const HOLDER = "0x52e1284bd9E676d24100F1504Ccb1F78b407dd84";
/** Never used onchain: holds nothing, no Perpl account. */
const FRESH = "0x5e9104c0c0a0b0000000000000000000000dd1d1";
/** AUSD balances: keccak256(abi.encode(owner, BASE)) = balance << 8 (see perpl-check). Simulation only. */
const AUSD_BALANCE_BASE = "0x455730fed596673e69db1907be2e521374ba893f1a04cc5f5dd931616cd6b700";
const AUSD_BALANCE_SHIFT = 8n;
/** Dollar amounts in AUSD base units (6 decimals). */
const USD_10 = 10_000_000n;
const USD_20 = 20_000_000n;
const USD_50 = 50_000_000n;
const USD_100 = 100_000_000n;
const USD_120 = 120_000_000n;
const USD_150 = 150_000_000n;
const USD_300 = 300_000_000n;
const USD_900 = 900_000_000n;
const USD_10K = 10_000_000_000n;
const USD_200K = 200_000_000_000n;
const MARGIN = USD_10;
const OPEN_FLOOR = USD_10;
const CREDIT = USD_50;
const BIG = USD_300;
const SPENT_NEAR_TOTAL = USD_900;
/** Leverage in hundredths. */
const LEV_2X = 200n;
const LEV_5X = 500n;
const LEV_10X = 1_000n;
const LEV_12X = 1_200n;
const HDTHS_PER_X = 100n;
/** BTC's maintenance factor in the docs' example: 25× (4 %). */
const MMF_4PCT = 2_500n;
/** The docs' example in BTC's PNS (1 price decimal): entry $100,000.0; liquidation $94,000.0 / $106,000.0. */
const EXAMPLE_ENTRY = 1_000_000n;
const EXAMPLE_LONG_LIQ = 940_000n;
const EXAMPLE_SHORT_LIQ = 1_060_000n;
const EXAMPLE_FUNDED_LIQ = 939_000n;
/** One BTC in lots (5 lot decimals). */
const ONE_BTC = 100_000n;
/** Head reads race block production (~0.4 s blocks, RPC latency): allow ~10 s between the two reads. */
const HEAD_SLACK_BLOCKS = 25n;

let failures = 0;
function expect(ok: boolean, what: string): void {
  console.log(`${ok ? "✓" : "✗"} ${what}`);
  if (!ok) failures += 1;
}
const usd = (cns: bigint) => `$${formatUnits(cns, DECIMALS.usd6, 2)}`;

// ---------------------------------------------------------------- 1. the liquidation formula
// Docs (exchange/liquidation): a $100k BTC long at 10× with a 4 % maintenance margin liquidates at $94,000.
const btcScale = { priceDecimals: 1, lotDecimals: 5 };
const entry = EXAMPLE_ENTRY;
const oneBtc = ONE_BTC;
const exampleLong = perplOpenLiquidationPrice({
  side: "long",
  entryPricePNS: entry,
  lots: oneBtc,
  leverageHdths: LEV_10X,
  maintMarginFracHdths: MMF_4PCT,
  ...btcScale,
});
expect(exampleLong === EXAMPLE_LONG_LIQ, `docs example: $100k long 10×, 4 % MM → ${exampleLong} PNS ($94,000.0)`);
const exampleShort = perplOpenLiquidationPrice({
  side: "short",
  entryPricePNS: entry,
  lots: oneBtc,
  leverageHdths: LEV_10X,
  maintMarginFracHdths: MMF_4PCT,
  ...btcScale,
});
expect(exampleShort === EXAMPLE_SHORT_LIQ, `mirror short → ${exampleShort} PNS ($106,000.0)`);
const withFunding = perplLiquidationPrice({
  side: "long",
  entryPricePNS: entry,
  lots: oneBtc,
  depositCNS: USD_10K,
  premiumPnlCNS: USD_100,
  maintMarginFracHdths: MMF_4PCT,
  ...btcScale,
});
expect(
  withFunding === EXAMPLE_FUNDED_LIQ,
  `+$100 funding received moves the long's level to ${withFunding} PNS ($93,900.0)`,
);
const overCollateralised = perplLiquidationPrice({
  side: "long",
  entryPricePNS: entry,
  lots: oneBtc,
  depositCNS: USD_200K,
  premiumPnlCNS: 0n,
  maintMarginFracHdths: MMF_4PCT,
  ...btcScale,
});
expect(overCollateralised === null, "a long holding twice its notional has no liquidation price above 0");

// ---------------------------------------------------------------- 2. a first open, simulated
const terms = await readPerplMarketTerms(read, chainId, BTC);
const limit = perplLimitPrice(terms.markPNS, "buy", PERPL_SLIPPAGE_BPS);
const lots = perplLotsFor(MARGIN * 2n, limit, terms);
const head = await read.getBlockNumber();
const firstOpen: TxRequest[] = [
  perplApproveRequest(chainId, OPEN_FLOOR),
  perplCreateAccountRequest(chainId, OPEN_FLOOR),
  perplOrderRequest(chainId, {
    marketId: BTC,
    intent: "open",
    side: "long",
    lots,
    limitPricePNS: limit,
    leverageHdths: LEV_2X,
    headBlock: head,
  }),
];
const credit = mappingSlotOverride(PERPL_COLLATERAL[chainId], AUSD_BALANCE_BASE, FRESH, CREDIT << AUSD_BALANCE_SHIFT);
const sim = await simulatePerplSteps(read, FRESH, firstOpen, [credit]);
expect(
  sim.every((s) => s.ok),
  `approve → createAccount → IOC all succeed (${sim.map((s) => s.revert ?? "ok").join(", ")})`,
);
const fill = decodePerplOrder(sim[2]?.logs ?? [], chainId);
const opened = fill.kind === "no-order" ? undefined : fill.position.find((p) => p.kind === "opened");
expect(fill.kind === "filled" && opened !== undefined, `the order filled and opened a position (${fill.kind})`);
if (fill.kind !== "no-order" && opened?.kind === "opened") {
  const fillNotional = perplNotional(opened.lotsAfter, opened.entryPricePNS, terms);
  const initial = (fillNotional * HDTHS_PER_X) / LEV_2X;
  // Perpl books the initial margin plus the loss the fill takes against the mark (≤ maxNegPnlCollatBPS) as the deposit.
  const againstMark = fillNotional - perplNotional(opened.lotsAfter, terms.markPNS, terms);
  expect(
    opened.depositCNS >= initial,
    `position deposit ${usd(opened.depositCNS)} ≥ fill notional ${usd(fillNotional)} ÷ 2 = ${usd(initial)} (+ ${usd(opened.depositCNS - initial)} ≈ the fill's ${usd(againstMark)} against the mark) — the estimate assumes the lower bound`,
  );
  const real = perplLiquidationPrice({
    side: "long",
    entryPricePNS: opened.entryPricePNS,
    lots: opened.lotsAfter,
    depositCNS: opened.depositCNS,
    premiumPnlCNS: 0n,
    maintMarginFracHdths: terms.maintMarginFracHdths,
    priceDecimals: terms.priceDecimals,
    lotDecimals: terms.lotDecimals,
  });
  const estimate = perplOpenLiquidationPrice({
    side: "long",
    entryPricePNS: limit,
    lots,
    leverageHdths: LEV_2X,
    maintMarginFracHdths: terms.maintMarginFracHdths,
    priceDecimals: terms.priceDecimals,
    lotDecimals: terms.lotDecimals,
  });
  expect(
    real !== null && estimate !== null && estimate >= real,
    `ticket estimate ${estimate} PNS at the IOC bound ≥ the position's level ${real} PNS (never further from the mark)`,
  );
}

// ---------------------------------------------------------------- 3. how the slide confirms it
const ctx: PolicyContext = {
  chainId,
  self: FRESH,
  faceId: "off",
  marketRoomUsd6: () => undefined,
  equityUsd6: () => undefined,
  perplMarketLabel: () => "Bitcoin",
};
const none: PolicyUsage = { spentUsd6: 0n, signedAt: [] };
const judge = (requests: readonly TxRequest[], usage: PolicyUsage = none) =>
  evaluateSequence(
    requests.map((r) => ({ chainId, to: r.to, data: r.data, value: r.value ?? 0n, authorizationList: undefined })),
    ctx,
    usage,
    Date.now(),
  );
const order = (marketId: number, notional: bigint, leverageHdths: bigint, intent: "open" | "close" = "open") =>
  readPerplMarketTerms(read, chainId, marketId).then((t) => {
    const bound = perplLimitPrice(t.markPNS, intent === "open" ? "buy" : "sell", PERPL_SLIPPAGE_BPS);
    return perplOrderRequest(chainId, {
      marketId,
      intent,
      side: "long",
      lots: perplLotsFor(notional, bound, t),
      limitPricePNS: bound,
      leverageHdths,
    });
  });
expect(judge(firstOpen) === undefined, "first open, $10 at 2×: approve + account + order all sign in session");
const twelve = judge([await order(ETH, USD_120, LEV_12X)]);
expect(twelve?.reason === "over-leverage" && twelve.stepUp, `ETH at 12× → passkey (${twelve?.reason})`);
const large = judge([await order(BTC, BIG, LEV_5X)]);
expect(large?.reason === "over-trade-cap" && large.stepUp, `$300 notional → passkey (${large?.reason})`);
const bigDeposit = judge([
  perplApproveRequest(chainId, BIG),
  perplDepositRequest(chainId, BIG),
  await order(BTC, USD_20, LEV_5X),
]);
expect(
  bigDeposit?.reason === "over-move-cap" && bigDeposit.stepUp,
  `$300 move to Perpl → passkey (${bigDeposit?.reason})`,
);
const pastTotal = judge([await order(BTC, USD_150, LEV_5X)], { spentUsd6: SPENT_NEAR_TOTAL, signedAt: [] });
expect(pastTotal?.reason === "over-session-total", `$150 after $900 this session → passkey (${pastTotal?.reason})`);
expect(
  judge([await order(BTC, BIG, LEV_5X, "close"), perplWithdrawRequest(chainId, BIG)]) === undefined,
  "a $300 reduce-only close and a $300 withdrawal sign in session (never capped)",
);

// ---------------------------------------------------------------- 4. the planner, existing account
const plan = await perplOpenOperation(read, HOLDER, {
  marketId: BTC,
  side: "long",
  notionalCNS: MARGIN * 2n,
  leverageHdths: LEV_2X,
});
expect(
  plan.blocker === undefined && plan.plannedActions.join(",") === "perplOrder",
  `existing account with free collateral: ${plan.blocker ?? plan.plannedActions.join(" → ")} (no deposit)`,
);
const builder = plan.steps.at(-1);
if (typeof builder === "function") {
  const before = await read.getBlockNumber();
  const built = await builder();
  const last = BigInt(built.meta?.lastExecutionBlock ?? "0");
  expect(
    last >= before + PERPL_ORDER_TTL_BLOCKS && last <= before + PERPL_ORDER_TTL_BLOCKS + HEAD_SLACK_BLOCKS,
    `the order is built at signing time: lastExecutionBlock ${last} = head ${before} + ${PERPL_ORDER_TTL_BLOCKS}`,
  );
} else {
  expect(false, "the order step is a builder");
}

console.log(failures === 0 ? "perpl-plan-check: all checks passed" : `perpl-plan-check: ${failures} check(s) failed`);
process.exitCode = failures === 0 ? 0 : 1;
