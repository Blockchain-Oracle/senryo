import type { HttpServer } from "@senryo/service-common";
import { HTTP_STATUS, nowSec } from "@senryo/service-common";
import type { StreamBus } from "./bus.ts";
import {
  HEARTBEAT_MS,
  MAX_STREAMS_PER_IP,
  MAX_TOPICS,
  RETRY_MS,
  SLOW_SOCKET_CLOSE_MS,
  SOCKET_BACKLOG_MAX_BYTES,
} from "./constants.ts";
import { verifyStreamTicket } from "./ticket.ts";

/**
 * `GET /v1/stream?topics=prices,prints,user:0x…&ticket=…` — the one SSE per app (D-272, CWF `http/stream.ts`).
 * Public topics: `prices` (compact ticks, ephemeral), `prints` (every boundary print the moment it streams — the K
 * line clients draw is the one the chain records), `markets` (public call activity). `user:<address>` needs a ticket.
 * A topic that can't be granted (a bad or expired ticket, a topic this api doesn't know) is refused on its own with an
 * `event: topic-error` — the rest still stream, so a broken session never costs anyone prices (04-pricing R8, F9).
 * Only a request with nothing grantable is refused whole.
 * Every 5 s a `time` event carries the server clock (countdowns never trust the phone) and the price states' digest
 * (`h`, one letter per market; changes also go out at once as `h` on `prices`). A socket that can't keep up
 * skips ticks and is closed after 30 s blocked; a reconnect with `Last-Event-ID` replays durable events, or — when it
 * can't (a restart, a gap longer than the ring) — gets `event: reset` and refetches.
 */
const PUBLIC_TOPICS = new Set(["prices", "prints", "markets"]);
const USER_TOPIC = /^user:(0x[0-9a-fA-F]{40})$/;

export interface StreamDeps {
  bus: StreamBus;
  ticketSecret: string | undefined;
  corsOrigins: readonly string[];
  /** Frames sent right after connecting, per topic (the price states and the latest price per feed). */
  snapshot: (topic: string, batched: boolean) => string[];
  /** Fields every `time` beat carries besides the server time (`h`: the price states' digest). */
  beatData: () => Record<string, unknown>;
}

export interface TopicGrant {
  topics: string[];
  refused: { topic: string; reason: string }[];
  error: string | null;
}

export function grantTopics(
  raw: string | undefined,
  ticket: string | undefined,
  secret: string | undefined,
  nowSec: number,
): TopicGrant {
  const asked = [
    ...new Set(
      (raw ?? "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    ),
  ];
  if (asked.length === 0 || asked.length > MAX_TOPICS) {
    return { topics: [], refused: [], error: "topics: 1 to 16 required" };
  }
  const user = ticket && secret ? verifyStreamTicket(secret, ticket, nowSec) : null;
  const topics: string[] = [];
  const refused: TopicGrant["refused"] = [];
  for (const t of asked) {
    const m = USER_TOPIC.exec(t);
    if (PUBLIC_TOPICS.has(t)) topics.push(t);
    else if (!m) refused.push({ topic: t, reason: "unknown topic" });
    else if (user !== m[1]?.toLowerCase()) refused.push({ topic: t, reason: "needs a valid ticket for that address" });
    else topics.push(t.toLowerCase());
  }
  const error = topics.length === 0 ? (refused[0] ? `${refused[0].topic} ${refused[0].reason}` : "no topic") : null;
  return { topics, refused, error };
}

export function registerStreamRoute(app: HttpServer, deps: StreamDeps): void {
  const perIp = new Map<string, number>();
  app.get("/v1/stream", (request, reply) => {
    const q = request.query as { topics?: string; ticket?: string; lastEventId?: string; pp?: string };
    if ((perIp.get(request.ip) ?? 0) >= MAX_STREAMS_PER_IP) {
      return reply.code(HTTP_STATUS.tooMany).send({ error: { code: "RATE_LIMITED", message: "too many streams" } });
    }
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
    // An app that asked for `pp` gets each flush's ticks as one frame; an older one its per-feed `p` frames.
    const batched = q.pp === "1";
    perIp.set(request.ip, (perIp.get(request.ip) ?? 0) + 1);
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
    for (const r of grant.refused) res.write(`event: topic-error\ndata: ${JSON.stringify(r)}\n\n`);

    let blockedSince = 0;
    const write = (text: string, droppable: boolean) => {
      if (!text || (blockedSince && droppable)) return;
      if (!res.write(text) && !blockedSince) blockedSince = Date.now();
      // Durable frames queue while blocked; past the cap the socket goes (it reconnects and replays or resets).
      if (res.writableLength > SOCKET_BACKLOG_MAX_BYTES) res.destroy();
    };
    res.on("drain", () => {
      blockedSince = 0;
    });

    const lastId = request.headers["last-event-id"] ?? q.lastEventId;
    if (typeof lastId === "string" && lastId !== "") {
      const replay = deps.bus.since(lastId, (t) => wanted.has(t));
      if (replay === null) write(`event: reset\ndata: ${JSON.stringify({ epoch: deps.bus.epoch })}\n\n`, false);
      for (const f of replay ?? []) write(f.text, false);
    }
    for (const topic of grant.topics) for (const text of deps.snapshot(topic, batched)) write(text, true);

    const unsubscribe = deps.bus.subscribe((f) => {
      // `legacy` may be "" (a flush with only display ticks): an older app then gets nothing, never the batch.
      if (wanted.has(f.topic)) write(batched || f.legacy === undefined ? f.text : f.legacy, f.seq === 0);
    });
    const beat = setInterval(() => {
      if (blockedSince && Date.now() - blockedSince > SLOW_SOCKET_CLOSE_MS) {
        res.destroy();
        return;
      }
      write(`event: time\ndata: ${JSON.stringify({ t: Date.now(), ...deps.beatData() })}\n\n`, true);
    }, HEARTBEAT_MS);
    write(`event: time\ndata: ${JSON.stringify({ t: Date.now(), ...deps.beatData() })}\n\n`, false);
    request.raw.on("close", () => {
      clearInterval(beat);
      unsubscribe();
      const open = (perIp.get(request.ip) ?? 1) - 1;
      if (open > 0) perIp.set(request.ip, open);
      else perIp.delete(request.ip);
    });
  });
}
