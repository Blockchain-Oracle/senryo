"""R3.2 calibration: calls priced by the model on real windows, settled by what happened (D-300).

A window opens on its first price K and closes on its last; entries inside it fill at the price then, with τ to the
close. A band is scored by the caller's return per dollar at the fair price — mean(win / p) − 1 over entries the pool
would quote (3 % ≤ p ≤ 97 %) — overall, by probability decile and by σ state (the fast mark against the slow anchor,
both public). Used by `fit.py` (cross-validation) and `check.py` (the report).
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from model import ShapeTable, above, sigma_at
from samples import MARK_LAG_SEC
from series import Prices, SigmaMarks

LOCKOUT_SEC = 20
MIN_PROB, MAX_PROB = 0.03, 0.97
# Band widths from realised σ (D-300; the catalogue's ±½σ√τ range and 1σ√τ strikes, without the ×1.5).
RANGE_SIGMAS, STRIKE_SIGMAS = 0.5, 1.0
BPS = 10_000
# The spread curve h(p) = max(0.25 pt, 4·h50·p(1−p)), h50 by lane (D-300).
H_FLOOR = 0.0025
H50 = {60: 0.03, 300: 0.02, 900: 0.015, 3600: 0.01}
DECILES = 10
STATES = 3
KINDS = ("up", "down", "range", "moonshot", "crash")
CORE_KINDS = ("up", "down", "range")


@dataclass
class Model:
    table: ShapeTable
    weight: float
    kappa: float
    scale: float


def windows(prices: Prices, lane: int, t_from: int, t_to: int, step: int):
    """(entry t, τ, spot, K, close) for every entry of every whole window in [t_from, t_to)."""
    first = t_from + (-t_from) % lane
    starts = np.arange(first, t_to - lane, lane, dtype=np.int64)
    offsets = np.arange(0, lane - LOCKOUT_SEC, step, dtype=np.int64)
    s = np.repeat(starts, len(offsets))
    t = s + np.tile(offsets, len(starts))
    k, close, spot = prices.at(s), prices.at(s + lane), prices.at(t)
    ok = np.isfinite(k) & np.isfinite(close) & np.isfinite(spot)
    return t[ok], (s + lane - t)[ok], spot[ok], k[ok], close[ok]


def priced(w, fast: SigmaMarks, slow: SigmaMarks, m: Model, half_bps: int, strike_bps: int) -> dict:
    """kind → (p, won, state) for every entry of the windows `w`."""
    t, tau, spot, k, close = w
    sm, sl = fast.at(t, MARK_LAG_SEC), slow.at(t, MARK_LAG_SEC)
    ok = np.isfinite(sm) & np.isfinite(sl)
    tau, spot, k, close, sm, sl = tau[ok], spot[ok], k[ok], close[ok], sm[ok], sl[ok]
    sig = sigma_at(sm, sl * m.scale, m.weight, m.kappa, tau)
    up_p = above(m.table, k / spot, sig, tau)
    lo, hi = k * (1 - half_bps / BPS), k * (1 + half_bps / BPS)
    moon, crash = k * (1 + strike_bps / BPS), k * (1 - strike_bps / BPS)
    state = sm / sl
    live = close != k  # Up and Down refund a tie at K
    return {
        "up": (up_p[live], (close > k)[live], state[live]),
        "down": ((1 - up_p)[live], (close < k)[live], state[live]),
        "range": (above(m.table, lo / spot, sig, tau) - above(m.table, hi / spot, sig, tau),
                  (close >= lo) & (close <= hi), state),
        "moonshot": (above(m.table, moon / spot, sig, tau), close > moon, state),
        "crash": (1 - above(m.table, crash / spot, sig, tau), close < crash, state),
    }


def widths(realised_per_sec: float, lane: int) -> tuple[int, int]:
    sigma_lane = realised_per_sec * np.sqrt(lane) * BPS
    return max(1, round(sigma_lane * RANGE_SIGMAS)), max(1, round(sigma_lane * STRIKE_SIGMAS))


def _by(groups: np.ndarray, count: int, win: np.ndarray, p: np.ndarray) -> list[float]:
    return [float(np.mean(win[groups == i] / p[groups == i]) - 1) for i in range(count) if np.any(groups == i)]


def score(p: np.ndarray, win: np.ndarray, state: np.ndarray, h50: float) -> dict:
    q = (p >= MIN_PROB) & (p <= MAX_PROB)
    p, win, state = p[q], win[q].astype(float), state[q]
    if len(p) == 0:
        return {"n": 0}
    h = np.maximum(H_FLOOR, 4 * h50 * p * (1 - p))
    edges = np.quantile(p, np.linspace(0, 1, DECILES + 1))
    deciles = _by(np.clip(np.searchsorted(edges, p, side="right") - 1, 0, DECILES - 1), DECILES, win, p)
    cuts = np.quantile(state, np.linspace(0, 1, STATES + 1))
    states = _by(np.clip(np.searchsorted(cuts, state, side="right") - 1, 0, STATES - 1), STATES, win, p)
    return {
        "n": int(len(p)),
        "p": float(p.mean()),
        "won": float(win.mean()),
        "fair": float(np.mean(win / p) - 1),
        "withSpread": float(np.mean(win / np.minimum(p + h, 1 - 1e-9)) - 1),
        "deciles": deciles,
        "states": states,
    }


def worst_core(report: dict) -> float:
    """The worst |return at fair| over Up, Down and Range on every lane — the plan's ±5 % bar."""
    return max(abs(s["fair"]) for key, s in report.items() if s["n"] and key.split()[1] in CORE_KINDS)


