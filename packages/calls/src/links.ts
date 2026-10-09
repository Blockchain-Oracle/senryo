/**
 * A call's public link (S5.13 share card): the web shows its receipt to anyone at `/call?id=…&chainId=…`; the phone app
 * opens `/calls/<ticketId>` for it (`apps/mobile/src/lib/deep-link.ts`). Every link names its network.
 */
import { type ChainId, WEB_ORIGIN } from "@senryo/config";

export function callLink(ticketId: bigint, chainId: ChainId): string {
  const query = new URLSearchParams({ id: String(ticketId), chainId: String(chainId) });
  return `${WEB_ORIGIN}/call?${query.toString()}`;
}
