"use client";

/**
 * Diagnostics (S6.10): what this device measured — prompts per ceremony (D-029: one or two on create?), flow timings
 * and TTFT (D-037). Read off here for the per-authenticator report; nothing secret is recorded.
 */
import { type MeasureEvent, ttftMs } from "@senryo/account";
import { useSyncExternalStore } from "react";
import { Panel } from "@/components/shell/primitives";
import { Button } from "@/components/ui/button";
import { measureStore } from "@/lib/account/measure";

const MS_PER_S = 1_000;
const SHOWN_FLOWS = 8;
const EMPTY: readonly MeasureEvent[] = [];

function seconds(ms: number): string {
  return `${(ms / MS_PER_S).toFixed(1)} s`;
}

export function DiagnosticsPanel() {
  const events = useSyncExternalStore(measureStore.subscribe, measureStore.get, () => EMPTY);
  const flows = events
    .filter((e): e is Extract<MeasureEvent, { type: "flow" }> => e.type === "flow")
    .slice(-SHOWN_FLOWS);
  const ttft = ttftMs(events);
  const stop = events.find(
    (e): e is Extract<MeasureEvent, { type: "ttft" }> => e.type === "ttft" && e.phase === "stop",
  );
  return (
    <Panel>
      <div className="flex items-center justify-between border-border border-b px-3 py-3">
        <div>
          <p className="text-row">Time to first transaction</p>
          <p className="text-meta text-text-2">Landing → first confirmed, user-signed claim on this device.</p>
        </div>
        <span className="font-mono text-num-sm tnum">
          {ttft === undefined ? "—" : `${seconds(ttft)} · ${stop?.taps ?? 0} taps`}
        </span>
      </div>
      {flows.length === 0 ? (
        <p className="px-3 py-3 text-meta text-text-2">No passkey ceremonies recorded on this device yet.</p>
      ) : (
        <table className="w-full text-meta tnum">
          <thead className="text-text-3">
            <tr className="border-border border-b">
              <th className="px-3 py-2 text-left font-normal">Flow</th>
              <th className="px-3 py-2 text-right font-normal">Prompts</th>
              <th className="px-3 py-2 text-right font-normal">Time</th>
              <th className="px-3 py-2 text-right font-normal">Result</th>
            </tr>
          </thead>
          <tbody>
            {flows.map((f) => (
              <tr key={`${f.flow}-${f.at}`} className="border-border border-b last:border-0">
                <td className="px-3 py-1.5">{f.flow}</td>
                <td className="px-3 py-1.5 text-right tnum">{f.outcome === "ok" ? f.prompts : "—"}</td>
                <td className="px-3 py-1.5 text-right tnum">{seconds(f.ms)}</td>
                <td
                  className={f.outcome === "ok" ? "px-3 py-1.5 text-right text-up" : "px-3 py-1.5 text-right text-down"}
                >
                  {f.outcome === "ok" ? "OK" : (f.failure ?? f.outcome).toUpperCase()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="flex justify-end border-border border-t px-3 py-2">
        <Button variant="ghost" size="sm" onClick={() => measureStore.clear()} disabled={events.length === 0}>
          Clear log
        </Button>
      </div>
    </Panel>
  );
}
