/**
 * services/api smoke on the anvil fork (local): every route family through `@senryo/api-client` exactly as the apps
 * call it — config/geo/status/markets, SIWE session, prefs, vault, starter claim relay to `finalized`, account,
 * alerts/events/push, WS `prices:XAU` + `account:{addr}`. Sponsor gets RELAYER_ROLE and StarterDrip a MON float via
 * anvil cheats. Run services/api against the fork first (see the S3 handoff).
 */
import {
  ApiError,
  accountRoute,
  alertsCreateRoute,
  alertsListRoute,
  authNonceRoute,
  authVerifyRoute,
  configRoute,
  createApiClient,
  eventsRoute,
  geoRoute,
  marketsRoute,
  prefsGetRoute,
  prefsPutRoute,
  pushTokenRoute,
  starterClaimRoute,
  starterRelayRoute,
  starterStatusRoute,
  statusRoute,
  vaultGetRoute,
  vaultPutRoute,
  WS_PATH,
} from "@senryo/api-client";
import { addressOf, signerFromPrivateKey, starterDripDomain } from "@senryo/chain";
import { CLAIM_TYPES, isTerminalStage } from "@senryo/core";
import { requireSecret } from "@senryo/service-common";
import { MS_PER_SECOND, WAIT, XAU_ALERT_PRICE18 } from "./constants.ts";
import { anvil, freshUser, prepareFork, ROLES } from "./fork.ts";
import { CHAIN, waitUntil } from "./lib.ts";

const FORK = process.env.FORK_RPC ?? "http://127.0.0.1:18645";
const API = process.env.API_URL ?? "http://127.0.0.1:3100";
const DRIP_FLOAT = "0x56bc75e2d63100000";
const DEADLINE_TTL = 300n;
const sponsor = signerFromPrivateKey(requireSecret("SPONSOR_PK"), "sponsor").address;
const user = freshUser();
const checks: Record<string, boolean> = {};
const record = (name: string, ok: boolean) => {
  checks[name] = ok;
  console.log(`${ok ? "✓" : "✗"} ${name}`);
};

await prepareFork(FORK, [], [sponsor], [[ROLES.relayer, sponsor]]);
await anvil(FORK, "anvil_setBalance", [addressOf(CHAIN, "StarterDrip"), DRIP_FLOAT]);

let token: string | null = null;
const api = createApiClient({ origin: API, deviceHash: `smoke-${Date.now()}`, getToken: () => token });

const config = await api.call(configRoute, {});
record(
  "config lists practice network",
  config.networks.some((n) => n.chainId === CHAIN && n.deployed),
);
record("geo answers", (await api.call(geoRoute, {})).mainnetTradingAllowed !== undefined);
const status = await api.call(statusRoute, {});
record(
  "status reads the chain",
  status.chains.some((c) => c.chainId === CHAIN && c.rpc.state === "ok"),
);
const markets = await api.call(marketsRoute, { query: { chainId: CHAIN } });
record(
  "markets has XAU with 10x max",
  markets.engine.some((m) => m.symbol === "XAU" && m.maxLeverageX === 10),
);

const nonce = await api.call(authNonceRoute, { body: { address: user.address, chainId: CHAIN } });
const signature = await user.signMessage({ message: nonce.message });
const session = await api.call(authVerifyRoute, { body: { message: nonce.message, signature } });
token = session.token;
record("SIWE session issued", session.address === user.address);
const replay = await api.call(authVerifyRoute, { body: { message: nonce.message, signature } }).catch((e) => e);
record("SIWE nonce is single-use", replay instanceof ApiError && replay.code === "SIGNATURE_EXPIRED");

const empty = await api.call(prefsGetRoute, {});
const put = await api.call(prefsPutRoute, { body: { blob: "c2VucnlvLXByZWZz", ifVersion: empty.version } });
const stale = await api.call(prefsPutRoute, { body: { blob: "b3RoZXI", ifVersion: 0 } }).catch((e) => e);
record(
  "prefs write + optimistic concurrency",
  put.version === 1 && stale instanceof ApiError && stale.code === "CONFLICT",
);

