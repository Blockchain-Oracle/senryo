/**
 * Targeted check (security): session-policy scope — allowlist, selectors, caps decoded from real calldata (SenryoCore /
 * LpVault / token ABIs from `@senryo/contracts`), reduce-only uncapped, withdraw-to-self in scope, every other
 * destination needs a step-up. Pure policy; the signer wiring is in session.check.ts.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { TESTNET_CHAIN_ID } from "@senryo/config";
import { lpVaultAbi, mockAUSDAbi, senryoCoreAbi } from "@senryo/contracts";

import { type Address, encodeFunctionData, type Hex, maxUint256 } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { SESSION_RATE_PER_MINUTE, SESSION_TOTAL_CAP_USD6 } from "../src/constants.ts";
import { evaluateTransaction } from "../src/policy/evaluate.ts";
import { scopeTargets } from "../src/policy/targets.ts";
import { emptyUsage, type FaceIdMode, type PolicyContext, type PolicyUsage } from "../src/policy/types.ts";
import { DEADLINE_S, MARKET_XAU, NOW_MS, PRICE_E18, TRIGGER_SALT, USD } from "./constants.ts";

const ONE_WEI = 1n;
/** Any chain other than the session network. */
const ETHEREUM_CHAIN_ID = 1;

const chainId = TESTNET_CHAIN_ID;
const T = scopeTargets(chainId);
const self = privateKeyToAccount(generatePrivateKey()).address;
const other = privateKeyToAccount(generatePrivateKey()).address;
const NOW = NOW_MS;

const DEADLINE = DEADLINE_S;
const PRICE = PRICE_E18;
const MARKET = MARKET_XAU;

function need(a: Address | undefined, name: string): Address {
  assert.ok(a, `${name} missing from the 10143 address book`);
  return a;
}
const core = need(T.core, "SenryoCore");
const vault = need(T.lpVault, "LpVault");
const ausd = need(T.stables[0], "MockAUSD");

function ctx(
  over: Partial<PolicyContext> & { equity?: bigint; room?: bigint; faceId?: FaceIdMode } = {},
): PolicyContext {
  return {
    chainId,
    self,
    faceId: over.faceId ?? "off",
    marketRoomUsd6: () => over.room ?? USD.tenThousand,
    equityUsd6: () => over.equity ?? USD.thousand,
    marketLabel: () => "Gold",
  };
}

const coreCall = (functionName: string, args: readonly unknown[]): Hex =>
  encodeFunctionData({ abi: senryoCoreAbi, functionName, args } as never);
const tokenCall = (functionName: string, args: readonly unknown[]): Hex =>
  encodeFunctionData({ abi: mockAUSDAbi, functionName, args } as never);

function judge(to: Address, data: Hex, c = ctx(), usage: PolicyUsage = emptyUsage(), extra = {}) {
  return evaluateTransaction({ chainId, to, data, value: 0n, authorizationList: undefined, ...extra }, c, usage, NOW);
}
const open = (notional: bigint) => coreCall("increase", [MARKET, true, notional, PRICE, DEADLINE]);

test("open within caps signs; notional and leverage come from calldata", () => {
  const v = judge(core, open(USD.hundred));
  assert.equal(v.kind, "sign");
  assert.deepEqual((v as { action?: unknown }).action, {
    kind: "open",
    marketId: 0,
    isLong: true,
    notionalUsd6: USD.hundred,
  });
});

test("open above the per-trade / OI-room / leverage caps needs step-up", () => {
  assert.equal((judge(core, open(USD.overTradeCap)) as { reason?: string }).reason, "over-trade-cap");
  assert.equal(
    (judge(core, open(USD.sixty), ctx({ room: USD.fifty })) as { reason?: string }).reason,
    "over-trade-cap",
  );
  const lev = judge(core, open(USD.twoHundred), ctx({ equity: USD.ten }));
  assert.deepEqual([lev.kind, (lev as { reason?: string }).reason], ["reject", "over-leverage"]);
  assert.equal((judge(core, open(USD.ten), ctx({ equity: 0n })) as { reason?: string }).reason, "over-leverage");
});

test("missing balance/market reads never widen scope", () => {
  const c = { ...ctx(), equityUsd6: () => undefined };
  assert.equal((judge(core, open(USD.one), c) as { reason?: string }).reason, "context-unavailable");
});

test("session total cap", () => {
  const usage = { spentUsd6: SESSION_TOTAL_CAP_USD6 - USD.fifty, signedAt: [] };
  assert.equal((judge(core, open(USD.sixty), ctx(), usage) as { reason?: string }).reason, "over-session-total");
  assert.equal(judge(core, open(USD.forty), ctx(), usage).kind, "sign");
});

test("reduce-only is uncapped and exempt from the rate cap", () => {
  const busy = { spentUsd6: SESSION_TOTAL_CAP_USD6, signedAt: Array(SESSION_RATE_PER_MINUTE).fill(NOW) };
  assert.equal(judge(core, coreCall("close", [MARKET, PRICE, DEADLINE]), ctx(), busy).kind, "sign");
  assert.equal(judge(core, coreCall("decrease", [MARKET, maxUint256, PRICE, DEADLINE]), ctx(), busy).kind, "sign");
  assert.equal((judge(core, open(USD.one), ctx(), busy) as { reason?: string }).reason, "over-session-total");
  const rate = { spentUsd6: 0n, signedAt: Array(SESSION_RATE_PER_MINUTE).fill(NOW) };
  assert.equal((judge(core, open(USD.one), ctx(), rate) as { reason?: string }).reason, "rate");
});

