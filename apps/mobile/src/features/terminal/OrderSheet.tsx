/**
 * The order's settings on the phone (Tradash's settings sheet; Q1 · Codex direction 16 §1–2), from the order stack:
 * a ride's margin, opt-in leverage and its risk ladder, or a call's type, stake and payoff drawing — then the trail and
 * the fee, each one line that opens. Every amount is exact; presets are conveniences. It rests at 62 / 88 / 100 % (D-321).
 */
import { StyleSheet, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { LIST_DETENTS } from "~/components/sheet/constants";
import { Sheet, useSheetClose } from "~/components/sheet/Sheet";
import { SheetHeading } from "~/components/sheet/SheetRoute";
import { SPACE } from "~/theme";
import { type CallOrder, CallSettingsBody } from "./CallSettingsBody";
import { type RideOrder, RideSettingsBody } from "./RideSettingsBody";

function Done() {
  const close = useSheetClose();
  return <Button label="Done" onPress={() => close()} />;
}

export function OrderSheet({
  symbol,
  ride,
  call,
  available,
  onClose,
}: {
  symbol: string;
  ride: RideOrder | null;
  call: CallOrder;
  available: bigint | undefined;
  onClose: () => void;
}) {
  return (
    <Sheet onClose={onClose} closeLabel="Close the order settings" detents={LIST_DETENTS}>
      <SheetHeading title={`${symbol} · ${ride ? "Ride" : "Call"} settings`} />
      <View style={styles.body}>
        {ride ? (
          <RideSettingsBody o={ride} available={available} />
        ) : (
          <CallSettingsBody o={call} available={available} />
        )}
        <Done />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: SPACE.md, paddingBottom: SPACE.lg },
});
