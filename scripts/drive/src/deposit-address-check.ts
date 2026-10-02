/**
 * B4 deposit-address check — live and read-only (a Relay quote opens an address; nothing is signed, sent or funded).
 * The any-asset routes run in-process (services/api/scripts/anyasset-harness.ts) and are called through
 * `@senryo/api-client`, as the app does:
 *  1. open deposit addresses into the user's Monad wallet for USDC (Base), AUSD (Arbitrum, from USDC), MON (Base, from
 *     ETH) and USDT0 (Ethereum, from USDT): an EVM address on the origin chain, the recipient bound to the wallet,
 *     0 < minimum ≤ expected, and a status URL;
 *  2. the refusal rule: Relay's own quote, re-pointed at another recipient / asset / chain / deposit step, is refused;
 *  3. what isn't served says so: Practice ("Mainnet only"), XAUt0 (no Relay solver for XAUT), a chain off the route
 *     table (Solana / Bitcoin origins also need RELAY_API_KEY: Relay answers "missing an api key" without one);
 *  4. tracking by address: a fresh address lists no deposits; a known open address (Relay's docs sample, Polygon →
 *     Base) lists its delivered request with both tx hashes.
 *   pnpm --filter @senryo/drive deposit-address-check
 */
import { bridgeDepositAddressRoute, bridgeDepositStatusRoute } from "@senryo/api-client";
import { getAddress } from "@senryo/chain";
import { CHAIN_IDS_ELSEWHERE, MAINNET_CHAIN_ID, RELAY_API, TESTNET_CHAIN_ID } from "@senryo/config";
import { formatUnits } from "@senryo/core";
import { openAnyAssetHarness } from "../../../services/api/scripts/anyasset-harness.ts";
import { depositRefusal } from "../../../services/api/src/anyasset/bridge/deposit-address.ts";

const ME = getAddress(process.env.ADDRESS ?? "0xeed8e68dd4c7886a8e964ce512262cebcf813c0a");
const OTHER = "0x00000000000000000000000000000000000000Aa";
const TEN_USD6 = 10_000_000n;
const ETH_005 = 5_000_000_000_000_000n;
const XAUT_001 = 10_000n;
const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;
/** Relay's documented open deposit address (Polygon USDC → Base), delivered in April 2026. */
const SAMPLE_ADDRESS = "0xb353e49aa47514fb579d6ba6594c768379a96515";
const POLYGON = 137;
const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const MONAD_USDC = "0x754704Bc059F8C67012fEd69BC8A327a5aafb603";

const failures: string[] = [];
function check(ok: boolean, what: string): void {
  console.log(`${ok ? "✓" : "✗"} ${what}`);
  if (!ok) failures.push(what);
}

const live = await openAnyAssetHarness({});

// ---------------------------------------------------------------- 1. open addresses into Monad
const cases = [
  { label: "USDC from Base", fromChain: CHAIN_IDS_ELSEWHERE.base, asset: "USDC", amount: TEN_USD6 },
  {
    label: "AUSD from Arbitrum (USDC)",
    fromChain: CHAIN_IDS_ELSEWHERE.arbitrum,
    asset: "AUSD",
    amount: TEN_USD6,
    remote: "USDC",
  },
  {
    label: "MON from Base (ETH)",
    fromChain: CHAIN_IDS_ELSEWHERE.base,
    asset: "MON",
    amount: ETH_005,
    remote: "NATIVE",
  },
  { label: "USDT0 from Ethereum (USDT)", fromChain: CHAIN_IDS_ELSEWHERE.ethereum, asset: "USDT0", amount: TEN_USD6 },
] as const;
let fresh: string | undefined;
for (const c of cases) {
  console.log(`\n# ${c.label}`);
  const r = await live.api.call(bridgeDepositAddressRoute, {
    body: {
      fromChain: c.fromChain,
      toChain: MAINNET_CHAIN_ID,
      asset: c.asset,
      amount: c.amount,
      recipient: ME,
      ...("remote" in c ? { remote: c.remote } : {}),
    },
  });
  check(r.status === "ok", `${c.label}: deposit address issued`);
  if (r.status !== "ok") {
    console.log(r);
    continue;
  }
  fresh ??= r.depositAddress;
  console.log(
    `send ${formatUnits(r.amountIn, r.remote.decimals, r.remote.decimals)} ${r.remote.symbol} to ${r.depositAddress}`,
    `→ ${formatUnits(r.amountOut, r.out.decimals, r.out.decimals)} ${r.out.symbol} (min ${formatUnits(r.minReceived, r.out.decimals, r.out.decimals)})`,
    `~${r.etaSec}s · request ${r.requestId} · order deadline ${r.addressExpiresAt}`,
  );
  check(EVM_ADDRESS.test(r.depositAddress), `${c.label}: an EVM address on the origin chain`);
  check(r.recipient === ME && r.mode === "open", `${c.label}: open, bound to the user's wallet`);
  check(r.minReceived > 0n && r.minReceived <= r.amountOut, `${c.label}: 0 < minimum ≤ expected`);
  check(r.statusUrl.includes(r.depositAddress), `${c.label}: tracked by address`);
}

