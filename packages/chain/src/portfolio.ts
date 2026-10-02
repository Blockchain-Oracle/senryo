import { type ChainId, MAINNET_CHAIN_ID, MAINNET_EXTERNAL, SPOT_TOKENS } from "@senryo/config";
import { aggregatorV3InterfaceAbi, inboxFactoryAbi, senryoCoreAbi } from "@senryo/contracts/abis";
import { type Address, erc20Abi, zeroAddress } from "viem";
import type { ReadClient } from "./clients.ts";
import { addressOf, isDeployed } from "./contracts.ts";
import { readLpVault } from "./lp-reads.ts";
import { readPerplAccount, readPerplPositions } from "./perpl/reads.ts";
import { pinRead } from "./pinned-read.ts";
import { readAccountSnapshot } from "./reads.ts";
import { readSpotHoldings, readSpotPrices } from "./spot.ts";

const TEN = 10n;
const PRICE_DECIMALS = 18;
const PRICE_TO_USD6_DECIMALS = 12n;
const WAD = TEN ** BigInt(PRICE_DECIMALS);
const BPS = 10_000n;
/** Matches CollateralConfig / Constants, not an alternative risk policy. */
const FEED_GRACE = 600n;
export interface PortfolioComponent {
  name: string;
  supported?: boolean;
  valueUsd6: bigint | undefined;
  missing: string[];
}
export interface PortfolioSnapshot {
  chainId: ChainId;
  blockNumber: bigint;
  timestamp: bigint;
  totalUsd6: bigint;
  quality: "estimated" | "partial";
  components: PortfolioComponent[];
  /** Stable USD marks without a configured feed use their USD peg as an explicit estimate. */
  basis: "USD estimate";
}
export function sumPortfolio(components: readonly PortfolioComponent[]) {
  return {
    totalUsd6: components.reduce((sum, c) => sum + (c.valueUsd6 ?? 0n), 0n),
    quality: components.some((c) => c.valueUsd6 === undefined || c.missing.length > 0)
      ? ("partial" as const)
      : ("estimated" as const),
  };
}
/** Undo the liquidation collateral haircut; holds reserve spending but are still owned money. */
export function tradingDisplayValue(equityLiq: bigint, holds: bigint, gross: bigint, riskCollateral: bigint): bigint {
  return equityLiq + holds + gross - riskCollateral;
}
export async function readPortfolio(
  source: ReadClient,
  chainId: ChainId,
  user: Address,
  requests: (
    block: bigint,
  ) => Promise<{ ids: readonly bigint[]; complete: boolean; indexedBlock?: bigint | undefined }>,
): Promise<PortfolioSnapshot> {
  const finalized = await source.getBlock({ blockTag: "finalized" });
  const own = isDeployed(chainId, "LpVault")
    ? await requests(finalized.number).catch(() => ({
        ids: [] as readonly bigint[],
        complete: false,
        indexedBlock: undefined,
      }))
    : undefined;
  // The indexer can lag finality. Use one older, fully indexed finalized snapshot for every money component.
  const indexed = own?.indexedBlock;
  const block =
    indexed !== undefined && indexed > 0n && indexed < finalized.number
      ? await source.getBlock({ blockNumber: indexed })
      : finalized;
  const read = pinRead(source, block.number);
  const coreReady = isDeployed(chainId, "SenryoCore");
  const ausd = chainId === MAINNET_CHAIN_ID ? MAINNET_EXTERNAL.ausd : addressOf(chainId, "MockAUSD");
  const usdc = chainId === MAINNET_CHAIN_ID ? MAINNET_EXTERNAL.usdc : addressOf(chainId, "MockUSDC");
  const stable = [ausd, usdc] as const;
  const core = coreReady ? ({ address: addressOf(chainId, "SenryoCore"), abi: senryoCoreAbi } as const) : undefined;
  const marks = await Promise.all(
    stable.map(async (token) => {
      if (!core) return { price: WAD as bigint | undefined, haircut: 0n };
      try {
        const cfg = await read.readContract({ ...core, functionName: "collateralConfig", args: [token] });
        if (cfg.usdFeed === zeroAddress) return { price: WAD, haircut: BigInt(cfg.haircutBps) };
        const feed = { address: cfg.usdFeed, abi: aggregatorV3InterfaceAbi } as const;
        const [round, decimals] = await Promise.all([
          read.readContract({ ...feed, functionName: "latestRoundData" }),
          read.readContract({ ...feed, functionName: "decimals" }),
        ]);
        const [rid, answer, , at, air] = round;
        const valid =
          answer > 0n &&
          at <= block.timestamp &&
          air >= rid &&
          decimals <= PRICE_DECIMALS &&
          block.timestamp - at <= BigInt(cfg.feedHeartbeat) + FEED_GRACE;
        return {
          price: valid ? answer * TEN ** BigInt(PRICE_DECIMALS - decimals) : undefined,
          haircut: BigInt(cfg.haircutBps),
        };
      } catch {
        return { price: undefined, haircut: 0n };
      }
    }),
  );
  const valueStable = (amount: bigint, i: number) => {
    const price = marks[i]?.price;
    return amount === 0n ? 0n : price === undefined ? undefined : (amount * price) / WAD;
  };
  const part = async (
    name: string,
    fn: () => Promise<Omit<PortfolioComponent, "name">>,
  ): Promise<PortfolioComponent> => {
    try {
      return { name, ...(await fn()) };
    } catch {
      return { name, valueUsd6: undefined, missing: [name] };
    }
  };
  const components = await Promise.all([
    part("Wallet", async () => {
      const balances = await read.multicall({
        contracts: stable.map(
          (token) => ({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [user] }) as const,
        ),
        allowFailure: false,
      });
      let value = 0n;
      const missing: string[] = [];
      balances.forEach((amount, i) => {
        const v = valueStable(amount, i);
        if (v === undefined) missing.push(i === 0 ? "AUSD price" : "USDC price");
        else value += v;
      });
      if (chainId === MAINNET_CHAIN_ID) {
        const tokens = SPOT_TOKENS.filter((t) => !stable.some((s) => s.toLowerCase() === t.address.toLowerCase()));
        const holdings = await readSpotHoldings(read, user, tokens);
        const held = holdings.filter((h) => h.balance > 0n);
        const prices = await readSpotPrices(
          read,
          held.map((h) => h.token),
        );
        for (const holding of held) {
          const price = prices.find((p) => p.token.address === holding.token.address)?.priceUsd18;
          const usdMark = marks[1]?.price;
          if (price === undefined || usdMark === undefined) missing.push(`${holding.token.symbol} price`);
          else
            value +=
              (holding.balance * price * usdMark) /
              (TEN ** BigInt(holding.token.decimals) * WAD * TEN ** PRICE_TO_USD6_DECIMALS);
        }
      }
      return { valueUsd6: value, missing };
    }),
    part("Trading account", async () => {
      if (!core) return { valueUsd6: 0n, missing: [], supported: false };
      const s = await readAccountSnapshot(read, chainId, user);
      let gross = 0n;
      let adjusted = 0n;
      for (const [i, balance] of [s.ausd, s.usdc].entries()) {
        const price = marks[i]?.price;
        if (balance > 0n && price === undefined) return { valueUsd6: undefined, missing: ["Trading collateral price"] };
        gross += valueStable(balance, i) ?? 0n;
        const capped = (price ?? WAD) > WAD ? WAD : (price ?? WAD);
        adjusted += (((balance * capped) / WAD) * (BPS - (marks[i]?.haircut ?? 0n))) / BPS;
      }
      return { valueUsd6: tradingDisplayValue(s.equityLiq, s.holds, gross, adjusted), missing: [] };
    }),
    part("Pool investments", async () => {
      if (!isDeployed(chainId, "LpVault")) return { valueUsd6: 0n, missing: [], supported: false };
      if (!own) throw new Error("Pool requests unavailable");
      const complete = own.complete || (own.indexedBlock !== undefined && own.indexedBlock >= block.number);
      const pool = await readLpVault(read, chainId, user, "finalized", own.ids, complete);
      return {
        valueUsd6: pool.sharesValue + pool.pendingValue,
        missing: complete ? [] : ["Pending pool requests updating"],
      };
    }),
    // Perpl (D1, mainnet): AUSD the wallet moved to its own Perpl account — the free balance plus each position's
    // collateral and the Exchange's own PnL at the mark. It left the wallet, so nothing above counts it.
    part("Perpl", async () => {
      if (chainId !== MAINNET_CHAIN_ID) return { valueUsd6: 0n, missing: [], supported: false };
      const account = await readPerplAccount(read, chainId, user, block.number);
      if (!account) return { valueUsd6: 0n, missing: [] };
      const positions = await readPerplPositions(
        read,
        chainId,
        account.accountId,
        account.marketsWithPositions,
        block.number,
      );
      const equity = positions.reduce((sum, p) => sum + p.depositCNS + p.pnlCNS, account.balanceCNS);
      const value = valueStable(equity > 0n ? equity : 0n, 0);
      return value === undefined
        ? { valueUsd6: undefined, missing: ["AUSD price"] }
        : { valueUsd6: value, missing: [] };
    }),
    part("Deposit inbox", async () => {
      if (!isDeployed(chainId, "InboxFactory")) return { valueUsd6: 0n, missing: [], supported: false };
      const inbox = await read.readContract({
        address: addressOf(chainId, "InboxFactory"),
        abi: inboxFactoryAbi,
        functionName: "inboxOf",
        args: [user],
      });
      const balances = await read.multicall({
        contracts: stable.map(
          (token) => ({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [inbox] }) as const,
        ),
        allowFailure: false,
      });
      const values = balances.map((v, i) => valueStable(v, i));
      return {
        valueUsd6: values.some((v) => v === undefined)
          ? undefined
          : values.reduce<bigint>((sum, v) => sum + (v ?? 0n), 0n),
        missing: values.some((v) => v === undefined) ? ["Inbox collateral price"] : [],
      };
    }),
  ]);
  return {
    chainId,
    blockNumber: block.number,
    timestamp: block.timestamp,
    ...sumPortfolio(components),
    components,
    basis: "USD estimate",
  };
}
