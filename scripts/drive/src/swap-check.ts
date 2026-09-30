/**
 * S3.3 swap check (D-021/D-093). Read-only on Monad mainnet + a local anvil **mainnet fork** (no mainnet tx):
 *  1. find the AUSD/USDC v4 pool key onchain (StateView over candidate keys; no log scans), quote both directions
 *  2. on the fork: fund a throwaway EOA with USDC (impersonated PoolManager), Permit2-approve the Universal Router,
 *     `execute(V4_SWAP, [SWAP_EXACT_IN_SINGLE, SETTLE_ALL, TAKE_ALL])` with the 5-field ExactInputSingleParams that
 *     CollateralSwapper encodes — the output must equal the Quoter's quote at the same state.
 *   anvil --fork-url https://rpc.monad.xyz --network monad --port 18745
 *   MAINNET_FORK_RPC=http://127.0.0.1:18745 pnpm --filter @senryo/drive swap-check
 */
import {
  createReadClient,
  createSender,
  encodeExactInSingle,
  erc20Abi,
  externalCall,
  findStablePool,
  permit2Abi,
  quoteExactIn,
  sendTx,
  type TxRequest,
  universalRouterAbi,
} from "@senryo/chain";
import { MAINNET_CHAIN_ID, MAINNET_EXTERNAL } from "@senryo/config";
import { formatUnits } from "@senryo/core";
import { DEC, MS_PER_SECOND, SHOWN_DIGITS, SWAP } from "./constants.ts";
import { anvil, freshUser } from "./fork.ts";

const mainnet = createReadClient(MAINNET_CHAIN_ID);
const pool = await findStablePool(mainnet);
if (!pool) throw new Error("no AUSD/USDC v4 pool found among the candidate keys");
const usdcIn = SWAP.amountUsd6;
const usdcIsZero = pool.key.currency0 === MAINNET_EXTERNAL.usdc;
const usdcToAusd = await quoteExactIn(mainnet, pool.key, usdcIsZero, usdcIn);
const ausdToUsdc = await quoteExactIn(mainnet, pool.key, !usdcIsZero, usdcIn);
const readOnly = {
  poolKey: pool.key,
  poolId: pool.poolId,
  lpFee: pool.lpFee,
  tick: pool.tick,
  liquidity: pool.liquidity.toString(),
  quote: {
    [`${formatUnits(usdcIn, DEC.usd6, 2)} USDC → AUSD`]: formatUnits(usdcToAusd.amountOut, DEC.usd6, SHOWN_DIGITS),
    [`${formatUnits(usdcIn, DEC.usd6, 2)} AUSD → USDC`]: formatUnits(ausdToUsdc.amountOut, DEC.usd6, SHOWN_DIGITS),
  },
};
console.log(JSON.stringify(readOnly, null, 2));

const FORK = process.env.MAINNET_FORK_RPC;
if (!FORK) process.exit(0);

// ---------------------------------------------------------------- fork execution
const { usdc, ausd, uniswapV4 } = MAINNET_EXTERNAL;
const fork = createReadClient(MAINNET_CHAIN_ID, { http: [FORK] });
const user = freshUser();
await anvil(FORK, "anvil_setBalance", [user.address, SWAP.forkMon]);
await anvil(FORK, "anvil_impersonateAccount", [uniswapV4.poolManager]);
await anvil(FORK, "anvil_setBalance", [uniswapV4.poolManager, SWAP.forkMon]);
const fund = externalCall(usdc, erc20Abi, "transfer", [user.address, usdcIn], "approve");
await anvil(FORK, "eth_sendTransaction", [
  { from: uniswapV4.poolManager, to: fund.to, data: fund.data, gas: SWAP.adminGas },
]);

const sender = createSender({ chainId: MAINNET_CHAIN_ID, account: user, rpc: { http: [FORK] }, read: fork });
const send = async (label: string, request: TxRequest) => {
  const sent = await sendTx(sender, request);
  console.log(`  ✓ ${label} ${sent.stage} gas ${sent.gas}`);
  return sent;
};
await send("USDC.approve(Permit2)", externalCall(usdc, erc20Abi, "approve", [uniswapV4.permit2, usdcIn], "approve"));
const expiry = Math.floor(Date.now() / MS_PER_SECOND) + SWAP.permitTtlSec;
await send(
  "Permit2.approve(UR)",
  externalCall(
    uniswapV4.permit2,
    permit2Abi,
    "approve",
    [usdc, uniswapV4.universalRouter, usdcIn, expiry],
    "permit2Approve",
  ),
);
const quoteNow = await quoteExactIn(fork, pool.key, usdcIsZero, usdcIn);
const minOut = (quoteNow.amountOut * (SWAP.bps - SWAP.slippageBps)) / SWAP.bps;
const { commands, inputs } = encodeExactInSingle({ key: pool.key, zeroForOne: usdcIsZero, amountIn: usdcIn, minOut });
const before = await fork.readContract({
  address: ausd,
  abi: erc20Abi,
  functionName: "balanceOf",
  args: [user.address],
});
const deadline = BigInt(Math.floor(Date.now() / MS_PER_SECOND) + SWAP.permitTtlSec);
const swap = await send(
  "UR.execute(V4_SWAP exact-in single)",
  externalCall(uniswapV4.universalRouter, universalRouterAbi, "execute", [commands, inputs, deadline], "uniswapSwap"),
);
const after = await fork.readContract({
  address: ausd,
  abi: erc20Abi,
  functionName: "balanceOf",
  args: [user.address],
});
const received = after - before;
const result = {
  forkSwap: {
    tx: swap.hash,
    status: swap.stage,
    quotedAusd: formatUnits(quoteNow.amountOut, DEC.usd6, SHOWN_DIGITS),
    receivedAusd: formatUnits(received, DEC.usd6, SHOWN_DIGITS),
    matchesQuote: received === quoteNow.amountOut,
    structConfirmed: swap.stage === "proposed" && received >= minOut,
  },
};
console.log(JSON.stringify(result, null, 2));
process.exit(result.forkSwap.matchesQuote && result.forkSwap.structConfirmed ? 0 : 1);