test("withdraw to self is in scope; any other destination needs step-up", () => {
  assert.equal(judge(core, coreCall("withdraw", [ausd, USD.fiveThousand, self])).kind, "sign");
  const out = judge(core, coreCall("withdraw", [ausd, USD.one, other]));
  assert.deepEqual(
    [out.kind, (out as { reason?: string }).reason, (out as { stepUp?: boolean }).stepUp],
    ["reject", "destination", true],
  );
  assert.equal((judge(core, coreCall("depositFor", [ausd, USD.one, other])) as { reason?: string }).reason, "send");
  assert.equal(judge(core, coreCall("depositFor", [ausd, USD.one, self])).kind, "sign");
});

test("token approvals: known spender under the move cap only; transfers are sends", () => {
  assert.equal(judge(ausd, tokenCall("approve", [core, USD.hundred])).kind, "sign");
  assert.equal(judge(ausd, tokenCall("approve", [vault, USD.hundred])).kind, "sign");
  assert.equal((judge(ausd, tokenCall("approve", [other, USD.one])) as { reason?: string }).reason, "unknown-spender");
  assert.equal((judge(ausd, tokenCall("approve", [core, maxUint256])) as { reason?: string }).reason, "over-move-cap");
  assert.equal((judge(ausd, tokenCall("transfer", [other, USD.one])) as { reason?: string }).reason, "send");
  assert.equal(judge(ausd, tokenCall("faucet", [])).kind, "sign");
});

test("LP deposit capped and to self; redeem to self", () => {
  const lp = (fn: string, args: readonly unknown[]) =>
    encodeFunctionData({ abi: lpVaultAbi, functionName: fn, args } as never);
  assert.equal(judge(vault, lp("deposit", [USD.hundred, self])).kind, "sign");
  assert.equal((judge(vault, lp("deposit", [USD.hundred, other])) as { reason?: string }).reason, "destination");
  assert.equal((judge(vault, lp("deposit", [USD.threeHundred, self])) as { reason?: string }).reason, "over-move-cap");
  assert.equal(judge(vault, lp("requestRedeem", [USD.one, self])).kind, "sign");
});

test("card limits, admin selectors, unknown contracts, value, delegation, wrong chain", () => {
  const card = judge(core, coreCall("setCardEnvelope", [USD.ten]));
  assert.deepEqual(
    [(card as { reason?: string }).reason, (card as { stepUp?: boolean }).stepUp],
    ["card-setting", true],
  );
  const admin = judge(core, coreCall("pause", []));
  assert.deepEqual(
    [(admin as { reason?: string }).reason, (admin as { stepUp?: boolean }).stepUp],
    ["out-of-scope", false],
  );
  const stranger = judge(other, open(USD.one));
  assert.deepEqual(
    [(stranger as { reason?: string }).reason, (stranger as { stepUp?: boolean }).stepUp],
    ["out-of-scope", false],
  );
  assert.equal(
    (judge(core, open(USD.one), ctx(), emptyUsage(), { value: ONE_WEI }) as { reason?: string }).reason,
    "value",
  );
  const auth = judge(core, open(USD.one), ctx(), emptyUsage(), { authorizationList: [{}] });
  assert.equal((auth as { reason?: string }).reason, "delegation");
  const wrong = evaluateTransaction(
    { chainId: ETHEREUM_CHAIN_ID, to: core, data: open(USD.one), value: 0n, authorizationList: undefined },
    ctx(),
    emptyUsage(),
    NOW,
  );
  assert.deepEqual(
    [(wrong as { reason?: string }).reason, (wrong as { stepUp?: boolean }).stepUp],
    ["wrong-chain", false],
  );
});

test("TP/SL triggers only for the signer's own position", () => {
  const order = (user: Address) => ({
    user,
    marketId: MARKET,
    isLong: true,
    takeProfit: true,
    triggerPrice18: PRICE,
    sizeDelta: PRICE,
    acceptablePrice18: PRICE,
    expiry: DEADLINE,
    salt: TRIGGER_SALT,
  });
  assert.equal(judge(core, coreCall("placeTrigger", [order(self), "0x"])).kind, "sign");
  assert.equal(judge(core, coreCall("placeTrigger", [order(other), "0x"])).kind, "reject");
});

test("D-037 Face ID gate: off in practice, above threshold on mainnet, every trade when chosen", () => {
  assert.equal(judge(core, open(USD.twoHundred), ctx({ faceId: "off" })).kind, "sign");
  assert.equal(judge(core, open(USD.fortyNine), ctx({ faceId: "above-threshold" })).kind, "sign");
  const big = judge(core, open(USD.fifty), ctx({ faceId: "above-threshold" }));
  assert.deepEqual([big.kind, big.kind === "confirm" && big.prompt], ["confirm", "Confirm long $50.00 Gold"]);
  assert.equal(judge(core, open(USD.one), ctx({ faceId: "every-trade" })).kind, "confirm");
  assert.equal(
    judge(core, coreCall("close", [MARKET, PRICE, DEADLINE]), ctx({ faceId: "every-trade" })).kind,
    "confirm",
  );
});
