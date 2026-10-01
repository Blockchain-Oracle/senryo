import { router, useGlobalSearchParams, usePathname } from "expo-router";
import { useTabTrigger } from "expo-router/ui";
import { useEffect, useRef } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DOCK, RADIUS, SPACE, TYPE, useTheme } from "~/theme";
import { useDock } from "./dock-context";
import { type ListHandle, listFor, type ProbeState, resetProbe, updateProbe, useProbe, type Verdict } from "./probe";
import { SPIKE_ROOT } from "./screens";

/**
 * S1b.7 navigation spike (D-193): runs once when the shell opens with `?probe=1` and prints its verdicts on screen.
 * Checks: (1) a tab's pushed stack survives switching tabs; (2) each tab's scroll offset survives switching tabs and
 * a push/pop; (3) the dock hides during transaction entry and returns after; (4) the last row clears the dock.
 */
const SETTLE_MS = 400;
const NAV_MS = 700;
const LIST_WAIT_MS = 100;
const LIST_WAIT_TRIES = 50;
const HOME_SCROLL_Y = 900;
const MARKETS_SCROLL_Y = 600;
const TOLERANCE_PT = 2;
const DETAIL_ROW = "7";
const ENTRY_ROW = "3";

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
async function waitForList(tab: string): Promise<ListHandle> {
  for (let i = 0; i < LIST_WAIT_TRIES; i += 1) {
    const list = listFor(tab);
    if (list) return list;
    await wait(LIST_WAIT_MS);
  }
  throw new Error(`${tab} list never registered`);
}
const verdict = (ok: boolean): Verdict => (ok ? "pass" : "fail");

export function ProbeRunner() {
  const { probe } = useGlobalSearchParams<{ probe?: string }>();
  const pathname = usePathname();
  const { hidden } = useDock();
  const { switchTab } = useTabTrigger({ name: "home" });
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const path = useRef(pathname);
  const dockHidden = useRef(hidden);
  const started = useRef(false);
  path.current = pathname;
  dockHidden.current = hidden;

  useEffect(() => {
    if (probe !== "1" || started.current) return;
    started.current = true;
    const go = (tab: string) => switchTab(tab, {});
    const run = async () => {
      resetProbe();
      const home = await waitForList("home");
      home.scrollTo(HOME_SCROLL_Y);
      await wait(SETTLE_MS);
      const homeBefore = await home.probeRowY();
      router.push({ pathname: `${SPIKE_ROOT}/home/detail`, params: { row: DETAIL_ROW } });
      await wait(NAV_MS);
      go("markets");
      const markets = await waitForList("markets");
      markets.scrollTo(MARKETS_SCROLL_Y);
      await wait(SETTLE_MS);
      const marketsBefore = await markets.probeRowY();
      go("card");
      await wait(NAV_MS);
      go("home");
      await wait(NAV_MS);
      const stackKept = path.current.endsWith("/home/detail");
      updateProbe({ stack: verdict(stackKept) }, `home after card: ${path.current}`);
      router.back();
      await wait(NAV_MS);
      const homeAfter = await home.probeRowY();
      updateProbe(
        { scrollHome: verdict(Math.abs(homeAfter - homeBefore) <= TOLERANCE_PT) },
        `home probe row y ${Math.round(homeBefore)} → ${Math.round(homeAfter)}`,
      );
      go("markets");
      await wait(NAV_MS);
      const marketsAfter = await markets.probeRowY();
      updateProbe(
        { scrollMarkets: verdict(Math.abs(marketsAfter - marketsBefore) <= TOLERANCE_PT) },
        `markets probe row y ${Math.round(marketsBefore)} → ${Math.round(marketsAfter)}`,
      );
      go("home");
      await wait(NAV_MS);
      router.push({ pathname: `${SPIKE_ROOT}/home/detail`, params: { row: ENTRY_ROW } });
      await wait(NAV_MS);
      updateProbe({}, `before entry: ${path.current}`);
      router.push(`${SPIKE_ROOT}/home/ticket`);
      await wait(NAV_MS);
      const entryPath = path.current;
      const hiddenInEntry = dockHidden.current;
      router.back();
      await wait(NAV_MS);
      updateProbe(
        { hideDuringEntry: verdict(entryPath.endsWith("/home/ticket") && hiddenInEntry && !dockHidden.current) },
        `entry at ${entryPath}: dock hidden ${hiddenInEntry}; back at ${path.current}: shown ${!dockHidden.current}`,
      );
      router.dismissAll();
      await wait(NAV_MS);
      home.scrollToEnd();
      await wait(SETTLE_MS);
      const lastBottom = await home.lastRowBottom();
      const dockTop = height - insets.bottom - DOCK.bottomOffset - DOCK.height;
      updateProbe(
        { contentInset: verdict(lastBottom <= dockTop), running: false },
        `last row bottom ${Math.round(lastBottom)} vs dock top ${Math.round(dockTop)}`,
      );
    };
    run().catch((error: unknown) => updateProbe({ running: false }, `probe error: ${String(error)}`));
  }, [probe, switchTab, height, insets.bottom]);

  return <ProbePanel />;
}

const ROWS: readonly [keyof ProbeState, string][] = [
  ["stack", "Stack kept per tab"],
  ["scrollHome", "Scroll kept (Home, after push/pop)"],
  ["scrollMarkets", "Scroll kept (Markets)"],
  ["hideDuringEntry", "Dock hides in transaction entry"],
  ["contentInset", "Content clears the dock"],
];

function ProbePanel() {
  const state = useProbe();
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  if (!state.running && state.notes.length === 0) return null;
  const tone = (v: Verdict) => (v === "pass" ? color.up : v === "fail" ? color.down : color.text3);
  const word: Record<Verdict, string> = { pass: "Pass", fail: "Fail", pending: "Pending" };
  return (
    <View
      pointerEvents="none"
      style={[styles.panel, { top: insets.top + SPACE.xs, backgroundColor: color.popover, borderColor: color.border }]}
    >
      <Text style={[TYPE.rowStrong, { color: color.ink }]}>Shell spike probe {state.running ? "· running" : ""}</Text>
      {ROWS.map(([key, label]) => (
        <Text key={key} style={[TYPE.meta, { color: tone(state[key] as Verdict) }]}>
          {word[state[key] as Verdict]} · {label}
        </Text>
      ))}
      {state.notes.map((note) => (
        <Text key={note} style={[TYPE.meta, { color: color.text3 }]}>
          {note}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: "absolute",
    left: SPACE.inset,
    right: SPACE.inset,
    borderRadius: RADIUS.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: SPACE.md,
    gap: SPACE.xxs,
  },
});
