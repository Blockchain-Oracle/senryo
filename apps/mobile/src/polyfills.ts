import { install } from "react-native-quick-crypto";

/**
 * Loaded first from index.ts (ported). Only what the app needs; the pre-existing kit's web-reuse shims (localStorage,
 * relative fetch, window events) are not ported because Senryo shares packages, not web source.
 */

// WebCrypto for Hermes: global.crypto.getRandomValues + subtle, and global.Buffer. Mera (S6) derives the account and
// signs through these; viem's random key paths use getRandomValues.
install();

/** Hermes ships AbortController without these two statics; the API client bounds its fetches with them. */
const TIMEOUT_MESSAGE = "The operation timed out.";
const Signal = globalThis.AbortSignal as typeof AbortSignal & { timeout?: unknown; any?: unknown };
if (Signal && typeof Signal.timeout !== "function") {
  Signal.timeout = (ms: number) => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(new Error(TIMEOUT_MESSAGE)), ms);
    return controller.signal;
  };
}
if (Signal && typeof Signal.any !== "function") {
  Signal.any = (signals: AbortSignal[]) => {
    const controller = new AbortController();
    for (const signal of signals) {
      if (signal.aborted) {
        controller.abort(signal.reason);
        break;
      }
      signal.addEventListener("abort", () => controller.abort(signal.reason), { once: true });
    }
    return controller.signal;
  };
}

/**
 * Dev only: React 19.2's development renderer logs changed props with JSON.stringify, which throws on a bigint and
 * wedges the renderer. Money is bigint by rule, so dev builds would freeze on a money prop; release builds never log.
 */
if (__DEV__) {
  const proto = BigInt.prototype as unknown as { toJSON?: () => string };
  if (typeof proto.toJSON !== "function") {
    proto.toJSON = function toJSON(this: bigint) {
      return this.toString();
    };
  }
}
