/**
 * The any-asset gas pass on a LOCAL anvil fork of Monad mainnet (never a real network): a throwaway EOA is funded by
 * impersonated holders, live quotes are built for it, and every send goes through `@senryo/chain` (`sendTx`: estimate,
 * explicit gas under the action's budget). Each row prints `eth_estimateGas` beside the provider's own metering —
 * the source of the `aggregatorSwap` / bridge budgets in `@senryo/config` gas.ts.
 *   anvil --fork-url https://rpc.monad.xyz --network monad --port 18746
 *   MAINNET_FORK_RPC=http://127.0.0.1:18746 HYPERSYNC_API_TOKEN=… pnpm --filter @senryo/drive anyasset-check
 * Quotes price the LIVE chain, so start the fork right before the pass: a fork a few minutes behind can lack the
 * liquidity a multi-hop route uses (Monorail reverts `InsufficientLiquidity()`). FORK_CASES=label,… runs a subset.
 */
import { type ApiClient, bridgeQuoteRoute, swapQuoteRoute } from "@senryo/api-client";
import {
  createReadClient,
  createSender,
  erc20Abi,
  externalCall,
  type Hex,
  prepareAggregatorSwap,
  prepareBridgeSends,
  sendTx,
  type TxRequest,
} from "@senryo/chain";
import {
  CHAIN_IDS_ELSEWHERE,
  GAS_LIMITS,
  MAINNET_CHAIN_ID,
  MAINNET_EXTERNAL,
  MAINNET_TOKENS,
  NATIVE_TOKEN,
} from "@senryo/config";
import { anvil, freshUser } from "./fork.ts";

/** A PancakeSwap v3 XAUt0 pool on 143 (GeckoTerminal's top XAUt0 pool) — the fork's XAUt0 source. */
const XAUT0_HOLDER = "0xa5c3a55af4029724f519ac8d340be9916ac83e45";
const USER_MON = "0x3635c9adc5dea00000"; // 1,000 MON
const HOLDER_GAS_MON = "0xde0b6b3a7640000"; // 1 MON for an impersonated holder's own gas
const ADMIN_GAS = "0x30d40";
const TEN_USD6 = 10_000_000n;
const HUNDRED_MON = 100_000_000_000_000_000_000n;
/** USDC for the three USDC cases (swap, CCTP, Relay). */
const USDC_FUNDING = 30_000_000n;
const XAUT0_AMOUNT = 10_000n; // 0.01 XAUt0
const SLIPPAGE_BPS = 100;
const ATTEMPTS = 3;
/** Monorail's `InsufficientLiquidity()` selector. */
const INSUFFICIENT_LIQUIDITY = "0xbb55fd27";
/** Any valid Solana address (only the Monad-side steps run on the fork). */
const SOLANA_RECIPIENT = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM";

type Check = (ok: boolean, what: string) => void;

const only = process.env.FORK_CASES?.split(",").map((c) => c.trim().toLowerCase()) ?? [];
const selected = (label: string) => only.length === 0 || only.some((c) => label.toLowerCase().startsWith(c));

interface Row {
  case: string;
  step: string;
  estimate: string;
  limitSent: string;
  budget: string;
  providerGas: string;
}

async function warm<T>(read: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await read();
    } catch (error) {
      if (attempt >= ATTEMPTS) throw error;
    }
  }
}

