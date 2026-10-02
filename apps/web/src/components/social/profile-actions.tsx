"use client";

/**
 * ⋯ on someone else's profile (flow book F5; the phone's SocialActions): Mute (your feed only), Block (removes follows
 * both ways; asks once more before it acts), Report with a reason. Each acts at once on the api session (one passkey
 * prompt when locked, on the click) and can be undone from here; the lists live in Settings → Blocked & muted.
 */
import { type Address, REPORT_REASONS } from "@senryo/api-client";
import { useRelations, useRelationToggle, useReport } from "@senryo/query";
import { Ellipsis } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ListRow } from "@/components/kit/list-row";
import { known } from "@/components/ui/reading";
import { ROUTES } from "@/lib/constants/routes";
import { sameAddress, socialErrorCopy } from "@/lib/social/format";
import { useSessionGate } from "@/lib/social/session-gate";
import { cn } from "@/lib/utils";

export function ProfileActions({ other, name }: { other: Address; name: string }) {
  const gate = useSessionGate();
  const [open, setOpen] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [note, setNote] = useState<string>();
  const mutes = known(useRelations("mutes", gate.status === "ready" ? gate.session : undefined));
  const blocks = known(useRelations("blocks", gate.status === "ready" ? gate.session : undefined));
  const mute = useRelationToggle("mutes", gate.session);
  const block = useRelationToggle("blocks", gate.session);
  const report = useReport(gate.session);
  const muted = mutes?.some((m) => sameAddress(m.address, other)) ?? false;
  const blocked = blocks?.some((b) => sameAddress(b.address, other)) ?? false;
  const fail = (e: unknown) => setNote(socialErrorCopy(e, "Didn’t go through · try again"));
  if (sameAddress(gate.address, other)) return null;
  return (
    <div className="relative">
      <button
        type="button"
        aria-label="More: mute, block or report"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="inline-flex size-9 items-center justify-center rounded-full bg-raised-2 hover:bg-row-pressed"
      >
        <Ellipsis className="size-4" />
      </button>
      {open ? (
        <div className="absolute top-11 right-0 z-20 grid w-64 rounded-md bg-popover p-2 shadow-sheet">
          {gate.status === "guest" ? (
            <ListRow title="Create an account" href={ROUTES.welcome} />
          ) : reporting ? (
            <div className="grid gap-1 p-1">
              <p className="text-meta text-text-2">Report {name} for</p>
              <div className="flex flex-wrap gap-1">
                {REPORT_REASONS.map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() =>
                      report.mutate(
                        { profile: other, reason },
                        { onSuccess: () => setNote("Reported · thank you"), onError: fail },
                      )
                    }
                    className="h-7 rounded-full bg-raised-2 px-3 text-meta capitalize hover:bg-row-pressed"
                  >
                    {reason}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              <ListRow
                title={muted ? "Unmute" : "Mute"}
                subtitle="Your feed only"
                onClick={() => mute.mutate({ address: other, on: !muted }, { onError: fail })}
              />
              <ListRow
                title={blocked ? "Unblock" : confirmBlock ? `Block ${name}?` : "Block"}
                subtitle={blocked ? undefined : confirmBlock ? "Click again to block" : "Removes follows both ways"}
                className={cn(confirmBlock && !blocked && "text-down")}
                onClick={() => {
                  if (!blocked && !confirmBlock) return setConfirmBlock(true);
                  block.mutate(
                    { address: other, on: !blocked },
                    { onError: fail, onSettled: () => setConfirmBlock(false) },
                  );
                }}
              />
              <ListRow title="Report" onClick={() => setReporting(true)} />
              <Link
                href={`${ROUTES.account}?section=blocked`}
                className="px-2 py-1 text-meta text-link hover:underline"
              >
                Blocked & muted ›
              </Link>
            </>
          )}
          {note ? <p className="px-2 pt-1 text-meta text-text-2">{note}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
