/** The one `/v1/stream` (D-272): numbers for the bus, tickets and sockets. */

/** Durable events kept for `Last-Event-ID` replay. */
export const REPLAY_RING_SIZE = 2_000;
/**
 * The `time` beat (server time and the price states' digest): every 5 s, so a client notices a dead socket in 5 s and
 * a missed state change heals within one beat (04-pricing R9).
 */
export const HEARTBEAT_MS = 5_000;
/** A socket that has not drained for this long is closed (it skips price frames while blocked). */
export const SLOW_SOCKET_CLOSE_MS = 30_000;
/** A user-topic ticket lives this long (EventSource can't send headers, so the session can't ride along). */
export const STREAM_TICKET_TTL_SEC = 60;
export const MAX_TOPICS = 16;
/** A socket with more than this queued (durable frames it can't drain) is closed; it reconnects and replays. */
export const SOCKET_BACKLOG_MAX_BYTES = 1024 * 1024;
/** Open streams per client IP (several tabs and devices behind one address, never a flood). */
export const MAX_STREAMS_PER_IP = 32;
/** Fan-outs kept for the `/status` µs-per-client percentiles. */
export const FANOUT_SAMPLES = 600;
/** Sockets written per event-loop turn (~1.5 ms of writes): a big fan-out yields between slices. */
export const FANOUT_SLICE = 500;
/** The first reconnect delay the client is told to use (it jitters and doubles it, to 15 s). */
export const RETRY_MS = 1_000;
