"use client";

/**
 * Who the money goes to (flow book B7 step 1 / B8 step 2; Phantom grammar): one field — "Name, @handle or address" —
 * with Paste, then (Send) recents and the people you follow. An @handle resolves through the profile service; an
 * address is taken as typed (its checksum and the chain checks run on the next step). The web has no camera scan in
 * this step: Paste is the named alternative (flow book G6).
 */
import { useProfile } from "@senryo/query";
import { ClipboardPaste } from "lucide-react";
import { useState } from "react";
import { Avatar, personDetail, personName } from "@/components/identity/avatar";
import { ListRow, QuietLine } from "@/components/kit/list-row";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { known } from "@/components/ui/reading";
import { MARK_ROW } from "@/lib/constants/brand";
import type { Person } from "@/lib/money/people";

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const HANDLE = /^@?[a-z0-9_]{2,20}$/i;

export interface PickedRecipient {
  address: `0x${string}`;
  handle: string | null;
  /** "@kai", or the address itself. */
  label: string;
  avatar: string | null;
}

export function RecipientStep({
  people,
  initial,
  placeholder,
  onPick,
}: {
  people: readonly Person[];
  initial: string;
  placeholder: string;
  onPick: (r: PickedRecipient) => void;
}) {
  const [text, setText] = useState(initial);
  const value = text.trim();
  const isAddress = ADDRESS.test(value);
  const handle = !isAddress && HANDLE.test(value) ? value.replace(/^@/, "").toLowerCase() : undefined;
  const profile = useProfile(handle);
  const found = known(profile);
  const paste = () =>
    void navigator.clipboard
      ?.readText()
      .then((t) => setText(t.trim()))
      .catch(() => undefined);
  return (
    <div className="grid gap-4">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (isAddress) onPick({ address: value as `0x${string}`, handle: null, label: value, avatar: null });
        }}
      >
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          autoComplete="off"
          spellCheck={false}
          className="font-mono"
        />
        <Button type="button" variant="outline" onClick={paste} aria-label="Paste">
          <ClipboardPaste />
          <span className="hidden sm:inline">Paste</span>
        </Button>
      </form>
      {isAddress ? (
        <Button
          size="xl"
          onClick={() => onPick({ address: value as `0x${string}`, handle: null, label: value, avatar: null })}
        >
          Continue
        </Button>
      ) : handle ? (
        found ? (
          <ListRow
            leading={<Avatar avatar={found.avatar} address={found.address} size={MARK_ROW} />}
            title={personName(found)}
            subtitle={personDetail(found)}
            onClick={() =>
              onPick({
                address: found.address as `0x${string}`,
                handle: found.handle,
                label: found.handle ? `@${found.handle}` : found.address,
                avatar: found.avatar,
              })
            }
          />
        ) : profile.status === "failed" ? (
          <QuietLine>No one with that handle</QuietLine>
        ) : (
          <QuietLine>Looking up @{handle}…</QuietLine>
        )
      ) : value.length > 0 ? (
        <QuietLine>An @handle or a 0x address</QuietLine>
      ) : null}
      {people.length > 0 && value.length === 0 ? (
        <section className="grid gap-1">
          <h2 className="text-meta text-text-2">Recents and following</h2>
          {people.map((p) => (
            <ListRow
              key={p.address}
              leading={<Avatar avatar={p.avatar} address={p.address} size={MARK_ROW} />}
              title={personName(p)}
              subtitle={p.recent ? `Recent · ${personDetail(p)}` : personDetail(p)}
              onClick={() =>
                onPick({
                  address: p.address as `0x${string}`,
                  handle: p.handle,
                  label: p.handle ? `@${p.handle}` : p.address,
                  avatar: p.avatar,
                })
              }
            />
          ))}
        </section>
      ) : null}
    </div>
  );
}
