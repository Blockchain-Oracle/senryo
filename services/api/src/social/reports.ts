import { randomUUID } from "node:crypto";
import type {
  ReportReason,
  ReportRequest,
  ReportTargetKind,
  ReviewDecision,
  ReviewQueueItem,
  ReviewResult,
} from "@senryo/api-client";
import type { ChainId } from "@senryo/config";
import { type Db, HTTP_STATUS, HttpError, type Tx } from "@senryo/service-common";
import {
  LANDED_STAGES,
  LOCK_NS,
  REPORT_REVIEW_WEIGHT,
  REPORT_WEIGHT_TRUSTED,
  REPORT_WEIGHT_UNTRUSTED,
  REVIEW_PREVIEW_CHARS,
  TRUSTED_RELAY_KINDS,
} from "./constants.ts";
import type { SocialIndexer } from "./indexer-source.ts";
import { advisoryLock } from "./shared.ts";

/**
 * Reports and moderation (S12b.6, App Store 1.2).
 * - A report's weight is fixed when filed: 1 if the reporter claimed the starter / redeemed a voucher (a landed relay)
 *   or deposited on any served network, else 0. Sybil accounts can file, but they don't move anything.
 * - A target is hidden exactly when an operator's review says `hide` AND its open + actioned report weight reaches
 *   REPORT_REVIEW_WEIGHT. Either can come first: a `hide` set early takes effect ("auto-hides") when the weight
 *   arrives; weight alone only queues the target for review. `keep` dismisses the open reports and un-hides.
 * - Decisions live in `moderation_reviews` and outlive "delete my data" (re-applied to a new profile).
 */

export interface ModerationHooks {
  /** A profile's hidden state changed (drop it from cached leaderboards). */
  onProfileHidden?: (address: string) => void;
}

/** Trusted reporter: a landed starter claim / voucher, or a deposit on any network this api serves. */
export async function reporterWeight(
  db: Db,
  indexer: SocialIndexer,
  chainIds: readonly ChainId[],
  reporter: string,
): Promise<number> {
  const [claimed] = await db<{ ok: boolean }[]>`
    SELECT EXISTS (SELECT 1 FROM starter_claims WHERE user_address = ${reporter}
                    AND kind IN ${db(TRUSTED_RELAY_KINDS)} AND stage IN ${db(LANDED_STAGES)}) AS ok`;
  if (claimed?.ok) return REPORT_WEIGHT_TRUSTED;
  const funded = await indexer.fundedAmong(chainIds, [reporter]).catch(() => new Set<string>());
  return funded.has(reporter) ? REPORT_WEIGHT_TRUSTED : REPORT_WEIGHT_UNTRUSTED;
}

/** Recompute and store a target's hidden state; returns the weight and whether it is hidden now. */
async function applyModeration(
  tx: Tx,
  kind: ReportTargetKind,
  id: string,
  hooks: ModerationHooks,
): Promise<{ weight: number; hidden: boolean; decision: ReviewDecision | null }> {
  const [state] = await tx<{ weight: number; decision: ReviewDecision | null }[]>`
    SELECT (SELECT coalesce(sum(weight), 0)::int FROM reports
             WHERE target_kind = ${kind} AND target_id = ${id} AND status IN ('open', 'actioned')) AS weight,
           (SELECT decision FROM moderation_reviews WHERE target_kind = ${kind} AND target_id = ${id}) AS decision`;
  const weight = state?.weight ?? 0;
  const decision = state?.decision ?? null;
  const hidden = decision === "hide" && weight >= REPORT_REVIEW_WEIGHT;
  const changed =
    kind === "post"
      ? await tx`UPDATE posts SET hidden = ${hidden} WHERE id = ${id}::uuid AND hidden <> ${hidden} RETURNING id`
      : await tx`UPDATE profiles SET hidden = ${hidden} WHERE address = ${id} AND hidden <> ${hidden} RETURNING address`;
  if (hidden) {
    await tx`UPDATE reports SET status = 'actioned', reviewed_at = now()
              WHERE target_kind = ${kind} AND target_id = ${id} AND status = 'open'`;
  }
  if (kind === "profile" && changed.length > 0) hooks.onProfileHidden?.(id);
  return { weight, hidden, decision };
}

