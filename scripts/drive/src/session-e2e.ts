/**
 * S6.12 client-seam e2e on the anvil fork (local only): the real `AccountClient` (Mera derivation, policy, scoped
 * signer) on a virtual PRF authenticator, against a local services/api, exactly as the apps compose it —
 *   SIWE session signed in-session → starter claim relayed to `finalized` → encrypted prefs (seal/open, 409 on stale)
 *   → user sends through `@senryo/chain` with the scoped signer as `account` and `queuedNonces(LocalNonceSource)`
 *   (out-of-scope refused without burning a nonce; two concurrent sends get consecutive nonces; deposit at finalized)
 *   → backup passkey vault → `/v1/vault` → fresh device recovers with `recoverWithServerVault` → same address, same
 *   prefs key.
 * Run: anvil --fork-url <testnet rpc> --network monad --port 18765 --block-time 0.5 --mixed-mining
 *        --slots-in-an-epoch 1; services/api on it (S3 handoff); then
 *      FORK_RPC=http://127.0.0.1:18765 API_URL=http://127.0.0.1:3190 SPONSOR_PK_FILE=… pnpm session-e2e
 */
import {
  AccountClient,
  addRecoveryPasskey,
  clearDelegation,
  DELEGATES,
  OutOfScopeError,
  type PolicyContext,
  PREFS_VERSION,
  type Prefs,
  queuedNonces,
  recoverWithServerVault,
  signDelegation,
  signStarterClaim,
  VaultNotFoundError,
} from "@senryo/account";
import {
  ApiError,
  authNonceRoute,
  authVerifyRoute,
  createApiClient,
  prefsGetRoute,
  prefsPutRoute,
  starterClaimRoute,
  starterRelayRoute,
  vaultGetRoute,
  vaultPutRoute,
} from "@senryo/api-client";
import {
  addressOf,
  contractCall,
  createReadClient,
  createSender,
  LocalNonceSource,
  MemoryJournal,
  sendAndFinalize,
  sendTx,
  signerFromPrivateKey,
} from "@senryo/chain";
import { RP_ID } from "@senryo/config";
import { isTerminalStage } from "@senryo/core";
import { requireSecret } from "@senryo/service-common";
import { WAIT } from "./constants.ts";
import { memoryStore, VirtualAuthenticator } from "./fake-passkey.ts";
import { anvil, freshUser, prepareFork, ROLES } from "./fork.ts";
import { CHAIN, waitUntil } from "./lib.ts";

