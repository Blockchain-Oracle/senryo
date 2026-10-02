/**
 * F-D6 canonical share links: the web's query form, which the web's static export serves for any address and the app
 * maps to `/watch/0x…[/post/id]` (`lib/deep-link.ts`). Every link names its network, so a receiver on the other mode
 * is asked to switch before it opens (F7).
 */
import { type ChainId, WEB_ORIGIN } from "@senryo/config";

export function watchLink(address: string, chainId: ChainId, post?: string): string {
  const query = new URLSearchParams({ address, chainId: String(chainId) });
  if (post) query.set("post", post);
  return `${WEB_ORIGIN}/watch?${query.toString()}`;
}
