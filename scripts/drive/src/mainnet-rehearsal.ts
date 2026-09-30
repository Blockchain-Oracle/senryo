/**
 * S8.18 rehearsal on an anvil fork of Monad MAINNET (143) after `Deploy.s.sol` + `SeedMainnet.s.sol` ran against the
 * fork (a throwaway worktree holds the fork's `143.json` — never commit it): the apps' composition end to end on the
 * real Chainlink feeds, calendar, AUSD/USDC and Uniswap v4 pool — fund (AUSD lent by the PoolManager via
 * impersonation), deposit, XAU long → close, collateral swap AUSD → USDC, LP deposit + redeem request.
 * Run (from the rehearsal worktree): FORK_RPC=http://127.0.0.1:18766 pnpm exec tsx src/mainnet-rehearsal.ts
 */
import { AccountClient, defaultFaceIdMode, type PolicyContext, queuedNonces } from "@senryo/account";
import {
  addressOf,
  CONTRACT_ABIS,
  contractCall,
  createReadClient,
  createSender,
  externalCall,
  findStablePool,
  LocalNonceSource,
  MemoryJournal,
  quoteExactIn,
  readAccountSnapshot,
  readLpVault,
  readMarketRisk,
  readPositions,
  sendAndFinalize,
} from "@senryo/chain";
import { MAINNET_CHAIN_ID, MAINNET_EXTERNAL, RP_ID } from "@senryo/config";
import { capHeadroomUsd6, previewDecrease, previewIncrease, RISK } from "@senryo/core";
import {
  closeRequest,
  increaseRequest,
  lpApproveRequest,
  lpDepositRequest,
  lpRequestRedeemRequest,
  riskViewOf,
  sendTracked,
  swapCollateralRequest,
} from "@senryo/query";
import { memoryStore, VirtualAuthenticator } from "./fake-passkey.ts";
import { anvil } from "./fork.ts";

const FORK = process.env.FORK_RPC ?? "http://127.0.0.1:18766";
const CHAIN = MAINNET_CHAIN_ID;
const RICH = "0x8ac7230489e80000";
const FUND_USD6 = 60_000_000n;
const DEPOSIT_USD6 = 30_000_000n;
const TRADE_USD6 = 20_000_000n;
const SWAP_USD6 = 5_000_000n;
const LP_USD6 = 5_000_000n;
const XAU = 0;
/** 10 bps under the quote, as the app does (SWAP_SLIPPAGE_BPS). */
const SWAP_SLIPPAGE_BPS = 10n;

