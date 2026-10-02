/**
 * D6/D2 any-asset check — live and read-only (nothing is signed or sent on any network). The any-asset routes run
 * in-process (services/api/scripts/anyasset-harness.ts) and are called through `@senryo/api-client`, as the apps do:
 *  1. holdings of an active mainnet address (HyperSync, one query at most — a 429 exercises the fallback) and of a
 *     Practice address (token-list path, no prices);
 *  2. swap quotes MON → AUSD and USDT0 → XAUt0: pinned router, minimum ≤ expected, XAU feed as XAUt0's reference;
 *     the send lists built from them, and an unpinned router refused; Practice answers `unsupported`;
 *  3. bridges: the USDC out-route picker, a USDC → Base CCTP v2 quote, an AUSD → Ethereum Relay quote, their Monad
 *     send lists, and a status read;
 *  4. with MAINNET_FORK_RPC, the gas pass on a local anvil fork (anyasset-fork.ts).
 *   HYPERSYNC_API_TOKEN=… pnpm --filter @senryo/drive anyasset-check     (ADDRESS=0x… picks another holder)
 *   FORK_ONLY=1 MAINNET_FORK_RPC=… [FORK_CASES=label,…] runs only the fork gas pass.
 */
import {
  type BridgeQuoteOk,
  bridgeQuoteRoute,
  bridgeRoutesRoute,
  bridgeStatusRoute,
  holdingsRoute,
  type SwapQuoteOk,
  swapQuoteRoute,
} from "@senryo/api-client";
import { buildAggregatorSwap, buildBridgeSends, getAddress, UnpinnedTargetError } from "@senryo/chain";
import {
  BRIDGE_CONTRACTS,
  CCTP_TOKEN_MESSENGER,
  CHAIN_IDS_ELSEWHERE,
  isPinnedSwapRouter,
  MAINNET_CHAIN_ID,
  MAINNET_TOKENS,
  NATIVE_TOKEN,
  TESTNET_CHAIN_ID,
} from "@senryo/config";
import { formatUnits } from "@senryo/core";
import { openAnyAssetHarness } from "../../../services/api/scripts/anyasset-harness.ts";
import { forkGasPass } from "./anyasset-fork.ts";

/** A busy mainnet EOA (EIP-7702-delegated, ~17k txs, USDC flows on 2 Oct). */
const ADDRESS = getAddress(process.env.ADDRESS ?? "0xeed8e68dd4c7886a8e964ce512262cebcf813c0a");
/** The Practice deployer (holds mock AUSD/USDC on 10143). */
const PRACTICE_ADDRESS = getAddress(process.env.PRACTICE_ADDRESS ?? "0x52d205731E97C90aAB738AE66371449F585C0E6A");
const TEN_MON = 10_000_000_000_000_000_000n;
const TEN_USD6 = 10_000_000n;
const SLIPPAGE_BPS = 50;
const SHOWN = 4;
const USD_SHOWN = 2;
const USD6 = 6;
const ROWS = 12;
const DUMMY_REQUEST = "0x1111111111111111111111111111111111111111111111111111111111111111";
/** No contract we pin — the send-list builder must refuse it. */
const BOGUS_ROUTER = "0xdEdEdEdEdEdEdEdEdEdEdEdEdEdEdEdEdEdEdEdE";

const failures: string[] = [];
function check(ok: boolean, what: string): void {
  console.log(`${ok ? "✓" : "✗"} ${what}`);
  if (!ok) failures.push(what);
}

const live = await openAnyAssetHarness({
  hypersyncToken: process.env.HYPERSYNC_API_TOKEN,
  alchemyKey: process.env.ALCHEMY_API_KEY,
  auroraKey: process.env.AURORA_API_KEY,
});
// Practice without a HyperSync token: the token-list path, and no second query against the shared budget.
const practice = await openAnyAssetHarness({});

// FORK_ONLY=1 with MAINNET_FORK_RPC: just the gas pass (run it right after starting the fork).
if (process.env.FORK_ONLY && process.env.MAINNET_FORK_RPC) {
  await forkGasPass(process.env.MAINNET_FORK_RPC, live.api, check);
  await live.close();
  await practice.close();
  console.log(failures.length === 0 ? "\nfork pass ok" : `\n${failures.length} fork check(s) failed`);
  process.exit(failures.length === 0 ? 0 : 1);
}

