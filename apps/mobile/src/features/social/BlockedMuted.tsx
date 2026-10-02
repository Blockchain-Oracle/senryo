/**
 * Settings → Blocked & muted (F5, F-D7; defect 11): underline tabs Muted · Blocked, a row per account — avatar, name,
 * @handle (shown while they are listed on this network) — with Unmute / Unblock. The button opens the actions sheet
 * straight on its one-line confirmation; once done the list refetches and the row leaves. Unblocking doesn't bring
 * removed follows back. Reading these lists needs a session; a locked app asks only when the person taps Unlock.
 */
import { type SessionRunner, socialKeys, useRelations } from "@senryo/query";
import { useQueryClient } from "@tanstack/react-query";
import { type Href, router } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { ErrorState } from "~/components/kit/states";
import { UnderlineTabs } from "~/components/kit/UnderlineTabs";
import { ROUTES, relationActionRoute } from "~/lib/constants/routes";
import { SPACE } from "~/theme";
import { handleOf } from "./format";
import { PersonRow } from "./PersonRow";
import { PeopleSkeleton, QuietLine } from "./Quiet";
import { useSessionGate } from "./useSocialAccount";

const TABS = [
  { value: "mutes", label: "Muted" },
  { value: "blocks", label: "Blocked" },
] as const;
type Kind = (typeof TABS)[number]["value"];

const EMPTY: Record<Kind, string> = { mutes: "Nobody muted", blocks: "Nobody blocked" };
const UNDO: Record<Kind, { label: string; act: "unmute" | "unblock" }> = {
  mutes: { label: "Unmute", act: "unmute" },
  blocks: { label: "Unblock", act: "unblock" },
};

export function BlockedMuted() {
  const [kind, setKind] = useState<Kind>("mutes");
  const gate = useSessionGate();
  return (
    <View style={styles.page}>
      <UnderlineTabs options={TABS} value={kind} onChange={setKind} label="Blocked and muted" />
      {gate.status === "guest" ? (
        <QuietLine
          text="No account yet"
          action={{ label: "Create account", onPress: () => router.push(ROUTES.accountRequired) }}
        />
      ) : gate.status === "locked" ? (
        <QuietLine text="Unlock to see" action={{ label: "Unlock", onPress: gate.open }} />
      ) : gate.status === "failed" ? (
        <QuietLine text="Couldn’t confirm it’s you" action={{ label: "Try again", onPress: gate.open }} />
      ) : gate.status === "pending" || !gate.session ? (
        <PeopleSkeleton />
      ) : (
        <RelationList key={kind} kind={kind} session={gate.session} />
      )}
    </View>
  );
}

function RelationList({ kind, session }: { kind: Kind; session: SessionRunner }) {
  const client = useQueryClient();
  const reading = useRelations(kind, session);
  if (reading.status === "unknown") return <PeopleSkeleton />;
  if (reading.status === "failed") {
    return (
      <ErrorState
        diagnosis={reading.error}
        retry={() => void client.invalidateQueries({ queryKey: socialKeys.relations(kind) })}
      />
    );
  }
  if (reading.value.length === 0) return <QuietLine text={EMPTY[kind]} />;
  const undo = UNDO[kind];
  return (
    <View>
      {reading.value.map((entry) => (
        <PersonRow
          key={entry.address}
          person={entry}
          trailing={
            <Button
              label={undo.label}
              variant="secondary"
              size="sm"
              block={false}
              accessibilityHint={`${undo.label} ${handleOf(entry)}`}
              onPress={() => router.push(relationActionRoute(entry.address, undo.act) as Href)}
              style={styles.button}
            />
          }
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: SPACE.lg },
  button: { alignSelf: "center" },
});
