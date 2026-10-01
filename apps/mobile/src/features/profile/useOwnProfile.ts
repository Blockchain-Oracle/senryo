/**
 * The signed-in account's own profile, for the You tab and the editor (J9; D-174 privacy rules).
 *
 * Two reads, never a prompt:
 * - the owner's view (`/v1/profile`, every per-network setting) needs an API session, and creating one signs — so it
 *   is asked only while the trading session is unlocked. A locked phone keeps what it already read; it never raises
 *   Face ID just because a tab was opened;
 * - the public view on the selected network (`/v1/profile/:address`) carries the follower counts. It answers 404
 *   when the profile isn't listed there, so it is skipped once the owner's view says so.
 * Nothing is invented: no profile is `profile: null`, an unknown count is `undefined`.
 */
import type { Address } from "@senryo/account";
import type { MyProfile } from "@senryo/api-client";
import { socialKeys, useMyProfile, useProfile } from "@senryo/query";
import { useQueryClient } from "@tanstack/react-query";
import { useAccount } from "~/lib/account/provider";
import { useSessionRunner } from "~/lib/account/use-session-runner";
import { useNetwork } from "~/lib/network";

export interface ProfileIdentity {
  handle: string | null;
  displayName: string | null;
  bio: string | null;
  avatar: string | null;
  /** ISO time of the first save. */
  createdAt: string;
}

export type OwnProfile =
  /** Nothing known yet and a read is on its way. */
  | { kind: "loading" }
  /** Locked, and the public view has nothing (unlisted here, or no profile): unlocking loads it. */
  | { kind: "locked" }
  | { kind: "failed"; retry: () => void }
  | {
      kind: "ready";
      /** Null when the account has never saved a profile. */
      identity: ProfileIdentity | null;
      /** The owner's settings; undefined while only the public view is known (locked). */
      own: MyProfile | null | undefined;
      /** Listed on the selected network; undefined while the owner's view is unknown. */
      listedHere: boolean | undefined;
      /** From the public view on the selected network; undefined when unlisted or still loading. */
      counts: { followers: number; following: number } | undefined;
      countsLoading: boolean;
    };

export function useOwnProfile(): { address: Address | undefined; unlocked: boolean; profile: OwnProfile } {
  const account = useAccount();
  const network = useNetwork();
  const client = useQueryClient();
  const runner = useSessionRunner();
  const address = account.hint?.address;
  const unlocked = account.snapshot.status === "unlocked";
  const mine = useMyProfile(address, unlocked ? runner : undefined);
  const own = mine.status === "fresh" || mine.status === "stale" ? mine.value : undefined;
  const practice = network.key === "testnet";
  const listedHere = own ? (practice ? own.listedPractice : own.listedMainnet) : own === null ? false : undefined;
  const shown = useProfile(address && listedHere !== false ? address : undefined);
  const visible = shown.status === "fresh" || shown.status === "stale" ? shown.value : undefined;

  let profile: OwnProfile;
  if (own !== undefined || visible) {
    profile = {
      kind: "ready",
      identity: own ?? visible ?? null,
      own,
      listedHere: listedHere ?? (visible ? true : undefined),
      counts: visible ? { followers: visible.followers, following: visible.following } : undefined,
      countsLoading: listedHere !== false && shown.status === "unknown",
    };
  } else if (unlocked) {
    profile =
      mine.status === "failed"
        ? {
            kind: "failed",
            retry: () => {
              if (address) void client.invalidateQueries({ queryKey: socialKeys.me(address) });
            },
          }
        : { kind: "loading" };
  } else {
    profile = shown.status === "unknown" ? { kind: "loading" } : { kind: "locked" };
  }
  return { address, unlocked, profile };
}
