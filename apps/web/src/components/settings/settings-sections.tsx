"use client";

/**
 * Settings detail pages (flow book A10, G3; the phone's account/*): Mode (two rows, Mainnet locked until its deploy),
 * Status (`GET /v1/status`: per network, rows with "OK" / "Slow" / "Down" / "Unknown" and the age), Blocked & muted
 * (the lists, with Unblock / Unmute), and Sign out (confirm).
 */
import { statusRoute } from "@senryo/api-client";
import { MAINNET_CHAIN_ID } from "@senryo/config";
import { ids } from "@senryo/identity";
import { useQueryEnv, useRelations, useRelationToggle } from "@senryo/query";
import { useQuery } from "@tanstack/react-query";
import { Check, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { EntityMark } from "@/components/identity/entity-mark";
import { ListRow, QuietLine } from "@/components/kit/list-row";
import { Button } from "@/components/ui/button";
import { known } from "@/components/ui/reading";
import { useAccount } from "@/lib/account/provider";
import { ACTIVE_NETWORK } from "@/lib/constants/auth";
import { MARK_ROW } from "@/lib/constants/brand";
import { ROUTES } from "@/lib/constants/routes";
import { clockTime } from "@/lib/format";
import { handleOf, nameOf } from "@/lib/social/format";
import { useSessionGate } from "@/lib/social/session-gate";

const SEC_PER_MIN = 60;
const SEC_PER_HOUR = 3_600;
const STATUS_STALE_MS = 30_000;
/** An oracle older than this reads "Slow" (closed markets say Closed instead). */
const ORACLE_SLOW_SEC = 3_600;

const age = (sec: number) =>
  sec < SEC_PER_MIN
    ? `${sec}s`
    : sec < SEC_PER_HOUR
      ? `${Math.floor(sec / SEC_PER_MIN)}m`
      : `${Math.floor(sec / SEC_PER_HOUR)}h`;

export function ModeSection() {
  return (
    <div>
      <ListRow
        leading={<EntityMark id={ids.evmChain(ACTIVE_NETWORK.chainId)} size={MARK_ROW} decorative />}
        title="Practice"
        subtitle="Paper money · live now"
        trailing={<Check className="size-4 text-up" aria-label="Active" />}
      />
      <ListRow
        className="opacity-60"
        leading={<EntityMark id={ids.evmChain(MAINNET_CHAIN_ID)} size={MARK_ROW} decorative />}
        title="Mainnet"
        subtitle="Opens with the Mainnet deploy"
        trailing={<Lock className="size-4 text-text-3" aria-label="Not live" />}
      />
    </div>
  );
}

export function StatusSection() {
  const env = useQueryEnv();
  const status = useQuery({
    queryKey: ["status"],
    queryFn: ({ signal }) => env.api.call(statusRoute, {}, { signal }),
    staleTime: STATUS_STALE_MS,
    refetchInterval: STATUS_STALE_MS,
  });
  const value = status.data;
  if (!value)
    return status.isError ? (
      <QuietLine action={{ label: "Retry", onClick: () => void status.refetch() }}>Status unavailable</QuietLine>
    ) : (
      <QuietLine>Checking…</QuietLine>
    );
  const chain = value.chains.find((c) => c.chainId === env.chainId);
  const word = (state: string) =>
    state === "ok" ? "OK" : state === "slow" ? "Slow" : state === "down" ? "Down" : "Unknown";
  return (
    <div>
      {chain ? (
        <>
          <ListRow title="Network" detail={`${word(chain.rpc.state)} · head ${age(chain.headAgeSec ?? 0)}`} value="" />
          {chain.oracles.map((o) => (
            <ListRow
              key={o.symbol}
              title={`Price · ${o.symbol}`}
              value=""
              detail={
                o.status === "OPEN"
                  ? `${(o.ageSec ?? 0) > ORACLE_SLOW_SEC ? "Slow" : "OK"} · ${age(o.ageSec ?? 0)}`
                  : `${o.status === "CLOSED" ? "Closed" : o.status} · ${age(o.ageSec ?? 0)}`
              }
            />
          ))}
          <ListRow
            title="Indexer"
            value=""
            detail={chain.indexerLagBlocks === null ? "Unknown" : `${chain.indexerLagBlocks} blocks behind`}
          />
        </>
      ) : null}
      <ListRow title="Card" value="" detail={word(value.card.state)} />
      <ListRow title="Perpl" value="" detail={word(value.perpl.state)} />
      <ListRow title="Bridges (Aurora)" value="" detail={word(value.aurora.state)} />
      <p className="pt-2 text-meta text-text-3">Checked {clockTime(Date.parse(value.at))}</p>
    </div>
  );
}

export function BlockedMutedSection() {
  const gate = useSessionGate();
  const session = gate.status === "ready" ? gate.session : undefined;
  const blocks = known(useRelations("blocks", session));
  const mutes = known(useRelations("mutes", session));
  const unblock = useRelationToggle("blocks", gate.session);
  const unmute = useRelationToggle("mutes", gate.session);
  if (gate.status === "locked" || gate.status === "failed")
    return <QuietLine action={{ label: "Unlock", onClick: gate.open }}>Unlock to see your lists</QuietLine>;
  if (!blocks || !mutes) return <QuietLine>Loading…</QuietLine>;
  const rows = [
    ...blocks.map((p) => ({ p, kind: "blocks" as const })),
    ...mutes.map((p) => ({ p, kind: "mutes" as const })),
  ];
  if (rows.length === 0) return <QuietLine>No one blocked or muted</QuietLine>;
  return (
    <div>
      {rows.map(({ p, kind }) => (
        <ListRow
          key={`${kind}:${p.address}`}
          title={nameOf(p)}
          subtitle={`${kind === "blocks" ? "Blocked" : "Muted"} · ${handleOf(p)}`}
          trailing={
            <Button
              size="sm"
              variant="secondary"
              onClick={() => (kind === "blocks" ? unblock : unmute).mutate({ address: p.address, on: false })}
            >
              {kind === "blocks" ? "Unblock" : "Unmute"}
            </Button>
          }
        />
      ))}
    </div>
  );
}

export function SignOutSection() {
  const account = useAccount();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <div className="grid gap-3">
      <p className="text-row">Sign out of this browser?</p>
      <p className="text-meta text-text-2">Your account stays; sign in again with the same passkey.</p>
      <Button
        size="xl"
        variant="destructive"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void account
            .signOut()
            .then(() => router.push(ROUTES.welcome))
            .finally(() => setBusy(false));
        }}
      >
        Sign out
      </Button>
    </div>
  );
}
