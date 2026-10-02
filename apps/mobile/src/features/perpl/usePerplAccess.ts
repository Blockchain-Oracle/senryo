/**
 * Whether a Perpl market can be traded from here (flow book C1/C2/C4 rules), from the `perplTrade` capability and the
 * region: Practice locks it ("Mainnet"), Perpl's restricted regions make it read-only, a halted Exchange or a frozen
 * account locks it ("Paused"). A guest still gets Short / Long — the account sheet carries the ticket through sign-up.
 */
import { capabilitiesOf, useGeo, usePerplReady } from "@senryo/query";
import { useAccount } from "~/lib/account/provider";
import { useNetwork } from "~/lib/network";
import { PERPL_CHAIN } from "./market";

export type PerplAccess = { state: "trade" } | { state: "locked"; word: string; title: string; reason: string };

/** Why Practice has no Perpl ticket (flow book C4 step 7): the named reason behind the "Mainnet" lock. */
export const PERPL_PRACTICE_REASON =
  "Perpl trades with real AUSD on Monad mainnet. Its practice venue needs 100 AUSD to open an account and its faucet is empty, so Practice shows its prices without a ticket. Switch to Mainnet to trade.";

/** D-023 / services/api geo.ts: Perpl's blocked list, named as people read them. */
const BLOCKED_REGIONS = "Belarus, Cuba, Iran, North Korea, Russia, Syria, Ukraine, the UK and the US";

export function usePerplAccess(): PerplAccess {
  const network = useNetwork();
  const address = useAccount().hint?.address;
  const ready = usePerplReady(address);
  const geo = useGeo();
  if (network.chainId !== PERPL_CHAIN) {
    return {
      state: "locked",
      word: "Mainnet",
      title: "Mainnet only",
      reason: PERPL_PRACTICE_REASON,
    };
  }
  if ((geo.status === "fresh" || geo.status === "stale") && !geo.value.perplAllowed) {
    return {
      state: "locked",
      word: "Read-only",
      title: "Not available in your region",
      reason: `Perpl doesn’t accept orders from ${BLOCKED_REGIONS}. Prices stay visible.`,
    };
  }
  const capability = capabilitiesOf({
    chainId: network.chainId,
    account: address !== undefined,
    ...(ready === undefined ? {} : { perplAccountReady: ready }),
  }).perplTrade;
  if (address !== undefined && ready === false && !capability.available) {
    return { state: "locked", word: "Paused", title: "Perpl paused", reason: capability.reason ?? "Perpl paused" };
  }
  return { state: "trade" };
}
