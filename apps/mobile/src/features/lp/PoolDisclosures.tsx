/**
 * The pool's pre-approval disclosures (flow book D "Disclosures"; Part F8 keeps them, as compact rows): one row each
 * with an ⓘ that opens its one-sentence explanation. No paragraphs on the page.
 */
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Info } from "~/components/kit/symbols";
import { ChildSheet } from "~/components/sheet/ChildSheet";
import { fire } from "~/feedback/fire";
import { CONTROL_FONT_SCALE, SIZE, SPACE, TYPE, useTheme } from "~/theme";

export const POOL_DISCLOSURES = [
  { title: "Capital at risk", body: "The pool pays traders' profits; its value can fall." },
  { title: "24 h to redeem", body: "Shares wait 24 hours in escrow before a claim." },
  { title: "Claims need open markets", body: "Claims work only while every market is open." },
  { title: "Value moves until claim", body: "You receive the value at claim time, not at request." },
  { title: "Entry and exit prices differ", body: "Deposits count open trader losses; claims don't." },
  { title: "APR is past, not promised", body: "Last 7 days of fees and trader results." },
] as const;

export type PoolDisclosure = (typeof POOL_DISCLOSURES)[number];

export function PoolDisclosures({ onInfo }: { onInfo: (d: PoolDisclosure) => void }) {
  const { color } = useTheme();
  return (
    <View>
      {POOL_DISCLOSURES.map((d) => (
        <Pressable
          key={d.title}
          onPress={() => {
            fire("tick");
            onInfo(d);
          }}
          accessibilityRole="button"
          accessibilityLabel={`${d.title}. ${d.body}`}
          style={({ pressed }) => [styles.row, { opacity: pressed ? PRESSED : 1 }]}
        >
          <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.row, styles.flex, { color: color.text2 }]}>
            {d.title}
          </Text>
          <Info size={SIZE.iconSm} strokeWidth={SIZE.iconStroke} color={color.text3} />
        </Pressable>
      ))}
    </View>
  );
}

/** A disclosure's explanation (or the APR's source), rendered at the screen's root so it covers the page. */
export function InfoSheet({
  info,
  onClose,
}: {
  info: { title: string; body: string } | undefined;
  onClose: () => void;
}) {
  const { color } = useTheme();
  return (
    <ChildSheet open={info !== undefined} onClose={onClose} title={info?.title ?? ""}>
      <Text style={[TYPE.body, { color: color.text2 }]}>{info?.body}</Text>
    </ChildSheet>
  );
}

const PRESSED = 0.6;

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: SPACE.sm, minHeight: SIZE.touch },
  flex: { flex: 1 },
});
