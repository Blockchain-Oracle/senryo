/**
 * S1b.16 spot check (J11). Read-only on Monad mainnet + optionally a local anvil **mainnet fork** (no mainnet tx):
 *  1. every listed token: its pool, USD mid price, and a $10 USDC → token quote with its impact (the smoke table)
 *  2. on the fork: fund a throwaway EOA with USDC (impersonated PoolManager) and MON (cheat), then for each token buy
 *     $10 with `prepareTokenSwap` and sell the proceeds back — every send's `eth_estimateGas` is printed (the source of
 *     the `spotSwap` / `SPOT_SWAP_GAS_PER_HOP` budgets) and each output must equal the Quoter at the same state.
 *     A second EOA delegated (EIP-7702) to Simple7702Account buys MON, so native output into a delegated account works.
 *   anvil --fork-url https://rpc.monad.xyz --network monad --port 18745
 *   MAINNET_FORK_RPC=http://127.0.0.1:18745 pnpm --filter @senryo/drive spot-check
 */
import {
  createReadClient,
  createSender,
  erc20Abi,
  externalCall,
  prepareTokenSwap,
  quoteSpot,
  type ReadClient,
  readSpotHoldings,
  readSpotPrices,
  type SpotSide,
  sendTx,
  spotMinOut,
  spotPath,
} from "@senryo/chain";
import { MAINNET_CHAIN_ID, MAINNET_EXTERNAL, SPOT_REFERENCE_USD, SPOT_TOKENS, type SpotToken } from "@senryo/config";
import { formatUnits, ONE_USD6 } from "@senryo/core";
import { DEC, SHOWN_DIGITS, SPOT } from "./constants.ts";
import { anvil, freshUser } from "./fork.ts";

const PIPS_PER_BP = 100;
const JSON_INDENT = 2;
const HOPS = { one: 1, two: 2, three: 3 } as const;
const mainnet = createReadClient(MAINNET_CHAIN_ID);

// ---------------------------------------------------------------- 1. read-only smoke on mainnet
const prices = await readSpotPrices(mainnet, SPOT_TOKENS);
const smoke = [];
for (const { token, priceUsd18 } of prices) {
  const q = await quoteSpot(mainnet, token, "buy", SPOT.smokeUsd6);
  smoke.push({
    token: token.symbol,
    pool: `${token.quote} ${token.pool.key.fee / PIPS_PER_BP} bps · ts ${token.pool.key.tickSpacing} · ${token.pool.poolId.slice(0, 10)}…`,
    hops: token.route.length,
    priceUsd: priceUsd18 === undefined ? "—" : formatUnits(priceUsd18, DEC.e18, SPOT.priceDigits),
    "$10 USDC →": `${formatUnits(q.amountOut, token.decimals, SPOT.amountDigits)} ${token.symbol}`,
    feesBps: q.feeBps.toString(),
    impactBps: q.priceImpactBps.toString(),
  });
}
console.table(smoke);

const FORK = process.env.MAINNET_FORK_RPC;
if (!FORK) process.exit(0);

// ---------------------------------------------------------------- 2. fork execution + gas
const { usdc, uniswapV4 } = MAINNET_EXTERNAL;
const fork = createReadClient(MAINNET_CHAIN_ID, { http: [FORK] });

async function fundUser() {
  const user = freshUser();
  await anvil(FORK as string, "anvil_setBalance", [user.address, SPOT.forkMon]);
  // The PoolManager pays the impersonated transfer's gas from its own MON — never overwrite that balance: it backs
  // every native-MON pool's take.
  await anvil(FORK as string, "anvil_impersonateAccount", [uniswapV4.poolManager]);
  const fund = externalCall(usdc, erc20Abi, "transfer", [user.address, SPOT.forkUsdc6], "approve");
  await anvil(FORK as string, "eth_sendTransaction", [
    { from: uniswapV4.poolManager, to: fund.to, data: fund.data, gas: SPOT.adminGas },
  ]);
  return user;
}

/** The fork pulls cold storage from the live RPC on first touch; a large swap's first read can outlast the 4 s timeout. */
async function warm<T>(read: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await read();
    } catch (error) {
      if (attempt >= SPOT.forkAttempts) throw error;
    }
  }
}

const balanceOf = async (read: ReadClient, owner: `0x${string}`, token: SpotToken | "USDC") => {
  if (token === "USDC")
    return warm(() => read.readContract({ address: usdc, abi: erc20Abi, functionName: "balanceOf", args: [owner] }));
  const [held] = await warm(() => readSpotHoldings(read, owner, [token]));
  return held?.balance ?? 0n;
};

