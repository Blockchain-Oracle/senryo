import { blockerCopy, DECIMALS, formatUnits } from "@senryo/core";
import { router } from "expo-router";
import { CirclePlus } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { HoldToConfirm } from "~/components/trade/HoldToConfirm";
import type { MarketLine } from "~/features/markets/useMarketLine";
import { fire } from "~/feedback/fire";
import { ROUTES } from "~/lib/constants/routes";
import { pct, usd } from "~/lib/money";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { QUANTITY_DECIMALS } from "./constants";
import type { CommitState, Fix } from "./ticket-commit";
import type { useTicket } from "./useTicket";

type TicketModel = ReturnType<typeof useTicket>;

/** The secondary control beside the hold button (Review order / a blocker's fix). */
const SIDE_ACTION_WIDTH = 116;

/**
 * The ticket's fixed action zone (C39/C43, F37/F41/F42; Codex S1b.7 consult #4/#11), kept as compact as Fomo's so the
 * keypad keeps its room: "{amount} available ⊕" with the quantity, impact and fee on the right; one line saying why
 * the order can't go (the full blocker copy) or why a hold was reset; then one row — the explicit "Review order"
 * alternative (or the blocker's fix) beside the single 500 ms hold button (D-177), which carries the state's label
 * ("Enter an amount", "Insufficient funds", "Hold to open Long"). The zone is set off by spacing, not a line.
 */
export function TicketFooter({
  t,
  line,
  commit,
  note,
  resetKey,
  onReset,
  onConfirm,
  onReview,
}: {
  t: TicketModel;
  line: MarketLine;
  commit: CommitState;
  /** Why a hold was just reset ("Price updated. Review and hold again."). */
  note: string | undefined;
  resetKey: string;
  onReset: () => void;
  onConfirm: () => void;
  onReview: () => void;
}) {
  const { color } = useTheme();
  const copy = t.blocker ? blockerCopy(t.blocker, line.name, t.nowSec) : undefined;
  const qty = t.preview ? formatUnits(t.preview.sizeDelta, DECIMALS.e18, QUANTITY_DECIMALS) : undefined;
  const fee = t.preview ? `fee ${usd(t.preview.feeUsd6)}` : `fee ${line.market.risk.feeBps} bps`;
  // A guest gets exactly one account action: the hold's place becomes "Create an account to trade" (review: one
  // CTA, not a side button plus a disabled hold plus a warning line). The typed order is kept through sign-up.
  const guest = commit.fix === "createAccount";
  // The fix button carries the blocker's action, so the line keeps only its title then.
  const why = guest
    ? undefined
    : copy
      ? commit.fix
        ? copy.title
        : [copy.title, copy.action].filter(Boolean).join(" · ")
      : note;
  return (
    <View style={styles.zone}>
      <View style={styles.row}>
        <Pressable
          onPress={() => {
            fire("tick");
            router.push(ROUTES.addMoney);
          }}
          accessibilityRole="button"
          accessibilityLabel={`${t.snapshot ? usd(t.snapshot.freeToTrade) : "Balance unknown"} available to trade. Add money`}
          hitSlop={SPACE.sm}
          style={styles.inline}
        >
          <Text style={[TYPE.rowStrong, { color: color.ink }]}>
            {t.snapshot ? usd(t.snapshot.freeToTrade) : "—"} <Text style={{ color: color.text2 }}>available</Text>
          </Text>
          <CirclePlus size={SIZE.iconSm} strokeWidth={SIZE.iconStroke} color={color.text2} />
        </Pressable>
        <Text style={[TYPE.moneyMeta, styles.end, { color: color.text3 }]} numberOfLines={1}>
          {qty ? (
            <Text style={{ color: color.ink }}>
              {qty} {line.symbol}
            </Text>
          ) : null}
          {qty ? ` · impact ${pct(t.preview?.impactBps ?? 0n)} · ` : ""}
          {fee}
        </Text>
      </View>
      {why ? (
        <Text
          accessibilityLiveRegion="polite"
          numberOfLines={2}
          style={[TYPE.meta, { color: copy ? color.warn : color.text2 }]}
        >
          {why}
        </Text>
      ) : null}
      {guest ? (
        <Button
          label={commit.label}
          onPress={() => router.push(ROUTES.accountRequired)}
          accessibilityHint="Your order stays as you typed it"
        />
      ) : (
        <View style={styles.actions}>
          <View style={styles.side}>
            {commit.fix ? (
              <FixButton fix={commit.fix} t={t} max={line.maxLeverageX} />
            ) : (
              <Button
                label="Review"
                variant="outline"
                size="sm"
                disabled={!commit.holdable}
                onPress={onReview}
                accessibilityHint="Review the order: every number and an explicit Open button"
              />
            )}
          </View>
          <View style={styles.hold}>
            <HoldToConfirm
              label={commit.label}
              disabled={!commit.holdable}
              onConfirm={onConfirm}
              resetKey={resetKey}
              onReset={onReset}
              onAccessibleActivate={onReview}
              accessibilityHint="Hold for half a second to open the position, or use Review"
            />
          </View>
        </View>
      )}
    </View>
  );
}

function FixButton({ fix, t, max }: { fix: Fix; t: TicketModel; max: number }) {
  const props = { size: "sm" as const, variant: "secondary" as const };
  switch (fix) {
    case "addMoney":
      return <Button {...props} label="Add money" onPress={() => router.push(ROUTES.addMoney)} />;
    case "createAccount":
      // Not reached: a guest's footer is the single "Create an account to trade" button.
      return null;
    case "maxLeverage":
      return <Button {...props} label={`Set ${max}×`} onPress={() => t.setLeverage(max)} />;
  }
}

const styles = StyleSheet.create({
  zone: { paddingHorizontal: SIZE.gutter, paddingTop: SPACE.sm, gap: SPACE.sm },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: SPACE.sm },
  inline: { flexDirection: "row", alignItems: "center", gap: SPACE.xs, flexShrink: 0 },
  end: { flexShrink: 1, textAlign: "right" },
  actions: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  side: { width: SIDE_ACTION_WIDTH },
  hold: { flex: 1 },
});
