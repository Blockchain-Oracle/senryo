/**
 * Who you can send to in one tap (B7 step 1, B13): the addresses this account sent money to — from this phone's
 * journal (any asset) and the indexed sends — then the people it follows. Each person once, recents first. The same
 * set says whether a recipient is new ("First send to this address").
 */
import type { Address } from "@senryo/core";
import { useFollowList, useQueryEnv, useRecentRecipients } from "@senryo/query";
import { journalRecipients } from "~/features/money/recipient";

const PEOPLE_MAX = 12;

export interface Person {
  address: string;
  handle: string | null;
  displayName: string | null;
  avatar: string | null;
  recent: boolean;
}

export function usePeople(me: Address | undefined) {
  const env = useQueryEnv();
  const indexed = useRecentRecipients(me);
  const following = useFollowList(me, "following");
  const indexedList = indexed.status === "fresh" || indexed.status === "stale" ? indexed.value : [];
  const followList =
    following.reading.status === "fresh" || following.reading.status === "stale" ? following.reading.value : [];
  const journal = me ? journalRecipients(env.chainId, me) : [];
  const known: ReadonlySet<string> = new Set([...journal, ...indexedList.map((r) => r.address.toLowerCase())]);
  const people: Person[] = [];
  const seen = new Set<string>();
  const add = (p: Person) => {
    const key = p.address.toLowerCase();
    if (seen.has(key) || key === me?.toLowerCase()) return;
    seen.add(key);
    people.push(p);
  };
  for (const address of journal) add({ address, handle: null, displayName: null, avatar: null, recent: true });
  for (const r of indexedList) add({ address: r.address, handle: null, displayName: null, avatar: null, recent: true });
  for (const f of followList) {
    const key = f.address.toLowerCase();
    const existing = people.find((p) => p.address.toLowerCase() === key);
    if (existing) {
      existing.handle = f.handle;
      existing.displayName = f.displayName;
      existing.avatar = f.avatar;
      continue;
    }
    add({ address: f.address, handle: f.handle, displayName: f.displayName, avatar: f.avatar, recent: false });
  }
  return {
    people: people.slice(0, PEOPLE_MAX),
    known,
    loading: indexed.status === "unknown" && following.reading.status === "unknown",
  };
}
