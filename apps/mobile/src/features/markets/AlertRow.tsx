import { engineMarket } from "@senryo/config";
import { ids } from "@senryo/identity";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { EntityMark } from "~/components/identity/EntityMark";
import { X } from "~/components/kit/symbols";
import { UTILITY_ICON, UtilityButton } from "~/components/shell/Utilities";
import { fire } from "~/feedback/fire";
import { clockTime } from "~/lib/format";
import { price18, priceDecimalsOf } from "~/lib/money";
import { DISABLED_OPACITY, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { dayLabel } from "./periods";
import type { Alert } from "./useAlerts";

/** "Rises above $4,300.00" / "Falls below $4,100.00" at the market's own display precision. */
export function alertCondition(alert: Pick<Alert, "direction" | "price18" | "marketId">): string {
  const shown = price18(alert.price18, priceDecimalsOf(alert.marketId));
  return `${alert.direction === "above" ? "Rises above" : "Falls below"} $${shown}`;
}

/** "Active" or "Triggered 30 Sep 14:02" — the word carries the state, not a colour. */
function alertState(alert: Alert): string {
  if (alert.status !== "triggered" || alert.triggeredAt === null) return "Active";
  const at = Date.parse(alert.triggeredAt);
  return `Triggered ${dayLabel(at)} ${clockTime(at)}`;
}

/**
 * One price alert (direction "Alerts list": instrument, condition, active / triggered state, remove): the market's
 * mark and name when the list mixes markets, the condition, its state under it, and a round remove control. Bare on
 * its ground like every list row; a tap edits it (C9). `busy` dims it while its removal is in flight.
 */
export function AlertRow({
  alert,
  showMarket,
  busy,
  onRemove,
  onEdit,
}: {
  alert: Alert;
  showMarket: boolean;
  busy: boolean;
  onRemove: () => void;
  /** Opens the editor on this alert (Save replaces it). */
  onEdit?: () => void;
}) {
  const { color } = useTheme();
  const meta = engineMarket(alert.marketId);
  const condition = alertCondition(alert);
  const triggered = alert.status === "triggered";
  return (
    <Pressable
      disabled={!onEdit || busy}
      onPress={() => {
        fire("tick");
        onEdit?.();
      }}
      accessibilityRole={onEdit ? "button" : "text"}
      accessibilityLabel={`${showMarket ? `${meta?.name ?? `Market ${alert.marketId}`}, ` : ""}${condition}, ${alertState(alert)}`}
      {...(onEdit ? { accessibilityHint: "Edits this alert" } : {})}
      // The row is one element for VoiceOver; removing it is its custom action (the × inside isn't reachable alone).
      accessibilityActions={[{ name: "remove", label: "Remove alert" }]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === "remove" && !busy) onRemove();
      }}
      style={({ pressed }) => [styles.row, busy ? styles.busy : null, pressed ? { opacity: PRESSED } : null]}
    >
      {showMarket ? (
        <EntityMark
          id={ids.engineMarket(alert.chainId, alert.marketId)}
          size={SIZE.markDetail}
          label={meta?.symbol}
          decorative
        />
      ) : null}
      <View style={styles.text}>
        <Text numberOfLines={1} style={[TYPE.rowTitle, { color: color.ink }]}>
          {showMarket ? (meta?.name ?? `Market ${alert.marketId}`) : condition}
        </Text>
        <Text numberOfLines={1} style={[TYPE.rowDetail, { color: color.text3 }]}>
          {showMarket ? `${condition} · ` : ""}
          <Text style={{ color: triggered ? color.ink : color.text3 }}>{alertState(alert)}</Text>
        </Text>
      </View>
      <UtilityButton
        label={`Remove the alert: ${condition}`}
        onPress={() => {
          if (!busy) onRemove();
        }}
      >
        <X size={UTILITY_ICON} strokeWidth={SIZE.iconStroke} color={color.ink} />
      </UtilityButton>
    </Pressable>
  );
}

const PRESSED = 0.6;

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: SPACE.md, minHeight: SIZE.rowMinHeight },
  busy: { opacity: DISABLED_OPACITY },
  text: { flex: 1, gap: SPACE.xxs },
});
