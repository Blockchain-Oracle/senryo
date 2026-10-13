"use client";
/**
 * The web's search (R6): the shared index (`@senryo/calls` `useSearch`) with the web's places (Home, the rail,
 * Everything) and actions in their current state, and what choosing a result does — ↵ opens it, ⌘↵ / Ctrl+↵ its
 * alternate (Codex direction 13). Nothing here moves money: Up, Down and a position open the terminal ready (D-340).
 */
import { readSymbols } from "@senryo/calls";
import { type SearchView, useSearch } from "@senryo/calls/react";
import { explorerTxUrl, WEB_RAIL } from "@senryo/config";
import {
  actionEntries,
  recordVisit,
  SEARCH_ACTIONS,
  type SearchAction,
  type SearchEntry,
  type SearchTarget,
} from "@senryo/search";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useMemo } from "react";
import { useAppTrader } from "@/lib/account/guest";
import { setFeedback, useFeedback } from "@/lib/feedback";
import { activeNetwork } from "@/lib/network";
import { DRAWERS, openDrawer } from "@/lib/shell/drawer-param";
import { setPrivacy, usePrivacy } from "@/lib/shell/privacy";
import { TERMINAL_STORAGE, useStoredString } from "@/lib/terminal/stored";
import { openTour } from "@/lib/terminal/tour";
import { DRAWER_PREFIX, HREF, pageHref, SEARCH_PLACES } from "./hrefs";
import type { MarketPageState } from "./MarketPage";

/** Go to's keys 1…5: the rail (D-339). */
export const GO_TO = WEB_RAIL.map((r) => r.key);

/** What ⌘↵ does for an entry, named for the footer; null where it has none. */
export function alternateOf(entry: SearchEntry): string | null {
  const t = entry.target;
  switch (t.kind) {
    case "terminal":
      return t.intent.position ? "Receipt" : "Market options";
    case "place":
      return HREF[t.key]?.startsWith(DRAWER_PREFIX) ? null : "New tab";
    case "action":
      return t.action === "add-money" || t.action === "tour" ? "Help" : "Settings";
    case "receipt":
    case "explorer":
      return null;
    default:
      return null;
  }
}

export interface WebSearch extends SearchView {
  /** ↵ (alternate false) or ⌘↵ (true). Returns a symbol when the market page should open instead (handled in place). */
  run: (entry: SearchEntry, alternate: boolean) => { marketPage: MarketPageState } | null;
  go: (target: SearchTarget) => void;
}

export function useWebSearch(query: string, open: boolean): WebSearch {
  const router = useRouter();
  const trader = useAppTrader();
  const hidden = usePrivacy();
  const feedback = useFeedback();
  const { resolvedTheme, setTheme } = useTheme();
  const [favRaw] = useStoredString(TERMINAL_STORAGE.favourites);
  const favourites = useMemo(() => readSymbols(favRaw), [favRaw]);
  const practice = activeNetwork().key === "testnet";
  const light = resolvedTheme === "light";
  const actions = useMemo(
    () =>
      actionEntries(SEARCH_ACTIONS, {
        practice,
        hidden,
        sound: feedback.sound,
        haptics: feedback.haptics,
        light,
        ...(trader.guest ? {} : { oneTap: false }),
      }),
    [practice, hidden, feedback.sound, feedback.haptics, light, trader.guest],
  );
  const view = useSearch({ query, app: "web", open, places: SEARCH_PLACES, actions, goTo: GO_TO, favourites });

  const act = (action: SearchAction) => {
    switch (action) {
      case "add-money":
        return openDrawer(trader.guest ? DRAWERS.account : practice ? DRAWERS.wallet : DRAWERS.receive);
      case "receive":
        return openDrawer(DRAWERS.receive);
      case "withdraw":
        return openDrawer(DRAWERS.withdraw);
      case "balances":
        return setPrivacy(!hidden);
      case "sound":
        return setFeedback({ sound: !feedback.sound });
      case "haptics":
        return setFeedback({ haptics: !feedback.haptics });
      case "theme":
        return setTheme(light ? "dark" : "light");
      case "tour":
        return openTour();
      case "one-tap":
        return openDrawer(DRAWERS.oneTap);
    }
  };

  const go = (t: SearchTarget) => {
    switch (t.kind) {
      case "terminal":
      case "market":
        return router.push(pageHref(t) ?? "");
      case "receipt":
        return openDrawer(t.of === "call" ? DRAWERS.call : DRAWERS.ride, { id: t.id });
      case "window":
        return router.push(`/proof/w/?id=${t.windowId}&chainId=${activeNetwork().chainId}`);
      case "event":
        return router.push(`/app/event/?id=${t.eventId}`);
      case "place": {
        const href = HREF[t.key];
        if (!href) return;
        return href.startsWith(DRAWER_PREFIX) ? openDrawer(href.slice(DRAWER_PREFIX.length)) : router.push(href);
      }
      case "action":
        return act(t.action);
      case "help":
        return openDrawer(DRAWERS.help, { id: t.key });
      case "explorer":
        window.open(explorerTxUrl(activeNetwork().chainId, t.hash), "_blank", "noopener");
        return;
    }
  };

  const run: WebSearch["run"] = (entry, alternate) => {
    const t = entry.target;
    if (!alternate) {
      // The terminal records its market (D-337); a position is gone once it closes.
      if (t.kind !== "terminal") recordVisit(entry.id);
      go(t);
      return null;
    }
    switch (t.kind) {
      case "terminal":
        if (t.intent.position) {
          const [kind, id] = t.intent.position.split(":");
          go({ kind: "receipt", of: kind === "ride" ? "ride" : "call", id: id ?? "" });
          return null;
        }
        return { marketPage: { symbol: t.intent.symbol, ...(t.intent.lane ? { lane: t.intent.lane } : {}) } };
      case "place": {
        const href = HREF[t.key];
        if (href && !href.startsWith(DRAWER_PREFIX)) window.open(href, "_blank", "noopener");
        return null;
      }
      case "action":
        openDrawer(t.action === "add-money" || t.action === "tour" ? DRAWERS.help : DRAWERS.settings);
        return null;
      default:
        return null;
    }
  };

  return { ...view, run, go };
}
