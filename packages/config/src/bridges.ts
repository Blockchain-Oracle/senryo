/**
 * Cross-chain routes for the five bridgeable Monad assets (plan §0.8 B4/B9). Every pair in `BRIDGE_ROUTES` was quoted
 * live on 2 Oct 2026 (Relay, Across, LI.FI quotes; Circle Iris forwarding fees); a pair not listed has no route and the
 * picker shows it disabled. Plain data: chain ids, token addresses, provider hosts and the Monad contracts a bridge
 * step may call (`pinnedBridgeTargets`).
 */
import { MAINNET_EXTERNAL } from "./markets.ts";
import { type ChainId, MAINNET_CHAIN_ID, TESTNET_CHAIN_ID } from "./networks.ts";

export type BridgeProvider = "cctp" | "relay" | "across" | "lifi" | "aurora";
/** The Monad-side asset of a route. */
export type BridgeAsset = "USDC" | "USDT0" | "AUSD" | "XAUt0" | "MON";
/** The other chain's side of a route. */
export type RemoteAsset = "USDC" | "USDT" | "AUSD" | "XAUT" | "NATIVE";
export type BridgeDirection = "out" | "in";
export type VmType = "evm" | "svm" | "tvm";

export interface RemoteToken {
  /** EVM address, Solana mint or Tron base58; Relay's native placeholder for NATIVE. */
  address: string;
  decimals: number;
  symbol: string;
}

export interface BridgeChain {
  /** EVM chain id, or Relay's id for a non-EVM chain (Solana 792703809, Tron 728126428). */
  id: number;
  name: string;
  vm: VmType;
  /** `@senryo/identity` entity id of the chain mark (`chain:eip155:8453`, `chain:solana:…`). */
  mark: string;
  /** Circle CCTP v2 domain (EVM chains Circle serves from Monad). */
  cctpDomain?: number | undefined;
  testnet: boolean;
  tokens: Partial<Record<RemoteAsset, RemoteToken>>;
}

const EVM_NATIVE = "0x0000000000000000000000000000000000000000";
const USD_DECIMALS = 6;
const BSC_DECIMALS = 18;
const ETH_DECIMALS = 18;
const SOL_DECIMALS = 9;
const TRX_DECIMALS = 6;
const evmMark = (id: number) => `chain:eip155:${id}`;
const usd = (address: string, symbol: string, decimals = USD_DECIMALS): RemoteToken => ({ address, decimals, symbol });
const native = (symbol: string, address = EVM_NATIVE, decimals = ETH_DECIMALS): RemoteToken => ({
  address,
  decimals,
  symbol,
});

/** Circle CCTP v2 domains (developers.circle.com; each confirmed by Iris `fees/15/{domain}?forward=true`, 2 Oct). */
export const CCTP_DOMAIN = {
  ethereum: 0,
  avalanche: 1,
  optimism: 2,
  arbitrum: 3,
  solana: 5,
  base: 6,
  polygon: 7,
  /** `MessageTransmitterV2.localDomain()` on 143 and 10143 returns 15. */
  monad: 15,
} as const;

export const CHAIN_IDS_ELSEWHERE = {
  ethereum: 1,
  optimism: 10,
  bnb: 56,
  polygon: 137,
  base: 8453,
  arbitrum: 42161,
  avalanche: 43114,
  solana: 792703809,
  tron: 728126428,
  sepolia: 11155111,
  baseSepolia: 84532,
  arbitrumSepolia: 421614,
} as const;
const C = CHAIN_IDS_ELSEWHERE;

