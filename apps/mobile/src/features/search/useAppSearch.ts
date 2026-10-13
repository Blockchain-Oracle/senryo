/**
 * The phone's search (R6.9, UGLYCASH U10): the shared index (`@senryo/calls` `useSearch`, the web's own) with the
 * phone's places — the dock, More, the account pages — and its actions in their current state, and what a tap does.
 * Nothing here moves money: Up, Down and a position open the terminal ready (D-340).
 */
import { proofLink, readSymbols } from "@senryo/calls";
import { type SearchView, useSearch } from "@senryo/calls/react";
import { DOCK_NAV, explorerTxUrl, GAMES, MORE_NAV, WEB_EVERYTHING, WEB_PLACES } from "@senryo/config";
import {
  actionEntries,
  intentParams,
  type PlaceLike,
  recordVisit,
  SEARCH_ACTIONS,
  type SearchAction,
  type SearchEntry,
  type SearchTarget,
} from "@senryo/search";
import * as Linking from "expo-linking";
import { type Href, router } from "expo-router";
import { useMemo } from "react";
import { useMMKVBoolean, useMMKVString } from "react-native-mmkv";
import { useAppTrader } from "~/lib/account/guest";
import { accountRequiredRoute, ROUTES } from "~/lib/constants/routes";
import { useHideBalances } from "~/lib/hide-balances";
import { activeNetwork } from "~/lib/network";
import { STORAGE_KEYS, storage } from "~/lib/storage";
import { openTour } from "~/lib/tour";
import { useTheme } from "~/theme";

/** The web's words for a place where it has one; the phone's own pages say theirs here. */
const WEB_COPY = new Map(
  [...WEB_PLACES, ...WEB_EVERYTHING.flatMap((s): readonly PlaceLike[] => s.items)].map((p) => [p.key, p]),
);
const PHONE_COPY: Record<string, { description: string; keywords?: string }> = {
  wallet: { description: "Practice dollars, Receive and Withdraw.", keywords: "balance money dollars" },
  profile: { description: "Your name, @handle and bio.", keywords: "username handle avatar" },
  notifications: { description: "Results, alerts and messages.", keywords: "inbox bell alerts" },
  help: { description: "The questions people ask first, and how to reach Senryo.", keywords: "faq support" },
  sounds: { description: "Effects, music and their volumes.", keywords: "sound music volume" },
  preferences: { description: "Sound, vibration and how Senryo looks.", keywords: "settings haptics" },
  security: { description: "Your passkey and Face ID.", keywords: "passkey face id" },
};
const ACCOUNT_PAGES = [
  { key: "help", label: "Help", path: ROUTES.accountHelp },
  { key: "sounds", label: "Sounds", path: ROUTES.accountSounds },
  { key: "preferences", label: "Preferences", path: ROUTES.accountPreferences },
  { key: "security", label: "Security", path: ROUTES.accountSecurity },
] as const;
const NAV = [...DOCK_NAV.filter((d) => d.key !== "more"), ...MORE_NAV, ...ACCOUNT_PAGES];
/** Money moves through actions; one row each. */
const NOT_PLACES = new Set(["receive"]);
const PLACES: readonly PlaceLike[] = NAV.filter((n) => !NOT_PLACES.has(n.key)).map((n) => {
  const web = WEB_COPY.get(n.key);
  const copy = PHONE_COPY[n.key];
  const description = copy?.description ?? web?.description;
  const keywords = copy?.keywords ?? web?.keywords;
  return { key: n.key, label: n.label, ...(description ? { description } : {}), ...(keywords ? { keywords } : {}) };
});
const ROUTE: Record<string, string> = {
  ...Object.fromEntries(NAV.map((n) => [n.key, n.path])),
  ...Object.fromEntries(GAMES.map((g) => [g.key, g.route])),
};
/** Go to on the phone (no keys): the places the dock doesn't hold. */
export const PHONE_GO_TO = ["games", "earn", "wallet", "events", "status"] as const;

export interface AppSearch extends SearchView {
  open: (entry: SearchEntry) => void;
  go: (target: SearchTarget) => void;
}

export function useAppSearch(query: string, active: boolean): AppSearch {
  const trader = useAppTrader();
  const { name, setTheme } = useTheme();
  const light = name === "light";
  const [hidden, setHidden] = useHideBalances();
  const [sounds] = useMMKVBoolean(STORAGE_KEYS.sounds, storage);
  const [haptics] = useMMKVBoolean(STORAGE_KEYS.haptics, storage);
  const [favRaw] = useMMKVString(STORAGE_KEYS.favouriteMarkets, storage);
  const favourites = useMemo(() => readSymbols(favRaw), [favRaw]);
  const practice = activeNetwork().key === "testnet";
  const sound = sounds ?? true;
  const vibration = haptics ?? true;
  const actions = useMemo(
    () =>
      actionEntries(SEARCH_ACTIONS, {
        practice,
        hidden,
        sound,
        haptics: vibration,
        light,
        ...(trader.guest ? {} : { oneTap: false }),
      }),
    [practice, hidden, sound, vibration, light, trader.guest],
  );
  const view = useSearch({
    query,
    app: "phone",
    open: active,
    places: PLACES,
    actions,
    goTo: PHONE_GO_TO,
    favourites,
  });

  const act = (action: SearchAction) => {
    switch (action) {
      case "add-money":
        return router.push(
          (practice ? ROUTES.wallet : trader.guest ? accountRequiredRoute("add money") : ROUTES.receive) as Href,
        );
      case "receive":
        return router.push((trader.guest ? accountRequiredRoute("add money") : ROUTES.receive) as Href);
      case "withdraw":
        return router.push((trader.guest ? accountRequiredRoute("send") : ROUTES.withdraw) as Href);
      case "balances":
        return setHidden(!hidden);
      case "sound":
        return storage.set(STORAGE_KEYS.sounds, !sound);
      case "haptics":
        return storage.set(STORAGE_KEYS.haptics, !vibration);
      case "theme":
        return setTheme(light ? "dark" : "light");
      case "tour":
        router.navigate("/trade");
        return openTour();
      case "one-tap":
        return router.push(ROUTES.session as Href);
    }
  };

  const go = (t: SearchTarget) => {
    switch (t.kind) {
      case "terminal":
        return router.navigate({ pathname: "/trade", params: { symbol: t.intent.symbol, ...intentParams(t.intent) } });
      case "market":
        return router.push(`/search/${t.symbol}` as Href);
      case "receipt":
        return router.push((t.of === "ride" ? `/calls/rides/${t.id}` : `/calls/${t.id}`) as Href);
      case "window":
        return void Linking.openURL(proofLink(t.windowId, activeNetwork().chainId));
      case "event":
        return router.push(`/events/${t.eventId}` as Href);
      case "place": {
        const path = ROUTE[t.key];
        return path ? router.push(path as Href) : undefined;
      }
      case "action":
        return act(t.action);
      case "help":
        return router.push(`${ROUTES.accountHelp}?q=${t.key}` as Href);
      case "explorer":
        return void Linking.openURL(explorerTxUrl(activeNetwork().chainId, t.hash));
    }
  };

  const open = (entry: SearchEntry) => {
    // The terminal records its market (D-337); a position is gone once it closes.
    if (entry.target.kind !== "terminal") recordVisit(entry.id);
    go(entry.target);
  };

  return { ...view, open, go };
}
