/**
 * Whether a Perpl market can be traded from here (flow book C1/C2/C4 rules), from the `perplTrade` capability and the
 * region: Perpl's restricted regions make it read-only, a halted Exchange or a frozen
 * account locks it ("Paused"). A guest still gets Short / Long — the account sheet carries the ticket through sign-up.
 */
import { capabilitiesOf, useGeo, usePerplReady } from "@senryo/query";
import { useAccount } from "~/lib/account/provider";
import { useNetwork } from "~/lib/network";

export type PerplAccess = { state: "trade" } | { state: "locked"; word: string; title: string; reason: string };

/** Explain a network change while a ticket is being reviewed. */
export const PERPL_PRACTICE_REASON =
  "Review this ticket on the selected network. Practice uses test AUSD on Monad Testnet; Mainnet uses real AUSD. Each exchange sets its own account minimum.";

/** D-023 / services/api geo.ts: Perpl's blocked list, named as people read them. */
const BLOCKED_REGIONS = "Belarus, Cuba, Iran, North Korea, Russia, Syria, Ukraine, the UK and the US";

export function usePerplAccess(): PerplAccess {
  const network = useNetwork();
  const address = useAccount().hint?.address;
  const ready = usePerplReady(address);
  const geo = useGeo();
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
