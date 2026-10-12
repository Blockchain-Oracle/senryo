/**
 * Whether a window is open on chain (R5.25): `Windows.openWindow` takes a window only within its print's admission
 * after its start (300 s for Pyth), and the first call opens it — so a 15m or 1h window nobody called in time can never
 * take a call. The terminal asks this for the lane on screen and says so before the tap.
 */
import * as z from "zod";
import { bytes32Schema, chainIdSchema } from "../primitives.ts";
import { defineRoute } from "./define.ts";

export const windowStateRoute = defineRoute({
  method: "GET",
  path: "/v1/markets/windows/:windowId/opened",
  auth: "none",
  params: z.object({ windowId: bytes32Schema }),
  query: z.object({ chainId: z.coerce.number().pipe(chainIdSchema) }),
  body: undefined,
  response: z.object({ windowId: bytes32Schema, opened: z.boolean() }),
});
