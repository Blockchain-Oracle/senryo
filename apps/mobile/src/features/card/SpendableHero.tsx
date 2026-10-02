/**
 * The Card tab's one hero (E2): "Spendable" — the onchain `freeToSpend`, already capped by today's limit — in rolling
 * digits, with one line under it naming what binds it (limit left, limit used / expired / not set, or Frozen). Tapping
 * it opens the breakdown: free in the account, today's limit, open holds and card debt, and the one fact the intro
 * corrected — card holds and debt count against your positions. Loading never shows a fake $0.
 */
import type { AccountSnapshot } from "@senryo/chain";
import { type AllowanceState, allowanceState } from "@senryo/query";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AmountHero } from "~/components/kit/AmountHero";
import { Skeleton } from "~/components/kit/states";
import { Info } from "~/components/kit/symbols";
import { SheetHeading } from "~/components/sheet/SheetRoute";
import { ROUTES } from "~/lib/constants/routes";
import { usd } from "~/lib/money";
import { DISABLED_OPACITY, SHEET_SHAPE, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { CARD_RISK_LINE } from "./constants";

const MS_PER_SECOND = 1000n;
/** Placeholder widths while the snapshot loads (never a fake $0). */
const HERO_SKELETON = 180;
const LINE_SKELETON = 120;

export function allowanceNow(snapshot: AccountSnapshot): AllowanceState {
  const nowSec = BigInt(Date.now()) / MS_PER_SECOND;
  return allowanceState(snapshot.allowanceDailyLimit, snapshot.allowanceExpiry, snapshot.allowanceLeft, nowSec);
}

/** The line under the hero: what limits Spendable right now. */
function limitLine(snapshot: AccountSnapshot, frozen: boolean): string {
  if (frozen) return "Frozen";
  const state = allowanceNow(snapshot);
  if (state.kind === "off") return "No limit set";
  if (state.kind === "expired") return "Limit expired";
  if (state.leftUsd6 === 0n) return "Limit used";
  return `Limit left ${usd(state.leftUsd6, 0)} of ${usd(state.dailyLimitUsd6, 0)}`;
}

export function SpendableHero({
  snapshot,
  frozen,
  onOpen,
}: {
  snapshot: AccountSnapshot | undefined;
  frozen: boolean;
  /** Opens the breakdown (`SpendableBreakdown`, rendered by the screen as a sheet over the dock). */
  onOpen: () => void;
}) {
  const { color } = useTheme();
  return (
    <Pressable
      onPress={() => snapshot && onOpen()}
      disabled={!snapshot}
      accessibilityRole="button"
      accessibilityHint="Opens what makes up Spendable"
      style={[styles.hero, frozen ? styles.frozen : null]}
    >
      <View style={styles.label}>
        <Text style={[TYPE.rowDetail, { color: color.text3 }]}>Spendable</Text>
        <Info size={SIZE.iconSm} color={color.text3} />
      </View>
      {snapshot ? (
        <>
          <AmountHero text={usd(snapshot.freeToSpend > 0n ? snapshot.freeToSpend : 0n)} />
          <Text style={[TYPE.rowDetail, { color: color.text2 }]}>{limitLine(snapshot, frozen)}</Text>
        </>
      ) : (
        <>
          <Skeleton width={HERO_SKELETON} height={SIZE.skeletonRow} />
          <Skeleton width={LINE_SKELETON} />
        </>
      )}
    </Pressable>
  );
}

/** The breakdown under the hero's ⓘ (E2 step 2). */
export function SpendableBreakdown({
  snapshot,
  openHoldsUsd6,
  debtUsd6,
}: {
  snapshot: AccountSnapshot;
  openHoldsUsd6: bigint;
  debtUsd6: bigint;
}) {
  const { color } = useTheme();
  const state = allowanceNow(snapshot);
  const holds = snapshot.holds > openHoldsUsd6 ? snapshot.holds : openHoldsUsd6;
  const rows: ReadonlyArray<readonly [string, string]> = [
    ["Free in account", usd(snapshot.freeToTrade > 0n ? snapshot.freeToTrade : 0n)],
    ["Limit left today", state.kind === "live" ? usd(state.leftUsd6) : state.kind === "expired" ? "Expired" : "None"],
    ["Open holds", holds > 0n ? `−${usd(holds)}` : usd(0n)],
    ["Card debt", debtUsd6 > 0n ? `−${usd(debtUsd6)}` : usd(0n)],
  ];
  return (
    <>
      <SheetHeading title={`Spendable ${usd(snapshot.freeToSpend > 0n ? snapshot.freeToSpend : 0n)}`} />
      <View style={styles.rows}>
        {rows.map(([label, value]) => (
          <View key={label} style={styles.row}>
            <Text style={[TYPE.row, { color: color.text2 }]}>{label}</Text>
            <Text style={[TYPE.rowAmount, { color: color.ink }]}>{value}</Text>
          </View>
        ))}
      </View>
      <Text style={[TYPE.rowDetail, styles.note, { color: color.text3 }]}>{CARD_RISK_LINE}</Text>
      {snapshot.freeToTrade < snapshot.equityInit && snapshot.im > 0n ? (
        <Pressable
          accessibilityRole="link"
          onPress={() => router.push(ROUTES.home)}
          style={styles.link}
          hitSlop={SPACE.sm}
        >
          <Text style={[TYPE.rowDetail, { color: color.link }]}>{usd(snapshot.im)} in positions ›</Text>
        </Pressable>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  hero: { gap: SPACE.xs, alignItems: "flex-start" },
  frozen: { opacity: DISABLED_OPACITY },
  label: { flexDirection: "row", alignItems: "center", gap: SPACE.xs },
  rows: { gap: SHEET_SHAPE.rowGap, paddingHorizontal: SPACE.sm },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: SPACE.md },
  note: { textAlign: "center", paddingHorizontal: SPACE.md },
  link: { alignSelf: "center" },
});
