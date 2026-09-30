import { type Logger as PinoLogger, pino } from "pino";

export type Logger = PinoLogger;

/** Never logged: auth headers, webhook signatures, keys, tokens, blobs (pino `redact`). */
const REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  'req.headers["webhook-signature"]',
  'req.headers["x-api-key"]',
  "*.privateKey",
  "*.secret",
  "*.token",
  "*.signature",
  "*.blob",
  "*.vault",
];

/** Structured JSON logs to stdout (Coolify collects them). */
export function createLogger(service: string, level: string = process.env.LOG_LEVEL ?? "info"): Logger {
  return pino({
    level,
    base: { service },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: { paths: REDACT_PATHS, censor: "[redacted]" },
  });
}
