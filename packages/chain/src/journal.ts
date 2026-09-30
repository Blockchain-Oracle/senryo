import type { GasAction } from "@senryo/config";
import type { TxStage } from "@senryo/core";
import type { Address, Hex } from "viem";

/**
 * Every tx is journalled before it is broadcast, with its signed bytes, so a crash or app kill never loses track of
 * it: on restart `TxRecovery` (apps) / the outbox (services) reconciles each non-terminal entry against the chain —
 * re-broadcasting the *same* signed bytes at most, never signing a replacement. Apps back this with MMKV/localStorage
 * (`kvJournal`), services with Postgres, tests with `MemoryJournal`.
 */
export interface JournalEntry {
  hash: Hex;
  chainId: number;
  from: Address;
  to: Address;
  nonce: number;
  gas: string;
  action: GasAction | string;
  /** Signed serialized tx (re-broadcast only). */
  raw: Hex;
  stage: TxStage;
  blockNumber?: string | undefined;
  blockHash?: Hex | undefined;
  error?: string | undefined;
  createdAt: number;
  updatedAt: number;
  /** Caller context (e.g. `{ holdId }`), JSON-safe. */
  meta?: Record<string, string> | undefined;
}

export interface TxJournal {
  put(entry: JournalEntry): Promise<void>;
  update(hash: Hex, patch: Partial<Omit<JournalEntry, "hash">>): Promise<void>;
  list(): Promise<JournalEntry[]>;
  remove(hash: Hex): Promise<void>;
}

export class MemoryJournal implements TxJournal {
  private readonly entries = new Map<string, JournalEntry>();

  async put(entry: JournalEntry): Promise<void> {
    this.entries.set(entry.hash, entry);
  }

  async update(hash: Hex, patch: Partial<Omit<JournalEntry, "hash">>): Promise<void> {
    const entry = this.entries.get(hash);
    if (entry) this.entries.set(hash, { ...entry, ...patch, updatedAt: Date.now() });
  }

  async list(): Promise<JournalEntry[]> {
    return [...this.entries.values()];
  }

  async remove(hash: Hex): Promise<void> {
    this.entries.delete(hash);
  }
}

/** Synchronous string store (MMKV instance, `window.localStorage`). */
export interface KvStore {
  getItem(key: string): string | null | undefined;
  setItem(key: string, value: string): void;
}

export const DEFAULT_JOURNAL_KEY = "senryo.tx-journal.v1";

/** Journal persisted as one JSON document in a key-value store (few entries; terminal ones are removed). */
export function kvJournal(store: KvStore, key: string = DEFAULT_JOURNAL_KEY): TxJournal {
  const load = (): Record<string, JournalEntry> => {
    try {
      return JSON.parse(store.getItem(key) ?? "{}") as Record<string, JournalEntry>;
    } catch {
      return {};
    }
  };
  const save = (all: Record<string, JournalEntry>) => store.setItem(key, JSON.stringify(all));
  return {
    async put(entry) {
      save({ ...load(), [entry.hash]: entry });
    },
    async update(hash, patch) {
      const all = load();
      const entry = all[hash];
      if (entry) save({ ...all, [hash]: { ...entry, ...patch, updatedAt: Date.now() } });
    },
    async list() {
      return Object.values(load());
    },
    async remove(hash) {
      const all = load();
      delete all[hash];
      save(all);
    },
  };
}
