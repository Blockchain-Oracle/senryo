/**
 * `SessionManager` — the signing session's lifetime (Mera sessions have no TTL, scope or idle lock: all ours).
 * Holds at most one live Mera `Secp256k1SigningSession`; expiry = min(startedAt + TTL, lastUsedAt + idle); a timer
 * locks it on time, and `lock()` zeroes the key (`session.end()`). The snapshot is immutable and only replaced on
 * change, so React reads it with `useSyncExternalStore`.
 */
import type { Secp256k1SigningSession } from "@category-labs/mera";
import type { Address } from "viem";
import { SESSION_IDLE_MS, SESSION_TTL_MS } from "../constants.ts";
import { SessionLockedError } from "../errors.ts";
import type { LockReason, SessionSync } from "../platform/types.ts";
import { emptyUsage, type FaceIdMode, type PolicyUsage } from "../policy/types.ts";

export interface SessionSettings {
  ttlMs: number;
  idleMs: number;
  /** `undefined` → the network default (D-037: practice off, mainnet above threshold). */
  faceId: FaceIdMode | undefined;
}

export const DEFAULT_SETTINGS: SessionSettings = { ttlMs: SESSION_TTL_MS, idleMs: SESSION_IDLE_MS, faceId: undefined };

export type SessionSnapshot =
  | { status: "none" }
  | { status: "locked"; address: Address; reason: LockReason | undefined }
  | { status: "unlocked"; address: Address; startedAt: number; expiresAt: number };

export interface LiveSession {
  readonly address: Address;
  readonly session: Secp256k1SigningSession;
  readonly startedAt: number;
  lastUsedAt: number;
  usage: PolicyUsage;
  /** The account's prefs key (see `OpenedAccount.prefsKey`); zeroed with the session. */
  readonly prefsKey: Uint8Array | undefined;
}

export interface Clock {
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export const systemClock: Clock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof globalThis.setTimeout>),
};

export class SessionManager {
  #live: LiveSession | undefined;
  #address: Address | undefined;
  #reason: LockReason | undefined;
  #snapshot: SessionSnapshot = { status: "none" };
  #timer: unknown;
  readonly #listeners = new Set<() => void>();
  #settings: SessionSettings;
  readonly #clock: Clock;
  readonly #sync: SessionSync | undefined;
  readonly #unsubscribeSync: (() => void) | undefined;

  constructor(options: { clock?: Clock; sync?: SessionSync; settings?: SessionSettings } = {}) {
    this.#clock = options.clock ?? systemClock;
    this.#settings = options.settings ?? DEFAULT_SETTINGS;
    this.#sync = options.sync;
    this.#unsubscribeSync = this.#sync?.subscribe((event) => {
      // Another tab unlocked, locked or signed out: never keep a second live key in this tab.
      if (event.type === "signed-out") this.clear();
      else if (this.#live) this.lock(event.type === "unlocked" ? "other-tab" : event.reason, false);
    });
  }

  get settings(): SessionSettings {
    return this.#settings;
  }

  /** Apply new timing/Face ID settings. Loosening must be step-up-approved by the caller (`isLoosening`). */
  applySettings(next: SessionSettings): void {
    this.#settings = next;
    this.#reschedule();
    this.#emit();
  }

  snapshot = (): SessionSnapshot => this.#snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  /** The known account (from the hint) with no live key: LOCKED. `undefined` → no account on this device. */
  setIdentity(address: Address | undefined): void {
    if (this.#live && this.#live.address !== address) this.lock("manual");
    this.#address = address;
    this.#emit();
  }

  /** Starts a session with a freshly derived key (ends any previous one first). */
  start(address: Address, session: Secp256k1SigningSession, prefsKey?: Uint8Array): void {
    this.#end();
    const now = this.#clock.now();
    this.#address = address;
    this.#reason = undefined;
    this.#live = { address, session, startedAt: now, lastUsedAt: now, usage: emptyUsage(), prefsKey };
    this.#reschedule();
    this.#emit();
    this.#sync?.publish({ type: "unlocked", address, tab: this.#sync.tab });
  }

  expiresAt(): number | undefined {
    const live = this.#live;
    if (!live) return undefined;
    return Math.min(live.startedAt + this.#settings.ttlMs, live.lastUsedAt + this.#settings.idleMs);
  }

  /** The live session if it has not expired (an expired one is locked on the spot). */
  live(): LiveSession | undefined {
    const at = this.expiresAt();
    if (at !== undefined && this.#clock.now() >= at) this.lock(this.#expiryReason());
    return this.#live;
  }

  /** Runs `fn` with the live session and marks it used; throws `SessionLockedError` when locked. */
  async use<T>(fn: (live: LiveSession) => Promise<T>): Promise<T> {
    const live = this.live();
    if (!live) throw new SessionLockedError();
    const out = await fn(live);
    live.lastUsedAt = this.#clock.now();
    this.#reschedule();
    this.#emit();
    return out;
  }

  lock(reason: LockReason, broadcast = true): void {
    const had = this.#live !== undefined;
    this.#end();
    this.#reason = reason;
    this.#emit();
    if (had && broadcast) this.#sync?.publish({ type: "locked", reason, tab: this.#sync.tab });
  }

  /** Sign out: no live key and no identity. */
  clear(broadcast = false): void {
    this.#end();
    this.#address = undefined;
    this.#reason = undefined;
    this.#emit();
    if (broadcast) this.#sync?.publish({ type: "signed-out", tab: this.#sync.tab });
  }

  dispose(): void {
    this.#end();
    this.#unsubscribeSync?.();
    this.#listeners.clear();
  }

  #expiryReason(): LockReason {
    const live = this.#live;
    if (!live) return "idle";
    return live.startedAt + this.#settings.ttlMs <= live.lastUsedAt + this.#settings.idleMs ? "ttl" : "idle";
  }

  #end(): void {
    if (this.#timer !== undefined) this.#clock.clearTimeout(this.#timer);
    this.#timer = undefined;
    // Zeroes the key copy; later signing through it throws SESSION_ENDED (Mera session.ts).
    this.#live?.session.end();
    this.#live?.prefsKey?.fill(0);
    this.#live = undefined;
  }

  #reschedule(): void {
    if (this.#timer !== undefined) this.#clock.clearTimeout(this.#timer);
    this.#timer = undefined;
    const at = this.expiresAt();
    if (at === undefined) return;
    this.#timer = this.#clock.setTimeout(() => this.live(), Math.max(0, at - this.#clock.now()));
  }

  #emit(): void {
    const live = this.#live;
    const next: SessionSnapshot = live
      ? { status: "unlocked", address: live.address, startedAt: live.startedAt, expiresAt: this.expiresAt() ?? 0 }
      : this.#address
        ? { status: "locked", address: this.#address, reason: this.#reason }
        : { status: "none" };
    if (JSON.stringify(next) === JSON.stringify(this.#snapshot)) return;
    this.#snapshot = next;
    for (const listener of this.#listeners) listener();
  }
}

/** Longer TTL/idle, or a weaker Face ID mode, is "loosening" and needs a step-up (plan §2.4). */
export function isLoosening(prev: SessionSettings, next: SessionSettings, networkDefault: FaceIdMode): boolean {
  const strength: Record<FaceIdMode, number> = { off: 0, "above-threshold": 1, "every-trade": 2 };
  const faceWeaker = strength[next.faceId ?? networkDefault] < strength[prev.faceId ?? networkDefault];
  return next.ttlMs > prev.ttlMs || next.idleMs > prev.idleMs || faceWeaker;
}
