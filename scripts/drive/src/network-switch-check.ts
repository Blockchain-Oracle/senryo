/**
 * S8.22 network-switch check (signing only, nothing broadcast): one passkey account, two networks, and the session
 * policy keeps them apart. This is the layer the app's per-chain `policyContext` relies on.
 *  1. a Practice context signs an in-scope Practice tx;
 *  2. a Practice context refuses a Mainnet tx, and a Mainnet context refuses a Practice tx (`wrong-chain`, no step-up);
 *  3. entering Mainnet locks the session ("Switch to real money"); the next session's usage holds only its own
 *     signatures (an open counts toward spend and rate), so practice trading never counts against, or unlocks, real
 *     money.
 * Run: pnpm --filter @senryo/drive network-switch-check
 */
import { AccountClient, OutOfScopeError, type PolicyContext } from "@senryo/account";
import { type ChainId, MAINNET_CHAIN_ID, PRIORITY_FEE_WEI, RP_ID, TESTNET_CHAIN_ID } from "@senryo/config";
import { increaseRequest } from "@senryo/query";
import { memoryStore, VirtualAuthenticator } from "./fake-passkey.ts";

const XAU = 0;
const NOTIONAL_USD6 = 20_000_000n;
/** Any plausible gold price: signing never simulates, the policy only reads the call. */
const PRICE18 = 4_000_000_000_000_000_000_000n;
/** Room and equity far above the open, so the policy judges scope, not size. */
const ROOM_USD6 = 1_000_000_000_000n;
const GAS = 500_000n;
const MAX_FEE = 200_000_000_000n;

const checks: Record<string, boolean> = {};
const record = (name: string, ok: boolean, detail = "") => {
  checks[name] = ok;
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const client = new AccountClient({
  rpId: RP_ID,
  passkey: { kind: "web", webAuthnClient: new VirtualAuthenticator() },
  store: memoryStore(),
});
const self = await client.create();
const context = (chainId: ChainId) => (): PolicyContext => ({
  chainId,
  self,
  faceId: "off",
  marketRoomUsd6: () => ROOM_USD6,
  equityUsd6: () => ROOM_USD6,
  marketLabel: () => "Gold",
});
const practice = client.signer(context(TESTNET_CHAIN_ID));
const mainnet = client.signer(context(MAINNET_CHAIN_ID));
const open = increaseRequest(TESTNET_CHAIN_ID, XAU, true, NOTIONAL_USD6, PRICE18, 1);
const tx = (chainId: number, nonce: number) => ({
  chainId,
  type: "eip1559" as const,
  to: open.to,
  data: open.data,
  nonce,
  gas: GAS,
  maxFeePerGas: MAX_FEE,
  maxPriorityFeePerGas: PRIORITY_FEE_WEI,
});
const refusal = async (sign: () => Promise<unknown>) => {
  try {
    await sign();
    return "signed";
  } catch (error) {
    return error instanceof OutOfScopeError ? `${error.reason}${error.stepUp ? " (step-up)" : ""}` : String(error);
  }
};

// 1 — same network signs.
const ok = await refusal(() => practice.signTransaction(tx(TESTNET_CHAIN_ID, 0)));
record("Practice context signs a Practice open", ok === "signed", ok);
const used = client.session.live()?.usage;
record("the open counted in this session's usage", used !== undefined && used.signedAt.length > 0);

// 2 — the other network never signs, either way.
const toMainnet = await refusal(() => practice.signTransaction(tx(MAINNET_CHAIN_ID, 0)));
record("Practice context refuses a Mainnet tx", toMainnet === "wrong-chain", toMainnet);
const toPractice = await refusal(() => mainnet.signTransaction(tx(TESTNET_CHAIN_ID, 0)));
record("Mainnet context refuses a Practice tx", toPractice === "wrong-chain", toPractice);

// 3 — "Switch to real money" locks; the next session starts clean.
client.lock();
record("entering Mainnet locks the session", client.session.live() === undefined);
const after = await refusal(() => client.signer(context(TESTNET_CHAIN_ID)).signTransaction(tx(TESTNET_CHAIN_ID, 1)));
const fresh = client.session.live()?.usage;
record(
  "nothing carries over: the next session holds only its own open",
  after === "signed" &&
    fresh !== undefined &&
    used !== undefined &&
    fresh.signedAt.length === 1 &&
    fresh.spentUsd6 === used.spentUsd6,
  `${after}; ${fresh?.signedAt.length ?? "?"} signature(s), spent ${fresh?.spentUsd6} in the new session (before lock: ${used?.signedAt.length}, ${used?.spentUsd6})`,
);

const failed = Object.entries(checks).filter(([, pass]) => !pass);
console.log(JSON.stringify({ pass: failed.length === 0, checks: Object.keys(checks).length, failed }, null, 2));
process.exit(failed.length === 0 ? 0 : 1);
