/** Injected HTTP against an original binary contract on an owned disposable local node. */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  binaryHistoryRoute,
  binaryPositionRoute,
  binaryQuoteRoute,
  binaryRoundRoute,
  binaryRoundsRoute,
  createApiClient,
} from "@senryo/api-client";
import type { ReadClient } from "@senryo/chain";
import { BINARY_POLICY } from "@senryo/config";
import { createHttpServer, createLogger } from "@senryo/service-common";
import { binaryFixture, FIXTURE_FEE, MON, operation } from "../../../packages/chain/checks/binary-api-fixture.ts";
import { type BinaryHistoryReader, BinaryPredictions, createBinaryPredictions } from "../src/predictions/binary.ts";
import { registerBinaryPredictionRoutes } from "../src/routes/binary-predictions.ts";

const ADDRESS_HEX_LENGTH = 40,
  HASH_HEX_LENGTH = 64,
  UINT256_BITS = 256n;
const FIFTEEN_MINUTES = 900n,
  CLOSED = 409;
const TIMEOUT_MS = 90000,
  DEADLINE_SECONDS = 12n,
  STALE_SECONDS = 20n;
const OK = 200,
  BAD_REQUEST = 400,
  NOT_FOUND = 404,
  UNAVAILABLE = 503;
const log = createLogger("binary-api-check", "silent");
function appFor(service: BinaryPredictions) {
  const app = createHttpServer({ service: "binary-check", logger: log });
  registerBinaryPredictionRoutes(app, service);
  return app;
}
test("public binary composition remains inactive and rejects untrusted source flags before RPC", async () => {
  let rpcCalls = 0;
  const read = new Proxy(
    {},
    {
      get() {
        rpcCalls++;
        throw new Error("RPC must not run");
      },
    },
  ) as ReadClient;
  const app = appFor(createBinaryPredictions(new Map([[BINARY_POLICY.chainId, { read }]])));
  try {
    const list = await app.inject("/v1/binary-predictions?chainId=10143&asset=BTC&duration=900");
    assert.equal(list.statusCode, OK);
    assert.deepEqual(list.json(), { status: "inactive", sources: [], rounds: [] });
    const contract = `0x${"1".repeat(ADDRESS_HEX_LENGTH)}`,
      round = operation("not-deployed");
    for (const path of [
      `${contract}/${round}`,
      `${contract}/${round}/position/${contract}`,
      `${contract}/${round}/quote`,
      `${contract}/history/${contract}`,
    ]) {
      const query = path.endsWith("/quote") ? `&owner=${contract}&side=up&action=buy&amountWei=1` : "";
      assert.equal((await app.inject(`/v1/binary-predictions/${path}?chainId=10143${query}`)).statusCode, NOT_FOUND);
    }
    for (const suffix of [
      "&development=true",
      "&devWorkspace=true",
      "&environmentId=fixture:x",
      "&rpc=http://127.0.0.1",
      "&consumer=local-test",
    ]) {
      assert.equal(
        (await app.inject(`/v1/binary-predictions?chainId=10143&asset=BTC&duration=900${suffix}`)).statusCode,
        BAD_REQUEST,
      );
    }
    for (const chainId of ["143", "10143.0", "1"]) {
      assert.equal(
        (await app.inject(`/v1/binary-predictions?chainId=${chainId}&asset=BTC&duration=900`)).statusCode,
        BAD_REQUEST,
      );
    }
    assert.equal(rpcCalls, 0);
  } finally {
    await app.close();
  }
});

