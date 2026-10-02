import type { Address } from "@senryo/account";
import { socialKeys, useRelations, useRelationToggle } from "@senryo/query";
import { useQueryClient } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Screen } from "~/components/kit/Screen";
import { Skeleton } from "~/components/kit/states";
import { UnderlineTabs } from "~/components/kit/UnderlineTabs";
import { QuietState } from "~/features/profile/QuietState";
import { RelationRow, UndoConfirm } from "~/features/profile/RelationRow";
import { useSessionGate } from "~/features/social/useSocialAccount";
import { fire } from "~/feedback/fire";
import { SIZE, SPACE } from "~/theme";

type Kind = "mutes" | "blocks";
const TABS = [
  { value: "mutes", label: "Muted" },
  { value: "blocks", label: "Blocked" },
] as const;
const LOADING_KEYS = ["a", "b", "c"] as const;
const EMPTY: Record<Kind, string> = { mutes: "Nobody muted", blocks: "Nobody blocked" };

/**
 * Blocked & muted (A10, F5, F-D7; defect 11): underline tabs Muted · Blocked, each a list of people — avatar, name,
 * @handle — with Unmute / Unblock, a one-line confirm, and the row leaves. The lists need an api session, which a
 * locked phone brings up only on the person's tap (browsing Settings never raises Face ID). Unblocking doesn't
 * restore follows.
 */
export default function BlockedMuted() {
  const [kind, setKind] = useState<Kind>("mutes");
  const gate = useSessionGate();
  return (
    <Screen>
      <Stack.Screen options={{ title: "Blocked & muted" }} />
      <UnderlineTabs options={TABS} value={kind} onChange={setKind} label="Blocked and muted" />
      {gate.status === "guest" ? (
        <QuietState line="No account on this phone" />
      ) : gate.status === "locked" || gate.status === "failed" ? (
        <QuietState
          line={gate.status === "locked" ? "Unlock to see this list" : "Couldn’t confirm it’s you"}
          action={{ label: gate.status === "locked" ? "Unlock" : "Try again", variant: "primary", onPress: gate.open }}
        />
      ) : (
        <List key={kind} kind={kind} session={gate.status === "ready" ? gate.session : undefined} />
      )}
    </Screen>
  );
}

function List({ kind, session }: { kind: Kind; session: ReturnType<typeof useSessionGate>["session"] }) {
  const list = useRelations(kind, session);
  const queries = useQueryClient();
  const toggle = useRelationToggle(kind, session);
  const [confirm, setConfirm] = useState<{ address: Address; name: string }>();
  const [busy, setBusy] = useState<string>();
  const [failed, setFailed] = useState<string>();

  const undo = (address: Address) => {
    setBusy(address);
    setFailed(undefined);
    toggle.mutate(
      { address, on: false },
      {
        onSuccess: () => fire("confirm"),
        onError: () => {
          fire("fail");
          setFailed(address);
        },
        onSettled: () => setBusy(undefined),
      },
    );
  };

  if (!session || list.status === "unknown") {
    return (
      <View style={styles.list} accessibilityRole="progressbar" accessibilityLabel="Loading">
        {LOADING_KEYS.map((key) => (
          <Skeleton key={key} height={SIZE.rowMinHeight} />
        ))}
      </View>
    );
  }
  if (list.status === "failed") {
    return (
      <QuietState
        line="Couldn’t load"
        action={{
          label: "Retry",
          onPress: () => void queries.invalidateQueries({ queryKey: socialKeys.relations(kind) }),
        }}
      />
    );
  }
  const items = list.value;
  if (items.length === 0) return <QuietState line={EMPTY[kind]} />;
  return (
    <View style={styles.list}>
      {items.map((person, index) => (
        <RelationRow
          key={person.address}
          person={person}
          index={index}
          action={kind === "mutes" ? "Unmute" : "Unblock"}
          busy={busy === person.address}
          failed={failed === person.address}
          onPress={(name) => setConfirm({ address: person.address, name })}
        />
      ))}
      {confirm ? (
        <UndoConfirm
          kind={kind}
          name={confirm.name}
          onConfirm={() => undo(confirm.address)}
          onClose={() => setConfirm(undefined)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: SPACE.xs },
});
