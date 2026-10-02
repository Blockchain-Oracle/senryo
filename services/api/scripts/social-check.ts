/**
 * S12b social check (targeted money/security-adjacent check, not a UI test). Runs every social route in-process
 * against a scratch Postgres, with the leaderboard and feed poller reading an in-memory indexer; it migrates that
 * database and deletes only its own rows.
 *   DATABASE_URL=postgres://127.0.0.1:5432/senryo_social_check pnpm --filter @senryo/api social-check
 * Suites: identity (handles, privacy, follows), posts + moderation (filter, reports, review, block/mute), leaderboard
 * (window math, floor, ranks, Your rank, Top Trades, recommendations), feed (poller, scopes, sharing) + search, market
 * Holders (visibility, viewer filters, Friends, math, cache, 503s), trade posts (F-D1) and delete-my-data coverage.
 */

import { deleteDataChecks } from "./social-checks/delete-data.ts";
import { feedChecks } from "./social-checks/feed.ts";
import { holdersChecks } from "./social-checks/holders.ts";
import { identityChecks } from "./social-checks/identity.ts";
import { leaderboardChecks } from "./social-checks/leaderboard.ts";
import { moderationChecks } from "./social-checks/moderation.ts";
import { tradePostChecks } from "./social-checks/trade-posts.ts";
import { Checks, cleanup, openHarness } from "./social-harness.ts";

const h = await openHarness();
const checks = new Checks();

try {
  for (const [name, suite] of [
    ["identity", identityChecks],
    ["posts + moderation", moderationChecks],
    ["leaderboard", leaderboardChecks],
    ["feed + search", feedChecks],
    ["trade posts", tradePostChecks],
    ["market holders", holdersChecks],
    ["delete my data", deleteDataChecks],
  ] as const) {
    console.log(`\n── ${name}`);
    await suite(h, checks);
  }
} finally {
  await cleanup(h.db, h.addresses);
  await h.close();
}

console.log(`\n${checks.total - checks.failed}/${checks.total} social checks passed`);
process.exitCode = checks.failed === 0 ? 0 : 1;
