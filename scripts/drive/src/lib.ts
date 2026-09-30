import {
  createReadClient,
  createSender,
  createWsClient,
  HeadTracker,
  MemoryJournal,
  type ReadClient,
  type Sender,
  type SentTx,
  sendAndFinalize,
  type TxRequest,
} from "@senryo/chain";
import { explorerTxUrl, TESTNET_CHAIN_ID } from "@senryo/config";
import { loadSigner } from "@senryo/service-common";
import { COLS } from "./constants.ts";

/** Shared plumbing for drive scripts: testnet only, keys from `<NAME>_PK_FILE`, every tx printed + collected. */

export const CHAIN = TESTNET_CHAIN_ID;

export interface DriveTx {
  step: string;
  hash: string;
  stage: string;
  gas: string;
  url: string;
}

export interface Drive {
  read: ReadClient;
  heads: HeadTracker;
  txs: DriveTx[];
  sender(name: string): Sender;
  send(sender: Sender, step: string, request: TxRequest): Promise<SentTx>;
  close(): Promise<void>;
}

export async function openDrive(): Promise<Drive> {
  const read = createReadClient(CHAIN);
  const heads = new HeadTracker(read, createWsClient(CHAIN));
  await heads.start();
  const txs: DriveTx[] = [];
  const senders = new Map<string, Sender>();
  return {
    read,
    heads,
    txs,
    sender(name) {
      let s = senders.get(name);
      if (!s) {
        s = createSender({ chainId: CHAIN, account: loadSigner(name), read, heads, journal: new MemoryJournal() });
        senders.set(name, s);
      }
      return s;
    },
    async send(sender, step, request) {
      const sent = await sendAndFinalize(sender, request);
      const row = {
        step,
        hash: sent.hash,
        stage: sent.final.stage,
        gas: sent.gas.toString(),
        url: explorerTxUrl(CHAIN, sent.hash),
      };
      txs.push(row);
      console.log(
        `  ✓ ${step.padEnd(COLS.step)} ${sent.final.stage.padEnd(COLS.stage)} gas ${row.gas.padStart(COLS.gas)}  ${row.url}`,
      );
      return sent;
    },
    async close() {
      await heads.stop();
    },
  };
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Poll `check` every `everyMs` until it returns a value or `timeoutMs` passes. */
export async function waitUntil<T>(check: () => Promise<T | undefined>, timeoutMs: number, everyMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await check();
    if (value !== undefined) return value;
    await sleep(everyMs);
  }
  return undefined;
}
