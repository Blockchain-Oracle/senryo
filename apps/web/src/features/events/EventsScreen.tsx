"use client";
/**
 * Events (S8.7, D-296; the web's `/app/events/`, the phone's Events screen; Owarine's event board): real games as yes/no
 * questions, soonest close first, each with its pools moving live and Yes / No in place; the ones just settled after;
 * how a question settles and your calls beside. Until the book is on this network the board says what it waits for,
 * and how it settles stays readable.
 */
import { eventPhase, leagueName } from "@senryo/calls";
import { useEventsFlow } from "@senryo/calls/react";
import { EVENTS, LEAGUES } from "@senryo/config";
import { useServerSeconds } from "@senryo/live/react";
import { useAccount } from "@/lib/account/provider";
import { fire } from "@/lib/feedback";
import { notify } from "@/lib/notify";
import { DRAWERS, openDrawer } from "@/lib/shell/drawer-param";
import { EventCard } from "./EventCard";
import { HowItSettles, YourEventCalls } from "./EventSide";
import { SourceMark } from "./SourceMark";

export function EventsScreen() {
  const account = useAccount();
  const now = useServerSeconds();
  const flow = useEventsFlow(account, {
    cue: (c) => (c === "filled" ? fire("filled", { cue: "open" }) : fire(c)),
    notify: (n) => notify({ ...n, tone: "warning" }),
    needAccount: () =>
      notify({
        title: "Sign in to call",
        description: "Your passkey is your account.",
        action: { label: "Sign in", onClick: () => openDrawer(DRAWERS.account) },
      }),
  });
  const open = flow.events.filter((e) => eventPhase(e, now) === "open");
  const rest = flow.events.filter((e) => eventPhase(e, now) !== "open");
  const blocked = !flow.limits ? "Events are Practice only" : null;
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex flex-col gap-6">
        <p className="text-body text-text-2">Real games · Yes or No · winners share the losing side</p>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-meta text-text-2">
          {LEAGUES.map((l) => (
            <span key={l.key} className="flex items-center gap-1.5">
              <SourceMark source="league" league={l.key} />
              {leagueName(l.key)}
            </span>
          ))}
        </p>
        {!flow.live ? (
          <p className="text-body text-text-2" role="status">
            Events aren't open yet.
          </p>
        ) : flow.boardStatus === "failed" ? (
          <p className="text-body text-text-2" role="status">
            The board can't be read right now · it retries on its own
          </p>
        ) : open.length === 0 && rest.length === 0 ? (
          <p className="text-body text-text-2" role="status">
            {flow.boardStatus === "unknown"
              ? "Reading the board…"
              : "No games open right now · new ones list as their day comes up"}
          </p>
        ) : null}
        {open.length > 0 ? (
          <section aria-label="Open questions" className="grid gap-4 md:grid-cols-2">
            {open.map((e) => (
              <EventCard key={e.eventId} event={e} flow={flow} now={now} blocked={blocked} />
            ))}
          </section>
        ) : null}
        {rest.length > 0 ? (
          <section aria-label="Under way and settled" className="flex flex-col gap-3">
            <h2 className="font-semibold text-section-title">Under way and settled</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {rest.map((e) => (
                <EventCard key={e.eventId} event={e} flow={flow} now={now} blocked={blocked} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
      <div className="flex flex-col gap-8 lg:sticky lg:top-6 lg:self-start">
        <HowItSettles committee={flow.committee} feeBps={EVENTS.feeBps} />
        <YourEventCalls calls={flow.calls} signedIn={Boolean(flow.owner)} />
      </div>
    </div>
  );
}