export const BRIDGE_CHAINS: readonly BridgeChain[] = [
  {
    id: C.ethereum,
    name: "Ethereum",
    vm: "evm",
    mark: evmMark(C.ethereum),
    cctpDomain: CCTP_DOMAIN.ethereum,
    testnet: false,
    tokens: {
      USDC: usd("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "USDC"),
      USDT: usd("0xdAC17F958D2ee523a2206206994597C13D831ec7", "USDT"),
      AUSD: usd(MAINNET_EXTERNAL.ausd, "AUSD"),
      XAUT: usd("0x68749665FF8D2d112Fa859AA293F07A622782F38", "XAUt"),
      NATIVE: native("ETH"),
    },
  },
  {
    id: C.base,
    name: "Base",
    vm: "evm",
    mark: evmMark(C.base),
    cctpDomain: CCTP_DOMAIN.base,
    testnet: false,
    tokens: {
      USDC: usd("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", "USDC"),
      USDT: usd("0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2", "USDT"),
      NATIVE: native("ETH"),
    },
  },
  {
    id: C.arbitrum,
    name: "Arbitrum",
    vm: "evm",
    mark: evmMark(C.arbitrum),
    cctpDomain: CCTP_DOMAIN.arbitrum,
    testnet: false,
    tokens: {
      USDC: usd("0xaf88d065e77c8cC2239327C5EDb3A432268e5831", "USDC"),
      USDT: usd("0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", "USDT0"),
      NATIVE: native("ETH"),
    },
  },
  {
    id: C.optimism,
    name: "Optimism",
    vm: "evm",
    mark: evmMark(C.optimism),
    cctpDomain: CCTP_DOMAIN.optimism,
    testnet: false,
    tokens: {
      USDC: usd("0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", "USDC"),
      USDT: usd("0x01bFF41798a0BcF287b996046Ca68b395DbC1071", "USDT0"),
      NATIVE: native("ETH"),
    },
  },
  {
    id: C.polygon,
    name: "Polygon",
    vm: "evm",
    mark: evmMark(C.polygon),
    cctpDomain: CCTP_DOMAIN.polygon,
    testnet: false,
    tokens: {
      USDC: usd("0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", "USDC"),
      USDT: usd("0xc2132D05D31c914a87C6611C10748AEb04B58e8F", "USDT0"),
      NATIVE: native("POL"),
    },
  },
  {
    id: C.avalanche,
    name: "Avalanche",
    vm: "evm",
    mark: evmMark(C.avalanche),
    cctpDomain: CCTP_DOMAIN.avalanche,
    testnet: false,
    tokens: { USDC: usd("0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E", "USDC"), NATIVE: native("AVAX") },
  },
  {
    id: C.bnb,
    name: "BNB Chain",
    vm: "evm",
    mark: evmMark(C.bnb),
    testnet: false,
    tokens: {
      USDC: usd("0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", "USDC", BSC_DECIMALS),
      USDT: usd("0x55d398326f99059fF775485246999027B3197955", "USDT", BSC_DECIMALS),
      NATIVE: native("BNB"),
    },
  },
  {
    id: C.solana,
    name: "Solana",
    vm: "svm",
    mark: "chain:solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
    testnet: false,
    tokens: {
      USDC: usd("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", "USDC"),
      USDT: usd("Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", "USDT"),
      NATIVE: native("SOL", "11111111111111111111111111111111", SOL_DECIMALS),
    },
  },
  {
    id: C.tron,
    name: "Tron",
    vm: "tvm",
    mark: "chain:tron:0x2b6653dc",
    testnet: false,
    tokens: {
      USDT: usd("TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t", "USDT"),
      NATIVE: native("TRX", "T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb", TRX_DECIMALS),
    },
  },
  {
    id: C.sepolia,
    name: "Sepolia",
    vm: "evm",
    mark: evmMark(C.sepolia),
    cctpDomain: CCTP_DOMAIN.ethereum,
    testnet: true,
    tokens: { USDC: usd("0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", "USDC") },
  },
  {
    id: C.baseSepolia,
    name: "Base Sepolia",
    vm: "evm",
    mark: evmMark(C.baseSepolia),
    cctpDomain: CCTP_DOMAIN.base,
    testnet: true,
    tokens: { USDC: usd("0x036CbD53842c5426634e7929541eC2318f3dCF7e", "USDC") },
  },
  {
    id: C.arbitrumSepolia,
    name: "Arbitrum Sepolia",
    vm: "evm",
    mark: evmMark(C.arbitrumSepolia),
    cctpDomain: CCTP_DOMAIN.arbitrum,
    testnet: true,
    tokens: { USDC: usd("0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d", "USDC") },
  },
];

export function bridgeChain(id: number): BridgeChain | undefined {
  return BRIDGE_CHAINS.find((c) => c.id === id);
}

/** The Monad side of each route: mainnet tokens; Practice has only Circle's testnet USDC (CCTP's sandbox). */
export const MONAD_BRIDGE_ASSETS: Readonly<Record<ChainId, Partial<Record<BridgeAsset, RemoteToken>>>> = {
  [MAINNET_CHAIN_ID]: {
    USDC: usd(MAINNET_EXTERNAL.usdc, "USDC"),
    USDT0: usd("0xe7cd86e13AC4309349F30B3435a9d337750fC82D", "USDT0"),
    AUSD: usd(MAINNET_EXTERNAL.ausd, "AUSD"),
    XAUt0: usd("0x01bFF41798a0BcF287b996046Ca68b395DbC1071", "XAUt0"),
    MON: native("MON"),
  },
  [TESTNET_CHAIN_ID]: { USDC: usd("0x534b2f3A21130d7a60830c2Df862319e593943A3", "USDC") },
};

export interface BridgeRoute {
  monadChainId: ChainId;
  asset: BridgeAsset;
  direction: BridgeDirection;
  /** The other chain. */
  chain: number;
  /** What arrives there (out) or is sent from there (in); the first is the default. */
  remote: readonly RemoteAsset[];
  /** Providers in preference order; a quote asks every one and returns the best minimum received. */
  providers: readonly BridgeProvider[];
}

function routes(
  monadChainId: ChainId,
  asset: BridgeAsset,
  direction: BridgeDirection,
  chains: readonly number[],
  remote: readonly RemoteAsset[],
  providers: readonly BridgeProvider[],
): BridgeRoute[] {
  return chains.map((chain) => ({ monadChainId, asset, direction, chain, remote, providers }));
}

const M = MAINNET_CHAIN_ID;
const CCTP_EVM = [C.ethereum, C.base, C.arbitrum, C.optimism, C.polygon, C.avalanche];
const USDT_EVM = [C.ethereum, C.arbitrum, C.optimism, C.polygon, C.bnb, C.base];
const RELAY_EVM = [C.ethereum, C.base, C.arbitrum, C.optimism, C.polygon, C.bnb, C.avalanche];
const RELAY_DOLLAR = [C.base, C.arbitrum, C.optimism, C.polygon, C.bnb, C.avalanche, C.solana];
const TESTNET_CCTP = [C.sepolia, C.baseSepolia, C.arbitrumSepolia];

/** Every live route (plan §0.8 tables, narrowed to the pairs quoted on 2 Oct 2026). */
export const BRIDGE_ROUTES: readonly BridgeRoute[] = [
  // ---- out of Monad
  ...routes(M, "USDC", "out", CCTP_EVM, ["USDC"], ["cctp", "relay"]),
  ...routes(M, "USDC", "out", [C.bnb], ["USDC"], ["relay", "across"]),
  ...routes(M, "USDC", "out", [C.solana], ["USDC"], ["relay"]),
  ...routes(M, "USDC", "out", [C.tron], ["USDT"], ["relay"]),
  ...routes(M, "USDT0", "out", USDT_EVM, ["USDT"], ["across", "lifi"]),
  ...routes(M, "USDT0", "out", [C.solana, C.tron], ["USDT"], ["relay"]),
  ...routes(M, "AUSD", "out", [C.ethereum], ["AUSD", "USDC"], ["relay"]),
  ...routes(M, "AUSD", "out", RELAY_DOLLAR, ["USDC"], ["relay"]),
  ...routes(M, "XAUt0", "out", [C.ethereum], ["XAUT"], ["lifi"]),
  ...routes(M, "MON", "out", [C.base, C.solana], ["USDC", "NATIVE"], ["relay"]),
  ...routes(M, "MON", "out", [C.ethereum, C.arbitrum, C.optimism, C.polygon, C.bnb, C.avalanche], ["USDC"], ["relay"]),
  ...routes(M, "MON", "out", [C.tron], ["NATIVE"], ["relay"]),
  // ---- into Monad (signed on the other chain by the sender's own wallet)
  ...routes(M, "USDC", "in", CCTP_EVM, ["USDC"], ["relay", "cctp", "across"]),
  ...routes(M, "USDC", "in", [C.bnb, C.solana], ["USDC"], ["relay"]),
  ...routes(M, "AUSD", "in", [C.ethereum], ["AUSD", "USDC"], ["relay"]),
  ...routes(M, "AUSD", "in", [C.base, C.arbitrum], ["USDC"], ["relay"]),
  ...routes(M, "MON", "in", RELAY_EVM, ["NATIVE", "USDC"], ["relay"]),
  ...routes(M, "MON", "in", [C.solana], ["USDC", "NATIVE"], ["relay"]),
  ...routes(M, "USDT0", "in", USDT_EVM, ["USDT"], ["across"]),
  ...routes(M, "XAUt0", "in", [C.ethereum], ["XAUT"], ["lifi"]),
  // ---- Practice: CCTP v2 is the only bridge serving 10143 (Circle sandbox)
  ...routes(TESTNET_CHAIN_ID, "USDC", "out", TESTNET_CCTP, ["USDC"], ["cctp"]),
  ...routes(TESTNET_CHAIN_ID, "USDC", "in", TESTNET_CCTP, ["USDC"], ["cctp"]),
];

export function bridgeRoutesFor(
  monadChainId: ChainId,
  asset: BridgeAsset,
  direction: BridgeDirection,
): readonly BridgeRoute[] {
  return BRIDGE_ROUTES.filter((r) => r.monadChainId === monadChainId && r.asset === asset && r.direction === direction);
}

export function bridgeRoute(
  monadChainId: ChainId,
  asset: BridgeAsset,
  direction: BridgeDirection,
  chain: number,
): BridgeRoute | undefined {
  return bridgeRoutesFor(monadChainId, asset, direction).find((r) => r.chain === chain);
}

// ---------------------------------------------------------------- provider hosts and pinned Monad contracts

export const RELAY_API = "https://api.relay.link";
export const ACROSS_API = "https://app.across.to/api";
export const LIFI_API = "https://li.quest/v1";
export const LIFI_INTEGRATOR = "senryo";
/** Aurora (NEAR Intents) — every endpoint is keyed by the Studio API key in the path (`/incidents/{apiKey}`). */
export const AURORA_API = "https://intents-api.aurora.dev/api";
/** Circle Iris: production for 143, the sandbox for 10143. */
export const CCTP_IRIS: Readonly<Record<ChainId, string>> = {
  [MAINNET_CHAIN_ID]: "https://iris-api.circle.com",
  [TESTNET_CHAIN_ID]: "https://iris-api-sandbox.circle.com",
};

/** CCTP v2 TokenMessengerV2 (CREATE2: one address per environment, on Monad and on every EVM chain Circle serves). */
export const CCTP_TOKEN_MESSENGER: Readonly<Record<ChainId, `0x${string}`>> = {
  [MAINNET_CHAIN_ID]: "0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d",
  [TESTNET_CHAIN_ID]: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA",
};
/** Circle's Forwarding Service hook ("cctp-forward", version 0): Circle mints on the destination for `forwardFee`. */
export const CCTP_FORWARD_HOOK_DATA = "0x636374702d666f72776172640000000000000000000000000000000000000000" as const;
/** Fast transfer (soft finality); Monad → any domain charges 0 bps for it (Iris, 2 Oct). */
export const CCTP_FAST_FINALITY = 1000;

/**
 * Contracts on Monad a bridge step may call or approve (read from live quotes on 2 Oct 2026). Upgradeability: the
 * CCTP messenger (admin 0xba0d…8a44), the Across spoke (ERC-1967) and the LI.FI diamond can change code under these
 * addresses; Relay's depository is not a proxy.
 */
export const BRIDGE_CONTRACTS: Readonly<Record<ChainId, Readonly<Record<string, `0x${string}`>>>> = {
  [MAINNET_CHAIN_ID]: {
    relayDepository: "0x4cd00e387622c35bddb9b4c962c136462338bc31",
    /** Relay's router for currencies its solver doesn't hold (USDT0 swaps in, then bridges). */
    relayRouter: "0xccc88a9d1b4ed6b0eaba998850414b24f1c315be",
    cctpTokenMessenger: CCTP_TOKEN_MESSENGER[MAINNET_CHAIN_ID],
    acrossSpoke: "0xd2ecb3afe598b746F8123CaE365a598DA831A449",
    lifiDiamond: "0x026F252016A7C47CDEf1F05a3Fc9E20C92a49C37",
  },
  [TESTNET_CHAIN_ID]: { cctpTokenMessenger: CCTP_TOKEN_MESSENGER[TESTNET_CHAIN_ID] },
};

export function isPinnedBridgeTarget(chainId: ChainId, to: string): boolean {
  return Object.values(BRIDGE_CONTRACTS[chainId]).some((pin) => pin.toLowerCase() === to.toLowerCase());
}

/** Typical delivery time per provider (s), shown before a quote; a quote's own estimate replaces it. */
export const BRIDGE_TYPICAL_ETA_SEC: Readonly<Record<BridgeProvider, number>> = {
  relay: 5,
  cctp: 60,
  across: 10,
  lifi: 1_080,
  aurora: 600,
};
