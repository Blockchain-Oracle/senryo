import type { StatusResponse } from "@senryo/api-client";
import { type ChainId, FEED_STATES, networkOf } from "@senryo/config";
import { ids } from "@senryo/identity";
import { useStatus } from "@senryo/query";
import { useQueryClient } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { EntityMark } from "~/components/identity/EntityMark";
import { ListRow } from "~/components/kit/ListRow";
import { Screen } from "~/components/kit/Screen";
import { Panel } from "~/components/kit/Surface";
import { ReadingView } from "~/components/kit/states";
import { SectionHeading } from "~/features/profile/SectionHeading";
import { SPACE, TYPE, useTheme } from "~/theme";

/**
 * Status (R2.10): what the api reports about itself, read from `/v1/status` every 15 s — prices overall and per source
 * (how many markets are live, delayed, closed…), each network's connection, how far history trails the chain, and
 * deposits. Only what the api reports: nothing here is inferred on the phone.
 */
type Health = StatusResponse["prices"]["state"];

const MARK = 28;
const SOURCE_NAMES: Readonly<Record<string, { name: string; id?: string }>> = {
  pyth: { name: "Pyth", id: ids.provider("pyth") },
  redstone: { name: "RedStone" },
  basket: { name: "Baskets", id: ids.market("MAJORS") },
};
const WORDS: Readonly<Record<Health, string>> = {
  ok: "Working",
  degraded: "Partly delayed",
  down: "Down",
  unknown: "Unknown",
};

/** "7 live · 5 closed": the non-zero states in their usual order. */
function countsLine(counts: Readonly<Record<string, number>>): string {
  const parts = FEED_STATES.flatMap((s) => (counts[s] ? [`${counts[s]} ${s}`] : []));
  return parts.length > 0 ? parts.join(" · ") : "No markets";
}

/** "Latest block 2 s old · history 3 blocks behind". */
function chainLine(c: StatusResponse["chains"][number]): string | undefined {
  const parts = [
    c.headAgeSec === null ? null : `Latest block ${c.headAgeSec} s old`,
    c.indexerLagBlocks === null ? null : `history ${c.indexerLagBlocks} blocks behind`,
  ].filter((p): p is string => p !== null);
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

function StateWord({ state }: { state: Health }) {
  const { color } = useTheme();
  const tint =
    state === "down" ? color.destructive : state === "degraded" ? color.warn : state === "ok" ? color.ink : color.text3;
  return <Text style={[TYPE.rowStrong, { color: tint }]}>{WORDS[state]}</Text>;
}

function Report({ s }: { s: StatusResponse }) {
  const { color } = useTheme();
  return (
    <>
      <View style={styles.section}>
        <SectionHeading>Prices</SectionHeading>
        <Panel>
          <ListRow
            title="All markets"
            detail={s.prices.detail ?? undefined}
            trailing={<StateWord state={s.prices.state} />}
          />
          {s.priceSources.map((p) => {
            const known = SOURCE_NAMES[p.source];
            return (
              <ListRow
                key={p.source}
                title={known?.name ?? p.source}
                detail={countsLine(p.counts)}
                leading={known?.id ? <EntityMark id={known.id} size={MARK} decorative /> : undefined}
                trailing={<StateWord state={p.state} />}
              />
            );
          })}
        </Panel>
      </View>
      <View style={styles.section}>
        <SectionHeading>Networks</SectionHeading>
        <Panel>
          {s.chains.map((c) => (
            <ListRow
              key={c.chainId}
              title={`${networkOf(c.chainId as ChainId).name} · ${networkOf(c.chainId as ChainId).modeLabel}`}
              detail={chainLine(c) ?? c.rpc.detail ?? undefined}
              trailing={<StateWord state={c.rpc.state} />}
            />
          ))}
          <ListRow
            title="Deposits"
            detail={s.aurora.detail ?? undefined}
            trailing={<StateWord state={s.aurora.state} />}
          />
        </Panel>
      </View>
      <Text style={[TYPE.meta, styles.stamp, { color: color.text3 }]}>
        Checked {new Date(s.at).toLocaleTimeString()} · refreshes every 15 s
      </Text>
    </>
  );
}

export function StatusScreen() {
  const status = useStatus();
  const queries = useQueryClient();
  return (
    <Screen>
      <Stack.Screen options={{ title: "Status" }} />
      <ReadingView reading={status} retry={() => void queries.invalidateQueries({ queryKey: ["status"] })}>
        {(s) => <Report s={s} />}
      </ReadingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: SPACE.sm, marginBottom: SPACE.lg },
  stamp: { textAlign: "center", marginTop: SPACE.sm },
});
