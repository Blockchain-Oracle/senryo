import type { NotificationSubject, PushChannel } from "@senryo/api-client";
import { type ChainId, networkOf } from "@senryo/config";
import { DECIMALS, formatUnits } from "@senryo/core";
import type { Db, Tx } from "./db.ts";

export type { NotificationSubject, PushChannel };

/**
 * The notifications ledger (G1, D7), shared by the keeper, the api and the card service. A notification is one
 * `push_sends` row: the inbox entry (title, body, the screen a tap opens, the subject whose mark it shows) and, queued
 * on the same insert, its push. Whoever records it, the keeper of that network delivers it (`PushDelivery`); the row's
 * event key makes the whole thing idempotent — recording the same event twice is a no-op, so it is never pushed twice.
 *
 * Copy rules (S1b): a short title that says what happened, a plain-words body, Practice notifications say so in the
 * title and write money as P$ (Living Lacquer §5.6), links carry `?chainId=` so a tap opens in its own mode (S8.22).
 * Only what the caller knows is stated.
 */

export interface NotificationMessage {
  title: string;
  body: string;
  /** senryo:// screen the tap opens, with `?chainId=`. */
  url: string;
  /** What the inbox row draws its mark from; null when nothing more specific than the app fits. */
  subject: NotificationSubject | null;
  /** A newer push with the same key replaces the one on screen (iOS collapseId, Android tag). */
  collapseKey?: string | undefined;
}

export interface NotificationRecord extends NotificationMessage {
  chainId: ChainId;
  /** Unique per event on its network (`fill:<tx>`, `follow:<a>:<b>`); stored chain-prefixed. */
  eventKey: string;
  /** The recipient. */
  user: string;
  channel: PushChannel;
}

const SCHEME = "senryo://";
const PAPER_MONEY = "P$";
const REAL_MONEY = "$";
/** Token amounts in a notification show at most this many decimals (trailing zeros dropped). */
const TOKEN_SHOWN_DECIMALS = 6;
const TRAILING_ZEROS = /\.?0+$/;
/** A nameless account reads `0x12ab…cd34`: "0x" + 4 hex, then the last 4. */
const SHORT_ADDRESS_HEAD = 6;
const SHORT_ADDRESS_TAIL = 4;

/** The ledger key: keepers of both networks share one table (S8.22). */
export function notificationKey(chainId: ChainId, eventKey: string): string {
  return `${chainId}:${eventKey}`;
}

/**
 * Writes the inbox row and queues its push for the keeper of `chainId`. False when this event was already recorded
 * (nothing is queued again).
 */
export async function recordNotification(db: Db | Tx, n: NotificationRecord): Promise<boolean> {
  const rows = await db`
    INSERT INTO push_sends (event_key, user_address, channel, chain_id, title, body, url, subject, collapse_key,
                            next_attempt_at)
    VALUES (${notificationKey(n.chainId, n.eventKey)}, ${n.user.toLowerCase()}, ${n.channel}, ${n.chainId}, ${n.title},
            ${n.body}, ${n.url}, ${n.subject === null ? null : db.json(n.subject as never)}, ${n.collapseKey ?? null},
            now())
    ON CONFLICT (event_key) DO NOTHING RETURNING event_key`;
  return rows.length > 0;
}

/** "Practice · …" on testnet, the text alone on Mainnet. */
export function pushTitle(chainId: ChainId, text: string): string {
  const network = networkOf(chainId);
  return network.key === "testnet" ? `${network.modeLabel} · ${text}` : text;
}

/** `senryo://<path>?chainId=<id>` — opened in its own mode by the app's `linkTarget`. */
export function appLink(chainId: ChainId, path = ""): string {
  return `${SCHEME}${path}?chainId=${chainId}`;
}

/** Account dollars: P$ in Practice, $ on Mainnet, cents shown. */
export function dollarsText(chainId: ChainId, usd6: bigint): string {
  const symbol = networkOf(chainId).key === "testnet" ? PAPER_MONEY : REAL_MONEY;
  return `${symbol}${formatUnits(usd6, DECIMALS.usd6, DECIMALS.cents)}`;
}

/** A token amount, exact up to TOKEN_SHOWN_DECIMALS, without trailing zeros: `20`, `0.5`, `1,234.000001`. */
export function tokenAmountText(amount: bigint, decimals: number): string {
  const text = formatUnits(amount, decimals, Math.min(decimals, TOKEN_SHOWN_DECIMALS));
  return text.includes(".") ? text.replace(TRAILING_ZEROS, "") : text;
}

