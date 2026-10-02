/**
 * The Card tab with a card (§0.9 "Card tab, issued"; E2–E6): the art with •••• last4 (dimmed when frozen), the one
 * hero — Spendable — then the action circles Freeze/Unfreeze · Limit · Details · Add funds, the card-debt line with
 * Repay when there is debt, the locked Add to Wallet row, and the card's own payments (Practice: Simulate a payment
 * above them). No prose: every state is a word or a row.
 */
import type { CardSummary, CardSummaryCard } from "@senryo/api-client";
import type { AccountSnapshot } from "@senryo/chain";
import type { AllowanceState } from "@senryo/query";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { Eye, Gauge, Plus, Snowflake } from "~/components/kit/symbols";
import { QuietLine } from "~/features/markets/QuietLine";
import { fire } from "~/feedback/fire";
import { ROUTES } from "~/lib/constants/routes";
import { usd } from "~/lib/money";
import { RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { ACTION_GLYPH, ActionCircle } from "./ActionCircle";
import { CardFace } from "./CardFace";
import { CardHero } from "./CardHero";
import { CardPayments } from "./CardPayments";
import { SpendableHero } from "./SpendableHero";
import type { useCardFreeze } from "./useCardFreeze";
import { WalletRow } from "./WalletRow";

export function CardIssued({
  card,
  summary,
  snapshot,
  spendableUnavailable,
  allowance,
  freeze,
  practice,
  onBreakdown,
  onSimulate,
  onWallet,
}: {
  card: CardSummaryCard;
  summary: CardSummary;
  snapshot: AccountSnapshot | undefined;
  spendableUnavailable: boolean;
  allowance: AllowanceState | undefined;
  freeze: ReturnType<typeof useCardFreeze>;
  practice: boolean;
  onBreakdown: () => void;
  onSimulate: () => void;
  onWallet: () => void;
}) {
  const { color } = useTheme();
  const frozen = freeze.frozen;
  const debt = summary.debtUsd6 ?? snapshot?.cardDebt ?? 0n;
  const testCard = card.sandbox === true && !practice;
  return (
    <View style={styles.page}>
      <View style={styles.art}>
        <CardHero dim={frozen}>
          <CardFace last4={card.last4 ?? undefined} />
        </CardHero>
        {testCard ? (
          <Text style={[TYPE.meta, styles.center, { color: color.text3 }]}>Test card · no charge</Text>
        ) : null}
      </View>
      <SpendableHero snapshot={snapshot} unavailable={spendableUnavailable} frozen={frozen} onOpen={onBreakdown} />
      <View style={styles.circles}>
        {frozen ? (
          <ActionCircle
            label="Unfreeze"
            active
            disabled={freeze.unresolved}
            onPress={() => router.push(ROUTES.cardUnfreeze)}
          >
            <Snowflake size={ACTION_GLYPH} color={color.primary} />
          </ActionCircle>
        ) : (
          <ActionCircle
            label="Freeze"
            busy={freeze.state === "freezing"}
            disabled={freeze.unresolved}
            hint="Stops the card at once"
            onPress={() => void freeze.freeze()}
          >
            <Snowflake size={ACTION_GLYPH} color={color.ink} />
          </ActionCircle>
        )}
        <ActionCircle label="Limit" disabled={freeze.unresolved} onPress={() => router.push(ROUTES.cardAllowance)}>
          <Gauge size={ACTION_GLYPH} color={color.ink} />
        </ActionCircle>
        <ActionCircle label="Details" onPress={() => router.push(ROUTES.cardReveal)}>
          <Eye size={ACTION_GLYPH} color={color.ink} />
        </ActionCircle>
        <ActionCircle label="Add funds" onPress={() => router.push(ROUTES.addMoney)}>
          <Plus size={ACTION_GLYPH} color={color.ink} />
        </ActionCircle>
      </View>
      <FreezeLine freeze={freeze} />
      {debt > 0n ? <DebtLine debtUsd6={debt} /> : null}
      <WalletRow onPress={onWallet} />
      <View style={styles.section}>
        <View style={styles.heading}>
          <Text accessibilityRole="header" style={[TYPE.sectionTitle, { color: color.ink }]}>
            Payments
          </Text>
          {summary.recent.length > 0 ? (
            <Pressable onPress={() => router.push(ROUTES.activityCard)} accessibilityRole="link" hitSlop={SPACE.sm}>
              <Text style={[TYPE.rowDetail, { color: color.link }]}>See all</Text>
            </Pressable>
          ) : null}
        </View>
        {practice || card.sandbox ? <SimulateRow onPress={onSimulate} disabled={card.state === "CLOSED"} /> : null}
        {summary.recent.length > 0 ? (
          <CardPayments rows={summary.recent} {...(allowance ? { allowance } : {})} />
        ) : (
          <QuietLine>No payments yet</QuietLine>
        )}
      </View>
    </View>
  );
}

/** A freeze that didn't finish says so in words, with the one action that helps (never while it is unknown). */
function FreezeLine({ freeze }: { freeze: ReturnType<typeof useCardFreeze> }) {
  const { color } = useTheme();
  if (freeze.unresolved) {
    return <Text style={[TYPE.rowDetail, styles.center, { color: color.warn }]}>Freeze not confirmed yet</Text>;
  }
  if (freeze.state !== "unconfirmed") return null;
  return (
    <View style={styles.freezeLine} accessibilityLiveRegion="polite">
      <Text style={[TYPE.rowDetail, { color: color.warn }]}>Freeze not confirmed</Text>
      <Button label="Retry" variant="ghost" size="sm" block={false} onPress={() => void freeze.freeze()} />
    </View>
  );
}

/** Card debt (E4 step 6): the amount and Repay, on the down wash — the one coloured row on the page. */
function DebtLine({ debtUsd6 }: { debtUsd6: bigint }) {
  const { color } = useTheme();
  return (
    <View style={[styles.debt, { backgroundColor: color.downWash }]} accessibilityRole="alert">
      <View style={styles.debtText}>
        <Text style={[TYPE.rowTitle, { color: color.ink }]}>Card debt {usd(debtUsd6)}</Text>
      </View>
      <Button label="Repay" size="sm" block={false} onPress={() => router.push(ROUTES.cardRepay)} />
    </View>
  );
}

function SimulateRow({ onPress, disabled }: { onPress: () => void; disabled: boolean }) {
  const { color } = useTheme();
  return (
    <Pressable
      onPress={() => {
        fire("tick");
        onPress();
      }}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, pressed ? { opacity: PRESSED } : null]}
    >
      <View style={[styles.disc, { backgroundColor: color.primaryWash }]}>
        <Plus size={ACTION_GLYPH} color={color.primary} />
      </View>
      <View style={styles.rowText}>
        <Text style={[TYPE.rowTitle, { color: color.ink }]}>Simulate a payment</Text>
        <Text style={[TYPE.rowDetail, { color: color.text3 }]}>Test merchants</Text>
      </View>
    </Pressable>
  );
}

const PRESSED = 0.6;

const styles = StyleSheet.create({
  page: { gap: SPACE.xl },
  art: { gap: SPACE.sm, paddingTop: SPACE.sm, paddingHorizontal: SPACE.sm },
  center: { textAlign: "center" },
  circles: { flexDirection: "row", justifyContent: "space-between" },
  freezeLine: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACE.sm },
  debt: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.md,
    borderRadius: RADIUS.md,
  },
  debtText: { flex: 1 },
  section: { gap: SPACE.sm },
  heading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  row: { flexDirection: "row", alignItems: "center", gap: SPACE.md, minHeight: SIZE.rowMinHeight },
  disc: {
    width: SIZE.markRow,
    height: SIZE.markRow,
    borderRadius: RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: { flex: 1, gap: SPACE.xxs },
});