export async function forkGasPass(forkUrl: string, api: ApiClient, check: Check): Promise<void> {
  console.log(`\n# fork gas pass on ${forkUrl}`);
  const fork = createReadClient(MAINNET_CHAIN_ID, { http: [forkUrl] });
  const user = freshUser();
  const sender = createSender({ chainId: MAINNET_CHAIN_ID, account: user, rpc: { http: [forkUrl] }, read: fork });
  await anvil(forkUrl, "anvil_setBalance", [user.address, USER_MON]);
  const fund = async (holder: string, token: string, amount: bigint, gas: boolean) => {
    await anvil(forkUrl, "anvil_impersonateAccount", [holder]);
    // Never overwrite the PoolManager's MON: it backs every native-MON pool's take.
    if (gas) await anvil(forkUrl, "anvil_setBalance", [holder, HOLDER_GAS_MON]);
    const call = externalCall(token as Hex, erc20Abi, "transfer", [user.address, amount], "approve");
    await anvil(forkUrl, "eth_sendTransaction", [{ from: holder, to: call.to, data: call.data, gas: ADMIN_GAS }]);
  };
  const pm = MAINNET_EXTERNAL.uniswapV4.poolManager;
  await fund(pm, MAINNET_TOKENS.usdc, USDC_FUNDING, false);
  await fund(pm, MAINNET_TOKENS.ausd, TEN_USD6 * 2n, false);
  await fund(pm, MAINNET_TOKENS.usdt0, TEN_USD6 * 2n, false);
  await fund(XAUT0_HOLDER, MAINNET_TOKENS.xaut0, XAUT0_AMOUNT * 2n, true);

  const rows: Row[] = [];
  const run = async (label: string, requests: TxRequest[], providerGas: bigint | null) => {
    for (const request of requests) {
      const estimate = await warm(() =>
        fork.estimateGas({ account: user.address, to: request.to, data: request.data, value: request.value ?? 0n }),
      );
      const budget = request.gasCap ?? GAS_LIMITS[request.action];
      const sent = await sendTx(sender, request);
      rows.push({
        case: label,
        step: request.action,
        estimate: estimate.toString(),
        limitSent: sent.gas.toString(),
        budget: budget.toString(),
        providerGas: request.action === "approve" ? "" : String(providerGas ?? ""),
      });
      check(
        sent.stage === "proposed",
        `fork ${label} ${request.action}: ${sent.stage} (estimate ${estimate} ≤ ${budget})`,
      );
    }
  };

  const swaps = [
    { label: "MON → AUSD", from: NATIVE_TOKEN, to: MAINNET_TOKENS.ausd, amount: HUNDRED_MON },
    { label: "USDC → XAUt0", from: MAINNET_TOKENS.usdc, to: MAINNET_TOKENS.xaut0, amount: TEN_USD6 },
    { label: "USDT0 → XAUt0", from: MAINNET_TOKENS.usdt0, to: MAINNET_TOKENS.xaut0, amount: TEN_USD6 },
    { label: "AUSD → MON", from: MAINNET_TOKENS.ausd, to: NATIVE_TOKEN, amount: TEN_USD6 },
  ] as const;
  for (const s of swaps.filter((x) => selected(x.label))) {
    const q = await api.call(swapQuoteRoute, {
      query: {
        chainId: MAINNET_CHAIN_ID,
        from: s.from,
        to: s.to,
        amount: s.amount,
        sender: user.address,
        slippageBps: SLIPPAGE_BPS,
      },
    });
    if (q.status !== "ok") {
      check(false, `fork ${s.label}: quoted (${q.status})`);
      continue;
    }
    const requests = await prepareAggregatorSwap(fork, user.address, {
      ...q.quote,
      tokenIn: q.from.address,
      amountIn: q.amountIn,
      gasEstimate: q.quote.gasEstimate ?? undefined,
    });
    await run(`${s.label} (${q.quote.provider})`, requests, q.quote.gasEstimate).catch((error: unknown) => {
      const message = (error instanceof Error ? error.message.split("\n")[0] : undefined) ?? String(error);
      // An order-book hop (Kuru) priced on the live chain can't fill on a fork even seconds behind it.
      if (message.includes(INSUFFICIENT_LIQUIDITY)) console.log(`~ fork ${s.label}: skipped — ${message} (fork drift)`);
      else check(false, `fork ${s.label}: ${message}`);
    });
  }

  const bridges = [
    {
      label: "USDC → Base (cctp)",
      asset: "USDC",
      toChain: CHAIN_IDS_ELSEWHERE.base,
      provider: "cctp",
      amount: TEN_USD6,
    },
    {
      label: "USDC → Base (relay)",
      asset: "USDC",
      toChain: CHAIN_IDS_ELSEWHERE.base,
      provider: "relay",
      amount: TEN_USD6,
    },
    {
      label: "AUSD → Ethereum (relay)",
      asset: "AUSD",
      toChain: CHAIN_IDS_ELSEWHERE.ethereum,
      provider: "relay",
      amount: TEN_USD6,
    },
    {
      label: "USDT0 → Arbitrum (across)",
      asset: "USDT0",
      toChain: CHAIN_IDS_ELSEWHERE.arbitrum,
      provider: "across",
      amount: TEN_USD6,
    },
    {
      label: "XAUt0 → Ethereum (lifi)",
      asset: "XAUt0",
      toChain: CHAIN_IDS_ELSEWHERE.ethereum,
      provider: "lifi",
      amount: XAUT0_AMOUNT,
    },
    {
      label: "MON → Base (relay)",
      asset: "MON",
      toChain: CHAIN_IDS_ELSEWHERE.base,
      provider: "relay",
      amount: HUNDRED_MON,
    },
    // Relay's router (USDT0 swaps in before bridging), to a Solana wallet.
    {
      label: "USDT0 → Solana (relay)",
      asset: "USDT0",
      toChain: CHAIN_IDS_ELSEWHERE.solana,
      provider: "relay",
      amount: TEN_USD6,
      recipient: SOLANA_RECIPIENT,
    },
  ] as const;
  for (const b of bridges.filter((x) => selected(x.label))) {
    const q = await api.call(bridgeQuoteRoute, {
      query: {
        fromChain: MAINNET_CHAIN_ID,
        toChain: b.toChain,
        asset: b.asset,
        amount: b.amount,
        sender: user.address,
        recipient: "recipient" in b ? b.recipient : user.address,
        provider: b.provider,
      },
    });
    if (q.status !== "ok") {
      check(false, `fork ${b.label}: quoted (${q.reason})`);
      continue;
    }
    // The fork user holds 1,000 MON; the reserve rule is enforced (LI.FI charges its bridge fee in MON).
    const requests = await prepareBridgeSends(fork, MAINNET_CHAIN_ID, user.address, q.steps);
    await run(b.label, requests, null).catch((error: unknown) =>
      check(false, `fork ${b.label}: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`),
    );
  }
  console.table(rows);
}
