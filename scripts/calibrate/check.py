"""R3.2 cross-source check (D-300, D-313): the committed table, scored on Pyth's own minute prints.

    uv run --no-project --python 3.12 --with numpy python -I scripts/calibrate/check.py <data-dir> <table-json>

The fit is cross-validated on Binance (`fit.py`); this prices real 5m/15m/1h windows on Senryo's archive of Pyth's
minute prints (`fetch-archive.mjs`, kept since 8 Oct) with the σ marks the keeper will sign from the same prints, and
reports each band's return at fair (`bands.py`). The archive is days, not months — a sanity check that the Binance
fit carries over to Pyth, not a calibration of its own.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np

# Run with `python -I` (the data is downloaded): the sibling modules come from this folder only, never the data's.
sys.path.insert(0, str(Path(__file__).resolve().parent))

from bands import KINDS, Model, WindowSet, line  # noqa: E402
from model import ShapeTable  # noqa: E402
from series import MINUTE, SECONDS_PER_YEAR, SigmaMarks, load_pyth  # noqa: E402

LANES = (300, 900, 3600)


def main() -> None:
    data, table_path = Path(sys.argv[1]), Path(sys.argv[2])
    fit = json.loads(table_path.read_text())
    table = ShapeTable(np.array(fit["taus"], dtype=float), fit["zStep"], np.array(fit["cdf"]))
    model = Model(table, fit["markWeight"], fit["kappaPerSec"], fit["longRunScale"])
    minutes = load_pyth(data / "pyth")
    items = []
    for sym, annual in fit["realisedAnnual"].items():
        if sym not in minutes:
            continue
        m = minutes[sym]
        fast = SigmaMarks(m, fit["fastSpanMinutes"])
        slow = SigmaMarks(m, fit["slowSpanMinutes"], fit["slowHorizonMinutes"])
        items.append((m, fast, slow, annual / np.sqrt(SECONDS_PER_YEAR)))
        print(f"{sym}: {np.isfinite(m.values).sum():,} Pyth minutes")
    spans = [(m.start, m.end) for m, *_ in items]
    report = WindowSet(items, LANES, lambda i: spans[i], MINUTE).report(model)
    for key in sorted(report, key=lambda k: (int(k.split("s")[0]), KINDS.index(k.split()[1]))):
        print(line(key, report[key]))


if __name__ == "__main__":
    main()
