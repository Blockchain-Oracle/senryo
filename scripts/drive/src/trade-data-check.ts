// biome-ignore-all lint/style/noMagicNumbers: explicit boundary values are the test fixtures.
import assert from "node:assert/strict";
import { decodePerplTick, PerplPriceStream } from "../../../packages/query/src/perpl-stream.ts";
import { mirrorDecision } from "../../../services/keeper/src/jobs/mirror-policy.ts";
import { LocalOracleHistory } from "./mobile-dev-history.ts";

const history = new LocalOracleHistory();
history.record("XAU", 61, 100n);
history.record("XAU", 65, 120n);
history.record("XAU", 69, 90n);
history.record("XAU", 69, 110n);
history.record("XAU", 181, 105n);
assert.deepEqual(
  history.candles("XAU", 60, 0).Candle.map((c) => [c.openTime, c.open, c.high, c.low, c.close, c.roundCount]),
  [
    [180, 105n, 105n, 105n, 105n, 1],
    [60, 100n, 120n, 100n, 110n, 3],
  ],
);
assert.throws(() => history.record("XAU", 60, 100n));
assert.throws(() => history.candles("XAU", 0, 0));
history.clear();
assert.equal(history.candles("XAU", 60, 0).Candle.length, 0);
const source = { answer: 100n, roundId: 2n, updatedAt: 990n };
const input = {
  source,
  mirror: { ...source, updatedAt: 980n },
  category: "fx" as const,
  nowSec: 1000n,
  active: true,
  confirming: false,
  lastSourceRound: "1",
  heartbeatSec: 9000,
  deviationBps: 50,
  confirmSec: 155,
};
assert.equal(mirrorDecision(input), "active-round");
assert.equal(mirrorDecision({ ...input, lastSourceRound: "2" }), undefined);
assert.equal(mirrorDecision({ ...input, active: false }), undefined);
assert.equal(mirrorDecision({ ...input, source: { ...source, updatedAt: 1001n } }), "invalid-source");
assert.equal(mirrorDecision({ ...input, source: { ...source, updatedAt: 100n } }), "invalid-source");
assert.equal(mirrorDecision({ ...input, source: { ...source, answer: 0n } }), "invalid-source");
assert.equal(mirrorDecision({ ...input, active: false, source: { ...source, answer: 101n } }), "deviation");
assert.equal(
  mirrorDecision({ ...input, confirming: true, active: false, mirror: { ...source, updatedAt: 800n } }),
  "confirmation",
);
assert.equal(decodePerplTick(50, { mrk: 133196, at: { t: 10000 } }, 10000)?.at, 10000);
assert.equal(decodePerplTick(50, { mrk: 0, at: { t: 10000 } }, 10000), undefined);
assert.equal(decodePerplTick(50, { mrk: 12, at: { t: 20000 } }, 10000), undefined);
assert.equal(decodePerplTick(9999, { mrk: 12, at: { t: 10000 } }, 10000), undefined);
console.log("PASS local OHLC truth, reset, relay freshness/active rounds, and stream validation");

// Public read only: actual venue packets must decode and progress; no wallet/authentication or orders.
for (const [chainId, marketId] of [
  [143, 50],
  [10143, 256],
] as const) {
  const stream = new PerplPriceStream(chainId);
  const observations = new Set<number>();
  await new Promise<void>((resolve, reject) => {
    const deadline = setTimeout(() => {
      stop();
      reject(new Error("No progressing ZEC market-state ticks in 20s"));
    }, 20000);
    const stop = stream.subscribe(() => {
      const tick = stream.get(marketId);
      if (!tick) return;
      observations.add(tick.at);
      if (observations.size >= 3) {
        clearTimeout(deadline);
        stop();
        console.log(
          JSON.stringify({
            symbol: "ZEC",
            chainId,
            observations: observations.size,
            price18: tick.price18.toString(),
            sourceAgeMs: Date.now() - tick.at,
            samples: tick.samples.length,
          }),
        );
        resolve();
      }
    });
  });
}
