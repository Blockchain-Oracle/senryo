import { HANDLE_TOMBSTONE_DAYS, type SocialDelete } from "@senryo/api-client";
import type { Db } from "@senryo/service-common";
import { LOCK_NS } from "./constants.ts";
import { advisoryLock, rethrowDeadlock } from "./shared.ts";

/**
 * "Delete my data" (S12b.8, App Store 5.1.1(v)), one transaction:
 * - deleted: the profile; push tokens and their delivery tickets; backup-passkey vaults; encrypted prefs; and what its
 *   notifications said (the dedupe keys stay, without title, body, link or subject, so an old event is never pushed
 *   again). Onchain calls are public and permanent, which the app says.
 * - unlinked: first-party analytics events keep their counts but lose the address;
 * - kept: the released handle's 30-day hold (Q-022 default: nobody can instantly re-claim it to impersonate).
 */
export async function deleteSocialData(db: Db, address: string): Promise<SocialDelete> {
  try {
    return await db.begin(async (tx) => {
      await advisoryLock(tx, LOCK_NS.profile, address);
      const [profile] = await tx<{ handle: string | null }[]>`
        SELECT handle FROM profiles WHERE address = ${address} FOR UPDATE`;
      let handleHeldUntil: Date | null = null;
      if (profile?.handle) {
        await advisoryLock(tx, LOCK_NS.handle, profile.handle);
        const [held] = await tx<{ held_until: Date }[]>`
          INSERT INTO handle_tombstones (handle, address, held_until)
          VALUES (${profile.handle}, ${address}, now() + make_interval(days => ${HANDLE_TOMBSTONE_DAYS}))
          ON CONFLICT (handle) DO UPDATE
            SET address = EXCLUDED.address, released_at = now(), held_until = EXCLUDED.held_until
          RETURNING held_until`;
        handleHeldUntil = held?.held_until ?? null;
      }
      const profiles = await tx`DELETE FROM profiles WHERE address = ${address} RETURNING address`;
      await tx`DELETE FROM push_tickets WHERE token IN (SELECT token FROM push_tokens WHERE user_address = ${address})`;
      const pushTokens = await tx`DELETE FROM push_tokens WHERE user_address = ${address} RETURNING token`;
      const vaults = await tx`DELETE FROM vault_blobs WHERE address = ${address} RETURNING credential_id`;
      const prefs = await tx`DELETE FROM prefs_blobs WHERE address = ${address} RETURNING address`;
      const notifications = await tx`
        UPDATE push_sends SET title = NULL, body = NULL, url = NULL, subject = NULL
         WHERE user_address = ${address} AND title IS NOT NULL RETURNING event_key`;
      await tx`UPDATE events SET user_address = NULL WHERE user_address = ${address}`;
      return {
        deleted: {
          profile: profiles.length > 0,
          pushTokens: pushTokens.length,
          vaults: vaults.length,
          prefs: prefs.length > 0,
          notifications: notifications.length,
        },
        handleHeldUntil: handleHeldUntil?.toISOString() ?? null,
      };
    });
  } catch (error) {
    rethrowDeadlock(error);
    throw error;
  }
}
