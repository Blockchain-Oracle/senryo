/**
 * Identity checks (S12b.2/3): handle states and race, tombstones, the change budget, the content filter,
 * unlisted-mainnet privacy, follows (pagination, cap under concurrency) and blocks against follows.
 */
import {
  FOLLOWING_MAX,
  followersRoute,
  followGetRoute,
  followRoute,
  HANDLE_TOMBSTONE_DAYS,
  handleAvailableRoute,
  profileGetRoute,
  profilePutRoute,
  unfollowRoute,
} from "@senryo/api-client";
import { MAINNET_CHAIN_ID, TESTNET_CHAIN_ID } from "@senryo/config";
import { MS_PER_SECOND, SECONDS_PER_DAY } from "@senryo/service-common";
import { type Checks, codeOf, freshHandle, type Harness, randomAddress, type User } from "../social-harness.ts";

const CLAIMANTS = 8;
const CAP_RACERS = 5;
const PAGE = 2;
const HANDLE_CHANGES_ALLOWED = 5;
/** Tolerance when comparing the tombstone expiry with now + 30 days. */
const CLOCK_SLACK_MS = 60_000;

export async function identityChecks(h: Harness, checks: Checks): Promise<void> {
  const available = (handle: string) => h.anon.call(handleAvailableRoute, { params: { h: handle } });
  const claim = (u: User, handle: string | null) => u.api.call(profilePutRoute, { body: { handle } });
  const lookup = (key: string, chainId: typeof MAINNET_CHAIN_ID | typeof TESTNET_CHAIN_ID) =>
    h.anon.call(profileGetRoute, { params: { handleOrAddress: key }, query: { chainId } });

  // ── Availability states ──────────────────────────────────────────────────────────────────────────────────────
  const short = await available("abc");
  checks.record("invalid: too short", short.state === "invalid" && short.reason === "length", short);
  const charset = await available("ab-cd");
  checks.record("invalid: charset", charset.state === "invalid" && charset.reason === "charset", charset);
  const blockedWord = await available("sh1t_trader");
  checks.record("invalid: blocked word (leet folded)", blockedWord.reason === "blocked", blockedWord);
  for (const reserved of ["senryo", "admin", "Senryo_Support", "@monad"]) {
    const r = await available(reserved);
    checks.record(`reserved: ${reserved}`, r.state === "reserved", r);
  }
  const fresh = freshHandle();
  checks.record("available: fresh handle", (await available(fresh)).state === "available");

  // ── Handle race: N concurrent claims (mixed case) → exactly one wins ────────────────────────────────────────
  const claimants = Array.from({ length: CLAIMANTS }, () => h.user());
  const raced = await Promise.all(
    claimants.map((u, i) => codeOf(claim(u, i % 2 === 0 ? fresh : `@${fresh.toUpperCase()}`))),
  );
  const winners = raced.filter((c) => c === "OK").length;
  const losers = raced.filter((c) => c === "HANDLE_TAKEN").length;
  checks.record("race: exactly one claim wins", winners === 1 && losers === CLAIMANTS - 1, raced);
  const owner = claimants[raced.indexOf("OK")];
  if (!owner) throw new Error("no race winner");
  checks.record("taken after claim", (await available(fresh.toUpperCase())).state === "taken");

  // ── Tombstone: release holds the handle 30 days for its previous owner ─────────────────────────────────────
  const next = freshHandle();
  await claim(owner, next);
  const held = await available(fresh);
  const expected = Date.now() + HANDLE_TOMBSTONE_DAYS * SECONDS_PER_DAY * MS_PER_SECOND;
  const heldOk = held.state === "held" && Math.abs(Date.parse(held.heldUntil ?? "") - expected) < CLOCK_SLACK_MS;
  checks.record("held: released handle is tombstoned ~30 days", heldOk, held);
  const [intruder] = [h.user()];
  checks.record("held: another account can't claim it", (await codeOf(claim(intruder, fresh))) === "HANDLE_HELD");
  checks.record("held: previous owner reclaims it", (await codeOf(claim(owner, fresh))) === "OK");
  checks.record("held: the handle it left is now held", (await available(next)).state === "held");
  await claim(owner, null);
  checks.record("held: clearing the handle tombstones it", (await available(fresh)).state === "held");
  checks.record("held: intruder still refused", (await codeOf(claim(intruder, fresh))) === "HANDLE_HELD");

  // ── Change budget: at most 5 released handles held per account per window ──────────────────────────────────
  const churner = h.user();
  await claim(churner, freshHandle());
  const changes: string[] = [];
  for (let i = 0; i <= HANDLE_CHANGES_ALLOWED; i += 1) changes.push(await codeOf(claim(churner, freshHandle())));
  const budgetOk =
    changes.slice(0, HANDLE_CHANGES_ALLOWED).every((c) => c === "OK") && changes.at(-1) === "RATE_LIMITED";
  checks.record("budget: 6th handle change within 30 days is refused", budgetOk, changes);

  // ── Content filter ─────────────────────────────────────────────────────────────────────────────────────────
  const writer = h.user();
  const impersonate = await codeOf(writer.api.call(profilePutRoute, { body: { displayName: "Senryo Support" } }));
  checks.record("content: impersonating display name refused", impersonate === "CONTENT_BLOCKED");
  const bio = await codeOf(writer.api.call(profilePutRoute, { body: { bio: "gold bull, sh!tposter" } }));
  checks.record("content: blocked word in bio refused", bio === "CONTENT_BLOCKED");
  const scunthorpe = await codeOf(writer.api.call(profilePutRoute, { body: { bio: "Scunthorpe United fan" } }));
  checks.record("content: Scunthorpe passes", scunthorpe === "OK");

  // ── Privacy: an unlisted mainnet account is invisible on mainnet, by handle AND by address ─────────────────
  const priv = h.user();
  const privHandle = freshHandle();
  const saved = await priv.api.call(profilePutRoute, { body: { handle: privHandle, publicTradesMainnet: true } });
  checks.record(
    "privacy: defaults practice on, mainnet off; public trades need the listing",
    saved.listedPractice && !saved.listedMainnet && saved.publicTradesPractice && !saved.publicTradesMainnet,
    saved,
  );
  checks.record(
    "privacy: @handle resolves on practice",
    (await lookup(`@${privHandle}`, TESTNET_CHAIN_ID)).handle === privHandle,
  );
  const byHandle = await codeOf(lookup(privHandle, MAINNET_CHAIN_ID));
  checks.record("privacy: @handle does NOT resolve on mainnet", byHandle === "NOT_FOUND", byHandle);
  const byAddress = await codeOf(lookup(priv.address, MAINNET_CHAIN_ID));
  checks.record("privacy: address lookup on mainnet reveals nothing", byAddress === "NOT_FOUND", byAddress);
  const nobody = await codeOf(lookup(randomAddress(), MAINNET_CHAIN_ID));
  checks.record("privacy: unlisted and absent are indistinguishable", byAddress === nobody);

  const star = h.user();
  await star.api.call(profilePutRoute, { body: { handle: freshHandle(), listedMainnet: true } });
  await priv.api.call(followRoute, { params: { address: star.address } });
  const mainFollowers = await h.anon.call(followersRoute, {
    params: { address: star.address },
    query: { chainId: MAINNET_CHAIN_ID },
  });
  const practiceFollowers = await h.anon.call(followersRoute, {
    params: { address: star.address },
    query: { chainId: TESTNET_CHAIN_ID },
  });
  const inMain = mainFollowers.items.some((f) => f.address.toLowerCase() === priv.lower);
  const inPractice = practiceFollowers.items.some((f) => f.address.toLowerCase() === priv.lower);
  checks.record("privacy: unlisted follower hidden from mainnet list, shown on practice", !inMain && inPractice);
  const starMain = await lookup(star.address, MAINNET_CHAIN_ID);
  checks.record("privacy: mainnet follower count excludes unlisted", starMain.followers === 0, starMain);
  const starSees = await star.api.call(followGetRoute, { params: { address: priv.address } });
  const starMainSees = await h
    .on(star, MAINNET_CHAIN_ID)
    .api.call(followGetRoute, { params: { address: priv.address } });
  checks.record(
    "privacy: followsYou shown on practice, hidden on a mainnet session",
    starSees.followsYou && !starMainSees.followsYou,
    { starSees, starMainSees },
  );
  await priv.api.call(profilePutRoute, { body: { listedMainnet: true } });
  checks.record(
    "privacy: opting in makes @handle resolve on mainnet",
    (await lookup(privHandle, MAINNET_CHAIN_ID)).handle === privHandle,
  );

  // ── Follow basics and pagination ───────────────────────────────────────────────────────────────────────────
  checks.record(
    "follow: self is refused",
    (await codeOf(star.api.call(followRoute, { params: { address: star.address } }))) === "BAD_REQUEST",
  );
  const ghost = randomAddress();
  checks.record(
    "follow: unlisted/absent target is 404",
    (await codeOf(star.api.call(followRoute, { params: { address: ghost } }))) === "NOT_FOUND",
  );
  const again = await priv.api.call(followRoute, { params: { address: star.address } });
  checks.record("follow: idempotent", again.following);
  const fans = Array.from({ length: PAGE + 1 }, () => h.user());
  for (const fan of fans) {
    await fan.api.call(profilePutRoute, { body: { handle: freshHandle() } });
    await fan.api.call(followRoute, { params: { address: star.address } });
  }
  const first = await h.anon.call(followersRoute, {
    params: { address: star.address },
    query: { chainId: TESTNET_CHAIN_ID, limit: PAGE },
  });
  const second = await h.anon.call(followersRoute, {
    params: { address: star.address },
    query: { chainId: TESTNET_CHAIN_ID, limit: PAGE, ...(first.nextCursor ? { cursor: first.nextCursor } : {}) },
  });
  const seen = new Set([...first.items, ...second.items].map((f) => f.address));
  checks.record(
    "follow: keyset pages cover every follower once",
    seen.size === fans.length + 1 && second.nextCursor === null,
    { first, second },
  );
  const off = await priv.api.call(unfollowRoute, { params: { address: star.address } });
  checks.record("follow: unfollow", !off.following);

  // ── Follow cap: exact, also when follows race at the edge ──────────────────────────────────────────────────
  const targets = Array.from({ length: CAP_RACERS }, () => h.user());
  for (const t of targets) await t.api.call(profilePutRoute, { body: { handle: freshHandle() } });
  const collector = h.user();
  const seed = Array.from({ length: FOLLOWING_MAX - 1 }, () => ({
    follower: collector.lower,
    followee: randomAddress().toLowerCase(),
  }));
  await h.db`INSERT INTO follows ${h.db(seed, "follower", "followee")}`;
  const capRace = await Promise.all(
    targets.map((t) => codeOf(collector.api.call(followRoute, { params: { address: t.address } }))),
  );
  const capWon = capRace.filter((c) => c === "OK").length;
  const capLost = capRace.filter((c) => c === "FOLLOW_LIMIT").length;
  checks.record(
    `cap: racing follows at ${FOLLOWING_MAX - 1} → exactly one lands`,
    capWon === 1 && capLost === CAP_RACERS - 1,
    capRace,
  );
  const [count] = await h.db<
    { n: number }[]
  >`SELECT count(*)::int AS n FROM follows WHERE follower = ${collector.lower}`;
  checks.record("cap: never exceeds FOLLOWING_MAX", count?.n === FOLLOWING_MAX, count);

  // ── Blocks: either direction stops a follow ────────────────────────────────────────────────────────────────
  const blocker = targets[0];
  const pest = h.user();
  if (!blocker) throw new Error("no block target");
  await h.db`INSERT INTO blocks (blocker, blocked) VALUES (${blocker.lower}, ${pest.lower})`;
  checks.record(
    "block: blocked account can't follow its blocker",
    (await codeOf(pest.api.call(followRoute, { params: { address: blocker.address } }))) === "BLOCKED",
  );
  const other = targets[1];
  if (!other) throw new Error("no second target");
  await h.db`INSERT INTO blocks (blocker, blocked) VALUES (${pest.lower}, ${other.lower})`;
  checks.record(
    "block: can't follow an account you blocked",
    (await codeOf(pest.api.call(followRoute, { params: { address: other.address } }))) === "BLOCKED",
  );
  const state = await pest.api.call(followGetRoute, { params: { address: blocker.address } });
  checks.record("block: follow state reports the block", state.blocked && !state.following, state);
}
