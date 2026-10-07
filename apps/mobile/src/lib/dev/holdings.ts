import { addressOf, createReadClient, readTokenBalances } from "@senryo/chain";
import { NATIVE_TOKEN, TESTNET_CHAIN_ID } from "@senryo/config";
import { ids } from "@senryo/identity";
import { DEV_RPC, requireDevWorkspace } from "./config";

const MON_DECIMALS = 18;
const DOLLAR_DECIMALS = 6;

/** The fixture's known token universe, with balances read together from the actual local chain. */
export async function devHoldings(url: URL) {
  requireDevWorkspace();
  const owner = url.searchParams.get("address");
  if (!owner || !/^0x[0-9a-fA-F]{40}$/.test(owner) || url.searchParams.get("chainId") !== String(TESTNET_CHAIN_ID)) {
    throw new Error("Development holdings require a Practice account");
  }
  const read = createReadClient(TESTNET_CHAIN_ID, { http: [DEV_RPC] });
  const block = await read.getBlock({ blockTag: "finalized" });
  const listed = [
    {
      address: NATIVE_TOKEN,
      symbol: "MON",
      name: "Monad",
      native: true,
      decimals: MON_DECIMALS,
      mark: ids.native(TESTNET_CHAIN_ID, "MON"),
    },
    {
      address: addressOf(TESTNET_CHAIN_ID, "MockAUSD"),
      symbol: "AUSD",
      name: "Practice AUSD",
      native: false,
      decimals: DOLLAR_DECIMALS,
      mark: "",
    },
    {
      address: addressOf(TESTNET_CHAIN_ID, "MockUSDC"),
      symbol: "USDC",
      name: "Practice USDC",
      native: false,
      decimals: DOLLAR_DECIMALS,
      mark: "",
    },
  ];
  const balances = await readTokenBalances(
    read,
    owner as `0x${string}`,
    listed.map((t) => t.address),
    block.number,
  );
  if (balances.some((balance) => balance === undefined)) throw new Error("A local fixture balance could not be read");
  return {
    chainId: TESTNET_CHAIN_ID,
    address: owner,
    at: new Date().toISOString(),
    blockNumber: block.number,
    discovery: {
      source: "tokenlist",
      complete: true,
      scannedToBlock: null,
      note: "Local fixture universe: MON, AUSD, USDC",
    },
    tokens: listed.map((token, index) => ({
      ...token,
      balance: balances[index],
      verified: true,
      lookalike: false,
      logoUrl: null,
      priceUsd18: null,
      valueUsd6: null,
      change24hBps: null,
      priceSource: null,
    })),
    totalUsd6: 0n,
    partial: false,
    pricesAvailable: false,
  };
}
