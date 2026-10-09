import {
  addressOf,
  describeError,
  type EventChange,
  type EventListing,
  type EventStep,
  eventChanges,
  eventIdOf,
  eventStepsData,
  eventTermsHashOf,
  type Hex,
  isDeployed,
  listEventsData,
  MULTICALL3,
  readEvent,
  readEventFees,
  sendTx,
} from "@senryo/chain";
import { EVENT_COMMITTEES, EVENTS, gameTerms, LEAGUES, type LeagueSpec, leagueOf } from "@senryo/config";
import {
  adoptListing,
  adoptVerdict,
  answersOf,
  appLink,
  applyEventChanges,
  callsToPay,
  dollarsText,
  dropListing,
  type EventRow,
  eventById,
  eventWork,
  insertListing,
  listedGameKeys,
  markAnswerPosted,
  type NewListing,
  nowSec,
  pushTitle,
  saveAnswer,
  staleListings,
} from "@senryo/service-common";
import {
  EVENT_CLAIM_BATCH,
  EVENT_LIST_BATCH,
  EVENT_LISTING_STALE_SEC,
  EVENT_MIN_LEAD_SEC,
  EVENT_WORK_BATCH,
  EVENTS_INTERVAL_MS,
  EVENTS_LIST_EVERY_MS,
} from "../constants.ts";
import type { KeeperContext } from "../context.ts";
import { answerTime, type Committee, gameOf, loadCommittee, signAnswer } from "../events/committee.ts";
import type { FetchCache, GameRef } from "../events/game.ts";
import { espnSchedule } from "../events/sources/espn.ts";
import type { Job } from "../runner.ts";

/**
 * Events (S8.7, D-296): the keeper lists the coming games (ESPN's schedule, every ten minutes), then carries each to
 * its payout — once a game can be over, each committee member reads its own source and, when it shows a final, signs
 * its statement; the answers are relayed with a `resolve` once the dissent wait or the deadline allows; the calls are
 * paid in batches and the book's fees swept into the shared pool. Every step is idempotent and the book's own events
 * drive `market_events`.
 */
export function eventsJob(ctx: KeeperContext): Job {
  const committee = loadCommittee(ctx.chainId, ctx.log);
  let listedAtMs = 0;
  return {
    name: "events",
    intervalMs: EVENTS_INTERVAL_MS,
    run: async () => {
      if (!committee || !isDeployed(ctx.chainId, "EventBook")) return;
      const cache: FetchCache = new Map();
      const now = nowSec();
      if (Date.now() - listedAtMs >= EVENTS_LIST_EVERY_MS) {
        listedAtMs = Date.now();
        await guarded(ctx, "listing", () => list(ctx, committee, cache, now));
      }
      for (const e of await eventWork(ctx.db, ctx.chainId, now, EVENT_WORK_BATCH)) {
        await guarded(ctx, e.event_id, () => advance(ctx, committee, e, cache, now));
      }
      await guarded(ctx, "payouts", () => pay(ctx));
    },
  };
}

async function guarded(ctx: KeeperContext, subject: string, work: () => Promise<void>): Promise<void> {
  try {
    await work();
  } catch (error) {
    ctx.log.warn({ subject, err: describeError(error) }, "event work failed; retrying");
  }
}

// ------------------------------------------------------------------------------------------------ listing

function newListing(league: LeagueSpec, g: GameRef, committeeId: number): NewListing {
  const eventId = eventIdOf(league.key, g.key);
  const question = league.question(g.home.name, g.away.name);
  const rules = league.rule(g.home.name, g.away.name);
  return {
    eventId,
    league: league.key,
    gameKey: g.key,
    question,
    rules,
    termsHash: eventTermsHashOf(eventId, question, rules),
    home: g.home,
    away: g.away,
    startsAt: g.startSec,
    ...gameTerms(league, g.startSec),
    feeBps: EVENTS.feeBps,
    committeeId,
  };
}

const onChain = (
  l: Pick<
    NewListing,
    "eventId" | "committeeId" | "feeBps" | "closesAt" | "answerFrom" | "answerBy" | "question" | "rules"
  >,
): EventListing => ({
  terms: {
    eventId: l.eventId,
    committeeId: l.committeeId,
    feeBps: l.feeBps,
    closesAt: l.closesAt,
    answerFrom: l.answerFrom,
    answerBy: l.answerBy,
  },
  question: l.question,
  rules: l.rules,
});

