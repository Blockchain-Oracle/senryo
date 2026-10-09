/**
 * `pnpm --filter @senryo/web dev:live` — the web app on localhost against the live API: a small proxy on :3461
 * forwards to the API with our web origin (production CORS stays senryo.xyz only) and answers the browser with
 * localhost's, streaming bodies through (the SSE stream included); then `next dev` on :3460 with
 * `NEXT_PUBLIC_API_ORIGIN` pointed at it and the development rpId (`localhost`: test passkeys, never senryo.xyz
 * accounts). Development only; nothing here ships.
 */
import { spawn } from "node:child_process";
import { createServer, request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";

const API = new URL(process.env.SENRYO_API ?? "https://api.senryo.xyz");
const WEB_ORIGIN = "https://senryo.xyz";
const PROXY_PORT = 3461;
const WEB_PORT = 3460;
const LOCAL = `http://localhost:${WEB_PORT}`;
const ALLOW = {
  "access-control-allow-origin": LOCAL,
  "access-control-allow-methods": "GET, HEAD, POST, PUT, DELETE, OPTIONS",
  "access-control-allow-headers": "authorization, content-type, accept, last-event-id, x-senryo-device",
  "access-control-max-age": "600",
};
const NO_CONTENT = 204;
const BAD_GATEWAY = 502;

const proxy = createServer((req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(NO_CONTENT, ALLOW);
    res.end();
    return;
  }
  const headers = { ...req.headers, host: API.host, origin: WEB_ORIGIN };
  const send = API.protocol === "https:" ? httpsRequest : httpRequest;
  const upstream = send(
    {
      protocol: API.protocol,
      host: API.hostname,
      port: API.port || undefined,
      path: req.url,
      method: req.method,
      headers,
    },
    (up) => {
      const out = { ...up.headers, ...ALLOW };
      delete out["access-control-allow-credentials"];
      res.writeHead(up.statusCode ?? BAD_GATEWAY, out);
      res.flushHeaders();
      up.pipe(res);
    },
  );
  upstream.on("error", (error) => {
    if (!res.headersSent) res.writeHead(BAD_GATEWAY, ALLOW);
    res.end(String(error));
  });
  // The browser went away (a closed stream, a reload): stop the upstream call. A request's own "close" fires once its
  // body is read, so the response's is the one that means the client left.
  res.on("close", () => {
    if (!res.writableFinished) upstream.destroy();
  });
  req.pipe(upstream);
});

proxy.listen(PROXY_PORT, () => {
  console.warn(`dev-live: ${API.origin} via http://localhost:${PROXY_PORT}`);
  const next = spawn("next", ["dev", "--port", String(WEB_PORT)], {
    stdio: "inherit",
    env: {
      ...process.env,
      NEXT_PUBLIC_API_ORIGIN: `http://localhost:${PROXY_PORT}`,
      NEXT_PUBLIC_DEV_RP_ID: "localhost",
    },
  });
  const stop = () => {
    next.kill("SIGTERM");
    proxy.close();
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  next.on("exit", (code) => {
    proxy.close();
    process.exit(code ?? 0);
  });
});
