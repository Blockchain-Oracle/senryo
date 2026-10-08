import type { HttpServer } from "@senryo/service-common";
import { HTTP_STATUS, nowSec } from "@senryo/service-common";
import type { StreamBus } from "./bus.ts";
import { HEARTBEAT_MS, MAX_TOPICS, RETRY_MS, SLOW_SOCKET_CLOSE_MS } from "./constants.ts";
import { verifyStreamTicket } from "./ticket.ts";

/**
 * `GET /v1/stream?topics=prices,prints,user:0x…&ticket=…` — the one SSE per app (D-272, CWF `http/stream.ts`).
 * Public topics: `prices` (compact ticks, ephemeral), `prints` (every boundary print the moment it streams — the K
 * line clients draw is the one the chain records), `markets` (public call activity). `user:<address>` needs a ticket.
 * Every 15 s a `time` event carries the server clock, so countdowns never trust the phone. A socket that can't keep up
 * skips ticks and is closed after 30 s blocked; a reconnect with `Last-Event-ID` replays durable events.
 */
const PUBLIC_TOPICS = new Set(["prices", "prints", "markets"]);
const USER_TOPIC = /^user:(0x[0-9a-fA-F]{40})$/;

export interface StreamDeps {
  bus: StreamBus;
  ticketSecret: string | undefined;
  corsOrigins: readonly string[];
  /** Frames sent right after connecting, per topic (the latest price per feed). */
  snapshot: (topic: string) => string[];
}

export function grantTopics(
  raw: string | undefined,
  ticket: string | undefined,
  secret: string | undefined,
  nowSec: number,
) {
  const topics = [
    ...new Set(
      (raw ?? "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    ),
  ];
  if (topics.length === 0 || topics.length > MAX_TOPICS) return { topics, error: "topics: 1 to 16 required" };
  const user = ticket && secret ? verifyStreamTicket(secret, ticket, nowSec) : null;
  for (const t of topics) {
    if (PUBLIC_TOPICS.has(t)) continue;
    const m = USER_TOPIC.exec(t);
    if (!m) return { topics, error: `unknown topic ${t}` };
    if (user !== m[1]?.toLowerCase()) return { topics, error: `${t} needs a valid ticket for that address` };
  }
  return { topics: topics.map((t) => (t.startsWith("user:") ? t.toLowerCase() : t)), error: null };
}

export function registerStreamRoute(app: HttpServer, deps: StreamDeps): void {
  app.get("/v1/stream", (request, reply) => {
    const q = request.query as { topics?: string; ticket?: string; lastEventId?: string };
    const grant = grantTopics(q.topics, q.ticket, deps.ticketSecret, nowSec());
    const origin = request.headers.origin;
    const cors: Record<string, string> =
      origin && deps.corsOrigins.includes(origin) ? { "access-control-allow-origin": origin, vary: "Origin" } : {};
    if (grant.error) {
      const status = grant.error.includes("ticket") ? HTTP_STATUS.unauthorized : HTTP_STATUS.badRequest;
      return reply
        .code(status)
        .headers(cors)
        .send({ error: { code: "BAD_REQUEST", message: grant.error } });
    }
    const wanted = new Set(grant.topics);
    reply.hijack();
    const res = reply.raw;
    res.writeHead(HTTP_STATUS.ok, {
      ...cors,
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    });
    res.write(`retry: ${RETRY_MS}\n\n`);

    let blockedSince = 0;
    const write = (text: string, droppable: boolean) => {
      if (blockedSince && droppable) return;
      if (!res.write(text) && !blockedSince) blockedSince = Date.now();
    };
    res.on("drain", () => {
      blockedSince = 0;
    });

    const lastId = Number(request.headers["last-event-id"] ?? q.lastEventId ?? Number.NaN);
    const replay = Number.isFinite(lastId) ? deps.bus.since(lastId, (t) => wanted.has(t)) : null;
    for (const f of replay ?? []) write(f.text, false);
    for (const topic of grant.topics) for (const text of deps.snapshot(topic)) write(text, true);

    const unsubscribe = deps.bus.subscribe((f) => {
      if (wanted.has(f.topic)) write(f.text, f.seq === 0);
    });
    const beat = setInterval(() => {
      if (blockedSince && Date.now() - blockedSince > SLOW_SOCKET_CLOSE_MS) {
        res.destroy();
        return;
      }
      write(`event: time\ndata: ${JSON.stringify({ t: Date.now() })}\n\n`, true);
    }, HEARTBEAT_MS);
    write(`event: time\ndata: ${JSON.stringify({ t: Date.now() })}\n\n`, false);
    request.raw.on("close", () => {
      clearInterval(beat);
      unsubscribe();
    });
  });
}
