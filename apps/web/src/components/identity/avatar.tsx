import { shortAddress } from "@senryo/core";
import { WEB_ART } from "@senryo/identity/web";

/** The twelve authored portraits (brand/art/avatars), in their published order. */
export const AVATAR_IDS = Object.keys(WEB_ART)
  .filter((key) => key.startsWith("avatar-"))
  .sort();

const HEX_RADIX = 16;
const ADDRESS_TAIL = 2;

/** The portrait an account shows until its owner picks one: stable for the address, one of the twelve. */
export function defaultAvatar(address: string | undefined): string | undefined {
  if (!address || AVATAR_IDS.length === 0) return undefined;
  const byte = Number.parseInt(address.slice(-ADDRESS_TAIL), HEX_RADIX);
  return AVATAR_IDS[(Number.isNaN(byte) ? 0 : byte) % AVATAR_IDS.length];
}

/**
 * A person's avatar (the phone's Avatar, S1b.3): the profile's chosen portrait, or the account's stable default from
 * the authored set of twelve — never a letter, a colour hash or a fake photo. Decorative: the row names the person.
 */
export function Avatar({ avatar, address, size }: { avatar?: string | null; address?: string; size: number }) {
  const id = avatar && WEB_ART[avatar] ? avatar : defaultAvatar(address);
  const Art = id ? WEB_ART[id]?.symbol : undefined;
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 overflow-hidden rounded-full bg-raised-2"
      style={{ width: size, height: size }}
    >
      {Art ? <Art width={size} height={size} /> : null}
    </span>
  );
}

/** The parts of a public identity a row needs. */
export interface PersonIdentity {
  address: string;
  handle: string | null;
  displayName: string | null;
  avatar?: string | null;
}

/** Display name, else @handle, else the short address. */
export function personName(p: PersonIdentity): string {
  return p.displayName ?? (p.handle ? `@${p.handle}` : shortAddress(p.address));
}

/** The line under the name: the @handle when the name is a display name, else the short address. */
export function personDetail(p: PersonIdentity): string {
  return p.displayName && p.handle ? `@${p.handle}` : shortAddress(p.address);
}
