/**
 * The device's journal of trades on their way (R5.13): each signed call or ride is written here — its digest, what it
 * was in words, its toast — after the signature and before the send, and taken out once its status settles. What is
 * left after a kill, a reload or a lost answer is re-read on the next launch (`useIntentRecovery`): unknown →
 * checking → filled or refused. Checking only reads the relay's status by digest; nothing is ever sent twice.
 * Per platform storage (`configureIntentJournal`): the browser's store on the web, MMKV on the phone.
 */
import { ApiError, type IntentStatus } from "@senryo/api-client";

export interface JournalStore {
  get(key: string): string | null | undefined;
  set(key: string, value: string): void;
}

/** What the flow knows about a trade before it is signed. */
export interface JournalMark {
  /** In words: "Up BTC 1m", "Up BTC ride". */
  what: string;
  kind: "open" | "close";
  instrument: "call" | "ride";
  symbol: string;
  /** The trade's toast (`tradeToastId`): recovery writes its outcome there. */
  toast: string;
}

export interface JournalEntry extends JournalMark {
  digest: `0x${string}`;
  chainId: number;
  owner: string;
  sentAt: number;
}

const KEY = "senryo.intents.v1";
const MAX_ENTRIES = 20;
/** An intent's deadline is minutes; a day covers any launch gap worth telling about. */
const MAX_AGE_MS = 86_400_000;

let store: JournalStore | undefined;
const memory = new Map<string, string>();
const fallback: JournalStore = { get: (k) => memory.get(k), set: (k, v) => void memory.set(k, v) };

export function configureIntentJournal(s: JournalStore): void {
  store = s;
}

function read(): JournalEntry[] {
  try {
    const raw = (store ?? fallback).get(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    const now = Date.now();
    return parsed.filter(
      (e): e is JournalEntry =>
        typeof e === "object" &&
        e !== null &&
        typeof (e as JournalEntry).digest === "string" &&
        typeof (e as JournalEntry).sentAt === "number" &&
        now - (e as JournalEntry).sentAt < MAX_AGE_MS,
    );
  } catch {
    return [];
  }
}

// Readers follow the journal through `useSyncExternalStore`: a version bump per write.
let version = 0;
const listeners = new Set<() => void>();

export function subscribeJournal(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const journalVersion = (): number => version;

function write(entries: readonly JournalEntry[]): void {
  try {
    (store ?? fallback).set(KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
  } catch {}
  version += 1;
  for (const l of listeners) l();
}

/** Written before the send: a trade the device signed is never forgotten by a crash between the two. */
export function journalIntent(entry: JournalEntry): void {
  write([...read().filter((e) => e.digest !== entry.digest), entry]);
}

export function forgetIntent(digest: string): void {
  const entries = read();
  if (entries.some((e) => e.digest === digest)) write(entries.filter((e) => e.digest !== digest));
}

export function intentsOf(chainId: number, owner: string): JournalEntry[] {
  const who = owner.toLowerCase();
  return read().filter((e) => e.chainId === chainId && e.owner === who);
}

// The trades whose send lost its answer in this run (the network, or the relay failing mid-way): recovery speaks for
// them as it does for a previous launch's, instead of the flow saying "not taken".
const lost = new Set<string>();

/** The send's answer was lost: recovery reads its status and says how it ended. Reads, never sends. */
export function answerLost(digest: string): void {
  lost.add(digest);
  version += 1;
  for (const l of listeners) l();
}

export const wasLost = (digest: string): boolean => lost.has(digest);

const SERVER_ERROR = 500;

/**
 * Send a signed trade with the journal around it (R5.13): written before the send; a relay that answers — taken, or
 * refused in words (a 4xx) — settles what the journal needs to say, a refusal taking it out; an answer lost on the way
 * (the network, a 5xx) leaves it for recovery and returns null.
 */
export async function sendJournalled(
  chainId: number,
  owner: `0x${string}`,
  mark: JournalMark,
  digest: `0x${string}`,
  send: () => Promise<IntentStatus>,
): Promise<IntentStatus | null> {
  journalIntent({ ...mark, digest, chainId, owner: owner.toLowerCase(), sentAt: Date.now() });
  try {
    return await send();
  } catch (error) {
    if (error instanceof ApiError && error.status < SERVER_ERROR) {
      forgetIntent(digest);
      throw error;
    }
    answerLost(digest);
    return null;
  }
}
