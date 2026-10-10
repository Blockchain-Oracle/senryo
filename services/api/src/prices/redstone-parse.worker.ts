import { parentPort } from "node:worker_threads";
import { type ParseReply, type ParseRequest, parsePackages } from "./redstone-packages.ts";

/**
 * The RedStone parse worker (04-pricing R14): the gateway's ~2 MB answer arrives as transferred bytes and only the
 * wanted feeds' packages go back, so the api's event loop never spends the 21–25 ms parse. Bundled as its own entry
 * (`redstone-parse.mjs`, services/common/scripts/bundle.mjs).
 */
const decoder = new TextDecoder();

parentPort?.on("message", (request: ParseRequest) => {
  let reply: ParseReply;
  try {
    const packages = [...parsePackages(decoder.decode(request.bytes), new Set(request.wanted))];
    reply = { id: request.id, ok: true, packages };
  } catch (error) {
    const e = error as Error;
    reply = { id: request.id, ok: false, name: e.name, message: e.message };
  }
  parentPort?.postMessage(reply);
});
