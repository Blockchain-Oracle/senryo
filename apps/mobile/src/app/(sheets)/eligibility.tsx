import { type Href, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { Button } from "~/components/kit/Button";
import { useGroupFill } from "~/components/kit/Surface";
import { Check } from "~/components/kit/symbols";
import { usePressScale } from "~/components/kit/usePressScale";
import { useSheetClose } from "~/components/sheet/Sheet";
import { SheetRoute } from "~/components/sheet/SheetRoute";
import { confirmEligibility, RESTRICTED_REGIONS } from "~/features/legal/eligibility";
import { InfoTip } from "~/features/setup/InfoTip";
import { fire } from "~/feedback/fire";
import { useAccount } from "~/lib/account/provider";
import { ROUTES } from "~/lib/constants/routes";
import { BUTTON, HAIRLINE_PX, SIZE, SPACE, TIMING, TYPE, useTheme } from "~/theme";

const ROW_PRESS_SCALE = 0.985;
const BOX = SIZE.icon;
const BOX_CHECK = 16;
/** Continue holds its spinner this long so the confirmation reads as done before the ticket rises (M13). */
const PENDING_MS = TIMING.selection;

/**
 * A11 region check (FT101 / M13; Fomo F36 adapted): before the first real-money trade, one checkbox row — "I'm not in
 * a restricted region" — with the exact statement and the list behind its ⓘ, the Terms one tap away, and Continue:
 * the quiet plate until the box is checked, then a short spinner, then the order ticket (`next`).
 */
export default function EligibilitySheet() {
  return (
    <SheetRoute title="Trading with real money">
      <Confirm />
    </SheetRoute>
  );
}

function Confirm() {
  const { color } = useTheme();
  const close = useSheetClose();
  const address = useAccount().hint?.address;
  const { next } = useLocalSearchParams<{ next?: string }>();
  const press = usePressScale(ROW_PRESS_SCALE);
  const [checked, setChecked] = useState(false);
  const [pending, setPending] = useState(false);
  // One step lighter than the sheet (the surface rule), so the confirmation reads as its own plate.
  const fill = useGroupFill();
  const regions = `${RESTRICTED_REGIONS.slice(0, -1).join(", ")} or ${RESTRICTED_REGIONS.at(-1)}`;
  return (
    <View style={styles.stack}>
      <Animated.View style={press.style}>
        <Pressable
          onPressIn={press.onPressIn}
          onPressOut={press.onPressOut}
          onPress={() => {
            fire("tick");
            setChecked((v) => !v);
          }}
          accessibilityRole="checkbox"
          accessibilityState={{ checked }}
          accessibilityLabel="I’m not in a restricted region"
          style={[styles.row, { backgroundColor: fill }]}
        >
          <View
            style={[
              styles.box,
              checked
                ? { backgroundColor: color.primary, borderColor: color.primary }
                : { backgroundColor: color.transparent, borderColor: color.text3 },
            ]}
          >
            {checked ? (
              <Check size={BOX_CHECK} strokeWidth={SIZE.iconStroke + 1} color={color.primaryForeground} />
            ) : null}
          </View>
          <Text style={[TYPE.rowTitle, styles.text, { color: color.ink }]}>I’m not in a restricted region</Text>
          <InfoTip
            title="Restricted regions"
            body={`I confirm I am not located in, a citizen or resident of, or otherwise subject to the laws of ${regions}, nor of a sanctioned jurisdiction. Practice is open to everyone.`}
          />
        </Pressable>
      </Animated.View>
      <Text
        accessibilityRole="link"
        onPress={() => router.push(ROUTES.accountTerms)}
        style={[TYPE.bodyStrong, styles.center, { color: color.link }]}
      >
        Terms of use
      </Text>
      <Button
        label="Continue"
        disabled={!checked || !address}
        loading={pending}
        onPress={() => {
          if (!address) return;
          confirmEligibility(address);
          fire("confirm");
          setPending(true);
          setTimeout(() => close(() => (next ? router.push(next as Href) : undefined)), PENDING_MS);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: SPACE.md },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    padding: SPACE.lg,
    borderRadius: BUTTON.radius.md + SPACE.xs,
  },
  // A checkbox is a control boundary: its outline is the unchecked state.
  box: {
    width: BOX,
    height: BOX,
    borderRadius: SPACE.xs + SPACE.xxs,
    borderWidth: HAIRLINE_PX + HAIRLINE_PX / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { flex: 1 },
  center: { textAlign: "center" },
});