// ---------------------------------------------------------------- 1. holdings
console.log(`\n# holdings ${ADDRESS} on ${MAINNET_CHAIN_ID}`);
const h = await live.api.call(holdingsRoute, { query: { chainId: MAINNET_CHAIN_ID, address: ADDRESS } });
console.log(`discovery: ${h.discovery.source} complete=${h.discovery.complete} note=${h.discovery.note ?? "—"}`);
console.table(
  h.tokens.slice(0, ROWS).map((t) => ({
    symbol: t.symbol,
    verified: t.verified,
    lookalike: t.lookalike,
    balance: formatUnits(t.balance, t.decimals, SHOWN),
    usd: t.valueUsd6 === null ? "—" : formatUnits(t.valueUsd6, USD6, USD_SHOWN),
    logo: t.logoUrl ? "url" : "monogram",
  })),
);
console.log(`${h.tokens.length} tokens, total $${formatUnits(h.totalUsd6, USD6, USD_SHOWN)} partial=${h.partial}`);
if (h.discovery.source !== "hypersync") console.log("  (HyperSync didn't answer: fallback path exercised)");
check(h.tokens.length > 0, "holdings list tokens");
check(
  h.tokens.every((t) => t.balance > 0n),
  "no zero balances",
);
check(
  h.tokens.filter((t) => !t.verified).every((t) => t.priceUsd18 === null && t.valueUsd6 === null),
  "unverified tokens carry no price",
);
const firstUnverified = h.tokens.findIndex((t) => !t.verified);
check(firstUnverified === -1 || h.tokens.slice(firstUnverified).every((t) => !t.verified), "verified tokens first");
check(
  h.totalUsd6 === h.tokens.filter((t) => t.verified).reduce((s, t) => s + (t.valueUsd6 ?? 0n), 0n),
  "total = Σ verified values",
);
check(
  h.tokens.some((t) => t.native),
  "native MON listed",
);

console.log(`\n# holdings ${PRACTICE_ADDRESS} on ${TESTNET_CHAIN_ID}`);
const p = await practice.api.call(holdingsRoute, { query: { chainId: TESTNET_CHAIN_ID, address: PRACTICE_ADDRESS } });
console.log(p.tokens.map((t) => `${t.symbol}${t.verified ? "" : "?"} ${formatUnits(t.balance, t.decimals, SHOWN)}`));
check(!p.pricesAvailable && p.tokens.every((t) => t.priceUsd18 === null), "Practice holdings carry no prices");
check(p.discovery.source === "tokenlist" && !p.discovery.complete, "no token → token-list discovery, flagged partial");

// ---------------------------------------------------------------- 2. swap quotes
const swaps = [
  { label: "MON → AUSD", from: NATIVE_TOKEN, to: MAINNET_TOKENS.ausd, amount: TEN_MON },
  { label: "USDT0 → XAUt0", from: MAINNET_TOKENS.usdt0, to: MAINNET_TOKENS.xaut0, amount: TEN_USD6 },
] as const;
const quotes: SwapQuoteOk[] = [];
for (const s of swaps) {
  console.log(`\n# swap ${s.label}`);
  const q = await live.api.call(swapQuoteRoute, {
    query: {
      chainId: MAINNET_CHAIN_ID,
      from: s.from,
      to: s.to,
      amount: s.amount,
      sender: ADDRESS,
      slippageBps: SLIPPAGE_BPS,
    },
  });
  check(q.status === "ok", `${s.label}: quoted`);
  if (q.status !== "ok") {
    console.log(q);
    continue;
  }
  quotes.push(q);
  const c = q.quote;
  console.log(
    `${c.provider} → ${formatUnits(c.amountOut, q.to.decimals, q.to.decimals)} ${q.to.symbol} (min ${formatUnits(c.minOut, q.to.decimals, q.to.decimals)})`,
    `impact provider=${c.providerImpactBps} reference=${c.referenceImpactBps} judged=${c.impact} via ${c.impactSource}`,
    `gas ${c.gasEstimate} → limit ${c.gasLimit} · route ${c.route.map((r) => r.venues.join("|")).join(" > ")}`,
  );
  console.log("alternatives", q.alternatives);
  check(isPinnedSwapRouter(c.router, c.provider), `${s.label}: router ${c.router} is pinned`);
  check(c.minOut > 0n && c.minOut <= c.amountOut, `${s.label}: 0 < minOut ≤ amountOut`);
  const sends = buildAggregatorSwap({
    quote: { ...c, tokenIn: q.from.address, amountIn: q.amountIn, gasEstimate: c.gasEstimate ?? undefined },
    allowance: 0n,
  });
  const native = q.from.address === NATIVE_TOKEN;
  check(
    sends.map((r) => r.action).join(",") === (native ? "aggregatorSwap" : "approve,aggregatorSwap"),
    `${s.label}: send list ${sends.map((r) => r.action).join(" → ")}`,
  );
  let refused = false;
  try {
    buildAggregatorSwap({
      quote: { ...c, router: getAddress(BOGUS_ROUTER), tokenIn: q.from.address, amountIn: q.amountIn },
    });
  } catch (error) {
    refused = error instanceof UnpinnedTargetError;
  }
  check(refused, `${s.label}: an unpinned router is refused`);
}
const xaut = quotes.find((q) => q.to.address === getAddress(MAINNET_TOKENS.xaut0));
check(xaut?.reference.sourceOut === "xau-feed", "XAUt0 is referenced to the XAU/USD feed");
const tq = await live.api.call(swapQuoteRoute, {
  query: {
    chainId: TESTNET_CHAIN_ID,
    from: NATIVE_TOKEN,
    to: MAINNET_TOKENS.ausd,
    amount: TEN_MON,
    sender: ADDRESS,
    slippageBps: SLIPPAGE_BPS,
  },
});
check(tq.status === "unsupported", "Practice swap quote answers unsupported");