const fromRow = (r: EventRow): EventListing =>
  onChain({
    eventId: r.event_id as Hex,
    committeeId: r.committee_id,
    feeBps: r.fee_bps,
    closesAt: Number(r.closes_at),
    answerFrom: Number(r.answer_from),
    answerBy: Number(r.answer_by),
    question: r.question,
    rules: r.rules,
  });

async function list(ctx: KeeperContext, committee: Committee, cache: FetchCache, now: number): Promise<void> {
  const batch: EventListing[] = [];
  for (const row of await staleListings(ctx.db, ctx.chainId, EVENT_LISTING_STALE_SEC)) {
    const chain = await readEvent(ctx.read, ctx.chainId, row.event_id as Hex);
    if (chain.state !== "none") await adoptListing(ctx.db, ctx.chainId, row.event_id);
    else if (Number(row.closes_at) > now + EVENT_MIN_LEAD_SEC) batch.push(fromRow(row));
    else await dropListing(ctx.db, ctx.chainId, row.event_id);
  }
  for (const league of LEAGUES) {
    let games: GameRef[];
    try {
      games = await espnSchedule(league, now + EVENT_MIN_LEAD_SEC, now + EVENTS.listAheadSec, cache);
    } catch (error) {
      ctx.log.warn({ league: league.key, err: describeError(error) }, "schedule unreadable; next run");
      continue;
    }
    const known = await listedGameKeys(
      ctx.db,
      ctx.chainId,
      league.key,
      games.map((g) => g.key),
    );
    for (const g of games) {
      if (known.has(g.key)) continue;
      const l = newListing(league, g, committee.id);
      await insertListing(ctx.db, ctx.chainId, l);
      batch.push(onChain(l));
    }
  }
  for (let i = 0; i < batch.length; i += EVENT_LIST_BATCH) {
    await sendListings(ctx, batch.slice(i, i + EVENT_LIST_BATCH));
  }
}

/** A batch, and when it is refused, each listing alone (a refused one is dropped rather than retried for ever). */
async function sendListings(ctx: KeeperContext, listings: EventListing[], alone = false): Promise<void> {
  const book = addressOf(ctx.chainId, "EventBook");
  const sent = await sendTx(ctx.sender, {
    to: book,
    data: listEventsData(listings),
    action: "eventList",
    meta: { job: "events", why: "list", count: String(listings.length) },
  });
  ctx.recent.add({ job: "events", subject: `list ${listings.length}`, tx: sent.hash, stage: sent.stage });
  if (sent.stage !== "reverted") {
    await applyEventChanges(ctx.db, ctx.chainId, eventChanges(sent.receipt.logs, book), sent.hash);
    ctx.log.info({ actor: "keeper", why: "list", count: listings.length, tx: sent.hash }, "events listed");
    return;
  }
  if (alone) {
    const id = listings[0]?.terms.eventId;
    ctx.log.warn({ event: id, tx: sent.hash }, "listing refused; dropped");
    if (id) await dropListing(ctx.db, ctx.chainId, id);
    return;
  }
  for (const l of listings) await sendListings(ctx, [l], true);
}

// ------------------------------------------------------------------------------------------------ answers and verdicts

