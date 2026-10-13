"use client";
/**
 * A terminal link's intent (D-340: `?lane=300&mode=ride&side=up&position=call:1019`, search's results): the lane and
 * Call or Ride become the terminal's choices, the side and the position are lit ready for a few seconds (never placed,
 * never cashed out) and the position is selected — it drives the chart and its CLOSE is ringed (D-343) — then the link
 * drops its params so Back and a reload don't ask again. A link to a market that isn't listed lands on the last market
 * (`app/not-found.tsx`) with `?missing=`, said once. Reads the params inside its own Suspense boundary (a static export).
 */
import { unknownMarketWords } from "@senryo/calls";
import { setTerminalReady } from "@senryo/calls/react";
import type { CadenceSec } from "@senryo/config";
import { hasIntent, parseIntent } from "@senryo/search";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { notify } from "@/lib/notify";

const MISSING = "missing";

interface Props {
  setCadence: (c: CadenceSec) => void;
  setInstrument: (i: "call" | "ride") => void;
}

function Apply({ setCadence, setInstrument }: Props) {
  const params = useSearchParams();
  const key = params.toString();
  // biome-ignore lint/correctness/useExhaustiveDependencies: the params' text is the trigger; the setters are stable.
  useEffect(() => {
    const missing = params.get(MISSING);
    if (missing) notify({ ...unknownMarketWords(missing), tone: "warning" });
    const intent = parseIntent((k) => params.get(k));
    if (!hasIntent(intent)) {
      if (missing) window.history.replaceState(window.history.state, "", window.location.pathname);
      return;
    }
    if (intent.instrument) setInstrument(intent.instrument);
    if (intent.lane && intent.instrument !== "ride") setCadence(intent.lane);
    setTerminalReady({ side: intent.side ?? null, position: intent.position ?? null });
    window.history.replaceState(window.history.state, "", window.location.pathname);
  }, [key]);
  return null;
}

export function TerminalIntent(props: Props) {
  return (
    <Suspense fallback={null}>
      <Apply {...props} />
    </Suspense>
  );
}
