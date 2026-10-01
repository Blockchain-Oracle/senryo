/**
 * Deposit inboxes (S8.24, D-179): `InboxFactory.inboxOf(user)` is a CREATE2 address any Monad wallet or exchange can
 * send AUSD/USDC to. The keeper's `sweeps` job pays the gas to deploy + `sweep`, which credits the user's core
 * account — so a brand-new account needs no MON to receive its first deposit.
 */

/**
 * The keeper sweeps an inbox once AUSD + USDC there reach this (both 6 decimals). The deposit is the anti-spam cost:
 * gas is only ever spent after real value has landed, and the first sweep (deploy + depositFor) costs far more MON
 * than a dust transfer is worth. Smaller amounts wait in the inbox (still the user's) until topped up.
 */
export const INBOX_SWEEP_MIN_USD6 = 1_000_000n;

/**
 * A counterfactual inbox is invisible to the indexer until it is deployed, so the app registers it with the api when
 * it shows the address (`POST /v1/inbox/watch`); the keeper reads its balance until this many days after the last
 * registration. Deployed inboxes are found through the indexer and need no watch.
 */
export const INBOX_WATCH_TTL_DAYS = 7;
