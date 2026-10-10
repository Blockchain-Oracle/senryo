"""R3.2 calibration: the table's rows below a minute, from Pyth's own per-second prices (D-300).

    uv run --no-project --python 3.12 --with numpy python -I scripts/calibrate/subminute.py <data-dir> <table-json>

Binance trade prints are no proxy below a minute (a quiet market prints no trade for seconds; Pyth's aggregate keeps
moving), and the per-second Pyth record (`record-recent.mjs`) is hours, not months. So Pyth decides one number per
horizon — how wide a sub-minute move is against a one-minute move under the same σ model, λ(τ) = median|u_τ| /
median|u_60| — and each row is the one-minute row, measured on 90 days, rescaled: F_τ(z) = F_60(z / λ(τ)). The σ
marks come from Senryo's archived minute prints (`fetch-archive.mjs`), as the keeper's will. Rewrites the rows below
60 s of <table-json> in place and records λ and the record's span.
"""

from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

import numpy as np

# Run with `python -I` (the data is downloaded): the sibling modules come from this folder only, never the data's.
sys.path.insert(0, str(Path(__file__).resolve().parent))

from model import ShapeTable, standardised  # noqa: E402
from samples import Samples, draw  # noqa: E402
from series import MINUTE, Prices, SigmaMarks, load_pyth  # noqa: E402

SYMBOLS = ("BTC", "ETH", "SOL", "XRP", "BNB", "DOGE", "HYPE")
PRICE_SCALE = 1e-8
ENTRY_STEP = 1
REFERENCE_TAU = 60


def load_seconds(path: Path) -> Prices:
    with path.open() as f:
        rows = [(int(t), int(p) * PRICE_SCALE) for t, p in csv.reader(f) if t]
    t = np.array([r[0] for r in rows], dtype=np.int64)
    v = np.array([r[1] for r in rows])
    start = int(t.min())
    values = np.full(int(t.max()) - start + 1, np.nan)
    values[t - start] = v
    return Prices(start, 1, values)


def main() -> None:
    data, table_path = Path(sys.argv[1]), Path(sys.argv[2])
    fit = json.loads(table_path.read_text())
    taus = fit["taus"]
    sub = tuple(t for t in taus if t < REFERENCE_TAU)
    minutes = load_pyth(data / "pyth")
    parts, spans = [], {}
    for i, sym in enumerate(SYMBOLS):
        path = data / "pyth-1s" / f"{sym}.csv"
        if not path.exists() or sym not in minutes:
            continue
        seconds = load_seconds(path)
        fast = SigmaMarks(minutes[sym])
        slow = SigmaMarks(minutes[sym], fit["slowSpanMinutes"], fit["slowHorizonMinutes"])
        parts.append(draw(i, seconds, fast, slow, (*sub, REFERENCE_TAU), ENTRY_STEP, seconds.start, seconds.end))
        spans[sym] = [seconds.start, seconds.end]
    s = Samples.join(parts)
    u = np.abs(standardised(s, fit["markWeight"], fit["kappaPerSec"], fit["longRunScale"]))
    ref = float(np.median(u[s.tau == REFERENCE_TAU]))
    table = ShapeTable(np.array(taus, dtype=float), fit["zStep"], np.array(fit["cdf"]))
    z = np.arange(len(fit["cdf"][0])) * fit["zStep"]
    lam = {}
    for tau in sub:
        lam[tau] = float(np.median(u[s.tau == tau])) / ref
        row = taus.index(tau)
        f = table(z / lam[tau], np.full(len(z), REFERENCE_TAU))
        f = np.maximum.accumulate(f)
        f[0] = 0.5
        fit["cdf"][row] = [round(float(x), 6) for x in f]
        print(f"tau {tau:>3}s: λ = {lam[tau]:.3f}  (n {int(np.sum(s.tau == tau)):,})")
    fit["subMinute"] = {"lambda": lam, "referenceTau": REFERENCE_TAU, "medianAbsU60": ref, "recordSpans": spans}
    table_path.write_text(json.dumps(fit, indent=1) + "\n")
    print(f"rows below {REFERENCE_TAU} s rewritten from {len(s):,} Pyth samples")


if __name__ == "__main__":
    main()
