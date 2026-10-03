"use client";

/**
 * Public stats (D-022; flow book G7 judge path): Senryo's traction per network, live from the public Envio indexer.
 * A two-option switch picks Practice (Monad testnet, paper money) or Mainnet; the choice lives in the link
 * (`?chainId=`, as in watch links) so a shared page opens on the same network. Each network's reads are cached, so
 * switching back is instant.
 */
import { MAINNET, NETWORK_BY_CHAIN_ID, type NetworkConfig, TESTNET } from "@senryo/config";
import { graphqlEndpoint } from "@senryo/indexer-client";
import { useSearchParams } from "next/navigation";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { statsHref } from "@/lib/constants/routes";
import { ENV } from "@/lib/env";
import { useDeployment, useTraction } from "@/lib/stats/traction";
import { cn } from "@/lib/utils";
import { DailyActivity } from "./daily-activity";
import { formatCount } from "./format";
import { TractionFigures } from "./traction-figures";

const OPTIONS = [TESTNET, MAINNET].map((n) => ({ value: String(n.chainId), label: n.modeLabel }));

/** What each network's figures are worth, said once under the switch. */
const VALUE_LINE: Record<NetworkConfig["key"], string> = {
  testnet: "Practice · Monad testnet, no real value",
  mainnet: "Mainnet · Monad, real value",
};

/** The public endpoint, as a judge would paste it. */
const ENDPOINT = graphqlEndpoint(ENV.INDEXER_ORIGIN).replace(/^https?:\/\//, "");

function networkOf(param: string | null): NetworkConfig {
  const found = Object.values(NETWORK_BY_CHAIN_ID).find((n) => String(n.chainId) === param);
  return found ?? TESTNET;
}

function SourceLine({ network }: { network: NetworkConfig }) {
  const indexed = useTraction(network.chainId).data?.indexed;
  return (
    <footer className="grid gap-1 text-meta text-text-3">
      <p>
        Envio indexer · {ENDPOINT}
        {indexed ? ` · read through block ${formatCount(indexed.progressBlock)}` : ""}
      </p>
      <p>Pool value from the pool contract · days in UTC</p>
    </footer>
  );
}

export function StatsScreen() {
  const network = networkOf(useSearchParams().get("chainId"));
  const deployment = useDeployment(network.chainId);
  const color = network.key === "testnet" ? "var(--practice)" : "var(--mainnet)";

  return (
    <div className="grid gap-8 pt-4">
      <div className="grid gap-3">
        <h1 className="text-page-title">Stats</h1>
        <SegmentedControl
          label="Network"
          options={OPTIONS}
          value={String(network.chainId)}
          onValueChange={(v) => window.history.replaceState(null, "", statsHref(Number(v)))}
          fill
        />
        <p className={cn("text-meta", network.key === "testnet" ? "text-practice" : "text-mainnet")}>
          {VALUE_LINE[network.key]}
        </p>
      </div>
      <TractionFigures network={network} />
      {deployment.data?.core === false ? (
        <p className="text-meta text-text-3">Per day · counted once Senryo’s {network.modeLabel} contracts are live</p>
      ) : (
        <DailyActivity key={`days-${network.chainId}`} chainId={network.chainId} color={color} />
      )}
      <SourceLine network={network} />
    </div>
  );
}
