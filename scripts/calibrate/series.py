"""R3.2 calibration (D-300): price series and the keeper's σ marks.

A price at instant t is the first price at or after t — Pyth's unique print at t, a Binance bar's open. The σ mark is
the one the keeper signs each minute (D-300): an EWMA, span 30, of squared 1-minute log returns between minute
boundaries, per √second. `services/keeper` computes the same thing from the `pyth_prints` minute boundaries.
"""

from __future__ import annotations

import csv
import io
import math
import zipfile
from pathlib import Path

import numpy as np

MINUTE = 60
EWMA_SPAN = 30
# Binance spot files carry microseconds from 2025 on (milliseconds before).
MICROS_FLOOR = 10**14
MICROS = 1_000_000
MILLIS = 1_000
# A Pyth price older than this at its minute is a closed or silent market, not a print.
PYTH_MAX_AGE_SEC = 5
SECONDS_PER_YEAR = 365 * 86_400


class Prices:
    """Prices on a regular grid: `values[i]` is the price at `start + i × step` (NaN where there was none)."""

    def __init__(self, start: int, step: int, values: np.ndarray):
        self.start = start
        self.step = step
        self.values = values

    def at(self, t: np.ndarray) -> np.ndarray:
        i = (t - self.start) // self.step
        ok = (i >= 0) & (i < len(self.values)) & ((t - self.start) % self.step == 0)
        out = np.full(t.shape, np.nan)
        out[ok] = self.values[i[ok]]
        return out

    @property
    def end(self) -> int:
        return self.start + self.step * len(self.values)


def _grid(times: np.ndarray, prices: np.ndarray, step: int) -> Prices:
    order = np.argsort(times)
    times, prices = times[order], prices[order]
    start = int(times[0])
    n = int((times[-1] - start) // step) + 1
    values = np.full(n, np.nan)
    values[(times - start) // step] = prices
    return Prices(start, step, values)


def load_binance(directory: Path, step: int) -> Prices:
    """Every kline zip in `directory` (one symbol, one interval): each bar's open at its open time."""
    times: list[int] = []
    opens: list[float] = []
    for path in sorted(directory.glob("*.zip")):
        with zipfile.ZipFile(path) as z:
            for name in z.namelist():
                with z.open(name) as f:
                    for row in csv.reader(io.TextIOWrapper(f)):
                        if not row or not row[0].isdigit():
                            continue
                        raw = int(row[0])
                        times.append(raw // MICROS if raw >= MICROS_FLOOR else raw // MILLIS)
                        opens.append(float(row[1]))
    return _grid(np.array(times, dtype=np.int64), np.array(opens), step)


def load_pyth(directory: Path) -> dict[str, Prices]:
    """`fetch-archive.mjs` files: each feed's print at every minute it was live."""
    rows: dict[str, tuple[list[int], list[float]]] = {}
    for path in sorted(directory.glob("pyth-1m-*.csv")):
        with path.open() as f:
            for r in csv.DictReader(f):
                t, published = int(r["t"]), int(r["publish_time"])
                if published - t > PYTH_MAX_AGE_SEC:
                    continue
                price = int(r["price"]) * 10.0 ** int(r["expo"])
                ts, ps = rows.setdefault(r["symbol"], ([], []))
                ts.append(t)
                ps.append(price)
    return {s: _grid(np.array(ts, dtype=np.int64), np.array(ps), MINUTE) for s, (ts, ps) in rows.items() if ts}


class SigmaMarks:
    """`sigma[k]`: the mark signed just after minute boundary `start + k × 60`, σ per √second (NaN until seeded): an
    EWMA over `span` minutes of squared log returns over `horizon` minutes (overlapping, one per minute). The fast mark
    is 1-minute returns over 30 minutes; the slow anchor is longer returns over a day, so hour-scale prices inherit the
    regime's chop or trend."""

    def __init__(self, minutes: Prices, span: int = EWMA_SPAN, horizon: int = 1, clip: float = math.inf):
        """`clip`: a squared return counts at most clip² × the variance before it (a winsorised EWMA), so the move
        that just carried a price toward a strike can't by itself blow σ up."""
        if minutes.step != MINUTE:
            raise ValueError("σ marks need minute boundaries")
        clip2 = clip * clip
        alpha = 2 / (span + 1)
        p = minutes.values
        r = np.full(len(p), np.nan)
        r[horizon:] = np.log(p[horizon:] / p[:-horizon])
        var = np.full(len(p), np.nan)
        acc, seen = 0.0, 0
        for k in range(len(p)):
            x = r[k]
            if not math.isnan(x):
                if seen < span:  # seed with the plain mean of the first span
                    acc = (acc * seen + x * x) / (seen + 1)
                else:
                    acc = alpha * min(x * x, clip2 * acc) + (1 - alpha) * acc
                seen += 1
            if seen >= min(span, EWMA_SPAN):
                var[k] = acc
        self.start = minutes.start
        self.sigma = np.sqrt(var / (MINUTE * horizon))

    def at(self, t: np.ndarray, lag: int) -> np.ndarray:
        """The freshest mark a fill at `t` can carry: the last minute boundary at or before `t − lag`."""
        k = (t - lag - self.start) // MINUTE
        ok = (k >= 0) & (k < len(self.sigma))
        out = np.full(t.shape, np.nan)
        out[ok] = self.sigma[k[ok]]
        return out


def realised_annual(minutes: Prices) -> float:
    """Annualised realised volatility of 1-minute log returns over the whole series."""
    p = minutes.values
    r = np.log(p[1:] / p[:-1])
    r = r[np.isfinite(r)]
    return float(np.sqrt(np.mean(r * r) / MINUTE * SECONDS_PER_YEAR))
