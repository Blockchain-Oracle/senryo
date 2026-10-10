/**
 * The price path assembled as `main.ts` assembles it — the real gateway, `/v1/stream`, the price and status routes —
 * on a local port and a throwaway database, with a Hermes in front of it that can be cut like a dead network (open
 * streams stop receiving bytes and stay open; new requests hang), and a watcher reading `/v1/stream` as an app does
 * (states, ticks, resets, reconnects). For the R1.23 chaos and abuse checks (04-pricing G3, G6); nothing here ships.
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import rateLimit from "@fastify/rate-limit";
import { MARKETS } from "@senryo/config";
import { createDb, createHttpServer, createLogger, type Db, HTTP_STATUS, migrate } from "@senryo/service-common";
import { PythGateway } from "../../src/prices/gateway.ts";
import type { RedStoneGateway } from "../../src/prices/redstone.ts";
import { registerInfoRoutes } from "../../src/routes/info.ts";
import { registerPriceRoutes } from "../../src/routes/prices.ts";
import { StreamBus } from "../../src/stream/bus.ts";
import { registerStreamRoute } from "../../src/stream/route.ts";
import { StreamWatcher } from "./watcher.ts";

const HERMES = "https://pyth.dourolabs.app/hermes";
const CHECK_DB_SUFFIX = "_check";

/** A Hermes that can be cut: `cut()` silences every open stream and hangs every new request until `restore()`. */
export class FaultyHermes {
  private down = false;
  private readonly hung = new Set<ServerResponse>();
  private readonly server = createServer((req, res) => void this.serve(req, res));
  origin = "";

  async start(): Promise<void> {
    await new Promise<void>((r) => this.server.listen(0, "127.0.0.1", r));
    this.origin = `http://127.0.0.1:${(this.server.address() as AddressInfo).port}`;
  }

  cut(): void {
    this.down = true;
  }

  restore(): void {
    this.down = false;
    for (const res of this.hung) res.destroy();
    this.hung.clear();
  }

  close(): void {
    this.server.closeAllConnections();
    this.server.close();
  }

  private async serve(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (this.down) {
      this.hung.add(res);
      return;
    }
    const headers: Record<string, string> = {};
    if (req.headers.authorization) headers.authorization = req.headers.authorization;
    if (req.headers.accept) headers.accept = req.headers.accept;
    const abort = new AbortController();
    req.on("close", () => abort.abort());
    try {
      const upstream = await fetch(`${HERMES}${req.url ?? ""}`, { headers, signal: abort.signal });
      res.writeHead(upstream.status, { "content-type": upstream.headers.get("content-type") ?? "application/json" });
      if (!upstream.body) return void res.end();
      for await (const chunk of upstream.body) {
        // Cut: the bytes stop and the socket stays open, as when a network path dies.
        if (this.down) {
          this.hung.add(res);
          return;
        }
        res.write(chunk);
      }
      res.end();
    } catch {
      res.destroy();
    }
  }
}

export interface Rig {
  db: Db;
  origin: string;
  watcher: StreamWatcher;
  hermes: FaultyHermes;
  /** The running gateway and bus (replaced by `restartApi`). */
  gateway: PythGateway;
  bus: StreamBus;
  /** Stop the api as a crash would leave it, stay down `downMs`, and start a fresh one (new epoch) on the same address. */
  restartApi(downMs: number): Promise<void>;
  close(): Promise<void>;
}

export async function openRig(input: {
  databaseUrl: string;
  pythKey: string;
  redstoneGateways?: RedStoneGateway[];
}): Promise<Rig> {
  const dbName = new URL(input.databaseUrl).pathname.slice(1);
  if (!dbName.endsWith(CHECK_DB_SUFFIX)) throw new Error(`refusing ${dbName}: a chaos check needs a *_check database`);
  const log = createLogger("chaos", "error");
  const db = createDb(input.databaseUrl, "chaos");
  await migrate(db, log);
  const hermes = new FaultyHermes();
  await hermes.start();
  const upstream = {
    pythKey: input.pythKey,
    hermesOrigin: hermes.origin,
    redstoneGateways: input.redstoneGateways,
    displayFeed: false,
  };
  const state = { bus: new StreamBus(), gateway: undefined as unknown as PythGateway, down: false };
  state.gateway = new PythGateway(db, state.bus, log, upstream);
  state.gateway.start();
  const guards = {
    faults: () => ({ unhandledRejections: 0, lastRejectionAt: null, loopDelayP99Ms: null, loopDelayMaxMs: null }),
  };
  const app = createHttpServer({ service: "chaos", logger: log });
  // While "down" every request gets what the proxy gives with no backend (a crashed api refuses; it doesn't serve).
  app.addHook("onRequest", async (_request, reply) => {
    if (state.down) return reply.code(HTTP_STATUS.badGateway).send();
  });
  await app.register(rateLimit, { global: false });
  // Routes read the gateway and bus through `state`, so a restart swaps them behind the same address.
  const gatewayView = new Proxy({} as PythGateway, { get: (_t, k) => Reflect.get(state.gateway, k, state.gateway) });
  registerPriceRoutes(app, gatewayView);
  const infoCtx = {
    chains: new Map(),
    log,
    gateway: gatewayView,
    guards,
    get bus() {
      return state.bus;
    },
  };
  registerInfoRoutes(app, infoCtx as never);
  registerStreamRoute(app, {
    get bus() {
      return state.bus;
    },
    ticketSecret: undefined,
    corsOrigins: [],
    snapshot: (t, batched) => (t === "prices" ? state.gateway.snapshot(batched) : []),
    beatData: () => ({ h: state.gateway.healthDigest() }),
  });
  await app.listen({ port: 0, host: "127.0.0.1" });
  const origin = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
  const watcher = new StreamWatcher(
    origin,
    MARKETS.map((m) => m.symbol),
  );
  watcher.start();
  return {
    db,
    origin,
    watcher,
    hermes,
    get gateway() {
      return state.gateway;
    },
    get bus() {
      return state.bus;
    },
    async restartApi(downMs: number) {
      state.down = true;
      await state.gateway.stop();
      app.server.closeAllConnections();
      await new Promise((r) => setTimeout(r, downMs));
      state.bus = new StreamBus();
      state.gateway = new PythGateway(db, state.bus, log, upstream);
      state.gateway.start();
      state.down = false;
    },
    async close() {
      watcher.stop();
      await state.gateway.stop();
      app.server.closeAllConnections();
      await app.close();
      hermes.close();
      await db.end();
    },
  };
}