test("typed binary HTTP reads real rounds/quotes/positions/credits, freshness and canonical history seam", {
  timeout: TIMEOUT_MS,
}, async () => {
  const f = await binaryFixture();
  let now = (await f.read.getBlock()).timestamp;
  let historyValue: Awaited<ReturnType<BinaryHistoryReader["read"]>> = null;
  const history: BinaryHistoryReader = { read: async () => historyValue };
  const source = { read: f.read, manifest: f.manifest, environment: f.environment };
  const service = new BinaryPredictions([source], history, () => now);
  const app = appFor(service);
  const noHistory = appFor(new BinaryPredictions([source], undefined, () => now));
  const refresh = async () => {
    now = (await f.read.getBlock()).timestamp;
  };
  const client = createApiClient({
    origin: "http://binary.test",
    fetch: (async (input: string | URL | Request) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input : input.url);
      const reply = await app.inject({ method: "GET", url: `${url.pathname}${url.search}` });
      return new Response(reply.body, { status: reply.statusCode, headers: { "content-type": "application/json" } });
    }) as typeof fetch,
  });
  const params = { contract: f.manifest.contract, roundId: f.roundId };
  const query = { chainId: "10143" as const };
  const historyUrl = `/v1/binary-predictions/${params.contract}/history/${f.owner}?chainId=10143`;
  try {
    assert.throws(
      () =>
        new BinaryPredictions(
          [{ ...source, environment: { ...f.environment, consumer: "public-api" } }],
          undefined,
          () => now,
        ),
    );
    assert.throws(
      () =>
        new BinaryPredictions(
          [{ ...source, environment: { ...f.environment, development: false } }],
          undefined,
          () => now,
        ),
    );
    assert.throws(
      () =>
        new BinaryPredictions(
          [{ ...source, environment: { ...f.environment, devWorkspace: false } }],
          undefined,
          () => now,
        ),
    );
    assert.throws(
      () =>
        new BinaryPredictions(
          [{ ...source, manifest: { ...f.manifest, environment: "public-testnet" } }],
          undefined,
          () => now,
        ),
    );
    const rounds = await client.call(binaryRoundsRoute, { query: { ...query, asset: "BTC", duration: "300" } });
    assert.equal(rounds.status, "available");
    assert.equal(rounds.rounds.length, 1);
    assert.equal(rounds.rounds[0]?.roundId, f.roundId);
    assert.equal(rounds.rounds[0]?.round.start, f.start);
    for (const [asset, duration] of [
      ["ETH", "300"],
      ["BTC", "900"],
    ] as const) {
      const empty = await client.call(binaryRoundsRoute, { query: { ...query, asset, duration } });
      const head = await f.read.getBlock();
      assert.equal(empty.status, "available");
      assert.equal(empty.rounds.length, 0);
      assert.deepEqual(empty.sources, [
        {
          chainId: BINARY_POLICY.chainId,
          environmentId: f.manifest.environmentId,
          contract: f.manifest.contract,
          configHash: f.manifest.configHash,
          blockNumber: head.number,
          blockHash: head.hash,
          timestamp: head.timestamp,
        },
      ]);
    }
    const nextLong = (f.start / FIFTEEN_MINUTES + 1n) * FIFTEEN_MINUTES;
    await f.call(
      "createRound",
      [BINARY_POLICY.ethFeed, Number(FIFTEEN_MINUTES), nextLong, f.owner],
      BINARY_POLICY.seedMinWei,
    );
    await refresh();
    const longRounds = await client.call(binaryRoundsRoute, { query: { ...query, asset: "ETH", duration: "900" } });
    assert.equal(longRounds.rounds.length, 1);
    assert.equal(longRounds.rounds[0]?.round.duration, Number(FIFTEEN_MINUTES));
    assert.equal(longRounds.rounds[0]?.round.start, nextLong);
    assert.equal(
      (await app.inject("/v1/binary-predictions?chainId=10143&asset=ETH")).json().rounds[0].round.duration,
      Number(FIFTEEN_MINUTES),
    );
    assert.equal((await app.inject(`${historyUrl}&cursor=bad%20cursor`)).statusCode, BAD_REQUEST);
    const scheduled = await client.call(binaryRoundRoute, { params, query });
    assert.equal(scheduled.round.state, 1);
    assert.equal(scheduled.source.environmentId, f.manifest.environmentId);
    assert.equal(scheduled.source.configHash, f.manifest.configHash);
    assert.equal(scheduled.round.escrow, BINARY_POLICY.seedMaxWei);
    assert.equal(typeof scheduled.source.blockNumber, "bigint");
    assert.equal(
      (await app.inject(`/v1/binary-predictions/${params.contract}/${operation("unknown")}?chainId=10143`)).statusCode,
      NOT_FOUND,
    );
    const absent = await noHistory.inject(historyUrl);
    assert.equal(absent.statusCode, OK);
    assert.equal(absent.json().history.reason, "not-configured");
    assert.equal(absent.json().history.events, null);
    assert.equal(
      (await client.call(binaryHistoryRoute, { params: { contract: params.contract, owner: f.owner }, query })).history
        .status,
      "unavailable",
    );

    const scheduledQuoteUrl = `/v1/binary-predictions/${params.contract}/${params.roundId}/quote?chainId=10143&owner=${f.owner}&side=up&action=buy&amountWei=${MON}`;
    assert.equal((await app.inject(scheduledQuoteUrl)).statusCode, CLOSED);
    await f.warp(f.start);
    await f.call("recordOpening", [f.roundId, f.proof(f.start)], FIXTURE_FEE);
    await refresh();
    const buy = await client.call(binaryQuoteRoute, {
      params,
      query: { ...query, owner: f.owner, side: "up", action: "buy", amountWei: MON },
    });
    assert.equal(buy.quote.input, MON);
    assert.ok(buy.quote.output > MON);
    assert.equal(buy.quote.blockNumber, buy.snapshot.source.blockNumber);
    assert.equal(buy.quote.timestamp, buy.snapshot.source.timestamp);
    await f.call("buy", [f.roundId, true, buy.quote.output, now + DEADLINE_SECONDS, operation("api-buy")], MON);
    await refresh();
    const position = await client.call(binaryPositionRoute, { params: { ...params, owner: f.owner }, query });
    assert.equal(position.position.up, buy.quote.output);
    assert.equal(position.creditWei, 0n);
    const soldShares = position.position.up / 2n;
    const sell = await client.call(binaryQuoteRoute, {
      params,
      query: { ...query, owner: f.owner, side: "up", action: "sell", amountWei: soldShares },
    });
    await f.call("sell", [
      f.roundId,
      true,
      soldShares,
      sell.quote.output,
      now + DEADLINE_SECONDS,
      operation("api-sell"),
    ]);
    await refresh();
    const sold = await client.call(binaryPositionRoute, { params: { ...params, owner: f.owner }, query });
    assert.equal(sold.position.up, buy.quote.output - soldShares);
    assert.equal(sold.creditWei, sell.quote.output);
    assert.ok(sold.walletMonWei < position.walletMonWei); // Sale credits did not transfer MON; gas reduced wallet.
    const other = await client.call(binaryPositionRoute, { params: { ...params, owner: f.other }, query });
    assert.equal(other.position.up, 0n);
    assert.equal(other.creditWei, 0n);
    const quoteUrl = `/v1/binary-predictions/${params.contract}/${params.roundId}/quote?chainId=10143&owner=${f.other}&side=up&action=sell&amountWei=1`;
    assert.equal((await app.inject(quoteUrl)).statusCode, BAD_REQUEST);
    const ownedDustUrl = quoteUrl.replace(f.other, f.owner);
    const dust = await app.inject(ownedDustUrl);
    assert.equal(dust.statusCode, BAD_REQUEST);
    assert.deepEqual(dust.json(), {
      error: { code: "BAD_REQUEST", message: "Input cannot produce a valid binary quote" },
    });
    // Neither a transport failure nor an undecoded error whose message resembles a revert is an input rejection.
    for (const message of ["transport unavailable at private RPC", "Invalid() unknown failure"]) {
      const failedRead = new Proxy(f.read, {
        get(target, key) {
          if (key !== "readContract") return Reflect.get(target, key);
          return (args: Parameters<typeof target.readContract>[0]) => {
            if (args.functionName === "quoteSell") throw new Error(message);
            return target.readContract(args);
          };
        },
      });
      const failed = appFor(new BinaryPredictions([{ ...source, read: failedRead }], undefined, () => now));
      try {
        const result = await failed.inject(ownedDustUrl);
        assert.equal(result.statusCode, UNAVAILABLE);
        assert.deepEqual(result.json(), {
          error: { code: "UPSTREAM_UNAVAILABLE", message: "Binary source is unavailable" },
        });
      } finally {
        await failed.close();
      }
    }
    for (const amount of ["0", "-1", "1.5", (2n ** UINT256_BITS).toString()]) {
      assert.equal((await app.inject(quoteUrl.replace("amountWei=1", `amountWei=${amount}`))).statusCode, BAD_REQUEST);
    }
    for (const bad of ["0x123", `0x${"0".repeat(HASH_HEX_LENGTH)}`]) {
      assert.equal(
        (await app.inject(`/v1/binary-predictions/${params.contract}/${bad}?chainId=10143`)).statusCode,
        BAD_REQUEST,
      );
    }
    // The seam cannot turn unknown into empty, accept an incomplete basis or trust a stale/noncanonical watermark.
    const head = await f.read.getBlock();
    historyValue = {
      owner: f.owner,
      environmentId: f.manifest.environmentId,
      chainId: BINARY_POLICY.chainId,
      contract: params.contract,
      configHash: f.manifest.configHash,
      fromBlock: f.manifest.anchorBlock,
      page: {
        status: "fresh",
        indexedBlock: head.number,
        indexedBlockHash: operation("orphaned"),
        blockLag: 0n,
        events: [],
        accounting: { positions: {}, creditWei: 0n, transferredWei: 0n, claimRealizedWei: 0n },
        nextCursor: null,
      },
    };
    assert.equal((await app.inject(historyUrl)).json().history.reason, "noncanonical");
    historyValue = { ...historyValue, fromBlock: f.manifest.anchorBlock + 1n };
    assert.equal((await app.inject(historyUrl)).json().history.reason, "incomplete");
    // A known empty test account with full fixture coverage can be fresh; scope and watermark remain checked.
    historyValue = {
      ...historyValue,
      fromBlock: f.manifest.anchorBlock,
      owner: f.other,
      page: { ...historyValue.page, indexedBlockHash: head.hash },
    };
    const otherHistoryUrl = historyUrl.replace(f.owner, f.other);
    assert.equal((await app.inject(otherHistoryUrl)).json().history.status, "fresh");
    assert.equal((await app.inject(historyUrl)).json().history.reason, "noncanonical");
    historyValue = {
      ...historyValue,
      page: { ...historyValue.page, indexedBlock: f.manifest.anchorBlock, indexedBlockHash: f.manifest.anchorHash },
    };
    assert.equal((await app.inject(otherHistoryUrl)).json().history.status, "lagging");
    historyValue = null;
    now += STALE_SECONDS;
    assert.equal((await app.inject(historyUrl)).statusCode, UNAVAILABLE);
    assert.equal(
      (await app.inject(`/v1/binary-predictions/${params.contract}/${params.roundId}?chainId=10143`)).statusCode,
      UNAVAILABLE,
    );
    assert.equal(
      (await app.inject("/v1/binary-predictions?chainId=10143&asset=BTC&duration=300")).statusCode,
      UNAVAILABLE,
    );
    await refresh();
    // Replace an actual block on the owned node between verified source read and final canonical check.
    const checkpoint = await f.read.request({ method: "evm_snapshot" as never });
    await f.read.request({ method: "evm_mine" as never });
    await refresh();
    let replaced = false;
    const racedRead = new Proxy(f.read, {
      get(target, key) {
        if (key !== "getBlock") return Reflect.get(target, key);
        return async (args?: { blockNumber?: bigint }) => {
          if (!replaced && args?.blockNumber !== undefined && args.blockNumber !== f.manifest.anchorBlock) {
            replaced = true;
            await f.read.request({ method: "evm_revert" as never, params: [checkpoint] as never });
            await f.warp(now + 1n);
          }
          return target.getBlock(args);
        };
      },
    });
    const raced = appFor(new BinaryPredictions([{ ...source, read: racedRead }], undefined, () => now));
    try {
      assert.equal(
        (await raced.inject(`/v1/binary-predictions/${params.contract}/${params.roundId}?chainId=10143`)).statusCode,
        UNAVAILABLE,
      );
      assert.equal(replaced, true);
    } finally {
      await raced.close();
    }
    await refresh();
    const mismatched = appFor(
      new BinaryPredictions(
        [{ ...source, manifest: { ...f.manifest, anchorHash: operation("wrong-anchor") } }],
        undefined,
        () => now,
      ),
    );
    try {
      assert.equal((await mismatched.inject(historyUrl)).statusCode, UNAVAILABLE);
    } finally {
      await mismatched.close();
    }
    // Verify actual receiver bytecode drift disables direct reads, even while the market still has balances.
    await f.read.request({ method: "anvil_setCode" as never, params: [BINARY_POLICY.receiver, "0x00"] as never });
    assert.equal((await app.inject(historyUrl)).statusCode, UNAVAILABLE);
  } finally {
    await app.close();
    await noHistory.close();
    await f.stop();
  }
});