/** "@kai", else their name, else `0x12ab…cd34`. */
export function personText(person: { address: string; handle: string | null; displayName: string | null }): string {
  if (person.handle) return `@${person.handle}`;
  if (person.displayName) return person.displayName;
  return `${person.address.slice(0, SHORT_ADDRESS_HEAD)}…${person.address.slice(-SHORT_ADDRESS_TAIL)}`;
}

/** Why the card said no (E4); the card service maps its decline to one of these. */
export const CARD_DECLINE_REASONS = ["overLimit", "notEnoughSpendable", "frozen", "pricesPaused", "other"] as const;
export type CardDeclineReason = (typeof CARD_DECLINE_REASONS)[number];

/**
 * A card event worth a notification. `ref` makes it idempotent (the card_auth id for a decision, the Lithic event
 * token for a refund); `authId`, when known, opens that payment's page.
 */
export type CardNotice = {
  ref: string;
  authId?: string | undefined;
  merchant: string | null;
  amountUsd6: bigint;
} & ({ kind: "approved" } | { kind: "refunded" } | { kind: "declined"; reason: CardDeclineReason });

const DECLINE_BODY: Record<CardDeclineReason, string> = {
  overLimit: "It's over your card's daily limit.",
  notEnoughSpendable: "There isn't enough spendable money for it.",
  frozen: "Your card is frozen. Unfreeze it to pay.",
  pricesPaused: "Prices are paused, so card payments wait until markets reopen.",
  other: "The payment didn't go through.",
};

export function cardMessage(chainId: ChainId, notice: CardNotice): NotificationMessage {
  const amount = dollarsText(chainId, notice.amountUsd6);
  const at = notice.merchant ?? "a merchant";
  const url = appLink(chainId, notice.authId ? `card/auth/${notice.authId}` : "card");
  const subject: NotificationSubject = { kind: "card" };
  switch (notice.kind) {
    case "approved":
      return {
        title: pushTitle(chainId, `Paid ${amount} at ${at}`),
        body: "It's held from your spendable money until the merchant settles it.",
        url,
        subject,
      };
    case "refunded":
      return {
        title: pushTitle(chainId, `${amount} refunded by ${at}`),
        body: "It's back in your spendable money.",
        url,
        subject,
      };
    case "declined":
      return {
        title: pushTitle(chainId, `Card declined at ${at}`),
        body: `${amount}: ${DECLINE_BODY[notice.reason]}`,
        url,
        subject,
      };
  }
}

/**
 * The card channel's sender (E4: "the card push has no sender"). Call it from services/card once a decision or a
 * refund is final — after the ASA answer is stored, or the refund is queued. Idempotent per `kind:ref`; false when it
 * was already recorded. The card service needs no Expo access: the keeper of `chainId` delivers it.
 */
export async function notifyCardEvent(
  db: Db | Tx,
  chainId: ChainId,
  user: string,
  notice: CardNotice,
): Promise<boolean> {
  return recordNotification(db, {
    chainId,
    eventKey: `card:${notice.kind}:${notice.ref}`,
    user,
    channel: "card",
    ...cardMessage(chainId, notice),
  });
}

export interface ArrivedAsset {
  /** The token contract, or the zero address for native MON. */
  address: `0x${string}`;
  symbol: string;
  decimals: number;
}

/**
 * Money arrived — any asset, any route (G1 "money arrived"). `ref` identifies the incoming transfer
 * (`<txHash>:<logIndex>`), so the same arrival is recorded once however often it is seen.
 *
 * TODO(D6 holdings watcher, B1): this is the hook for the any-asset watcher (HyperSync `Transfer` logs to the user's
 * address). Call it once per incoming transfer the watcher has seen at `finalized`, after the spam rules — never for
 * an unverified token (lookalike symbols would make the push itself the scam). Today only what the keeper and api
 * already observe sends "money arrived": inbox sweeps (keeper `sweeps`) and starter/voucher credits (api relay).
 */
export async function notifyArrival(
  db: Db | Tx,
  chainId: ChainId,
  user: string,
  asset: ArrivedAsset,
  amount: bigint,
  ref: string,
): Promise<boolean> {
  return recordNotification(db, {
    chainId,
    eventKey: `arrived:${ref}`,
    user,
    channel: "deposits",
    title: pushTitle(chainId, `${tokenAmountText(amount, asset.decimals)} ${asset.symbol} arrived`),
    body: "It's in your wallet.",
    url: appLink(chainId, "activity"),
    subject: { kind: "token", address: asset.address, symbol: asset.symbol },
  });
}
