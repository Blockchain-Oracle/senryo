/**
 * The one fact list on the phone (Q0, D-346; the web's `FactList`): label on the left, value on the right in tabular
 * figures, one 44 pt line each. Facts are typed — a money fact is masked with balances hidden by its type, not by each
 * caller — and a list at rest holds at most four (more belongs behind a disclosure or in a details view: pass
 * `atRest={false}` there). In development a fact drawn twice on one screen is reported (`fact-inspector`).
 */
import { StyleSheet, Text, View } from "react-native";
import { useFactInspector } from "~/lib/dev/fact-inspector";
import { masked, useHideBalances } from "~/lib/hide-balances";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";

export interface Fact {
  label: string;
  /** Formatted already; null reads "—". */
  value: string | null;
  money?: boolean;
}

export const MAX_FACTS_AT_REST = 4;

export function FactList({ facts, atRest = true }: { facts: readonly Fact[]; atRest?: boolean }) {
  const { color } = useTheme();
  const [hidden] = useHideBalances();
  useFactInspector(facts, atRest ? MAX_FACTS_AT_REST : null);
  return (
    <View>
      {facts.map((f) => (
        <View key={f.label} style={styles.line}>
          <Text style={[TYPE.row, styles.label, { color: color.inkMuted }]}>{f.label}</Text>
          <Text style={[TYPE.rowAmount, { color: color.ink }]}>
            {f.value === null ? "—" : f.money ? masked(f.value, hidden) : f.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: "row", alignItems: "center", gap: SPACE.md, minHeight: SIZE.touch },
  label: { flex: 1 },
});