interface GasRow {
  token: string;
  side: SpotSide;
  hops: number;
  step: string;
  usd: number;
  estimate: number;
  quoteGas: number;
  sent: number;
}
const gasRows: GasRow[] = [];
const outcomes: Array<{ token: string; side: SpotSide; quoted: string; received: string; matches: boolean }> = [];

/** One swap through the builder: estimate + send each request, then compare the output with the pre-send quote. */
async function swap(
  user: ReturnType<typeof freshUser>,
  token: SpotToken,
  side: SpotSide,
  amountIn: bigint,
  usdIn: bigint,
) {
  const sender = createSender({
    chainId: MAINNET_CHAIN_ID,
    account: user,
    rpc: { http: [FORK as string] },
    read: fork,
  });
  const quote = await warm(() => quoteSpot(fork, token, side, amountIn));
  const requests = await warm(() =>
    prepareTokenSwap(fork, user.address, {
      token,
      side,
      amountIn,
      minOut: spotMinOut(quote.amountOut),
      recipient: user.address,
      quoteGas: quote.gasEstimate,
    }),
  );
  const outToken = side === "buy" ? token : "USDC";
  const before = await balanceOf(fork, user.address, outToken);
  let gasPaid = 0n;
  for (const request of requests) {
    const estimate = await warm(() =>
      fork.estimateGas({ account: user.address, to: request.to, data: request.data, value: request.value ?? 0n }),
    );
    const sent = await sendTx(sender, request);
    if (sent.stage !== "proposed") throw new Error(`${token.symbol} ${side} ${request.meta?.step}: ${sent.stage}`);
    // Monad charges the gas LIMIT, not gas used (differences-from-ethereum.md §1; anvil --network monad does too).
    gasPaid += sent.gas * sent.receipt.effectiveGasPrice;
    gasRows.push({
      token: token.symbol,
      side,
      hops: spotPath(token, side).path.length,
      step: request.meta?.step ?? request.action,
      usd: Number(usdIn / ONE_USD6),
      estimate: Number(estimate),
      quoteGas: Number(quote.gasEstimate),
      sent: Number(sent.gas),
    });
  }
  const after = await balanceOf(fork, user.address, outToken);
  // A native-MON output arrives in the same account that paid the gas: add the gas back to see the swap's output.
  const nativeOut = side === "buy" && token.native;
  const received = after - before + (nativeOut ? gasPaid : 0n);
  const decimals = side === "buy" ? token.decimals : DEC.usd6;
  outcomes.push({
    token: token.symbol,
    side,
    quoted: formatUnits(quote.amountOut, decimals, SHOWN_DIGITS),
    received: formatUnits(received, decimals, SHOWN_DIGITS),
    matches: received === quote.amountOut,
  });
  return received;
}

// $10, the listing's $1,000 reference size and 10× it (more ticks crossed → the budget's worst case), each sold back.
const user = await fundUser();
const reference = BigInt(SPOT_REFERENCE_USD) * ONE_USD6;
for (const usd6 of [SPOT.smokeUsd6, reference, reference * SPOT.largeMultiple]) {
  for (const token of SPOT_TOKENS) {
    const bought = await swap(user, token, "buy", usd6, usd6);
    await swap(user, token, "sell", bought, usd6);
  }
}

// Native MON into an EIP-7702-delegated account (its delegate's receive() runs on the TAKE).
const delegated = await fundUser();
await anvil(FORK, "anvil_setCode", [delegated.address, `${SPOT.eip7702Designator}${SPOT.simple7702Account.slice(2)}`]);
const mon = SPOT_TOKENS.find((t) => t.native);
if (mon) await swap(delegated, mon, "buy", SPOT.smokeUsd6, SPOT.smokeUsd6);

console.table(gasRows);
console.table(outcomes);
const worst = (hops: number, step: string) =>
  Math.max(0, ...gasRows.filter((r) => r.hops === hops && r.step === step).map((r) => r.estimate));
console.log(
  JSON.stringify(
    {
      maxEstimate: {
        approve: Math.max(0, ...gasRows.filter((r) => r.step === "approve").map((r) => r.estimate)),
        permit2Approve: Math.max(0, ...gasRows.filter((r) => r.step === "permit2Approve").map((r) => r.estimate)),
        execute1Hop: worst(HOPS.one, "execute"),
        execute2Hops: worst(HOPS.two, "execute"),
        execute3Hops: worst(HOPS.three, "execute"),
      },
      allMatchQuote: outcomes.every((o) => o.matches),
    },
    null,
    JSON_INDENT,
  ),
);
process.exit(outcomes.every((o) => o.matches) ? 0 : 1);
