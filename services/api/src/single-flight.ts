import { HTTP_STATUS, HttpError } from "@senryo/service-common";

/**
 * One request per key in flight (D-166): a second one fails fast with 409 instead of queueing behind the first.
 * One api instance serves all traffic (D-121), so a process-local set suffices; database constraints and advisory
 * locks stay the source of truth. (routes/starter.ts keeps its own copy for relays; it can move here.)
 */
export class SingleFlight {
  private readonly inflight = new Set<string>();

  constructor(private readonly busyMessage: string) {}

  async run<T>(key: string, work: () => Promise<T>): Promise<T> {
    if (this.inflight.has(key)) throw new HttpError(HTTP_STATUS.conflict, "CONFLICT", this.busyMessage);
    this.inflight.add(key);
    try {
      return await work();
    } finally {
      this.inflight.delete(key);
    }
  }
}
