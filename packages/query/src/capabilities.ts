import { isDeployed } from "@senryo/chain";
import { type ChainId, MAINNET_CHAIN_ID, PERPL_EXCHANGE } from "@senryo/config";

export interface Capability {
  available: boolean;
  reason?: string;
}
export interface CapabilityFacts {
  chainId: ChainId;
  account: boolean;
  instrumentExecutable?: boolean;
  instrumentPriced?: boolean;
  cardIssued?: boolean;
  cardReveal?: boolean;
  walletProvisioning?: boolean;
  providerRouteReady?: boolean;
  perplAccountReady?: boolean;
}
const decision = (available: boolean, reason: string): Capability =>
  available ? { available } : { available, reason };
/** Feature facts, never one Mainnet-wide switch. Price availability does not establish execution. */
export function capabilitiesOf(f: CapabilityFacts) {
  const core = isDeployed(f.chainId, "SenryoCore");
  const accountReason = f.account ? "Trading opens after this network's deployment" : "Sign in to use this action";
  return {
    walletReceive: decision(f.account, "Sign in to see your wallet address"),
    walletSend: decision(f.account, "Sign in to send from your wallet"),
    inboxReceive: decision(
      f.account && isDeployed(f.chainId, "InboxFactory"),
      "Trading deposits are unavailable on this network",
    ),
    tradingTransfer: decision(f.account && core, accountReason),
    selfWithdraw: decision(f.account && core, accountReason),
    marketPrice: decision(f.instrumentPriced === true, "Price unavailable"),
    engineTrade: decision(
      f.account && core && f.instrumentExecutable === true,
      !core ? accountReason : "This instrument is unavailable for execution",
    ),
    spotSwap: decision(
      f.account && f.chainId === MAINNET_CHAIN_ID,
      "Spot swaps require a Mainnet wallet and a live quote",
    ),
    // D1: Perpl is traded from the wallet on Mainnet; `perplAccountReady` comes from `usePerplReady` (Exchange live,
    // account not frozen — no account yet is fine: the first open creates it).
    perplTrade: decision(
      f.account && PERPL_EXCHANGE[f.chainId] !== undefined && f.perplAccountReady === true,
      !f.account
        ? "Sign in to trade on Perpl"
        : PERPL_EXCHANGE[f.chainId] === undefined
          ? "Perpl is unavailable on this network"
          : "Perpl isn't accepting orders from this account right now",
    ),
    pool: decision(f.account && isDeployed(f.chainId, "LpVault"), "Pool investment is unavailable on this network"),
    cardReveal: decision(
      f.cardIssued === true && f.cardReveal === true,
      "Secure mobile reveal requires issuer and protected-view acceptance",
    ),
    walletProvisioning: decision(
      f.cardIssued === true && f.walletProvisioning === true,
      "Wallet provisioning is unavailable from this issuer",
    ),
    cashOut: decision(f.providerRouteReady === true, "Cash-out provider routes are unavailable"),
  };
}
