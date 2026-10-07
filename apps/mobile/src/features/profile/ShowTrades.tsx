/**
 * "Show my trades" per network (A2 step 1, decision 11; f-social "Visibility per mode"): one row with a Practice chip
 * and a Mainnet chip — chips, never switches (D-196) — and an ⓘ that says the one thing people must know: the same
 * address is on both networks and onchain activity is public. A chip on lists the profile there and shares its trades
 * (trades are only shared from a listed profile); off turns both off. Defaults: Practice on, Mainnet off.
 */
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { Check } from "~/components/kit/symbols";
import { usePressScale } from "~/components/kit/usePressScale";
import { InfoTip } from "~/features/setup/InfoTip";
import { fire } from "~/feedback/fire";
import { BUTTON, CONTROL_FONT_SCALE, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import type { Visibility } from "./VisibilitySettings";

export const SHARED_ADDRESS = {
  title: "One address, two networks",
  body: "Same address on Practice and Mainnet. Onchain activity is public. Each chip lists your profile and shares your trades on that network only.",
} as const;

/** First-save defaults (`packages/api-client/src/social.ts`): Practice listed and sharing, Mainnet off. */
export const DEFAULT_VISIBILITY: Visibility = {
  listedPractice: true,
  publicTradesPractice: true,
  listedMainnet: false,
  publicTradesMainnet: false,
};

export function ShowTrades({ value, onChange }: { value: Visibility; onChange: (next: Visibility) => void }) {
  const { color } = useTheme();
  const practice = value.listedPractice && value.publicTradesPractice;
  const mainnet = value.listedMainnet && value.publicTradesMainnet;
  return (
    <View style={styles.row}>
      <View style={styles.title}>
        <Text style={[TYPE.rowTitle, { color: color.ink }]}>Show my trades</Text>
        <InfoTip title={SHARED_ADDRESS.title} body={SHARED_ADDRESS.body} />
      </View>
      <View style={styles.chips}>
        <ModeChip
          label="Practice"
          on={practice}
          tone={color.practice}
          wash={color.practiceWash}
          onPress={() => onChange({ ...value, listedPractice: !practice, publicTradesPractice: !practice })}
        />
        <ModeChip
          label="Mainnet"
          on={mainnet}
          tone={color.mainnet}
          wash={color.mainnetWash}
          onPress={() => onChange({ ...value, listedMainnet: !mainnet, publicTradesMainnet: !mainnet })}
        />
      </View>
    </View>
  );
}

function ModeChip({
  label,
  on,
  tone,
  wash,
  onPress,
}: {
  label: string;
  on: boolean;
  tone: string;
  wash: string;
  onPress: () => void;
}) {
  const { color } = useTheme();
  const press = usePressScale();
  return (
    <Animated.View style={press.style}>
      <Pressable
        accessibilityRole="switch"
        accessibilityLabel={`Show my trades in ${label}`}
        accessibilityState={{ checked: on }}
        hitSlop={(SIZE.touch - SIZE.chipRowHeight) / 2}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        onPress={() => {
          fire("tick");
          onPress();
        }}
        style={[styles.chip, { backgroundColor: on ? wash : color.card }]}
      >
        {on ? <Check size={SIZE.iconSm} strokeWidth={SIZE.iconStroke} color={tone} /> : null}
        <Text
          maxFontSizeMultiplier={CONTROL_FONT_SCALE}
          style={[TYPE.chipCategory, { color: on ? tone : color.text3 }]}
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: "flex-start", gap: SPACE.sm },
  title: { flexDirection: "row", alignItems: "center", gap: SPACE.xs, flexShrink: 1 },
  chips: { flexDirection: "row", gap: SPACE.sm },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.xs,
    height: SIZE.chipRowHeight,
    paddingHorizontal: SPACE.md,
    borderRadius: BUTTON.radius.sm,
  },
});