/** File (or repeat — idempotent) a report. Post targets must exist on that network; you can't report yourself. */
export async function fileReport(
  db: Db,
  weight: number,
  reporter: string,
  kind: ReportTargetKind,
  targetId: string,
  body: ReportRequest,
  hooks: ModerationHooks = {},
): Promise<void> {
  await db.begin(async (tx) => {
    await advisoryLock(tx, LOCK_NS.moderation, `${kind}:${targetId}`);
    if (kind === "post") {
      const [post] = await tx<{ author: string }[]>`SELECT author FROM posts WHERE id = ${targetId}`;
      if (!post) throw new HttpError(HTTP_STATUS.notFound, "NOT_FOUND", "no such post");
      if (post.author === reporter) throw new HttpError(HTTP_STATUS.badRequest, "BAD_REQUEST", "that's your own post");
    } else if (targetId === reporter) {
      throw new HttpError(HTTP_STATUS.badRequest, "BAD_REQUEST", "that's your own profile");
    }
    await tx`
      INSERT INTO reports (id, target_kind, target_id, reporter, reason, note, weight)
      VALUES (${randomUUID()}, ${kind}, ${targetId}, ${reporter}, ${body.reason}, ${body.note ?? null}, ${weight})
      ON CONFLICT (target_kind, target_id, reporter) DO NOTHING`;
    await applyModeration(tx, kind, targetId, hooks);
  });
}

/** The operator's decision on a target. */
export async function review(
  db: Db,
  kind: ReportTargetKind,
  targetId: string,
  decision: ReviewDecision,
  note: string | undefined,
  hooks: ModerationHooks = {},
): Promise<ReviewResult> {
  return db.begin(async (tx) => {
    await advisoryLock(tx, LOCK_NS.moderation, `${kind}:${targetId}`);
    await tx`
      INSERT INTO moderation_reviews (target_kind, target_id, decision, note)
      VALUES (${kind}, ${targetId}, ${decision}, ${note ?? null})
      ON CONFLICT (target_kind, target_id) DO UPDATE
        SET decision = EXCLUDED.decision, note = EXCLUDED.note, reviewed_at = now()`;
    if (decision === "keep") {
      await tx`UPDATE reports SET status = 'dismissed', reviewed_at = now()
                WHERE target_kind = ${kind} AND target_id = ${targetId} AND status IN ('open', 'actioned')`;
    }
    const state = await applyModeration(tx, kind, targetId, hooks);
    return { targetKind: kind, targetId, decision, weight: state.weight, hidden: state.hidden };
  });
}

interface QueueRow {
  target_kind: ReportTargetKind;
  target_id: string;
  weight: number;
  reports: number;
  reasons: Record<string, number>;
  decision: ReviewDecision | null;
  hidden: boolean | null;
  preview: string | null;
  first_at: Date;
  last_at: Date;
}

/** `queued`: open weight at the bar and not hidden yet. `open`: any target with an open report. */
export async function reviewQueue(db: Db, status: "queued" | "open"): Promise<ReviewQueueItem[]> {
  const bar = status === "queued" ? REPORT_REVIEW_WEIGHT : 0;
  const rows = await db<QueueRow[]>`
    WITH open AS (
      SELECT target_kind, target_id, sum(weight)::int AS weight, count(*)::int AS reports,
             min(created_at) AS first_at, max(created_at) AS last_at
        FROM reports WHERE status = 'open' GROUP BY target_kind, target_id
    )
    SELECT o.*, mr.decision,
           (SELECT jsonb_object_agg(reason, n) FROM (SELECT reason, count(*)::int AS n FROM reports r
              WHERE r.target_kind = o.target_kind AND r.target_id = o.target_id AND r.status = 'open'
              GROUP BY reason) x) AS reasons,
           coalesce(po.hidden, pr.hidden) AS hidden,
           coalesce(left(po.text, ${REVIEW_PREVIEW_CHARS}),
                    concat_ws(' · ', '@' || pr.handle, pr.display_name)) AS preview
      FROM open o
      LEFT JOIN moderation_reviews mr ON mr.target_kind = o.target_kind AND mr.target_id = o.target_id
      LEFT JOIN posts po ON o.target_kind = 'post' AND po.id::text = o.target_id
      LEFT JOIN profiles pr ON o.target_kind = 'profile' AND pr.address = o.target_id
     WHERE o.weight >= ${bar} AND (${status === "open"} OR NOT coalesce(po.hidden, pr.hidden, false))
     ORDER BY o.weight DESC, o.last_at DESC`;
  return rows.map((r) => ({
    targetKind: r.target_kind,
    targetId: r.target_id,
    weight: r.weight,
    reports: r.reports,
    reasons: r.reasons as Partial<Record<ReportReason, number>>,
    decision: r.decision,
    hidden: r.hidden ?? false,
    preview: r.preview === "" ? null : r.preview,
    firstAt: r.first_at.toISOString(),
    lastAt: r.last_at.toISOString(),
  }));
}