def line(key: str, s: dict) -> str:
    out = f"{key:>14}: n {s['n']:>8,}"
    if s["n"]:
        out += (f"  p {s['p']:.3f} won {s['won']:.3f}  fair {s['fair']:+.3f}  with h {s['withSpread']:+.3f}"
                f"  deciles {min(s['deciles']):+.3f}…{max(s['deciles']):+.3f}"
                f"  σ quiet→hot {' '.join(f'{x:+.3f}' for x in s['states'])}")
    return out


class WindowSet:
    """Every entry of every window of some markets' lanes on one span (mirrored too), with its marks looked up once,
    so many models can be scored fast."""

    def __init__(self, items: list[tuple[Prices, SigmaMarks, SigmaMarks, float]], lanes: tuple[int, ...],
                 span_of, step: int):
        self.parts = []
        for i, (prices, fast, slow, realised) in enumerate(items):
            a, b = span_of(i)
            mirror = Prices(prices.start, prices.step, 1 / prices.values)
            for lane in lanes:
                half, strike = widths(realised, lane)
                for path in (prices, mirror):
                    t, tau, spot, k, close = windows(path, lane, a, b, step)
                    sm, sl = fast.at(t, MARK_LAG_SEC), slow.at(t, MARK_LAG_SEC)
                    ok = np.isfinite(sm) & np.isfinite(sl)
                    self.parts.append((lane, half, strike, tau[ok], spot[ok], k[ok], close[ok], sm[ok], sl[ok]))

    def report(self, m: Model) -> dict:
        acc: dict = {}
        for lane, half, strike, tau, spot, k, close, sm, sl in self.parts:
            w = (np.zeros(len(tau), dtype=np.int64), tau, spot, k, close)
            fast = _Fixed(sm)
            slow = _Fixed(sl)
            for kind, cols in priced(w, fast, slow, m, half, strike).items():
                for col, x in zip(acc.setdefault(f"{lane}s {kind}", ([], [], [])), cols):
                    col.append(x)
        return {key: score(*(np.concatenate(c) for c in cols), H50[int(key.split("s")[0])]) for key, cols in acc.items()}


class _Fixed:
    """Marks already looked up, in entry order (`priced` asks by instant; the cached set answers in order)."""

    def __init__(self, values: np.ndarray):
        self.values = values

    def at(self, t: np.ndarray, lag: int) -> np.ndarray:  # noqa: ARG002
        return self.values