// ---------------------------------------------------------------- 2. the refusal rule on Relay's own quote
console.log("\n# refusal rule");
const raw = await fetch(`${RELAY_API}/quote/v2`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    user: "0x0000000000000000000000000000000000000000",
    recipient: ME,
    originChainId: CHAIN_IDS_ELSEWHERE.base,
    destinationChainId: MAINNET_CHAIN_ID,
    originCurrency: BASE_USDC,
    destinationCurrency: MONAD_USDC,
    amount: TEN_USD6.toString(),
    tradeType: "EXACT_INPUT",
    useDepositAddress: true,
    refundTo: "0x0000000000000000000000000000000000000000",
  }),
}).then((r) => r.json());
const origin = { chainId: CHAIN_IDS_ELSEWHERE.base, token: BASE_USDC };
// biome-ignore lint/suspicious/noExplicitAny: a raw provider body, re-shaped below to provoke each refusal
const q = raw as any;
const clone = () => JSON.parse(JSON.stringify(q));
check(depositRefusal(q, ME, MONAD_USDC, origin) === null, "Relay's quote as given is accepted");
const otherRecipient = clone();
otherRecipient.details.recipient = OTHER;
check(depositRefusal(otherRecipient, ME, MONAD_USDC, origin) !== null, "another recipient is refused");
const otherPayment = clone();
otherPayment.protocol.v2.orderData.output.payments[0].recipient = OTHER;
check(depositRefusal(otherPayment, ME, MONAD_USDC, origin) !== null, "an order paying someone else is refused");
const otherAsset = clone();
otherAsset.details.currencyOut.currency.address = BASE_USDC;
check(depositRefusal(otherAsset, ME, MONAD_USDC, origin) !== null, "another asset is refused");
const otherStep = clone();
otherStep.steps[0].items[0].data.to = OTHER;
check(depositRefusal(otherStep, ME, MONAD_USDC, origin) !== null, "a deposit step paying elsewhere is refused");

// ---------------------------------------------------------------- 3. what isn't served says so
const refused = [
  { label: "Practice", fromChain: CHAIN_IDS_ELSEWHERE.sepolia, toChain: TESTNET_CHAIN_ID, asset: "USDC" },
  { label: "XAUt0 from Ethereum", fromChain: CHAIN_IDS_ELSEWHERE.ethereum, toChain: MAINNET_CHAIN_ID, asset: "XAUt0" },
  { label: "USDC from an unlisted chain", fromChain: 1_101, toChain: MAINNET_CHAIN_ID, asset: "USDC" },
] as const;
for (const c of refused) {
  const r = await live.api.call(bridgeDepositAddressRoute, {
    body: {
      fromChain: c.fromChain,
      toChain: c.toChain,
      asset: c.asset,
      amount: c.asset === "XAUt0" ? XAUT_001 : TEN_USD6,
      recipient: ME,
    },
  });
  check(r.status === "unsupported", `${c.label}: unsupported (${r.status === "unsupported" ? r.reason : "issued"})`);
}

// ---------------------------------------------------------------- 4. tracking by address
if (fresh) {
  const s = await live.api.call(bridgeDepositStatusRoute, {
    query: { fromChain: CHAIN_IDS_ELSEWHERE.base, depositAddress: fresh },
  });
  check(s.deposits.length === 0, "a fresh address lists no deposits yet");
}
const sample = await live.api.call(bridgeDepositStatusRoute, {
  query: { fromChain: POLYGON, depositAddress: SAMPLE_ADDRESS },
});
const done = sample.deposits.find((d) => d.state === "delivered");
console.log(sample.deposits.map((d) => `${d.state} in ${d.amountIn} out ${d.amountOut} ${d.sourceTxHash}`));
check(
  done !== undefined && done.sourceTxHash !== null && done.destinationTxHash !== null && done.amountIn !== null,
  "a delivered deposit reads delivered with its amounts and both tx hashes",
);

await live.close();
console.log(
  failures.length === 0 ? "\nall checks passed" : `\n${failures.length} check(s) failed:\n- ${failures.join("\n- ")}`,
);
process.exit(failures.length === 0 ? 0 : 1);
