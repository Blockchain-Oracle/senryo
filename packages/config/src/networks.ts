/**
 * Monad networks — plain data (no viem here; `@senryo/chain` builds viem chains from this).
 * Source: context/02-monad/network-and-endpoints.md (public endpoint tables, read 2026-09-29).
 * Practice mode = testnet 10143 (mock AUSD/USDC, no value); Mainnet = 143 (the demo network, D-008).
 */

export const MAINNET_CHAIN_ID = 143;
export const TESTNET_CHAIN_ID = 10143;

export type ChainId = typeof MAINNET_CHAIN_ID | typeof TESTNET_CHAIN_ID;
export type NetworkKey = "mainnet" | "testnet";

/** Measured 29 Sep: 101 blocks / 30.5 s ≈ 302 ms. viem's built-in chains still say 400 ms (stale). */
export const MONAD_BLOCK_TIME_MS = 300;

/** Public RPC `eth_getLogs` range on the default endpoints — history comes from the indexer, never RPC scans. */
export const PUBLIC_GETLOGS_MAX_BLOCKS = 100;

/** Monad's reserve rule: accounts that send value keep more than 10 MON (CLAUDE.md). */
export const SENDER_RESERVE_MON = 10n;

/** Blocks to wait after funding a fresh key before it sends (CLAUDE.md "wait 3 blocks after funding"). */
export const FUNDING_SETTLE_BLOCKS = 3n;

export interface Explorer {
  name: string;
  url: string;
}

export interface NetworkConfig {
  key: NetworkKey;
  chainId: ChainId;
  name: string;
  /** Label shown on every surface (D-008: each surface names its network). */
  modeLabel: "Real" | "Practice";
  nativeCurrency: { name: string; symbol: string; decimals: number };
  /** Ordered by preference. Senders fan out to the first two (card path, D-027). */
  rpcHttp: readonly [string, ...string[]];
  rpcWs: readonly [string, ...string[]];
  /** Historical-state reads (`eth_call` at old blocks) — regular nodes reject them. */
  archiveRpcHttp: string;
  explorers: readonly [Explorer, ...Explorer[]];
  /** Sourcify API used for verification (MonadVision). */
  sourcifyApi: string;
  blockTimeMs: number;
}

const MON = { name: "Monad", symbol: "MON", decimals: 18 } as const;

export const MAINNET: NetworkConfig = {
  key: "mainnet",
  chainId: MAINNET_CHAIN_ID,
  name: "Monad",
  modeLabel: "Real",
  nativeCurrency: MON,
  rpcHttp: ["https://rpc.monad.xyz", "https://rpc1.monad.xyz", "https://rpc3.monad.xyz"],
  rpcWs: ["wss://rpc.monad.xyz", "wss://rpc1.monad.xyz"],
  archiveRpcHttp: "https://rpc-mainnet.monadinfra.com",
  explorers: [
    { name: "MonadVision", url: "https://monadvision.com" },
    { name: "Monadscan", url: "https://monadscan.com" },
  ],
  sourcifyApi: "https://sourcify-api-monad.blockvision.org",
  blockTimeMs: MONAD_BLOCK_TIME_MS,
};

export const TESTNET: NetworkConfig = {
  key: "testnet",
  chainId: TESTNET_CHAIN_ID,
  name: "Monad Testnet",
  modeLabel: "Practice",
  nativeCurrency: MON,
  rpcHttp: ["https://testnet-rpc.monad.xyz", "https://rpc.ankr.com/monad_testnet"],
  rpcWs: ["wss://testnet-rpc.monad.xyz"],
  archiveRpcHttp: "https://rpc-testnet.monadinfra.com",
  explorers: [
    { name: "MonadVision", url: "https://testnet.monadvision.com" },
    { name: "Monadscan", url: "https://testnet.monadscan.com" },
  ],
  sourcifyApi: "https://sourcify-api-monad.blockvision.org",
  blockTimeMs: MONAD_BLOCK_TIME_MS,
};

export const NETWORKS: Readonly<Record<NetworkKey, NetworkConfig>> = { mainnet: MAINNET, testnet: TESTNET };

export const NETWORK_BY_CHAIN_ID: Readonly<Record<ChainId, NetworkConfig>> = {
  [MAINNET_CHAIN_ID]: MAINNET,
  [TESTNET_CHAIN_ID]: TESTNET,
};

export function isChainId(value: number): value is ChainId {
  return value === MAINNET_CHAIN_ID || value === TESTNET_CHAIN_ID;
}

export function networkOf(chainId: ChainId): NetworkConfig {
  return NETWORK_BY_CHAIN_ID[chainId];
}

/** `https://testnet.monadvision.com/tx/0x…` on the network's primary explorer. */
export function explorerTxUrl(chainId: ChainId, hash: string): string {
  return `${networkOf(chainId).explorers[0].url}/tx/${hash}`;
}

export function explorerAddressUrl(chainId: ChainId, address: string): string {
  return `${networkOf(chainId).explorers[0].url}/address/${address}`;
}
