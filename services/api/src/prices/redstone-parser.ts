import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import type { Logger } from "@senryo/service-common";
import { REDSTONE_PARSE_TIMEOUT_MS, REDSTONE_PARSE_WORKER_MAX_FAILURES } from "./constants.ts";
import { type Package, type ParseReply, type ParseRequest, parsePackages } from "./redstone-packages.ts";

/**
 * RedStone's answer parsed off the event loop (04-pricing R14, F14): one long-lived worker, the response bytes
 * transferred (zero copy), the wanted feeds' packages back. The worker is `redstone-parse.mjs` beside the bundle in the
 * image (an esbuild entry), the `.worker.ts` source under tsx. A parse that hangs past its timeout restarts the worker;
 * a worker that keeps dying (or never starts) hands the parse back to this thread, logged — a slow parse beats no
 * prices.
 */
const BUNDLED_WORKER = "./redstone-parse.mjs";
const SOURCE_WORKER = "./redstone-parse.worker.ts";

interface Pending {
  resolve: (packages: Map<string, Package[]>) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

function workerUrl(): URL {
  const bundled = new URL(BUNDLED_WORKER, import.meta.url);
  return existsSync(fileURLToPath(bundled)) ? bundled : new URL(SOURCE_WORKER, import.meta.url);
}

function errorOf(name: string, message: string): Error {
  return Object.assign(new Error(message), { name });
}

export class RedStoneParser {
  private worker: Worker | undefined;
  private nextId = 1;
  private readonly pending = new Map<number, Pending>();
  private failures = 0;
  private inThread = false;

  constructor(private readonly log: Logger) {}

  /** The wanted feeds' packages from the gateway's answer. `body` is transferred: unusable here afterwards. */
  parse(body: ArrayBuffer, wanted: ReadonlySet<string>): Promise<Map<string, Package[]>> {
    const worker = this.inThread ? undefined : this.ensure();
    if (!worker) return Promise.resolve(parsePackages(new TextDecoder().decode(body), wanted));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(errorOf("TimeoutError", "redstone parse timed out"));
        void worker.terminate();
      }, REDSTONE_PARSE_TIMEOUT_MS);
      this.pending.set(id, { resolve, reject, timer });
      const request: ParseRequest = { id, bytes: body, wanted: [...wanted] };
      worker.postMessage(request, [body]);
    });
  }

  stop(): void {
    const worker = this.worker;
    this.worker = undefined;
    void worker?.terminate();
  }

  private ensure(): Worker | undefined {
    if (this.worker) return this.worker;
    try {
      const worker = new Worker(workerUrl());
      worker.on("message", (reply: ParseReply) => this.answer(reply));
      worker.on("error", (error) => this.crashed(worker, error.message));
      worker.on("exit", (code) => this.crashed(worker, `exited with ${code}`));
      worker.unref();
      this.worker = worker;
      return worker;
    } catch (error) {
      this.giveUp((error as Error).message);
      return undefined;
    }
  }

  private answer(reply: ParseReply): void {
    const p = this.pending.get(reply.id);
    if (!p) return;
    this.pending.delete(reply.id);
    clearTimeout(p.timer);
    if (reply.ok) p.resolve(new Map(reply.packages));
    else p.reject(errorOf(reply.name, reply.message));
  }

  private crashed(worker: Worker, reason: string): void {
    if (this.worker !== worker) return;
    this.worker = undefined;
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.reject(errorOf("WorkerError", `redstone parse worker ${reason}`));
    }
    this.pending.clear();
    this.failures += 1;
    this.log.warn({ reason, failures: this.failures }, "redstone parse worker stopped");
    if (this.failures >= REDSTONE_PARSE_WORKER_MAX_FAILURES) this.giveUp(reason);
  }

  private giveUp(reason: string): void {
    this.inThread = true;
    this.log.error({ reason }, "redstone parse worker unavailable; parsing on the main thread");
  }
}
