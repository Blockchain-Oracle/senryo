/**
 * Where Social's links go, from wherever they are tapped. Inside the tab shell a thread is a page on the Social stack
 * and a market a page on the Markets stack. A trader's profile is a root page over the shell, so a thread opened from
 * it stays a root page over that profile (back returns to the profile), and a market opened from it returns to the
 * shell rather than stacking a second shell on top (expo-router dispatches a cross-navigator push to the root stack).
 */
import { type Href, router } from "expo-router";
import { useInShell } from "~/components/shell/dock-context";
import { marketRoute, postRoute, traderPostRoute } from "~/lib/constants/routes";

export function useOpenPost(): (post: { id: string; author: string }) => void {
  const inShell = useInShell();
  return (post) => router.push((inShell ? postRoute(post.id) : traderPostRoute(post.author, post.id)) as Href);
}

export function useOpenMarket(): (symbol: string) => void {
  const inShell = useInShell();
  return (symbol) => {
    const href = marketRoute(symbol) as Href;
    if (inShell) router.push(href);
    else router.navigate(href);
  };
}