const vault = {
  version: 1 as const,
  credential: { credentialId: `cred${Date.now()}` },
  prfSalt: "c2FsdA",
  nonce: "bm9uY2U",
  ciphertext: "Y2lwaGVy",
};
await api.call(vaultPutRoute, { body: { vault, label: "smoke" } });
const fetched = await api.call(vaultGetRoute, { params: { credentialId: vault.credential.credentialId } });
record(
  "vault stored + public fetch by credential",
  fetched.address === user.address && fetched.vault.ciphertext === vault.ciphertext,
);

const deadline = BigInt(Math.floor(Date.now() / MS_PER_SECOND)) + DEADLINE_TTL;
const claimSig = await user.signTypedData({
  domain: starterDripDomain(CHAIN),
  types: CLAIM_TYPES,
  primaryType: "Claim",
  message: { user: user.address, deadline },
});
const relay = await api.call(starterClaimRoute, {
  body: { chainId: CHAIN, user: user.address, deadline, signature: claimSig },
});
record("claim relayed (proposed)", relay.stage === "proposed" && relay.creditUsd6 > 0n);
const settled = await waitUntil(
  async () => {
    const r = await api.call(starterRelayRoute, { params: { relayId: relay.relayId } });
    return isTerminalStage(r.stage) ? r : undefined;
  },
  WAIT.observeMs,
  WAIT.pollMs,
);
record("claim reached finalized", settled?.stage === "finalized");
const starter = await api.call(starterStatusRoute, { query: { chainId: CHAIN, user: user.address } });
record("status shows claimed", starter.claimed && starter.lastRelay?.relayId === relay.relayId);
const again = await api
  .call(starterClaimRoute, { body: { chainId: CHAIN, user: user.address, deadline, signature: claimSig } })
  .catch((e) => e);
record("second claim refused", again instanceof ApiError && ["RATE_LIMITED", "ALREADY_CLAIMED"].includes(again.code));

const account = await api.call(accountRoute, { params: { address: user.address }, query: { chainId: CHAIN } });
record("account shows practice credit", account.finalized.ausd === relay.creditUsd6);

const alert = await api.call(alertsCreateRoute, {
  body: { chainId: CHAIN, marketId: 0, direction: "above", price18: XAU_ALERT_PRICE18 },
});
record(
  "alert created + listed",
  (await api.call(alertsListRoute, {})).alerts.some((a) => a.id === alert.id),
);
const events = await api.call(eventsRoute, {
  body: { platform: "web", appVersion: "0.1.0", events: [{ name: "smoke", at: new Date().toISOString() }] },
});
record("events accepted", events.accepted === 1);
const push = await api.call(pushTokenRoute, {
  body: { token: `ExponentPushToken[smoke${Date.now()}]`, platform: "ios", kind: "expo", channels: { card: false } },
});
record("push token registered", push.channels.card === false && push.channels.fills === true);

const wsMessages: Array<{ type: string; channel?: string }> = [];
const ws = new WebSocket(`${API.replace(/^http/, "ws")}${WS_PATH}`);
ws.onmessage = (event) => wsMessages.push(JSON.parse(String(event.data)));
await new Promise((resolve) => ws.addEventListener("open", resolve, { once: true }));
ws.send(JSON.stringify({ op: "subscribe", channel: "prices:XAU", chainId: CHAIN }));
ws.send(JSON.stringify({ op: "subscribe", channel: `account:${user.address}`, chainId: CHAIN, token }));
const gotBoth = await waitUntil(
  async () =>
    wsMessages.some((m) => m.type === "price") && wsMessages.some((m) => m.type === "account") ? true : undefined,
  WAIT.observeMs,
  WAIT.pollMs,
);
record("ws price + account pushes", gotBoth === true);
ws.close();

const pass = Object.values(checks).every(Boolean);
console.log(JSON.stringify({ pass, user: user.address, relayTx: relay.txHash, checks }, null, 2));
process.exit(pass ? 0 : 1);