const FORK = process.env.FORK_RPC ?? "http://127.0.0.1:18765";
const API = process.env.API_URL ?? "http://127.0.0.1:3190";
const DRIP_FLOAT = "0x56bc75e2d63100000";
const DEPOSIT_USD6 = 25_000_000n;
const HTTP_NOT_FOUND = 404;
const TTL_MS = 300_000;
const IDLE_MS = 60_000;
const checks: Record<string, boolean> = {};
const record = (name: string, ok: boolean, detail = "") => {
  checks[name] = ok;
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const sponsor = signerFromPrivateKey(requireSecret("SPONSOR_PK"), "sponsor").address;
await prepareFork(FORK, [], [sponsor], [[ROLES.relayer, sponsor]]);
await anvil(FORK, "anvil_setBalance", [addressOf(CHAIN, "StarterDrip"), DRIP_FLOAT]);

const auth = new VirtualAuthenticator();
/** A device: its own hint store and session, the same (synced) authenticator. */
const device = () =>
  new AccountClient({ rpId: RP_ID, passkey: { kind: "web", webAuthnClient: auth }, store: memoryStore() });
const context = (self: `0x${string}`) => (): PolicyContext => ({
  chainId: CHAIN,
  self,
  faceId: "off",
  marketRoomUsd6: () => undefined,
  equityUsd6: () => undefined,
});

/** The apps' `ensureApiSession`: nonce → in-session SIWE signMessage (policy-checked) → bearer token. */
async function apiFor(client: AccountClient) {
  let token: string | undefined;
  const api = createApiClient({ origin: API, deviceHash: `s6e2e-${Date.now()}`, getToken: () => token });
  const address = client.hint?.address as `0x${string}`;
  const challenge = await api.call(authNonceRoute, { body: { address, chainId: CHAIN } });
  const signature = await client.signer(context(address)).signMessage({ message: challenge.message });
  token = (await api.call(authVerifyRoute, { body: { message: challenge.message, signature } })).token;
  return api;
}

// 1 · Create (one ceremony) and an API session with no further prompt.
const a = device();
const address = await a.create();
const api = await apiFor(a);
record("create = 1 prompt; SIWE signed in session (no prompt)", auth.ceremonies === 1, address);

// 2 · Starter claim: typed data signed in scope, relayed by the sponsor, followed to finalized.
const signed = await signStarterClaim(a.signer(context(address)), CHAIN, Date.now());
const relay = await api.call(starterClaimRoute, {
  body: { chainId: CHAIN, user: address, deadline: signed.deadline, signature: signed.signature },
});
const settled = await waitUntil(
  async () => {
    const r = await api.call(starterRelayRoute, { params: { relayId: relay.relayId } });
    return isTerminalStage(r.stage) ? r : undefined;
  },
  WAIT.observeMs,
  WAIT.pollMs,
);
record(
  "starter claim → finalized, still 1 prompt",
  settled?.stage === "finalized" && settled.creditUsd6 > 0n && auth.ceremonies === 1,
  `relay ${relay.relayId} · tx ${relay.txHash} · credit ${settled?.creditUsd6} usd6`,
);

// 3 · Encrypted prefs: sealed with the account's prefs key; the server only ever sees ciphertext.
const prefs: Prefs = { v: PREFS_VERSION, session: { ttlMs: TTL_MS, idleMs: IDLE_MS, faceId: "every-trade" } };
const first = await api.call(prefsGetRoute, {});
const put = await api.call(prefsPutRoute, { body: { blob: a.sealPrefs(prefs), ifVersion: first.version } });
const back = await api.call(prefsGetRoute, {});
const stale = await api
  .call(prefsPutRoute, { body: { blob: a.sealPrefs(prefs), ifVersion: first.version } })
  .catch((e: unknown) => e);
record(
  "prefs sealed → stored → opened; stale ifVersion → 409",
  JSON.stringify(a.openPrefs(back.blob ?? "")) === JSON.stringify(prefs) &&
    put.version === back.version &&
    stale instanceof ApiError &&
    stale.code === "CONFLICT",
);

// 4 · User sends through @senryo/chain: scoped signer as `account`, account's queue around LocalNonceSource.
const read = createReadClient(CHAIN, { http: [FORK] });
const sender = createSender({
  chainId: CHAIN,
  account: a.signer(context(address)),
  read,
  rpc: { http: [FORK] },
  nonces: queuedNonces(new LocalNonceSource(read)),
  journal: new MemoryJournal(),
});
const startNonce = await read.getTransactionCount({ address, blockTag: "latest" });
const stranger = freshUser().address;
const refused = await sendTx(
  sender,
  contractCall(CHAIN, "MockAUSD", "approve", [stranger, DEPOSIT_USD6], "approve"),
).catch((e: unknown) => e);
const core = addressOf(CHAIN, "SenryoCore");
const [faucet, approve] = await Promise.all([
  sendAndFinalize(sender, contractCall(CHAIN, "MockAUSD", "faucet", [], "faucet")),
  sendAndFinalize(sender, contractCall(CHAIN, "MockAUSD", "approve", [core, DEPOSIT_USD6], "approve")),
]);
const deposit = await sendAndFinalize(
  sender,
  contractCall(CHAIN, "SenryoCore", "deposit", [addressOf(CHAIN, "MockAUSD"), DEPOSIT_USD6], "deposit"),
);
record("out-of-scope approve refused by policy before signing", refused instanceof OutOfScopeError);
record(
  "concurrent sends: consecutive nonces from the chain count (refusal burned none)",
  [faucet.nonce, approve.nonce].sort().join() === `${startNonce},${startNonce + 1}` && deposit.nonce === startNonce + 2,
  `nonces ${faucet.nonce}, ${approve.nonce}, ${deposit.nonce}`,
);
record(
  "faucet + approve + deposit finalized with explicit gas",
  [faucet, approve, deposit].every((t) => t.final.stage === "finalized" && t.stage === "proposed" && t.gas > 0n),
  `deposit ${deposit.hash} gas ${deposit.gas}`,
);
record("no prompt for in-scope sends", auth.ceremonies === 1);

// 5 · Backup passkey → server copy → fresh device recovers with no file.
const before = auth.ceremonies;
const vault = await addRecoveryPasskey(a, new Date());
record("backup passkey = 2 prompts", auth.ceremonies - before === 2);
const wire = {
  ...vault,
  credential: { credentialId: vault.credential.credentialId, transports: [...(vault.credential.transports ?? [])] },
};
await api.call(vaultPutRoute, { body: { vault: wire, label: "e2e backup" } });
const fetchVault = async (credentialId: string) =>
  api
    .call(vaultGetRoute, { params: { credentialId } })
    .then((r) => r.vault)
    .catch((e: unknown) => {
      if (e instanceof ApiError && e.status === HTTP_NOT_FOUND) return undefined;
      throw e;
    });

const [mainId, backupId] = auth.ids;
const wrong = device();
auth.discoverable = mainId;
const notFound = await recoverWithServerVault(wrong, fetchVault).catch((e: unknown) => e);
record("main passkey has no vault → VaultNotFoundError", notFound instanceof VaultNotFoundError);

const b = device();
auth.discoverable = backupId;
const beforeRecover = auth.ceremonies;
const recovered = await recoverWithServerVault(b, fetchVault);
record(
  "fresh device + backup passkey → same address (2 prompts)",
  recovered === address && auth.ceremonies - beforeRecover === 2 && b.hint?.mode === "vault",
);
const apiB = await apiFor(b);
const blobB = (await apiB.call(prefsGetRoute, {})).blob ?? "";
record("vault-path device opens the same prefs", JSON.stringify(b.openPrefs(blobB)) === JSON.stringify(prefs));

// 6 · EIP-7702 (D-145): the EOA signs the authorization behind a step-up; the sponsor sends the type-4 tx and pays.
const sponsorSender = createSender({
  chainId: CHAIN,
  account: signerFromPrivateKey(requireSecret("SPONSOR_PK"), "sponsor"),
  read,
  rpc: { http: [FORK] },
  journal: new MemoryJournal(),
});
const delegateTo = async (contract: `0x${string}`) => {
  const nonce = await read.getTransactionCount({ address, blockTag: "latest" });
  const authorization = await signDelegation(
    a,
    contract === DELEGATES.metamaskStatelessDeleGator
      ? { chainId: CHAIN, contract, nonce }
      : clearDelegation(CHAIN, nonce),
  );
  const sent = await sendAndFinalize(sponsorSender, {
    to: address,
    data: "0x",
    action: "delegate",
    authorizationList: [authorization],
  });
  return { sent, code: (await read.getCode({ address, blockTag: "latest" })) ?? "0x" };
};
const beforeDelegate = auth.ceremonies;
const on = await delegateTo(DELEGATES.metamaskStatelessDeleGator);
record(
  "7702: step-up (1 prompt) → sponsor type-4 finalized → EOA code = 0xef0100‖delegate",
  on.sent.final.stage === "finalized" &&
    on.code.toLowerCase() === `0xef0100${DELEGATES.metamaskStatelessDeleGator.slice(2)}`.toLowerCase() &&
    auth.ceremonies - beforeDelegate === 1,
  `tx ${on.sent.hash} gas ${on.sent.gas} (${on.sent.receipt.gasUsed} used)`,
);
const off = await delegateTo("0x0000000000000000000000000000000000000000");
record("7702: clear (authorize 0x0) → EOA code empty", off.sent.final.stage === "finalized" && off.code === "0x");

for (const c of [a, b, wrong]) c.session.dispose();
const failed = Object.entries(checks).filter(([, ok]) => !ok);
console.log(JSON.stringify({ pass: failed.length === 0, checks: Object.keys(checks).length, failed }, null, 2));
process.exit(failed.length === 0 ? 0 : 1);
