/**
 * The reaction engine (Tradash's combo / surge / slump / callouts, `context/13-revamp/tradash/SPEC-chart.md` §5; ported
 * from Owarine's `features/terminal/feedback/reactions.ts`, same thresholds). Fed the market's price on every tick with
 * the open call on it; returns what to play and show. Pure apart from the random pick among callout texts (injectable).
 *
 * A call has no liquidation price: its "line" is the window's open print, where a close on the wrong side pays nothing,
 * so "Near liquidation" is "Near the line". P/L and margin arrive in basis points of the stake (only ratios matter).
 */

export interface ReactionPosition {
  /** Changes when a new call starts. */
  key: string;
  /** +1 for Up, −1 for Down. */
  side: 1 | -1;
  /** Live result and what was put in, in any one unit (the terminal sends basis points of the stake). */
  pnl: number;
  margin: number;
  entry: number;
  /** The level that loses the call (the window's open print); null when unknown. */
  line: number | null;
}

export type CalloutTone = "good" | "great" | "epic" | "bad" | "warn";

export type Reaction =
  | { kind: "step"; favorable: boolean; count: number }
  | { kind: "surge"; favorable: boolean; mega: boolean }
  | { kind: "callout"; tone: CalloutTone; emoji: string; text: string };

type Pool = ReadonlyArray<readonly [string, string]>;

export const CALLOUTS = {
  combo3: [
    ["👍", "Nice"],
    ["😎", "Smooth"],
    ["✨", "Sweet"],
    ["👌", "Clean"],
  ],
  combo6: [
    ["🎯", "Perfect"],
    ["💪", "Strong"],
    ["🙌", "Beautiful"],
    ["😤", "Let's go"],
  ],
  comboEpic: [
    ["🔥", "On fire!"],
    ["⚡", "Unstoppable"],
    ["🤑", "Printing!"],
    ["👑", "Masterclass"],
  ],
  surge: [
    ["🚀", "Incredible!"],
    ["🚀", "Sending it!"],
    ["💥", "Massive move!"],
    ["🤯", "Unreal!"],
  ],
  mega: [
    ["🌕", "To the moon!"],
    ["🚀", "INSANE!"],
  ],
  adverse: [
    ["😬", "Uhh…"],
    ["😕", "Uhnnn"],
    ["🫤", "Hmm"],
    ["🙃", "Not like this"],
  ],
  slump: [
    ["🥲", "Ouch"],
    ["😵", "Yikes"],
    ["📉", "Rough"],
  ],
  newHigh: [
    ["💎", "New high"],
    ["📈", "New peak"],
  ],
  comeback: [
    ["😮‍💨", "Back in green"],
    ["🙏", "Phew"],
  ],
  nearLine: [["⚠️", "Near the line"]],
} as const satisfies Record<string, Pool>;

const MILESTONES: ReadonlyArray<{ roi: number; tone: CalloutTone; emoji: string; text: string }> = [
  { roi: 0.1, tone: "good", emoji: "💰", text: "+10%" },
  { roi: 0.25, tone: "great", emoji: "🤑", text: "+25%!" },
  { roi: 0.5, tone: "epic", emoji: "🏆", text: "+50%!" },
  { roi: 1, tone: "epic", emoji: "💯", text: "Doubled!" },
  { roi: 2, tone: "epic", emoji: "🐐", text: "Tripled!" },
];

const TOP_RANK = 2;
const RANK: Record<CalloutTone, number> = { good: 0, bad: 0, great: 1, epic: TOP_RANK, warn: TOP_RANK };
export const CALLOUT_LIFETIME_MS: Record<CalloutTone, number> = {
  good: 1_500,
  bad: 1_500,
  great: 1_800,
  epic: 2_200,
  warn: 2_600,
};

