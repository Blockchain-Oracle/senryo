/**
 * Earn as ownership (P5, D-325; Codex's ownership screen, Owarine's vault): the hero is what you own — your share value,
 * what you've earned and how much of the pool is yours — or, for a guest or before a first supply, what one pool share
 * is worth and what it did. A pool share's value over 1D / 7D / 30D (never deposits), the pool's state (total,
 * available, backing open calls against its cap, the next settlement), your pending requests as receipts you can take
 * back, the risk said plainly, and two pinned actions that open the keypad sheet — never a bare input. Requests are
 * one Face ID each, relayed (`@senryo/calls` `useEarnFlow`).
 */

import type { EarnRange } from "@senryo/api-client";
import {
  EARN_NOT_OPEN,
  EARN_RISK,
  earnHeld,
  earnWords,
  netEarned,
  poolPanel,
  seriesReturn,
  sharePriceE12,
  sharePriceText,
  shareSeries,
  sharesFor,
} from "@senryo/calls";
import { useEarnFlow } from "@senryo/calls/react";
import { signedUsd, usd } from "@senryo/core";
import { dollarId } from "@senryo/identity";
import { useServerSeconds } from "@senryo/live/react";
import { earnKeys, useMarketAccount } from "@senryo/query";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EntityMark } from "~/components/identity/EntityMark";
import { Button } from "~/components/kit/Button";
import { ProgressBar } from "~/components/kit/ProgressBar";
import { usePullRefresh } from "~/components/kit/PullRefresh";
import { Segmented } from "~/components/kit/Segmented";
import { ErrorState, LoadingState } from "~/components/kit/states";
import { fire } from "~/feedback/fire";
import { useAccount } from "~/lib/account/provider";
import { accountRequiredRoute } from "~/lib/constants/routes";
import { useNetwork } from "~/lib/network";
import { notify } from "~/lib/notify";
import { RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { EarnAmountSheet, type EarnSide } from "./EarnAmountSheet";
import { EarnChart } from "./EarnChart";

const RANGES = [
  { value: "1d", label: "1D", hours: 24 },
  { value: "7d", label: "7D", hours: 168 },
  { value: "30d", label: "30D", hours: 720 },
] as const;
const BPS_PER_PERCENT = 100;
const BPS = 10_000n;
const PERCENT_DECIMALS = 2;
const TRAY = SIZE.buttonHeight + SPACE.xl;
/** The backing meter turns amber past this share of its cap. */
const NEAR_CAP = 0.8;

export function EarnScreen() {
  // Pull down refreshes the page (D4: the owner's iPhone review — every screen with data refreshes).
  const refresh = usePullRefresh();
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  const account = useAccount();
  const network = useNetwork();
  const [range, setRange] = useState<EarnRange>("1d");
  const flow = useEarnFlow(account, range);
  const wallet = useMarketAccount(account.hint?.address);
  const now = useServerSeconds();
  const [sheet, setSheet] = useState<EarnSide | null>(null);
  const queries = useQueryClient();
  const view = "value" in flow.view ? flow.view.value : undefined;
  const words = view ? earnWords(view, now) : null;

  if (flow.view.status === "failed") {
    return (
      <ErrorState
        diagnosis={flow.view.error}
        retry={() => void queries.invalidateQueries({ queryKey: earnKeys.all })}
      />
    );
  }
  if (!view) return <LoadingState />;
  if (!words || !view.pool) {
    return (
      <View style={[styles.pad, styles.closed]}>
        <Text style={[TYPE.rowTitle, { color: color.ink }]}>{EARN_NOT_OPEN.title}</Text>
        <Text style={[TYPE.body, { color: color.inkMuted }]}>{EARN_NOT_OPEN.detail}</Text>
      </View>
    );
  }
  const pool = view.pool;
  const signedIn = account.hint !== undefined;
  const held = earnHeld(view);
  const owns = held > 0n;
  const net = netEarned(view);
  const share = pool.value > 0n ? Number((held * BPS) / pool.value) / BPS_PER_PERCENT : 0;
  const series = shareSeries(view, now);
  const span = RANGES.find((r) => r.value === range) ?? RANGES[0];
  const ret = seriesReturn(series, span.hours);
  const panel = poolPanel(pool, now);
  const balance = "value" in wallet ? wallet.value.balance : undefined;
  const busy = flow.pending !== null;
  const tone = (t: "up" | "down" | "muted") => (t === "up" ? color.up : t === "down" ? color.down : color.inkMuted);

  const confirm = async (side: EarnSide, amount: bigint, all: boolean) => {
    if (!signedIn) {
      router.push(accountRequiredRoute("earn"));
      return;
    }
    fire("press");
    try {
      const r =
        side === "supply"
          ? await flow.supply(amount)
          : await flow.withdraw(all ? (view.account?.shares ?? 0n) : sharesFor(amount, pool));
      if (r.state === "sent") {
        fire("filled", { cue: "open" });
        notify({ title: side === "supply" ? "Supply requested" : "Withdrawal requested", description: words.next });
      }
    } catch (error) {
      fire("fail", { sound: "error" });
      notify({ title: "Didn't go through", description: (error as Error).message, tone: "warning" });
    }
  };
  const takeBack = async (supply: boolean) => {
    try {
      await flow.cancel(supply);
    } catch (error) {
      notify({ title: "Couldn't take it back", description: (error as Error).message, tone: "warning" });
    }
  };

  return (
    <View style={[styles.fill, { backgroundColor: color.ground }]}>
      <ScrollView
        refreshControl={refresh}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + TRAY }]}
      >
        <View style={styles.block} accessibilityLiveRegion="polite">
          <Text style={[TYPE.caption, { color: color.inkMuted }]}>
            {owns ? "Your share value" : "Value of one pool share"}
          </Text>
          <View style={styles.markRow}>
            <EntityMark id={dollarId(network.chainId)} size={SIZE.markToken} decorative />
            <Text style={[TYPE.displayBalance, { color: color.ink }]}>
              {owns ? usd(held) : sharePriceText(sharePriceE12(pool))}
            </Text>
          </View>
          {owns ? (
            <Text style={[TYPE.body, { color: color.inkMuted }]}>
              {net !== null ? (
                <Text style={{ color: net > 0n ? color.up : net < 0n ? color.down : color.inkMuted }}>
                  {signedUsd(net)} earned ·{" "}
                </Text>
              ) : null}
              {share.toFixed(PERCENT_DECIMALS)}% of the pool
            </Text>
          ) : ret ? (
            <Text style={[TYPE.body, { color: color.inkMuted }]}>
              <Text style={{ color: tone(ret.tone) }}>{ret.change}</Text> · {ret.label}
            </Text>
          ) : null}
        </View>
        <View style={styles.block}>
          <Segmented
            options={RANGES.map((r) => ({ value: r.value, label: r.label }))}
            value={range}
            onChange={(v) => setRange(v as EarnRange)}
            label="Chart range"
          />
          <EarnChart series={series} tone={ret?.tone ?? "muted"} longRange={range !== "1d"} />
          {owns && ret ? (
            <Text style={[TYPE.caption, { color: color.inkMuted }]}>
              A share <Text style={{ color: tone(ret.tone) }}>{ret.change}</Text> · {ret.label}
            </Text>
          ) : null}
        </View>
        <View style={[styles.panel, { backgroundColor: color.card }]} accessibilityLabel="The pool">
          <Row label="Pool value" value={panel.total} />
          <Row label="Available for withdrawals" value={panel.available} />
          <Row label="Backing open calls" value={panel.backing} />
          <ProgressBar
            label="In use for open calls"
            value={panel.usedBps}
            max={Math.max(panel.capBps, 1)}
            valueText={panel.usedText}
            tone={panel.usedBps > panel.capBps * NEAR_CAP ? "near" : "calm"}
          />
          <Text style={[TYPE.caption, { color: color.inkMuted }]}>{panel.next}</Text>
        </View>
        {words.supplying || words.withdrawing ? (
          <View style={styles.block} accessibilityLabel="Your requests">
            <Text style={[TYPE.sectionTitle, { color: color.ink }]}>Your requests</Text>
            {words.supplying ? (
              <Receipt
                text={words.supplying}
                canTakeBack={!view.account?.supply.settled}
                busy={busy}
                onTakeBack={() => void takeBack(true)}
              />
            ) : null}
            {words.withdrawing ? (
              <Receipt
                text={words.withdrawing}
                canTakeBack={!view.account?.withdraw.settled}
                busy={busy}
                onTakeBack={() => void takeBack(false)}
              />
            ) : null}
          </View>
        ) : null}
        <Text style={[TYPE.caption, { color: color.inkMuted }]}>{words.risk}</Text>
      </ScrollView>
      <View style={[styles.tray, { backgroundColor: color.ground, paddingBottom: insets.bottom + SPACE.sm }]}>
        <Text style={[TYPE.caption, styles.center, { color: color.inkMuted }]}>{EARN_RISK}</Text>
        <View style={styles.actions}>
          <View style={styles.flex}>
            <Button label="Supply" loading={flow.pending === 1} disabled={busy} onPress={() => setSheet("supply")} />
          </View>
          <View style={styles.flex}>
            <Button
              label="Withdraw"
              variant="secondary"
              disabled={busy || (signedIn && (view.account?.value ?? 0n) === 0n)}
              onPress={() => setSheet("withdraw")}
            />
          </View>
        </View>
      </View>
      {sheet ? (
        <EarnAmountSheet
          side={sheet}
          max={signedIn ? (sheet === "supply" ? balance : (view.account?.value ?? 0n)) : undefined}
          pool={pool}
          next={words.next}
          signedIn={signedIn}
          onConfirm={(amount, all) => void confirm(sheet, amount, all)}
          onClose={() => setSheet(null)}
        />
      ) : null}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const { color } = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[TYPE.body, styles.flex, { color: color.inkMuted }]}>{label}</Text>
      <Text style={[TYPE.rowTitle, { color: color.ink }]}>{value}</Text>
    </View>
  );
}

