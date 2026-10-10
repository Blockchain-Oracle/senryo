"""R3.2 calibration fit (D-300): the σ model and the fat-tailed shape table.

    uv run --no-project --python 3.12 --with numpy python -I scripts/calibrate/fit.py <data-dir> <out-json>

<data-dir> holds `binance/1m/<SYM>` (fetch-binance.sh). σ is the keeper's fast mark — a winsorised EWMA of 1-minute
returns — trusted by a weight and faded into a slow one-day anchor over the horizon (`model.py`). The table is the
distribution of moves standardised by it. Each candidate fast mark is tuned and scored on what matters, the bands'
returns on real windows (`bands.py`): selection on one half, the score on the other, both ways. Production is then
fitted on all 90 days and written as JSON (`table.json`, turned into the contract's and the client's constants by
`codegen.mjs`). Rows below a minute come from Pyth's own per-second prices (`subminute.py`).
"""

from __future__ import annotations

import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

# Run with `python -I` (the data is downloaded): the sibling modules come from this folder only, never the data's.
sys.path.insert(0, str(Path(__file__).resolve().parent))

from bands import KINDS, Model, WindowSet, line, worst_core  # noqa: E402
from model import ShapeTable, standardised  # noqa: E402
from samples import MINUTE_TAUS, Samples, draw  # noqa: E402
from series import MINUTE, SECONDS_PER_YEAR, Prices, SigmaMarks, load_binance  # noqa: E402

MARKETS = ("BTC", "ETH", "SOL", "XRP", "BNB", "DOGE", "HYPE")
# Selection runs on the three biggest; the cross-validated report and production use all seven.
SELECT_MARKETS = 3
ENTRY_STEP = 2 * MINUTE
LANES = (300, 900, 3600)
# The table's horizons (seconds) and its z grid: 0, 0.05 … 5.00.
TABLE_TAUS = (5, 15, 30, 60, 120, 300, 900, 3600)
Z_STEP = 0.05
Z_POINTS = 101
MINUTES_PER_DAY = 1_440
# The σ marks (R3.2 compared 30/60-minute fast spans, 2σ/3σ winsorising and 1-/15-/60-minute-return anchors over one
# and three days; none beat this out of sample): fast EWMA span, winsorising clip, slow span, slow return horizon.
FAST_SPAN, FAST_CLIP, SLOW_SPAN, SLOW_HORIZON = 30, math.inf, MINUTES_PER_DAY, 1
# Each row's width against what windows settle (F_τ(z) → F_τ(z / λ_τ)), searched from the shortest minute row up.
ROW_WIDTHS = (0.76, 0.80, 0.84, 0.88, 0.92, 0.96, 1.0, 1.04)
WIDTH_PASSES = 2
WEIGHTS = (1.0, 0.8, 0.6, 0.4)
KAPPAS = (0.0, 1 / 7_200)
SCALE = 1.0


class Market:
    def __init__(self, sym: str, minutes: Prices):
        self.sym = sym
        self.minutes = minutes
        mid = minutes.start + (minutes.end - minutes.start) // 2
        self.mid = mid - mid % 86_400
        r = np.log(minutes.values[1:] / minutes.values[:-1])
        r = r[np.isfinite(r)]
        self.realised = float(np.sqrt(np.mean(r * r) / MINUTE))  # per √second, for band widths

    def halves(self) -> tuple[tuple[int, int], tuple[int, int]]:
        return (self.minutes.start, self.mid), (self.mid, self.minutes.end)


def span_of(m: Market, side: int | None) -> tuple[int, int]:
    return m.halves()[side] if side is not None else (m.minutes.start, m.minutes.end)


def samples_on(markets: list[Market], fasts: list[SigmaMarks], slows: list[SigmaMarks], side: int | None) -> Samples:
    """Samples on one half of every market (`side` 0 or 1), or on all of it (None)."""
    parts = [draw(i, m.minutes, fast, slow, MINUTE_TAUS, ENTRY_STEP, *span_of(m, side))
             for i, (m, fast, slow) in enumerate(zip(markets, fasts, slows))]
    return Samples.join(parts)


def shape(s: Samples, weight: float, kappa: float, scale: float) -> ShapeTable:
    """The symmetric empirical CDF of u at each table horizon (the nearest sampled one at or above a minute)."""
    u = np.abs(standardised(s, weight, kappa, scale))
    sampled = np.unique(s.tau)
    z = np.arange(Z_POINTS) * Z_STEP
    rows = []
    for tau in TABLE_TAUS:
        near = sampled[np.argmin(np.abs(np.log(sampled) - np.log(max(tau, MINUTE))))]
        a = np.sort(u[s.tau == near])
        rows.append(0.5 + 0.5 * np.searchsorted(a, z, side="right") / len(a))
    cdf = np.maximum.accumulate(np.array(rows), axis=1)
    cdf[:, 0] = 0.5
    return ShapeTable(np.array(TABLE_TAUS, dtype=float), Z_STEP, cdf)


def objective(report: dict) -> float:
    """Σ over lanes and band kinds of the squared return at fair."""
    return sum(r["fair"] ** 2 for r in report.values() if r["n"])