/** Noise level: an EMA of |Δp| between ticks. */
const EMA_ALPHA = 0.03;
/** A step is this many noise levels, clamped to a share of price. */
const STEP_NOISE = 2.5;
const STEP_MIN_SHARE = 5e-5;
const STEP_MAX_SHARE = 8e-4;
const COMBO_GOOD = 3;
const COMBO_GREAT = 6;
const COMBO_EPIC = 10;
const COMBO_EPIC_EVERY = 5;
const ADVERSE_CALLOUT = 3;
/** Surges: a move far outside the noise inside the window. */
const WINDOW_MS = 1_500;
const SURGE_COOLDOWN_MS = 3_000;
const SURGE_MIN_SAMPLES = 12;
const SURGE_MIN_POINTS = 4;
const SURGE_MIN_SPAN_MS = 900;
const SURGE_Z = 3;
const SURGE_SHARE = 2.5e-4;
const MEGA_Z = 4.5;
const MEGA_SHARE = 6e-4;
/** A new high only after giving back this much of the peak, and only above this ROI. */
const NEW_HIGH_GIVEBACK = 0.7;
const NEW_HIGH_MIN_ROI = 0.03;
const COMEBACK_ROI = -0.03;
/** Near the line inside this share of the entry-to-line room; re-armed past the second. */
const NEAR_LINE = 0.25;
const NEAR_LINE_REARM = 0.4;
const NEAR_LINE_MIN_SHARE = 2.5e-4;
const CALLOUT_QUIET_MS = 1_200;
const CALLOUT_COOLDOWN_MS = 2_200;
const CALLOUT_COOLDOWN_TOP_MS = 900;

interface PositionState {
  key: string;
  openedAt: number;
  anchor: number;
  combo: number;
  adverse: number;
  milestones: number;
  peak: number;
  newHighArmed: boolean;
  comebackArmed: boolean;
  nearLineArmed: boolean;
}

type Candidate = { tone: CalloutTone; pool: Pool } | { tone: CalloutTone; emoji: string; text: string };

export class ReactionEngine {
  private baseline = 0;
  private samples = 0;
  private lastPrice: number | null = null;
  private window: Array<{ t: number; p: number }> = [];
  private lastSurgeAt = Number.NEGATIVE_INFINITY;
  private lastCalloutAt = Number.NEGATIVE_INFINITY;
  private lastCalloutText = "";
  private pos: PositionState | null = null;

  constructor(private readonly random: () => number = Math.random) {}

  /** A new market: forget its noise level and every per-call state. */
  reset(): void {
    this.baseline = 0;
    this.samples = 0;
    this.lastPrice = null;
    this.window = [];
    this.lastSurgeAt = Number.NEGATIVE_INFINITY;
    this.pos = null;
  }

  feed(input: { t: number; price: number; position: ReactionPosition | null }): Reaction[] {
    const { t, price, position } = input;
    if (!(price > 0)) return [];
    this.observe(t, price);
    if (!position) {
      this.pos = null;
      return [];
    }
    const roi = position.margin > 0 ? position.pnl / position.margin : 0;
    if (!this.pos || this.pos.key !== position.key) {
      this.pos = {
        key: position.key,
        openedAt: t,
        anchor: price,
        combo: 0,
        adverse: 0,
        milestones: MILESTONES.filter((m) => roi >= m.roi).length,
        peak: position.pnl,
        newHighArmed: false,
        comebackArmed: roi <= COMEBACK_ROI,
        nearLineArmed: true,
      };
    }
    const s = this.pos;
    const out: Reaction[] = [];
    const callouts: Candidate[] = [];

    // Steps: a move of ~2.5× typical noise since the last step, either way.
    const threshold = Math.min(Math.max(STEP_NOISE * this.baseline, STEP_MIN_SHARE * price), STEP_MAX_SHARE * price);
    const move = (price - s.anchor) * position.side;
    if (Math.abs(move) >= threshold) {
      s.anchor = price;
      if (move > 0) {
        s.combo += 1;
        s.adverse = 0;
        out.push({ kind: "step", favorable: true, count: s.combo });
        if (position.pnl > 0) {
          if (s.combo === COMBO_GOOD) callouts.push({ tone: "good", pool: CALLOUTS.combo3 });
          else if (s.combo === COMBO_GREAT) callouts.push({ tone: "great", pool: CALLOUTS.combo6 });
          else if (s.combo >= COMBO_EPIC && s.combo % COMBO_EPIC_EVERY === 0)
            callouts.push({ tone: "epic", pool: CALLOUTS.comboEpic });
        }
      } else {
        s.adverse += 1;
        s.combo = 0;
        out.push({ kind: "step", favorable: false, count: s.adverse });
        if (s.adverse === ADVERSE_CALLOUT) callouts.push({ tone: "bad", pool: CALLOUTS.adverse });
      }
    }

    // Surges: a move far outside the noise inside 1.5 s.
    if (this.samples >= SURGE_MIN_SAMPLES && t - this.lastSurgeAt >= SURGE_COOLDOWN_MS) {
      const surge = this.detectSurge(price);
      if (surge) {
        this.lastSurgeAt = t;
        const favorable = Math.sign(surge.delta) === position.side;
        out.push({ kind: "surge", favorable, mega: surge.mega });
        callouts.push(
          favorable
            ? { tone: "epic", pool: surge.mega ? CALLOUTS.mega : CALLOUTS.surge }
            : { tone: "bad", pool: CALLOUTS.slump },
        );
      }
    }

    // ROI milestones, each once per call.
    for (let m = MILESTONES[s.milestones]; m && roi >= m.roi; m = MILESTONES[s.milestones]) {
      callouts.push({ tone: m.tone, emoji: m.emoji, text: m.text });
      s.milestones += 1;
    }

    // A new high after a real drawdown; a comeback from −3 %.
    if (s.peak > 0 && position.pnl <= NEW_HIGH_GIVEBACK * s.peak) s.newHighArmed = true;
    if (position.pnl > s.peak) {
      if (s.newHighArmed && roi > NEW_HIGH_MIN_ROI) callouts.push({ tone: "great", pool: CALLOUTS.newHigh });
      s.newHighArmed = false;
      s.peak = position.pnl;
    }
    if (roi <= COMEBACK_ROI) s.comebackArmed = true;
    else if (s.comebackArmed && position.pnl > 0) {
      s.comebackArmed = false;
      callouts.push({ tone: "good", pool: CALLOUTS.comeback });
    }

    // Near the line: within a quarter of the entry-to-line distance (re-arms past 40 %).
    if (position.line !== null) {
      const span = Math.max(Math.abs(position.entry - position.line), NEAR_LINE_MIN_SHARE * price);
      const room = ((price - position.line) * position.side) / span;
      if (room < NEAR_LINE && room > 0 && s.nearLineArmed) {
        s.nearLineArmed = false;
        callouts.push({ tone: "warn", pool: CALLOUTS.nearLine });
      } else if (room > NEAR_LINE_REARM) s.nearLineArmed = true;
    }

    const shown = this.gate(t, s, callouts);
    if (shown) out.push(shown);
    return out;
  }

