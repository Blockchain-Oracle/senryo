import type { Address } from "@senryo/account";
import { socialKeys, useFollowRecommendations, useFollowToggle, useQueryEnv } from "@senryo/query";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
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
 * Setup step 2 — follow top traders (A2, F3; Fomo F06): the network's 30-day ranked traders — rank, avatar, name over
 * @handle, 30-day PnL, a check when picked — **none preselected**. Following is not copy trading and moves no money.
 * Skip, or Continue with none, is always possible. Loading → skeleton rows; none ranked → "No ranked traders yet";
 * failed → "Couldn't load · Skip".
 */
export default function FollowStep() {
  const { address } = useSetupNav("follow");
  const { chainId } = useQueryEnv();
  return <AccountFollow key={`${chainId}:${address}`} />;
}
function AccountFollow() {
  const { color } = useTheme();
  const { next, back, address } = useSetupNav("follow");
  const session = useSessionRunner();
  const suggestions = useFollowRecommendations(session);
  const { chainId } = useQueryEnv();
  const client = useQueryClient();
  const [retrying, setRetrying] = useState(false);
  const retry = async () => {
    if (retrying) return;
    setRetrying(true);
    try {
      await client.refetchQueries({ queryKey: socialKeys.recommendations(chainId), exact: true });
    } finally {
      if (alive.current) setRetrying(false);
    }
  };
  const follow = useFollowToggle(address, session);
  const [picked, setPicked] = useState<ReadonlySet<Address>>(() => new Set());
  const [all, setAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const running = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const toggle = (who: Address) =>
    setPicked((prev) => {
      const out = new Set(prev);
      if (out.has(who)) out.delete(who);
      else out.add(who);
      return out;
    });

  const done = async () => {
    if (running.current) return;
    setFailed(false);
    if (picked.size === 0) return next();
    running.current = true;
    setBusy(true);
    try {
      for (const other of picked) {
        if (!alive.current) return;
        await follow.mutateAsync({ other, follow: true });
      }
      if (!alive.current) return;
      fire("confirm");
      next();
    } catch {
      if (!alive.current) return;
      fire("fail");
      setFailed(true);
    } finally {
      running.current = false;
      if (alive.current) setBusy(false);
    }
  };

  const items = suggestions.status === "fresh" || suggestions.status === "stale" ? suggestions.value.items : undefined;
  const shown = items ? (all ? items : items.slice(0, FIRST_PAGE)) : [];
  return (
    <SetupScreen
      step="follow"
      title="Follow top traders"
      body="Highest 30-day PnL"
      onBack={busy ? undefined : back}
      onSkip={busy ? undefined : next}
      footer={
        <>
          {failed ? (
            <Text accessibilityRole="alert" style={[TYPE.rowDetail, styles.center, { color: color.down }]}>
              Couldn’t follow everyone · try again
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
      <View style={styles.list}>
        {suggestions.status === "unknown"
          ? LOADING_KEYS.map((key) => <Skeleton key={key} height={SIZE.rowMinHeight + SPACE.sm} />)
          : null}
        {suggestions.status === "failed" ? (
          <View style={styles.list}>
            <Text accessibilityRole="alert" style={[TYPE.body, styles.center, { color: color.text2 }]}>
              Couldn’t load traders. Try again or continue without following anyone.
            </Text>
            <Button label="Try again" variant="outline" loading={retrying} onPress={() => void retry()} />
          </View>
        ) : null}
        {items && items.length === 0 ? (
          <Text style={[TYPE.body, styles.center, { color: color.text3 }]}>No ranked traders yet</Text>
        ) : null}
        {shown.map((t) => (
          <FollowRow key={t.address} trader={t} selected={picked.has(t.address)} onToggle={() => toggle(t.address)} />
        ))}
        {items && items.length > FIRST_PAGE && !all ? (
          <View style={styles.more}>
            <Button label="Show more" variant="secondary" size="sm" block={false} onPress={() => setAll(true)} />
          </View>
        ) : null}
      </View>
    </SetupScreen>
  );
}

const styles = StyleSheet.create({
  list: { gap: SPACE.md, paddingBottom: SPACE.lg },
  center: { textAlign: "center" },
  more: { alignItems: "center" },
});