function Receipt(p: { text: string; canTakeBack: boolean; busy: boolean; onTakeBack: () => void }) {
  const { color } = useTheme();
  return (
    <View style={[styles.receipt, { backgroundColor: color.card }]}>
      <Text style={[TYPE.body, styles.flex, { color: color.ink }]}>{p.text}</Text>
      {p.canTakeBack ? (
        <Button
          label="Take back"
          variant="secondary"
          size="sm"
          block={false}
          disabled={p.busy}
          onPress={p.onTakeBack}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1 },
  markRow: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  content: { padding: SIZE.gutter, gap: SPACE.xl },
  pad: { padding: SIZE.gutter },
  closed: { gap: SPACE.xs },
  block: { gap: SPACE.sm },
  center: { textAlign: "center" },
  panel: { borderRadius: RADIUS.lg, padding: SPACE.md, gap: SPACE.sm },
  row: { flexDirection: "row", alignItems: "center", minHeight: SIZE.touch - SPACE.sm },
  receipt: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    minHeight: SIZE.touch + SPACE.xl,
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.md,
  },
  tray: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    gap: SPACE.xs,
    paddingHorizontal: SIZE.gutter,
    paddingTop: SPACE.sm,
  },
  actions: { flexDirection: "row", gap: SPACE.sm },
});