def windowset(markets: list[Market], fasts: list[SigmaMarks], slows: list[SigmaMarks], side: int | None) -> WindowSet:
    items = [(m.minutes, f, sl, m.realised) for m, f, sl in zip(markets, fasts, slows)]
    return WindowSet(items, LANES, lambda i: span_of(markets[i], side), MINUTE)


def narrowed(table: ShapeTable, widths: list[float]) -> ShapeTable:
    """Each row j as F_τj(z / λ_j): λ < 1 narrows the row (a move must be smaller to reach the same chance)."""
    z = np.arange(table.cdf.shape[1]) * table.z_step
    rows = []
    for j, lam in enumerate(widths):
        f = table(z / lam, np.full(len(z), table.taus[j]))
        f = np.maximum.accumulate(f)
        f[0] = 0.5
        rows.append(f)
    return ShapeTable(table.taus, table.z_step, np.array(rows))


def tune(markets: list[Market], fasts: list[SigmaMarks], slows: list[SigmaMarks], side: int | None) -> tuple[Model, list[float]]:
    """On `side` (or all): the weight and fade whose table prices the windows closest to fair, then each minute
    row's width against the windows' outcomes."""
    s = samples_on(markets, fasts, slows, side)
    ws = windowset(markets, fasts, slows, side)
    best = None
    for a in WEIGHTS:
        for k in KAPPAS:
            model = Model(shape(s, a, k, SCALE), a, k, SCALE)
            j = objective(ws.report(model))
            if best is None or j < best[0]:
                best = (j, model)
    base = best[1]
    widths = [1.0] * len(TABLE_TAUS)
    rows = [j for j, tau in enumerate(TABLE_TAUS) if tau >= MINUTE]
    score_of = {}
    for _ in range(WIDTH_PASSES):
        for j in rows:
            for lam in ROW_WIDTHS:
                trial = widths.copy()
                trial[j] = lam
                key = tuple(trial)
                if key not in score_of:
                    m = Model(narrowed(base.table, trial), base.weight, base.kappa, base.scale)
                    score_of[key] = objective(ws.report(m))
            widths[j] = min(ROW_WIDTHS, key=lambda lam: score_of[tuple(widths[:j] + [lam] + widths[j + 1:])])
    # Rows below a minute follow the one-minute row here (subminute.py rescales them from Pyth).
    for j, tau in enumerate(TABLE_TAUS):
        if tau < MINUTE:
            widths[j] = widths[rows[0]]
    return Model(narrowed(base.table, widths), base.weight, base.kappa, base.scale), widths


def main() -> None:
    data, out = Path(sys.argv[1]), Path(sys.argv[2])
    markets = [Market(s, load_binance(data / "binance" / "1m" / f"{s}USDT", MINUTE)) for s in MARKETS]
    fasts = [SigmaMarks(m.minutes, FAST_SPAN, 1, FAST_CLIP) for m in markets]
    slows = [SigmaMarks(m.minutes, SLOW_SPAN, SLOW_HORIZON) for m in markets]
    pick = slice(0, SELECT_MARKETS)
    folds = []
    for side in (0, 1):
        model, widths = tune(markets[pick], fasts[pick], slows[pick], side)
        report = windowset(markets, fasts, slows, 1 - side).report(model)
        folds.append((worst_core(report), model, widths, report))
        print(f"tuned on half {side + 1}: weight {model.weight}, kappa {_inv(model.kappa)}, row widths "
              f"{[round(w, 2) for w in widths]} — scored on the other: worst |fair| {folds[-1][0]:.3f}", flush=True)
        for key in sorted(report, key=lambda k: (int(k.split("s")[0]), KINDS.index(k.split()[1]))):
            print(line(key, report[key]))
    model, widths = tune(markets[pick], fasts[pick], slows[pick], None)
    meta = {
        "generated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": "Binance spot 1-minute bars (data.binance.vision): "
        + ", ".join(f"{m.sym} {_day(m.minutes.start)}…{_day(m.minutes.end)}" for m in markets),
        "fastSpanMinutes": FAST_SPAN,
        "fastClipSigmas": FAST_CLIP if math.isfinite(FAST_CLIP) else None,
        "slowSpanMinutes": SLOW_SPAN,
        "slowHorizonMinutes": SLOW_HORIZON,
        "markWeight": model.weight,
        "kappaPerSec": model.kappa,
        "longRunScale": model.scale,
        "rowWidths": widths,
        "crossValidation": {"worstCoreFair": [f[0] for f in folds], "bar": 0.05},
        "realisedAnnual": {m.sym: m.realised * np.sqrt(SECONDS_PER_YEAR) for m in markets},
        "taus": list(TABLE_TAUS),
        "zStep": Z_STEP,
        "cdf": [[round(float(x), 6) for x in row] for row in model.table.cdf],
    }
    out.write_text(json.dumps(meta, indent=1) + "\n")
    print(f"production (all 90 days): weight {model.weight}, kappa {_inv(model.kappa)}, widths "
          f"{[round(w, 2) for w in widths]}; worst |fair| out of sample {max(f[0] for f in folds):.3f}; wrote {out}")


def _inv(k: float) -> str:
    return f"1/{1 / k:.0f}s" if k else "0"


def _day(t: int) -> str:
    return datetime.fromtimestamp(t, timezone.utc).date().isoformat()


if __name__ == "__main__":
    main()
