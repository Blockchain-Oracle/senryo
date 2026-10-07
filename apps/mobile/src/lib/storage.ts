import { createMMKV } from "react-native-mmkv";

/** The app's synchronous key-value store (theme, remembered choices, later the tx journal). Never secrets (SecureStore). */
export const storage = createMMKV({ id: "senryo" });

/** Every persisted key, versioned so a shape change never reads stale data. */
export const STORAGE_KEYS = {
  theme: "senryo.theme.v1",
  shellContext: "senryo.shell-context.v1",
  privacyMark: "senryo.privacy-mark.v1",
  setupOrder: "senryo.setup-order.v2",
  /** Home's last tab (Positions / Assets / Earn) — a per-viewer convenience. */
  homeTab: "senryo.home-tab.v1",
  sounds: "senryo.sounds.v1",
  /** The ElevenLabs cue variant chosen per sound in Preferences (by ear); absent = the bundled default. */
  soundChoice: "senryo.sound-choice.v1",
  haptics: "senryo.haptics.v1",
  welcomed: "senryo.welcomed.v1",
  /** Session settings (TTL, idle, Face ID per trade) — non-secret; loosening needs a step-up (S6). */
  sessionSettings: "senryo.session-settings.v1",
  /** S6.10 measurement ring buffer (prompt counts, flow timings, TTFT) — no secrets. */
  measure: "senryo.measure.v1",
  /** Per-install id for the starter relay's rate limit (`x-senryo-device`) — not an identity. */
  device: "senryo.device.v1",
  /** F10: the three-card risk explainer was accepted ("I understand" hold) — shown once, before the first trade. */
  riskExplained: "senryo.risk-explained.v1",
  /** F12: the newest liquidation id the user has seen (haptic once) and dismissed (post-mortem card hidden). */
  liquidationSeen: "senryo.liquidation-seen.v1",
  liquidationDismissed: "senryo.liquidation-dismissed.v1",
  /** S8.22 (F06/F49): the selected network — Practice (testnet) or Mainnet; fresh installs start in Practice. */
  network: "senryo.network.v1",
  /** J1: each new account's first-run setup step (handle → … → terms → primers → done), by address. */
  setup: "senryo.setup.v1",
  /** J1 terms step: the `LEGAL_VERSION` each account acknowledged, by address (a newer version asks again). */
  termsAccepted: "senryo.terms-accepted.v1",
  /** C21: the Kinpaku first-use tutorial was finished (or skipped) on this device. */
  cardIntroSeen: "senryo.card-intro-seen.v1",
  /** FT106: the ticket chart's candle style (body, colour pair, colour by previous close) — saved on "Save" only. */
  candles: "senryo.candles.v1",
  /** J3 Markets: what the Markets tab keeps on this phone, per network — starred markets and recent searches. */
  markets: "senryo.markets.v1",
  /** FT101: the eligibility version each account confirmed before its first Mainnet trade, by address. */
  eligibilityAccepted: "senryo.eligibility-accepted.v1",
  /** FT072: the Perps list's "Go long or short" intro was dismissed on this phone. */
  perpsIntroDismissed: "senryo.perps-intro-dismissed.v1",
  /** When the watchlist last changed on this phone (unix ms): the sync's last-writer-wins clock. */
  watchlistAt: "senryo.watchlist-at.v1",
  /** S1b.13: this phone's push registration — the Expo token, the account it was sent for, and the chosen channels. */
  push: "senryo.push.v1",
  /**
   * A2 (defect 6): set just before a create ceremony, holding the address the phone had before it ("" for none). A
   * kill after the passkey succeeded but before setup was recorded is caught on the next launch: a hint that differs
   * from the one stored here is a new account that still owes its setup.
   */
  setupCreating: "senryo.setup-creating.v1",
  /** A3: each account's @handle and avatar as last seen on this phone, by address, so Welcome can name it offline. */
  identityCache: "senryo.identity-cache.v1",
  /** A3: the address this phone last had signed in (kept after sign-out) — a different, empty account is warned. */
  lastAccount: "senryo.last-account.v1",
  /** A9: an account whose server-side delete didn't reach Senryo; retried at its next unlock on this phone. */
  pendingDelete: "senryo.pending-delete.v1",
  /** A10: show "••••" for amounts on Home, Assets and Card. */
  hideBalances: "senryo.hide-balances.v1",
  /** Flow book C3a: the short-specific risk card was accepted (shown before the first short, after the general three). */
  shortRiskExplained: "senryo.short-risk-explained.v1",
  /** B14: tokens this account hid, per network and account (server-side storage arrives with BD-5). */
  hiddenTokens: "senryo.hidden-tokens.v1",
  /** B13: saved destinations (name, address, chain, mark) per network and account, until BD-5's server copy. */
  savedDestinations: "senryo.saved-destinations.v1",
  /** B5/B4: purchases and bridges this phone started that have not landed yet ("Arriving"). */
  arrivals: "senryo.arrivals.v1",
  /** B4: the open deposit address issued per route (other chain + asset), per network and account — reused on reopen. */
  depositAddresses: "senryo.deposit-addresses.v1",
} as const;
