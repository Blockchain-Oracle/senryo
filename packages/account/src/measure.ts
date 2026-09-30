/**
 * Measurement hooks (S6.10; D-029 prompt counts, D-037 TTFT). Events carry no secrets — never addresses' keys, PRF
 * bytes or phrases; the address is public. Apps keep them in a local ring buffer and (S12) post them to `/v1/events`.
 * Log line format: `senryo.measure <json>` with the event below; one line per event.
 */
export type Flow = "create" | "sign-in" | "unlock" | "gate" | "step-up" | "reveal" | "vault-create" | "vault-recover";
export type Ceremony = "passkey-create" | "passkey-get" | "biometric";

export type MeasureEvent =
  | { type: "prompt"; flow: Flow; ceremony: Ceremony; index: number; at: number }
  | {
      type: "flow";
      flow: Flow;
      outcome: "ok" | "failed" | "cancelled";
      prompts: number;
      ms: number;
      failure?: string;
      at: number;
    }
  /** Time to first user-signed, confirmed transaction (practice claim): landing → finalized. */
  | { type: "ttft"; phase: "start" | "stop"; taps: number; at: number };

export type MeasureSink = (event: MeasureEvent) => void;

export const MEASURE_PREFIX = "senryo.measure";

export function formatMeasure(event: MeasureEvent): string {
  return `${MEASURE_PREFIX} ${JSON.stringify(event)}`;
}

/** TTFT in ms from a start/stop pair (`undefined` until both exist). */
export function ttftMs(events: readonly MeasureEvent[]): number | undefined {
  const start = events.find((e) => e.type === "ttft" && e.phase === "start");
  const stop = events.find((e) => e.type === "ttft" && e.phase === "stop");
  return start && stop ? stop.at - start.at : undefined;
}