async function advance(
  ctx: KeeperContext,
  committee: Committee,
  e: EventRow,
  cache: FetchCache,
  now: number,
): Promise<void> {
  const eventId = e.event_id as Hex;
  const chain = await readEvent(ctx.read, ctx.chainId, eventId);
  if (chain.state === "decided" || chain.state === "voided") {
    await adoptVerdict(ctx.db, ctx.chainId, e.event_id, {
      state: chain.state,
      answer: chain.answer,
      voidReason: chain.voidReason,
    });
    return;
  }
  if (chain.state !== "open") return;

  const order = EVENT_COMMITTEES[ctx.chainId]?.members.map((m) => m.address.toLowerCase()) ?? [];
  const onChainAlready = (member: string) => (chain.answered & (1 << order.indexOf(member.toLowerCase()))) !== 0;
  const saved = new Set((await answersOf(ctx.db, ctx.chainId, e.event_id)).map((a) => a.member));

  const at = answerTime(e, now);
  const league = leagueOf(e.league);
  if (at !== null && now <= chain.answerBy && league) {
    for (const m of committee.members) {
      const who = m.signer.address.toLowerCase();
      if (saved.has(who) || onChainAlready(who)) continue;
      const result = await m.read(league, gameOf(e), cache).catch((error: unknown) => {
        ctx.log.warn({ event: eventId, member: m.spec.name, err: describeError(error) }, "source unreadable");
        return null;
      });
      if (!result?.final) continue;
      const s = await signAnswer(ctx.chainId, m, e, result, at);
      await saveAnswer(ctx.db, ctx.chainId, {
        event_id: e.event_id,
        member: who,
        yes: s.answer.yes,
        statement: s.statement,
        statement_hash: s.answer.statementHash,
        attested_at: BigInt(s.answer.attestedAt),
        signature: s.signature,
      });
    }
  }

  const steps: EventStep[] = [];
  for (const a of await answersOf(ctx.db, ctx.chainId, e.event_id)) {
    if (a.posted) continue;
    if (onChainAlready(a.member)) {
      await markAnswerPosted(ctx.db, ctx.chainId, e.event_id, a.member);
      continue;
    }
    steps.push({
      kind: "answer",
      answer: {
        eventId,
        termsHash: e.terms_hash as Hex,
        member: a.member as Hex,
        yes: a.yes,
        statementHash: a.statement_hash as Hex,
        attestedAt: Number(a.attested_at),
      },
      signature: a.signature as Hex,
    });
  }
  const heard = chain.quorumAt > 0 && now >= chain.quorumAt + EVENTS.dissentWaitSec;
  if (heard || now > chain.answerBy) steps.push({ kind: "resolve", eventId });
  if (steps.length > 0) await sendSteps(ctx, steps, "eventAnswer", `answer ${eventId.slice(0, 10)}`);
}

// ------------------------------------------------------------------------------------------------ payouts

async function pay(ctx: KeeperContext): Promise<void> {
  const ids = await callsToPay(ctx.db, ctx.chainId, EVENT_CLAIM_BATCH * EVENT_LIST_BATCH);
  for (let i = 0; i < ids.length; i += EVENT_CLAIM_BATCH) {
    const chunk = ids.slice(i, i + EVENT_CLAIM_BATCH);
    await sendSteps(ctx, [{ kind: "claimFor", ticketIds: chunk }], "eventClaim", `pay ${chunk.length}`);
  }
  if ((await readEventFees(ctx.read, ctx.chainId)) > 0n) {
    await sendSteps(ctx, [{ kind: "sweepFees" }], "eventSweep", "sweep fees");
  }
}

async function sendSteps(
  ctx: KeeperContext,
  steps: EventStep[],
  action: "eventAnswer" | "eventClaim" | "eventSweep",
  subject: string,
): Promise<void> {
  const why = [...new Set(steps.map((s) => s.kind))].join("+");
  const sent = await sendTx(ctx.sender, {
    to: MULTICALL3,
    data: eventStepsData(ctx.chainId, steps),
    action,
    meta: { job: "events", why },
  });
  ctx.recent.add({ job: "events", subject, tx: sent.hash, stage: sent.stage });
  ctx.log.info({ actor: "keeper", why, subject, tx: sent.hash }, "events advanced");
  if (sent.stage === "reverted") throw new Error(`${why} reverted in ${sent.hash}`);
  const changes = eventChanges(sent.receipt.logs, addressOf(ctx.chainId, "EventBook"));
  await applyEventChanges(ctx.db, ctx.chainId, changes, sent.hash);
  await notifyPayouts(ctx, changes);
}

/** "You won $18.40" with the question, for every win and refund the moment it lands (a loss is shown, never pushed). */
async function notifyPayouts(ctx: KeeperContext, changes: readonly EventChange[]): Promise<void> {
  for (const c of changes) {
    if (c.kind !== "paid" || c.outcome === "lost" || c.amount === 0n) continue;
    const e = await eventById(ctx.db, ctx.chainId, c.eventId);
    if (!e) continue;
    const won = c.outcome === "won";
    const amount = dollarsText(ctx.chainId, c.amount);
    await ctx.notifier.push(ctx.chainId, `event:${c.ticketId}`, c.owner.toLowerCase(), "results", {
      title: pushTitle(ctx.chainId, won ? `You won ${amount}` : `Refunded ${amount}`),
      body: won ? e.question : `${e.question} — the committee didn't settle it, so every call is refunded`,
      url: appLink(ctx.chainId, `/events/${c.eventId}`),
      subject: { kind: "account" },
      collapseKey: `event:${c.ticketId}`,
    });
  }
}
