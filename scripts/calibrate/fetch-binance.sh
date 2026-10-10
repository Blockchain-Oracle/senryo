#!/usr/bin/env bash
# R3.2 calibration data (D-300): Binance spot klines from data.binance.vision, each archive checked against its
# published SHA-256. 1-minute bars for the seven ride/crypto markets over 90 days; 1-second bars for BTC, ETH and SOL
# over the last 40 days (the sub-minute horizons). Binance is the proxy until the Pyth archive is deep enough; the
# held-out check also runs on Pyth's own prints from Senryo's archive (fetch-archive.mjs).
#
#   scripts/calibrate/fetch-binance.sh <out-dir>
#
# Downloaded files are data: they land in <out-dir> only and are read by fit.py with the path passed in.
set -euo pipefail

OUT="${1:?usage: fetch-binance.sh <out-dir>}"
BASE="https://data.binance.vision/data/spot"
MINUTE_SYMBOLS=(BTCUSDT ETHUSDT SOLUSDT XRPUSDT BNBUSDT DOGEUSDT HYPEUSDT)
SECOND_SYMBOLS=(BTCUSDT ETHUSDT SOLUSDT)
MINUTE_MONTHS=(2026-07 2026-08 2026-09)
SECOND_MONTHS=(2026-09)
DAYS=(2026-10-01 2026-10-02 2026-10-03 2026-10-04 2026-10-05 2026-10-06 2026-10-07 2026-10-08 2026-10-09)

fetch() { # <url> <dir>
  local url="$1" dir="$2" name
  name="$(basename "$url")"
  mkdir -p "$dir"
  if [[ -f "$dir/$name" ]]; then return; fi
  # A month before the symbol's listing doesn't exist (HYPE starts in September 2026): skip it.
  if [[ "$(curl -s -o /dev/null -w '%{http_code}' -I "$url")" == "404" ]]; then
    echo "absent: $name"
    return 0
  fi
  curl -sfL --retry 5 --retry-delay 2 -o "$dir/$name.part" "$url"
  curl -sfL --retry 5 --retry-delay 2 -o "$dir/$name.CHECKSUM" "$url.CHECKSUM"
  local want got
  want="$(cut -d' ' -f1 "$dir/$name.CHECKSUM")"
  got="$(shasum -a 256 "$dir/$name.part" | cut -d' ' -f1)"
  if [[ "$want" != "$got" ]]; then
    echo "checksum mismatch: $name" >&2
    rm -f "$dir/$name.part"
    return 1
  fi
  mv "$dir/$name.part" "$dir/$name"
}

for sym in "${MINUTE_SYMBOLS[@]}"; do
  for m in "${MINUTE_MONTHS[@]}"; do fetch "$BASE/monthly/klines/$sym/1m/$sym-1m-$m.zip" "$OUT/1m/$sym"; done
  for d in "${DAYS[@]}"; do fetch "$BASE/daily/klines/$sym/1m/$sym-1m-$d.zip" "$OUT/1m/$sym"; done
  echo "1m $sym"
done
for sym in "${SECOND_SYMBOLS[@]}"; do
  for m in "${SECOND_MONTHS[@]}"; do fetch "$BASE/monthly/klines/$sym/1s/$sym-1s-$m.zip" "$OUT/1s/$sym"; done
  for d in "${DAYS[@]}"; do fetch "$BASE/daily/klines/$sym/1s/$sym-1s-$d.zip" "$OUT/1s/$sym"; done
  echo "1s $sym"
done
echo done
