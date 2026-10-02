/** Card service constants (specs/services.md §card; Lithic docs: 6 s hard / 3 s recommended ASA budget). */

export const CARD_PORT = 3001;

/** Decide before this many ms after receipt (Lithic declines at 6 s, recommends 3 s). */
export const INTERNAL_DEADLINE_MS = 2_800;
/** Standard-Webhooks timestamp tolerance (both ASA and events). */
export const WEBHOOK_TOLERANCE_S = 300;
/** Margin kept for writing the decision and responding (respond ~20 ms in the budget). */
export const RESPOND_MARGIN_MS = 60;

/** Foreign-currency authorisations hold cardholder × (1 + FX buffer) (D-042). */
export const FX_BUFFER_BPS = 300;
/** Tip MCCs (restaurants, bars, taxis, salons) hold cardholder × (1 + tip buffer). */
export const TIP_BUFFER_BPS = 2_000;
export const TIP_MCCS: readonly string[] = ["4121", "5812", "5813", "5814", "7230", "7298"];

/** 1 cent = 10_000 usd6. */
export const USD6_PER_CENT = 10_000n;
export const CARD_CURRENCY = "USD";

/** Constants.sol SAFETY_BUFFER_USD6 (B, D-054) — applies once the account carries risk (a hold counts). */
export const SAFETY_BUFFER_USD6 = 1_000_000n;

/** Constants.sol MAX_HOLD_USD6 — the contract refuses larger holds. */
export const MAX_HOLD_USD6 = 250_000_000n;

/** Card operator shards (OPERATOR_1_PK … OPERATOR_n_PK). */
export const MAX_OPERATORS = 8;

/** Issuer label hashed into the onchain `issuer` (bytes32) — release-only is set per issuer (D-036). */
export const DEFAULT_ISSUER_LABEL = "lithic-sandbox";

/** A duplicate ASA request polls the original's row this often until it is decided. */
export const DUPLICATE_POLL_MS = 50;

export const OUTBOX = {
  pollMs: 1_000,
  batch: 10,
  maxAttempts: 8,
  /** Exponential backoff base (ms) for failed sends. */
  backoffBaseMs: 2_000,
} as const;

export const LITHIC_SANDBOX_API = "https://sandbox.lithic.com";
export const LITHIC_SANDBOX_HOST = "sandbox.lithic.com";
export const LITHIC_TIMEOUT_MS = 5_000;
export const MS_PER_SECOND_N = 1_000n;
/** Shown as the issuer's name in the summary (E1 "issuer unavailable (named)"). */
export const ISSUER_NAME = "Lithic";

/** Simulate waits this long for our ASA decision to be recorded (the decision deadline plus a margin). */
export const SIMULATE_WAIT_MS = 3_500;
export const SIMULATE_POLL_MS = 100;
/** A PENDING `card_auth` row older than its deadline + this was never answered in time → Lithic declined it. */
export const UNANSWERED_GRACE_MS = 1_000;
/** Lithic `memo` on issued cards (≤ this many characters of the account address follow it). */
export const CARD_MEMO_PREFIX = "Senryo Kinpaku ";
export const CARD_MEMO_ADDRESS_CHARS = 10;
export const BPS = 10_000n;
