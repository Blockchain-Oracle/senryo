/** Native faucet request on a disposable LOCAL fork; public networks are refused. */
import assert from "node:assert/strict";
import {
  createReadClient,
  createSender,
  MemoryJournal,
  perplPracticeFundsRequest,
  readPerplSnapshot,
} from "@senryo/chain";
import { TESTNET_CHAIN_ID } from "@senryo/config";
import { sendTracked } from "@senryo/query";
import { anvil, freshUser } from "./fork.ts";

const RPC = "http://127.0.0.1:18765";
const LOCAL_TIMEOUT_MS = 30_000;
const read = createReadClient(TESTNET_CHAIN_ID, { http: [RPC], timeoutMs: LOCAL_TIMEOUT_MS });
assert.match(await anvil<string>(RPC, "web3_clientVersion", []), /anvil/i);
assert.equal(await read.getChainId(), TESTNET_CHAIN_ID);
const account = freshUser();
await anvil(RPC, "anvil_setBalance", [account.address, "0x3635c9adc5dea00000"]);
const sender = createSender({
  chainId: TESTNET_CHAIN_ID,
  read,
  rpc: { http: [RPC] },
  journal: new MemoryJournal(),
  account,
});
const result = await sendTracked(sender, perplPracticeFundsRequest(account.address), () => undefined);
assert.equal(result.final?.stage, "finalized");
assert.ok((await readPerplSnapshot(read, TESTNET_CHAIN_ID, account.address)).wallet.balance > 0n);
console.log(
  "PASS native faucet request → capped simulation → signature → finalized Agora test-AUSD balance (local only)",
);
