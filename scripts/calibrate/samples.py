"""R3.2 calibration: what a fill would have priced with, and what then happened.

A sample is one (market, entry instant t, horizon τ): the log return from the price at t to the price at t + τ, and the
fast and slow σ marks a fill at t could carry (the freshest minute boundary at or before t − `MARK_LAG_SEC`).
The model (`model.py`) turns those into a standardised move u; the table is u's distribution.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from series import MINUTE, Prices, SigmaMarks

# The keeper signs a minute's mark a few seconds after its boundary.
MARK_LAG_SEC = 5
# Horizons the fit and the check sample (seconds to the window's close at the fill).
SUB_MINUTE_TAUS = (5, 10, 15, 20, 30, 45)
MINUTE_TAUS = (60, 90, 120, 180, 300, 450, 600, 900, 1200, 1800, 2700, 3600)


@dataclass
class Samples:
    market: np.ndarray  # index into the market list
    t: np.ndarray
    tau: np.ndarray
    r: np.ndarray  # ln(P(t + τ) / P(t))
    sigma_mark: np.ndarray  # σ per √second the fill would have carried
    sigma_long: np.ndarray  # the slow mark (the long-run anchor) per √second

    def __len__(self) -> int:
        return len(self.r)

    def where(self, keep: np.ndarray) -> Samples:
        return Samples(*(getattr(self, f)[keep] for f in self.__dataclass_fields__))

    @staticmethod
    def join(parts: list[Samples]) -> Samples:
        return Samples(*(np.concatenate([getattr(p, f) for p in parts]) for f in Samples.__dataclass_fields__))


def draw(
    market: int,
    prices: Prices,
    marks: SigmaMarks,
    slow: SigmaMarks,
    taus: tuple[int, ...],
    entry_step: int,
    t_from: int,
    t_to: int,
) -> Samples:
    """Entries every `entry_step` seconds in [t_from, t_to − τ) on `prices`' grid, at each horizon in `taus`."""
    start = max(t_from, prices.start)
    start += (-(start - prices.start)) % prices.step
    entries = np.arange(start, min(t_to, prices.end), entry_step, dtype=np.int64)
    parts = []
    for tau in taus:
        t = entries[entries + tau < min(t_to, prices.end)]
        p0, p1 = prices.at(t), prices.at(t + tau)
        sm, sl = marks.at(t, MARK_LAG_SEC), slow.at(t, MARK_LAG_SEC)
        ok = np.isfinite(p0) & np.isfinite(p1) & np.isfinite(sm) & np.isfinite(sl) & (p0 > 0) & (p1 > 0)
        t = t[ok]
        parts.append(
            Samples(
                np.full(len(t), market),
                t,
                np.full(len(t), tau, dtype=np.int64),
                np.log(p1[ok] / p0[ok]),
                sm[ok],
                sl[ok],
            )
        )
    return Samples.join(parts)


def minute_prices_of(seconds: Prices) -> Prices:
    """Minute boundaries out of a 1-second series (the same first-trade-at-or-after rule)."""
    if seconds.step == MINUTE:
        return seconds
    offset = (-(seconds.start % MINUTE)) % MINUTE
    values = seconds.values[offset::MINUTE]
    return Prices(seconds.start + offset, MINUTE, values)
