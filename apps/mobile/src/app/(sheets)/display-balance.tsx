import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { AmountHero } from "~/components/kit/AmountHero";
import { Info } from "~/components/kit/symbols";
import { SheetRoute } from "~/components/sheet/SheetRoute";
import { PRIVACY_MARKS, PrivacyMark, usePrivacyMark } from "~/features/home/PrivacyMark";
import { useBalanceSheet } from "~/features/portfolio/useBalanceSheet";
import { fire } from "~/feedback/fire";
import { useAccount } from "~/lib/account/provider";
import { useHideBalances } from "~/lib/hide-balances";
import { usd } from "~/lib/money";
import { RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";

/** U04-S02–S04: live preview, persistent toggle and an expanding illustration selector. */
export default function DisplayBalance() {
  const { color } = useTheme();
  const address = useAccount().hint?.address;
  const [hidden, setHidden] = useHideBalances();
  const [mark, setMark] = usePrivacyMark();
  const sheet = useBalanceSheet();
  const readable = sheet.status === "ready" && sheet.rows.some((row) => row.valueUsd6 !== undefined);
  return (
    <SheetRoute title="Display Balance">
      <View
        accessible
        accessibilityLabel={
          hidden ? "Balance hidden" : readable ? `Balance ${usd(sheet.totalUsd6)}` : "Balance unavailable"
        }
        style={[styles.preview, { borderColor: color.text2 }]}
      >
        {hidden ? (
          <PrivacyMark name={mark} />
        ) : readable ? (
          <AmountHero text={usd(sheet.totalUsd6)} partial={sheet.partial} decimalRole={TYPE.numMd} />
        ) : (
          <Text style={[TYPE.row, { color: color.text3 }]}>
            {!address
              ? "Sign in to see your balance"
              : sheet.status === "loading"
                ? "Loading balance…"
                : "Balance unavailable"}
          </Text>
        )}
      </View>
      <View style={[styles.group, { backgroundColor: color.card }]}>
        <View style={styles.toggle}>
          <Text style={[TYPE.rowTitle, { color: color.ink }]}>Privacy mode</Text>
          <Switch
            value={hidden}
            onValueChange={(value) => {
              fire("tick");
              setHidden(value);
            }}
            trackColor={{ true: color.action, false: color.input }}
            accessibilityLabel="Hide balances"
          />
        </View>
        {hidden ? (
          <View
            style={[styles.choices, { borderColor: color.border }]}
            accessibilityRole="radiogroup"
            accessibilityLabel="Concealment illustration"
          >
            {PRIVACY_MARKS.map((name) => (
              <Pressable
                key={name}
                onPress={() => {
                  fire("tick");
                  setMark(name);
                }}
                accessibilityRole="radio"
                accessibilityLabel={name === "koban" ? "Gold coin" : name === "kitsune" ? "Kitsune" : "Senryo seal"}
                accessibilityState={{ checked: mark === name }}
                style={[
                  styles.choice,
                  {
                    backgroundColor: mark === name ? color.input : color.transparent,
                    borderColor: mark === name ? color.text3 : color.transparent,
                  },
                ]}
              >
                <PrivacyMark name={name} size={34} />
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
      <View style={styles.hint}>
        <Info size={SIZE.iconSm} color={color.ink} />
        <Text style={[TYPE.rowDetail, styles.hintText, { color: color.text3 }]}>
          You can also tap your balance to hide it.
        </Text>
      </View>
    </SheetRoute>
  );
}

const styles = StyleSheet.create({
  preview: {
    minHeight: 104,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: RADIUS.md,
    justifyContent: "center",
    alignItems: "center",
    padding: SPACE.md,
  },
  group: { borderRadius: RADIUS.md, padding: SPACE.md, gap: SPACE.sm },
  toggle: {
    minHeight: SIZE.touch,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: SPACE.md,
  },
  choices: { flexDirection: "row", borderWidth: 1, borderRadius: RADIUS.md, padding: SPACE.xs, gap: SPACE.sm },
  choice: {
    flex: 1,
    minHeight: SIZE.touch,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: RADIUS.sm,
  },
  hint: { flexDirection: "row", alignItems: "center", gap: SPACE.xs, paddingVertical: SPACE.sm },
  hintText: { flex: 1 },
});
