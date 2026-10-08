/**
 * Public Practice check (real venues, Stage 1): a brand-new wallet with no MON signs in to the deployed api, asks for
 * Perpl test dollars, and the sponsor's faucet relay lands 10,000 Agora test AUSD in it — no gas from the user. A second
 * ask the same day is refused, and `/v1/holdings` lists the token as a verified Practice dollar.
 *   API_URL=https://api.senryo.xyz pnpm --filter @senryo/drive exec tsx src/practice-funds-check.ts
 */
import assert from "node:assert/strict";
import {
  ApiError,
  authNonceRoute,
  authVerifyRoute,
  createApiClient,
  holdingsRoute,
  perplFundsRoute,
  starterRelayRoute,
} from "@senryo/api-client";
import { createReadClient, readPerplWalletCollateral } from "@senryo/chain";
import { explorerTxUrl, PERPL_COLLATERAL, PERPL_TESTNET_FAUCET_CNS, TESTNET_CHAIN_ID } from "@senryo/config";
import { isTerminalStage } from "@senryo/core";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const API = process.env.API_URL ?? "https://api.senryo.xyz";
const POLL_MS = 1_000;
const POLL_MAX = 60;

const user = privateKeyToAccount(generatePrivateKey());
let token: string | null = null;
const api = createApiClient({ origin: API, deviceHash: `funds-check-${Date.now()}`, getToken: () => token });
const read = createReadClient(TESTNET_CHAIN_ID);

const nonce = await api.call(authNonceRoute, { body: { address: user.address, chainId: TESTNET_CHAIN_ID } });
const session = await api.call(authVerifyRoute, {
  body: { message: nonce.message, signature: await user.signMessage({ message: nonce.message }) },
});
token = session.token;
assert.equal(await read.getBalance({ address: user.address }), 0n, "a fresh wallet holds no MON");

let relay = await api.call(perplFundsRoute, { body: { chainId: TESTNET_CHAIN_ID } });
console.log(`relay ${relay.relayId} → ${explorerTxUrl(TESTNET_CHAIN_ID, relay.txHash)}`);
for (let i = 0; i < POLL_MAX && !isTerminalStage(relay.stage); i++) {
  await new Promise((r) => setTimeout(r, POLL_MS));
  relay = await api.call(starterRelayRoute, { params: { relayId: relay.relayId } });
}
assert.equal(relay.stage, "finalized", `relay ended ${relay.stage}`);
const wallet = await readPerplWalletCollateral(read, TESTNET_CHAIN_ID, user.address);
assert.equal(wallet.balance, PERPL_TESTNET_FAUCET_CNS, "10,000 test AUSD in the wallet");
console.log(`PASS fresh wallet ${user.address} received ${wallet.balance} CNS test AUSD with 0 MON`);

const again = await api.call(perplFundsRoute, { body: { chainId: TESTNET_CHAIN_ID } }).catch((e: unknown) => e);
assert.ok(again instanceof ApiError, "a second ask the same day is refused");
assert.ok(["RATE_LIMITED", "NOT_NEEDED"].includes(again.code), `second ask: ${again.code}`);
console.log(`PASS second ask refused (${again.code})`);

const holdings = await api.call(holdingsRoute, { query: { chainId: TESTNET_CHAIN_ID, address: user.address } });
const listed = holdings.tokens.find((t) => t.address.toLowerCase() === PERPL_COLLATERAL[TESTNET_CHAIN_ID].toLowerCase());
assert.ok(listed?.verified, "holdings list the test AUSD as verified");
console.log(`PASS holdings: ${listed.symbol} · ${listed.name} · verified`);
