/** The one `/v1/stream` (D-272): numbers for the bus, tickets and sockets. */

/** Durable events kept for `Last-Event-ID` replay. */
export const REPLAY_RING_SIZE = 2_000;
/** `: ping` with the server time, so the client's countdown offset never trusts the phone clock. */
export const HEARTBEAT_MS = 15_000;
/** A socket that has not drained for this long is closed (it skips price frames while blocked). */
export const SLOW_SOCKET_CLOSE_MS = 30_000;
/** A user-topic ticket lives this long (EventSource can't send headers, so the session can't ride along). */
export const STREAM_TICKET_TTL_SEC = 60;
export const MAX_TOPICS = 16;
/** Reconnect delay the client is told to use. */
export const RETRY_MS = 3_000;
