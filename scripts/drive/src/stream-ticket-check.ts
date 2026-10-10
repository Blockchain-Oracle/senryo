/**
 * R1.23 · 04-pricing G3 (d): prices never wait on the user's stream ticket. `@senryo/live`'s `LiveStream` against the
 * deployed api asks for `user:` with a ticket route that fails, then with a ticket the api refuses; both times the
 * first price must arrive within 1.5 s. Passes against an api before R1.10 too (the client reconnects public-only
 * when the whole request is refused). `API_ORIGIN` (default https://api.senryo.xyz).
 *
 *   pnpm --filter @senryo/drive exec tsx src/stream-ticket-check.ts
 */
import { LiveStream } from "@senryo/live";
import { sleep } from "./lib.ts";

const ORIGIN = process.env.API_ORIGIN ?? "https://api.senryo.xyz";
const ADDRESS = "0x00000000000000000000000000000000000000aa";
const FIRST_PRICE_WITHIN_MS = 1_500;
const LISTEN_MS = 4_000;

async function firstPrice(label: string, ticket: () => Promise<string | undefined>): Promise<boolean> {
  const t0 = Date.now();
  let first = 0;
  const events = new Set<string>();
  const stream = new LiveStream({
    origin: ORIGIN,
    fetch: globalThis.fetch,
    topics: () => ["prices", `user:${ADDRESS}`],
    ticket,
    onEvent: (event) => {
      events.add(event);
      if ((event === "p" || event === "pp") && !first) first = Date.now() - t0;
    },
  });
  const release = stream.acquire();
  await sleep(LISTEN_MS);
  release();
  const ok = first > 0 && first <= FIRST_PRICE_WITHIN_MS;
  console.log(
    `${ok ? "ok  " : "FAIL"} ${label}: first price in ${first || "—"} ms (events: ${[...events].join(", ")})`,
  );
  return ok;
}

const results = [
  await firstPrice("ticket route failing", async () => {
    throw new Error("500");
  }),
  await firstPrice("ticket refused", async () => "forged.1.00"),
];
process.exit(results.every(Boolean) ? 0 : 1);
