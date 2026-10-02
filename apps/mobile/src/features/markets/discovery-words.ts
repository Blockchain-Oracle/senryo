/** A discovery gate's on-screen words (review S03; flow book C1 step 3): one word on a row, never a sentence. */
import { type DiscoveryInstrument, type ExecutionGate, MAINNET_CHAIN_ID } from "@senryo/config";

/**
 * The lock's one word on a row: Perpl crypto is "Mainnet" in Practice and "Soon" on Mainnet until Senryo connects;
 * calculated equity feeds are "Read-only"; an instrument with no price feed at all is "No feed".
 */
export function lockWord(instrument: Pick<DiscoveryInstrument, "class">, chainId: number): string {
  if (instrument.class === "crypto") return chainId === MAINNET_CHAIN_ID ? "Soon" : "Mainnet";
  return "Read-only";
}

export const NO_FEED = "No feed";

/** The page's gate title: what the lock means, in a few words. */
export function gateTitle(gate: ExecutionGate | undefined): string {
  if (gate?.state === "blocked") return gate.blocker === "B10" ? "Mainnet only" : "Read-only · price too jumpy";
  return "Read-only for now";
}
