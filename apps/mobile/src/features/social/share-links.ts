/**
 * F7 share links (F-D6): the web keeps its query form (a static export), every link names its network, and the app
 * remaps `/watch?address=X[&post=Y]` to `/watch/X[/post/Y]` (`lib/deep-link.ts`). A link opened in the other mode
 * goes through the mode sheet first; on the web it opens that network's page.
 */
import { WEB_ORIGIN } from "@senryo/config";
import { Share } from "react-native";
import { fire } from "~/feedback/fire";

export function profileLink(address: string, chainId: number): string {
  return `${WEB_ORIGIN}/watch?address=${address}&chainId=${chainId}`;
}

export function postLink(author: string, chainId: number, postId: string): string {
  return `${profileLink(author, chainId)}&post=${postId}`;
}

/** The system share sheet with one link; a dismissed sheet is not an error. */
export function shareLink(url: string): void {
  fire("tick");
  void Share.share({ message: url }).catch(() => undefined);
}