  private observe(t: number, price: number): void {
    if (this.lastPrice !== null) {
      const d = Math.abs(price - this.lastPrice);
      this.baseline = this.samples === 0 ? d : this.baseline + EMA_ALPHA * (d - this.baseline);
      this.samples += 1;
    }
    this.lastPrice = price;
    this.window.push({ t, p: price });
    while (this.window.length > 0 && t - (this.window[0]?.t ?? t) > WINDOW_MS) this.window.shift();
  }

  private detectSurge(price: number): { delta: number; mega: boolean } | null {
    const w = this.window;
    const first = w[0];
    const last = w.at(-1);
    if (!first || !last || w.length < SURGE_MIN_POINTS || last.t - first.t < SURGE_MIN_SPAN_MS || this.baseline <= 0)
      return null;
    const delta = price - first.p;
    const rel = Math.abs(delta) / price;
    const z = Math.abs(delta) / (this.baseline * Math.sqrt(w.length - 1));
    if (z >= MEGA_Z && rel >= MEGA_SHARE) return { delta, mega: true };
    if (z >= SURGE_Z && rel >= SURGE_SHARE) return { delta, mega: false };
    return null;
  }

  private gate(t: number, s: PositionState, candidates: Candidate[]): Reaction | null {
    if (candidates.length === 0 || t - s.openedAt < CALLOUT_QUIET_MS) return null;
    const best = candidates.reduce((a, b) => (RANK[b.tone] > RANK[a.tone] ? b : a));
    const cooldown = RANK[best.tone] >= TOP_RANK ? CALLOUT_COOLDOWN_TOP_MS : CALLOUT_COOLDOWN_MS;
    if (t - this.lastCalloutAt < cooldown) return null;
    let emoji: string;
    let text: string;
    if ("pool" in best) {
      const options = best.pool.length > 1 ? best.pool.filter(([, x]) => x !== this.lastCalloutText) : best.pool;
      const pick = options[Math.floor(this.random() * options.length) % options.length] ?? options[0];
      if (!pick) return null;
      [emoji, text] = pick;
    } else ({ emoji, text } = best);
    this.lastCalloutAt = t;
    this.lastCalloutText = text;
    return { kind: "callout", tone: best.tone, emoji, text };
  }
}
