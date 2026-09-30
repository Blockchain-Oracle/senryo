import {
  type ChainId,
  MAINNET,
  MAINNET_CHAIN_ID,
  type NetworkConfig,
  networkOf,
  TESTNET,
  TESTNET_CHAIN_ID,
} from "@senryo/config";
import { type Chain, defineChain } from "viem";
import { MULTICALL3_ADDRESS } from "./constants.ts";

/**
 * viem chains built from `@senryo/config` (the only home of chain ids and RPC URLs). viem's own `monad`/`monadTestnet`
 * still say `blockTime: 400` and point the testnet explorer at a stale host — we override both (300 ms, MonadVision).
 */
function toViemChain(net: NetworkConfig): Chain {
  const [explorer] = net.explorers;
  return defineChain({
    id: net.chainId,
    name: net.name,
    nativeCurrency: net.nativeCurrency,
    rpcUrls: { default: { http: [...net.rpcHttp], webSocket: [...net.rpcWs] } },
    blockExplorers: { default: { name: explorer.name, url: explorer.url } },
    contracts: { multicall3: { address: MULTICALL3_ADDRESS } },
    blockTime: net.blockTimeMs,
    testnet: net.key === "testnet",
  });
}

export const monadMainnet: Chain = toViemChain(MAINNET);
export const monadTestnet: Chain = toViemChain(TESTNET);

const BY_ID: Readonly<Record<ChainId, Chain>> = {
  [MAINNET_CHAIN_ID]: monadMainnet,
  [TESTNET_CHAIN_ID]: monadTestnet,
};

export function viemChain(chainId: ChainId): Chain {
  return BY_ID[chainId];
}

export function networkFor(chainId: ChainId): NetworkConfig {
  return networkOf(chainId);
}
