"use client";

/**
 * Card (flow book E1–E6; the phone's Card tab) on the web: the Kinpaku art with no numbers, one title, one line, one
 * action — and the same named locks as the phone. The card service's readiness on this network comes from
 * `/v1/config`; when it isn't live the page says "Card unavailable" with Retry, never an error wall. Revealing the card
 * details needs the phone's capture protection, and Add to Wallet needs Apple's provisioning entitlement — both are
 * shown, locked, with that reason.
 */
import { configRoute } from "@senryo/api-client";
import { useQueryEnv } from "@senryo/query";
import { useQuery } from "@tanstack/react-query";
import { Eye, Lock, Wallet } from "lucide-react";
import Link from "next/link";
import { ListRow } from "@/components/kit/list-row";
import { TabTitle } from "@/components/kit/page-header";
import { Column } from "@/components/shell/column";
import { SealMark } from "@/components/shell/seal";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAccount } from "@/lib/account/provider";
import { ROUTES } from "@/lib/constants/routes";

const CONFIG_STALE_MS = 60_000;

/** The Kinpaku card art: lacquer, the gold seal, the name — never a number (§0.9 "Card tab, unissued"). */
function CardArt() {
  return (
    <div
      aria-hidden
      className="relative mx-auto aspect-[1.586] w-full max-w-sm overflow-hidden rounded-lg bg-kinpaku-lacquer shadow-sheet ring-1 ring-kinpaku-edge"
    >
      <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_80%_0%,var(--kinpaku-foil-light),transparent_55%)] opacity-30" />
      <div className="absolute top-5 left-5">
        <SealMark />
      </div>
      <p className="absolute right-5 bottom-5 font-display text-section-title text-kinpaku-foil">Kinpaku 金箔</p>
    </div>
  );
}

function LockRow({ icon, title, reason }: { icon: React.ReactNode; title: string; reason: string }) {
  return (
    <ListRow
      className="opacity-70"
      leading={<span className="grid size-10 place-items-center rounded-full bg-raised-2 [&_svg]:size-5">{icon}</span>}
      title={title}
      subtitle={reason}
      trailing={<Lock className="size-4 text-text-3" aria-label={reason} />}
    />
  );
}

export function CardScreen() {
  const env = useQueryEnv();
  const account = useAccount();
  const config = useQuery({
    queryKey: ["config"],
    queryFn: ({ signal }) => env.api.call(configRoute, {}, { signal }),
    staleTime: CONFIG_STALE_MS,
    retry: false,
  });
  const live = config.data?.networks.find((n) => n.chainId === env.chainId)?.card ?? false;
  const guest = account.status === "ready" && !account.hint;
  return (
    <Column className="grid gap-5">
      <TabTitle>Card</TabTitle>
      <CardArt />
      <div className="grid gap-1 text-center">
        {config.isLoading ? (
          <Skeleton className="mx-auto h-6 w-56" />
        ) : live || guest ? (
          <>
            <h2 className="text-section-title">Get your Kinpaku card</h2>
            <p className="text-meta text-text-2">Spends your free balance</p>
          </>
        ) : (
          <>
            <h2 className="text-section-title">Card unavailable</h2>
            <p className="text-meta text-text-2">Card issuer not answering</p>
          </>
        )}
      </div>
      {guest ? (
        <Button asChild size="xl">
          <Link href={ROUTES.welcome}>Create account</Link>
        </Button>
      ) : !live && !config.isLoading ? (
        <Button size="xl" variant="secondary" disabled={config.isFetching} onClick={() => void config.refetch()}>
          Retry
        </Button>
      ) : live ? (
        <LockRow icon={<Lock />} title="Instant test card" reason="Issue it in the Senryo app" />
      ) : null}
      <div>
        <LockRow icon={<Eye />} title="Card details" reason="On the app · screen-capture protected" />
        <LockRow icon={<Wallet />} title="Add to Apple Wallet" reason="Needs Apple approval" />
      </div>
    </Column>
  );
}
