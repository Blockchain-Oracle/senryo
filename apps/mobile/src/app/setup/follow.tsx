import type { Address } from "@senryo/account";
import { useFollowRecommendations, useFollowToggle } from "@senryo/query";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { Skeleton } from "~/components/kit/states";
import { FollowRow } from "~/features/setup/FollowRow";
import { SetupScreen } from "~/features/setup/SetupScreen";
import { useSetupNav } from "~/features/setup/useSetupNav";
import { fire } from "~/feedback/fire";
import { useSessionRunner } from "~/lib/account/use-session-runner";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";

/** Rows shown before "Show more" (F06 shows five). */
const FIRST_PAGE = 5;
const LOADING_KEYS = ["a", "b", "c"] as const;

/**
 * Setup step 2 — follow top traders (C11; Fomo F06, adapted per direction §9): the network's 30-day ranked traders,
 * **none preselected**, each with why it is suggested. Following is not copy trading and moves no money; it fills the
 * Friends feed and leaderboard. Skip, or Continue with none, is always possible.
 */
export default function FollowStep() {
  const { color } = useTheme();
  const { next, back, address } = useSetupNav("follow");
  const session = useSessionRunner();
  const suggestions = useFollowRecommendations(session);
  const follow = useFollowToggle(address, session);
  const [picked, setPicked] = useState<ReadonlySet<Address>>(() => new Set());
  const [all, setAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const toggle = (who: Address) =>
    setPicked((prev) => {
      const out = new Set(prev);
      if (out.has(who)) out.delete(who);
      else out.add(who);
      return out;
    });

  const done = async () => {
    setFailed(false);
    if (picked.size === 0) return next();
    setBusy(true);
    try {
      for (const other of picked) await follow.mutateAsync({ other, follow: true });
      fire("confirm");
      next();
    } catch {
      fire("fail");
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const items = suggestions.status === "fresh" || suggestions.status === "stale" ? suggestions.value.items : undefined;
  const shown = items ? (all ? items : items.slice(0, FIRST_PAGE)) : [];
  return (
    <SetupScreen
      title="Follow top traders"
      body="See what the best performers of the last 30 days open and close. Following never copies a trade."
      onBack={back}
      onSkip={next}
      footer={
        <>
          {failed ? (
            <Text accessibilityRole="alert" style={[TYPE.rowDetail, styles.center, { color: color.down }]}>
              Couldn’t follow everyone. Try again, or skip for now.
            </Text>
          ) : null}
          <Button
            label={picked.size > 0 ? `Follow ${picked.size} and continue` : "Continue"}
            loading={busy}
            onPress={() => void done()}
          />
        </>
      }
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
        {suggestions.status === "unknown"
          ? LOADING_KEYS.map((key) => <Skeleton key={key} height={SIZE.rowMinHeight + SPACE.sm} />)
          : null}
        {suggestions.status === "failed" ? (
          <Text style={[TYPE.body, styles.center, { color: color.text3 }]}>
            Couldn’t load suggestions. You can follow people later from Social.
          </Text>
        ) : null}
        {items && items.length === 0 ? (
          <Text style={[TYPE.body, styles.center, { color: color.text3 }]}>
            Nobody is ranked on this network yet. The list fills as people trade.
          </Text>
        ) : null}
        {shown.map((t) => (
          <FollowRow key={t.address} trader={t} selected={picked.has(t.address)} onToggle={() => toggle(t.address)} />
        ))}
        {items && items.length > FIRST_PAGE && !all ? (
          <View style={styles.more}>
            <Button label="Show more" variant="secondary" size="sm" block={false} onPress={() => setAll(true)} />
          </View>
        ) : null}
      </ScrollView>
    </SetupScreen>
  );
}

const styles = StyleSheet.create({
  list: { gap: SPACE.md, paddingBottom: SPACE.lg },
  center: { textAlign: "center" },
  more: { alignItems: "center" },
});