// ---------------------------------------------------------------- 3. bridges
console.log("\n# bridge routes USDC out (Mainnet)");
const routes = await live.api.call(bridgeRoutesRoute, {
  query: { chainId: MAINNET_CHAIN_ID, asset: "USDC", direction: "out" },
});
console.log(
  routes.chains.map((c) => `${c.name}[${c.providers.map((x) => x.provider).join("/")}]`).join(" "),
  routes.aurora,
);
check(
  routes.chains.some((c) => c.chainId === CHAIN_IDS_ELSEWHERE.base && c.providers.some((x) => x.provider === "cctp")),
  "USDC → Base offers CCTP",
);

async function bridge(label: string, query: Parameters<typeof live.api.call<typeof bridgeQuoteRoute>>[1]["query"]) {
  console.log(`\n# bridge ${label}`);
  const b = await live.api.call(bridgeQuoteRoute, { query });
  check(b.status === "ok", `${label}: quoted`);
  if (b.status !== "ok") {
    console.log(b);
    return undefined;
  }
  console.log(
    `${b.provider}: ${formatUnits(b.amountOut, b.out.decimals, b.out.decimals)} ${b.out.symbol} (min ${formatUnits(b.minReceived, b.out.decimals, b.out.decimals)}) in ~${b.etaSec}s`,
    b.fees.map((f) => `${f.kind} ${formatUnits(f.amount, f.decimals, f.decimals)} ${f.symbol}`),
    b.steps.map((st) => (st.kind === "approve" ? `approve→${st.spender}` : `${st.action}→${st.to}`)),
    "alternatives",
    b.alternatives,
  );
  check(b.minReceived > 0n && b.minReceived <= b.amountOut, `${label}: 0 < minReceived ≤ amountOut`);
  const sends = buildBridgeSends(MAINNET_CHAIN_ID, b.steps, [0n]);
  check(
    sends.length === b.steps.length,
    `${label}: ${sends.length} Monad sends built (${sends.map((r) => r.action).join(" → ")})`,
  );
  return b;
}
const base = { amount: TEN_USD6, sender: ADDRESS, recipient: ADDRESS } as const;
const cctp: BridgeQuoteOk | undefined = await bridge("USDC → Base (CCTP v2)", {
  ...base,
  fromChain: MAINNET_CHAIN_ID,
  toChain: CHAIN_IDS_ELSEWHERE.base,
  asset: "USDC",
  provider: "cctp",
});
const messenger = CCTP_TOKEN_MESSENGER[MAINNET_CHAIN_ID].toLowerCase();
check(
  cctp?.steps.every((st) => (st.kind === "approve" ? st.spender : st.to).toLowerCase() === messenger) ?? false,
  "CCTP steps target TokenMessengerV2",
);
const relay = await bridge("AUSD → Ethereum (Relay)", {
  ...base,
  fromChain: MAINNET_CHAIN_ID,
  toChain: CHAIN_IDS_ELSEWHERE.ethereum,
  asset: "AUSD",
});
check(relay?.provider === "relay" && relay.tracking.id !== null, "Relay quote carries its request id");
check(
  relay?.steps.some(
    (st) => st.kind === "call" && st.to.toLowerCase() === BRIDGE_CONTRACTS[MAINNET_CHAIN_ID].relayDepository,
  ) ?? false,
  "Relay deposit goes to the pinned depository",
);
if (relay?.tracking.id) {
  const status = await live.api.call(bridgeStatusRoute, {
    query: {
      route: "relay",
      id: relay.tracking.id,
      fromChain: MAINNET_CHAIN_ID,
      toChain: CHAIN_IDS_ELSEWHERE.ethereum,
    },
  });
  console.log("relay status (never sent):", status.state, status.providerStatus);
  check(status.state === "pending" || status.state === "unknown", "an unsent Relay request reads pending/unknown");
}
const cctpStatus = await live.api.call(bridgeStatusRoute, {
  query: { route: "cctp", id: DUMMY_REQUEST, fromChain: MAINNET_CHAIN_ID, toChain: CHAIN_IDS_ELSEWHERE.base },
});
check(cctpStatus.state === "unknown", "an unknown CCTP burn reads unknown");
const practiceRoutes = await practice.api.call(bridgeRoutesRoute, {
  query: { chainId: TESTNET_CHAIN_ID, asset: "USDC", direction: "out" },
});
check(
  practiceRoutes.chains.length > 0 &&
    practiceRoutes.chains.every((c) => c.providers.every((x) => x.provider === "cctp")),
  "Practice USDC routes are CCTP only",
);

// ---------------------------------------------------------------- 4. fork gas pass (local anvil only)
if (process.env.MAINNET_FORK_RPC) await forkGasPass(process.env.MAINNET_FORK_RPC, live.api, check);

await live.close();
await practice.close();
console.log(
  failures.length === 0 ? "\nall checks passed" : `\n${failures.length} check(s) failed:\n- ${failures.join("\n- ")}`,
);
process.exit(failures.length === 0 ? 0 : 1);
