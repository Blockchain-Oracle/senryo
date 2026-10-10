/**
 * Earn (S7.6, D-287; the web's `EarnScreen`): your share of the pool that takes the other side, what the pool holds
 * and how much of it is ready, when the next hour settles, what you've asked for (take it back until then), and Supply
 * / Withdraw by an exact amount — one Face ID each, relayed (`@senryo/calls` `useEarnFlow`). Risk in words.
 */
import { EARN_NOT_OPEN, earnWords, hourLines, sharesFor } from "@senryo/calls";
import { checkEarnAmount, useEarnFlow } from "@senryo/calls/react";
import { dollarId, ids } from "@senryo/identity";
import { useServerSeconds } from "@senryo/live/react";
import { earnKeys, useMarketAccount } from "@senryo/query";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { EntityMark } from "~/components/identity/EntityMark";
import { Button } from "~/components/kit/Button";
import { Segmented } from "~/components/kit/Segmented";
import { ErrorState, LoadingState } from "~/components/kit/states";
import { fire } from "~/feedback/fire";
import { useAccount } from "~/lib/account/provider";
import { accountRequiredRoute } from "~/lib/constants/routes";
import { useNetwork } from "~/lib/network";
import { notify } from "~/lib/notify";
import { RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";

const SIDES = [
  { value: "supply", label: "Supply" },
  { value: "withdraw", label: "Withdraw" },
] as const;
type Side = (typeof SIDES)[number]["value"];
/** Dollars are 6-decimal on both networks. */
const USD_UNIT = 1_000_000;
const CENTS = 2;

export function EarnScreen() {
  const { color } = useTheme();
  const account = useAccount();
  const network = useNetwork();
  const flow = useEarnFlow(account);
  const wallet = useMarketAccount(account.hint?.address);
  const now = useServerSeconds();
  const [side, setSide] = useState<Side>("supply");
  const [amount, setAmount] = useState("");
  const view = "value" in flow.view ? flow.view.value : undefined;
  const words = view ? earnWords(view, now) : null;
  const queries = useQueryClient();

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
  const balance = "value" in wallet ? wallet.value.balance : undefined;
  const max = side === "supply" ? balance : view.account?.value;
  const check = checkEarnAmount(
    amount,
    max,
    side === "supply"
      ? "Reading your balance…"
      : view.account
        ? "Reading your position…"
        : "Nothing supplied to withdraw",
  );
  const busy = flow.pending !== null;

  const submit = async () => {
    if (!account.hint) {
      router.push(accountRequiredRoute("earn"));
      return;
    }
    if (!check.ok || check.value === undefined) return;
    fire("press");
    try {
      const all = side === "withdraw" && check.value === view.account?.value;
      const r =
        side === "supply"
          ? await flow.supply(check.value)
          : await flow.withdraw(all ? (view.account?.shares ?? 0n) : sharesFor(check.value, pool));
      if (r.state === "sent") {
        fire("filled", { cue: "open" });
        setAmount("");
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
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.block}>
        <View style={styles.markRow}>
          <EntityMark id={dollarId(network.chainId)} size={SIZE.markToken} decorative />
          <Text style={[TYPE.displayBalance, { color: color.ink }]}>{words.hero}</Text>
        </View>
        <Text style={[TYPE.body, { color: color.inkMuted }]}>{words.heroDetail}</Text>
      </View>
      <View style={styles.block}>
        <View style={styles.markRow}>
          <EntityMark id={ids.brand("senryo")} size={SIZE.markInline} variant="symbol" decorative />
          <Text style={[TYPE.rowTitle, { color: color.ink }]}>{words.pool}</Text>
        </View>
        <Text style={[TYPE.caption, { color: color.inkMuted }]}>{words.ready}</Text>
        <Text style={[TYPE.caption, { color: color.inkMuted }]}>{words.next}</Text>
      </View>
      {view.hours.length > 1 ? (
        <View style={styles.block}>
          <Text style={[TYPE.sectionTitle, { color: color.ink }]}>Hour by hour</Text>
          {hourLines(view).map((h) => (
            <View key={h.key} style={styles.hour}>
              <Text style={[TYPE.caption, { color: color.inkMuted }]}>{h.time}</Text>
              <Text
                style={[
                  TYPE.caption,
                  { color: h.tone === "up" ? color.up : h.tone === "down" ? color.down : color.inkMuted },
                ]}
              >
                {h.change}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      {words.supplying ? (
        <View style={styles.pending}>
          <Text style={[TYPE.body, styles.flex, { color: color.ink }]}>{words.supplying}</Text>
          {view.account?.supply.settled ? null : (
            <Button
              label="Take back"
              variant="secondary"
              size="sm"
              block={false}
              disabled={busy}
              onPress={() => void takeBack(true)}
            />
          )}
        </View>
      ) : null}
      {words.withdrawing ? (
        <View style={styles.pending}>
          <Text style={[TYPE.body, styles.flex, { color: color.ink }]}>{words.withdrawing}</Text>
          {view.account?.withdraw.settled ? null : (
            <Button
              label="Take back"
              variant="secondary"
              size="sm"
              block={false}
              disabled={busy}
              onPress={() => void takeBack(false)}
            />
          )}
        </View>
      ) : null}
      <View style={styles.block}>
        <Segmented
          options={SIDES}
          value={side}
          onChange={(s) => {
            setSide(s);
            setAmount("");
          }}
          label="Supply or withdraw"
        />
        <View style={[styles.field, { backgroundColor: color.muted }]}>
          <Text style={[TYPE.rowTitle, { color: color.inkMuted }]}>$</Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={color.inkMuted}
            accessibilityLabel={side === "supply" ? "Dollars to supply" : "Dollars to withdraw"}
            style={[TYPE.rowTitle, styles.flex, { color: color.ink }]}
          />
          {max !== undefined && max > 0n ? (
            <Button
              label={side === "supply" ? "Max" : "All"}
              variant="ghost"
              size="sm"
              block={false}
              onPress={() => setAmount((Number(max) / USD_UNIT).toFixed(CENTS))}
            />
          ) : null}
        </View>
        {check.problem ? <Text style={[TYPE.caption, { color: color.destructive }]}>{check.problem}</Text> : null}
        {!check.problem && check.hint && account.hint ? (
          <Text style={[TYPE.caption, { color: color.text3 }]}>{check.hint}</Text>
        ) : null}
        <Button
          label={
            !account.hint
              ? "Sign in to earn"
              : side === "supply"
                ? "Supply at the next hour"
                : "Withdraw at the next hour"
          }
          loading={busy}
          disabled={Boolean(account.hint) && !check.ok}
          onPress={() => void submit()}
        />
      </View>
      <Text style={[TYPE.caption, { color: color.inkMuted }]}>{words.risk}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  markRow: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  content: { padding: SIZE.gutter, gap: SPACE.xl },
  pad: { padding: SIZE.gutter },
  closed: { gap: SPACE.xs },
  block: { gap: SPACE.sm },
  flex: { flex: 1 },
  hour: { flexDirection: "row", justifyContent: "space-between", minHeight: SIZE.touch - SPACE.md },
  pending: { flexDirection: "row", alignItems: "center", gap: SPACE.md, minHeight: SIZE.touch },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    minHeight: SIZE.touch + SPACE.sm,
    paddingHorizontal: SPACE.lg,
    borderRadius: RADIUS.pill,
  },
});