const checks: Record<string, boolean> = {};
const record = (name: string, ok: boolean, detail = "") => {
  checks[name] = ok;
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const auth = new VirtualAuthenticator();
const client = new AccountClient({ rpId: RP_ID, passkey: { kind: "web", webAuthnClient: auth }, store: memoryStore() });
const address = await client.create();
await anvil(FORK, "anvil_setBalance", [address, RICH]);
// Lend the fork user AUSD from the Uniswap v4 PoolManager (fork-only impersonation).
const pm = MAINNET_EXTERNAL.uniswapV4.poolManager;
await anvil(FORK, "anvil_impersonateAccount", [pm]);
await anvil(FORK, "anvil_setBalance", [pm, RICH]);
const lend = externalCall(MAINNET_EXTERNAL.ausd, CONTRACT_ABIS.MockAUSD, "transfer", [address, FUND_USD6], "transfer");
await anvil(FORK, "eth_sendTransaction", [{ from: pm, to: lend.to, data: lend.data }]);

const read = createReadClient(CHAIN, { http: [FORK] });
const nonces = queuedNonces(new LocalNonceSource(read));
const base = (): PolicyContext => ({
  chainId: CHAIN,
  self: address,
  faceId: defaultFaceIdMode("mainnet"),
  marketRoomUsd6: () => undefined,
  equityUsd6: () => undefined,
});
const senderWith = (ctx: () => PolicyContext) =>
  createSender({
    chainId: CHAIN,
    account: client.signer(ctx),
    read,
    rpc: { http: [FORK] },
    nonces,
    journal: new MemoryJournal(),
  });
const plain = senderWith(base);
const core = addressOf(CHAIN, "SenryoCore");

await sendAndFinalize(
  plain,
  externalCall(MAINNET_EXTERNAL.ausd, CONTRACT_ABIS.MockAUSD, "approve", [core, DEPOSIT_USD6], "approve"),
);
await sendAndFinalize(
  plain,
  contractCall(CHAIN, "SenryoCore", "deposit", [MAINNET_EXTERNAL.ausd, DEPOSIT_USD6], "deposit"),
);
const funded = await readAccountSnapshot(read, CHAIN, address, "latest");
record(
  "mainnet deposit (real AUSD, in scope)",
  funded.ausd === DEPOSIT_USD6 && auth.ceremonies === 1,
  `equity ${funded.equityInit}`,
);

const xau = await readMarketRisk(read, CHAIN, XAU, "latest");
record(
  "XAU market live on mainnet feeds",
  xau.pv.status === "OPEN" && xau.pv.price18 > 0n,
  `${xau.pv.status} ${xau.pv.price18}`,
);
const trade = senderWith(() => ({
  ...base(),
  marketRoomUsd6: (_id, long) => capHeadroomUsd6(xau.risk, xau.book, xau.pv, long),
  equityUsd6: () => funded.equityInit,
  marketLabel: () => "Gold",
}));
const open = previewIncrease({
  market: xau.risk,
  book: xau.book,
  pv: xau.pv,
  account: riskViewOf(funded),
  isLong: true,
  notionalUsd6: TRADE_USD6,
});
const openStages: string[] = [];
await sendTracked(trade, increaseRequest(CHAIN, XAU, true, TRADE_USD6, open.execPrice18, 1), (e) =>
  openStages.push(e.stage),
);
const held = (await readPositions(read, CHAIN, address, 1)).find((p) => p.marketId === XAU);
record(
  "XAU long on mainnet (no prompt under the Face ID threshold)",
  held !== undefined && auth.ceremonies === 1,
  openStages.join(" → "),
);
if (held) {
  const exit = previewDecrease(xau.risk, (await readMarketRisk(read, CHAIN, XAU)).pv, held, held.size, 0n);
  const closeStages: string[] = [];
  await sendTracked(trade, closeRequest(CHAIN, XAU, true, exit.execPrice18, 1), (e) => closeStages.push(e.stage));
  const flat = (await readAccountSnapshot(read, CHAIN, address, "latest")).positionBitmap === 0;
  record("close on mainnet", flat && closeStages.at(-1) === "finalized", closeStages.join(" → "));
}

const pool = await findStablePool(read);
if (pool) {
  const zeroForOne = pool.key.currency0.toLowerCase() === MAINNET_EXTERNAL.ausd.toLowerCase();
  const { amountOut } = await quoteExactIn(read, pool.key, zeroForOne, SWAP_USD6);
  const quote = {
    tokenIn: MAINNET_EXTERNAL.ausd,
    amountIn: SWAP_USD6,
    amountOut,
    minOut: (amountOut * (RISK.BPS - SWAP_SLIPPAGE_BPS)) / RISK.BPS,
  };
  const before = await readAccountSnapshot(read, CHAIN, address, "latest");
  await sendTracked(plain, swapCollateralRequest(CHAIN, quote, 0), () => undefined);
  const after = await readAccountSnapshot(read, CHAIN, address, "latest");
  record(
    "collateral swap AUSD → USDC in account (≥ min-out)",
    after.usdc - before.usdc >= quote.minOut && before.ausd - after.ausd === SWAP_USD6,
    `quote ${amountOut} got ${after.usdc - before.usdc}`,
  );
} else record("collateral swap AUSD → USDC in account (≥ min-out)", false, "no pool");

const vault = addressOf(CHAIN, "LpVault");
await sendTracked(plain, lpApproveRequest(CHAIN, vault, LP_USD6), () => undefined);
await sendTracked(plain, lpDepositRequest(CHAIN, LP_USD6, address), () => undefined);
const lp = await readLpVault(read, CHAIN, address);
await sendTracked(plain, lpRequestRedeemRequest(CHAIN, lp.shares, address), () => undefined);
const lp2 = await readLpVault(read, CHAIN, address);
record(
  "LP deposit + redeem request on mainnet AUSD",
  lp.shares > 0n && lp2.pending.length === 1 && auth.ceremonies === 1,
);

client.session.dispose();
const failed = Object.entries(checks).filter(([, ok]) => !ok);
console.log(JSON.stringify({ pass: failed.length === 0, checks: Object.keys(checks).length, failed }, null, 2));
process.exit(failed.length === 0 ? 0 : 1);
