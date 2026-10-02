import { HANDLE_TOMBSTONE_DAYS, type SocialDelete } from "@senryo/api-client";
import type { Db } from "@senryo/service-common";
import { LOCK_NS } from "./constants.ts";
import { advisoryLock, rethrowDeadlock } from "./shared.ts";

/**
 * "Delete my data" (S12b.8, A9 / defect 10), one transaction:
 * - deleted: the profile; follows both ways; the account's own blocks and mutes; its likes; its reports plus the
 *   reports about its posts; its posts (replies to its theses, likes on them and their feed rows cascade); its feed
 *   rows (indexed fills — the onchain history itself is public and permanent, which the app says); its price alerts;
 *   its push tokens and their delivery tickets; its backup-passkey vaults; its deposit-inbox watches; its encrypted
 *   prefs; and what its notifications said (the dedupe keys stay, without title, body, link or subject, so an old
 *   event is never pushed again);
 * - unlinked: first-party analytics events keep their counts but lose the address;
 * - kept: the released handle's 30-day hold (Q-022 default: nobody can instantly re-claim it to impersonate),
 *   other accounts' blocks and mutes of this address (their safety data), and operator moderation decisions.
 */
export async function deleteSocialData(db: Db, address: string): Promise<SocialDelete> {
  try {
    return await db.begin(async (tx) => {
      await advisoryLock(tx, LOCK_NS.profile, address);
      await advisoryLock(tx, LOCK_NS.follow, address);
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
      const follows = await tx`
        DELETE FROM follows WHERE follower = ${address} OR followee = ${address} RETURNING id`;
      const blocks = await tx`DELETE FROM blocks WHERE blocker = ${address} RETURNING blocked`;
      const mutes = await tx`DELETE FROM mutes WHERE muter = ${address} RETURNING muted`;
      const likes = await tx`DELETE FROM likes WHERE address = ${address} RETURNING post_id`;
      const reports = await tx`
        DELETE FROM reports
         WHERE reporter = ${address}
            OR (target_kind = 'post' AND target_id IN (SELECT id::text FROM posts WHERE author = ${address}))
        RETURNING id`;
      const posts = await tx`DELETE FROM posts WHERE author = ${address} RETURNING id`;
      const feed = await tx`DELETE FROM feed_events WHERE actor = ${address} RETURNING id`;
      const alerts = await tx`DELETE FROM price_alerts WHERE user_address = ${address} RETURNING id`;
      await tx`DELETE FROM push_tickets WHERE token IN (SELECT token FROM push_tokens WHERE user_address = ${address})`;
      const pushTokens = await tx`DELETE FROM push_tokens WHERE user_address = ${address} RETURNING token`;
      const vaults = await tx`DELETE FROM vault_blobs WHERE address = ${address} RETURNING credential_id`;
      const watches = await tx`DELETE FROM inbox_watches WHERE user_address = ${address} RETURNING chain_id`;
      const prefs = await tx`DELETE FROM prefs_blobs WHERE address = ${address} RETURNING address`;
      const notifications = await tx`
        UPDATE push_sends SET title = NULL, body = NULL, url = NULL, subject = NULL
         WHERE user_address = ${address} AND title IS NOT NULL RETURNING event_key`;
      await tx`UPDATE events SET user_address = NULL WHERE user_address = ${address}`;
      return {
        deleted: {
          profile: profiles.length > 0,
          follows: follows.length,
          blocks: blocks.length,
          mutes: mutes.length,
          posts: posts.length,
          likes: likes.length,
          reports: reports.length,
          feedEvents: feed.length,
          alerts: alerts.length,
          pushTokens: pushTokens.length,
          vaults: vaults.length,
          inboxWatches: watches.length,
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
