import { createMMKV } from "react-native-mmkv";
import { DEV_WORKSPACE } from "./dev/config";

/** The app's synchronous key-value store (theme, remembered choices, later the tx journal). Never secrets (SecureStore). */
export const storage = createMMKV({ id: DEV_WORKSPACE ? "senryo-dev-workspace-v1" : "senryo" });

/** Every persisted key, versioned so a shape change never reads stale data. */
export const STORAGE_KEYS = {
  /** The terminal's market and cadence (S5). */
  terminalSymbol: "senryo.terminal.symbol.v1",
  terminalCadence: "senryo.terminal.cadence.v1",
  /** The last stake, in dollar base units (S5: "last stake remembered"). */
  lastStake: "senryo.terminal.stake.v1",
  /** The way to call: Up / Down, Range or Moonshot (S7.4). */
  terminalMode: "senryo.terminal.mode.v1",
  theme: "senryo.theme.v1",
  setupOrder: "senryo.setup-order.v2",
  sounds: "senryo.sounds.v1",
  tradeReactions: "senryo.trade-reactions.v1",
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
  /** S8.22 (F06/F49): the selected network — Practice (testnet) or Mainnet; fresh installs start in Practice. */
  network: "senryo.network.v1",
  /** J1: each new account's first-run setup step (handle → … → terms → primers → done), by address. */
  setup: "senryo.setup.v1",
  /** J1 terms step: the `LEGAL_VERSION` each account acknowledged, by address (a newer version asks again). */
  termsAccepted: "senryo.terms-accepted.v1",
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
  /** A10: show "••••" for amounts on Home, Assets and Card. */
  hideBalances: "senryo.hide-balances.v1",
  /** A9: an account whose server-side delete didn't reach Senryo; retried at its next unlock on this phone. */
  pendingDelete: "senryo.pending-delete.v1",
} as const;

/**
 * Keys earlier builds wrote that nothing reads any more (the trading era: risk cards, liquidations, card intro, candle
 * style, saved destinations, arrivals…). Kept only so "Delete my data" still wipes them from phones that have them.
 */
export const RETIRED_KEYS = [
  "senryo.privacy-mark.v1",
  "senryo.home-tab.v1",
  "senryo.risk-explained.v2",
  "senryo.liquidation-seen.v1",
  "senryo.liquidation-dismissed.v1",
  "senryo.card-intro-seen.v1",
  "senryo.candles.v1",
  "senryo.markets.v1",
  "senryo.eligibility-accepted.v1",
  "senryo.perps-intro-dismissed.v1",
  "senryo.watchlist-at.v1",
  "senryo.short-risk-explained.v2",
  "senryo.hidden-tokens.v1",
  "senryo.saved-destinations.v1",
  "senryo.arrivals.v1",
  "senryo.deposit-addresses.v1",
] as const;
