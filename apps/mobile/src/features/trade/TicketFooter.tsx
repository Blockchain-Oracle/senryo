import { blockerCopy, notional } from "@senryo/core";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { ChevronDown, CirclePlus } from "~/components/kit/symbols";
import { SlideToConfirm } from "~/components/trade/SlideToConfirm";
import type { MarketLine } from "~/features/markets/useMarketLine";
import { fire } from "~/feedback/fire";
import { useTermsGate } from "~/lib/account/terms-gate";
import { positionRoute, ROUTES } from "~/lib/constants/routes";
import { usd } from "~/lib/money";
import { CONTROL_FONT_SCALE, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import type { CommitState, Fix } from "./ticket-commit";
import type { useTicket } from "./useTicket";

type TicketModel = ReturnType<typeof useTicket>;

const FIX_LABEL: Record<Exclude<Fix, "createAccount">, string> = {
  addMoney: "Add money",
  maxLeverage: "Set max",
  closePosition: "Close it",
};

/**
 * The ticket's fixed action zone (Fomo F37/F41/F42; flow book C3 steps 4–7): "Buying power P$212 ⊕" with Details at
 * the right; one line naming the first blocker (core chain order, unchanged) with its fix as a link, or why a slide
 * was just reset; then the slide in the side's colour ("Slide to short", "… · passkey" above the session's limits),
 * busy while network fees are prepared. A guest gets one "Create an account to trade" button and the typed order is
 * kept through sign-up. VoiceOver confirms through Details, which has an explicit Open button.
 */
export function TicketFooter({
  t,
  line,
  commit,
  note,
  resetKey,
  onReset,
  onConfirm,
  onDetails,
}: {
  t: TicketModel;
  line: MarketLine;
  commit: CommitState;
  /** Why a slide was just reset ("Price updated. Review and slide again."). */
  note: string | undefined;
  resetKey: string;
  onReset: () => void;
  onConfirm: () => void;
  onDetails: () => void;
}) {
  const { color } = useTheme();
  const gate = useTermsGate();
  // Adding money is a money action: the terms gate runs first (A11).
  const addMoney = () => gate(() => router.push(ROUTES.addMoney), { verb: "add money", next: ROUTES.addMoney });
  const copy = t.blocker ? blockerCopy(t.blocker, line.symbol, t.nowSec, (v) => usd(v)) : undefined;
  // C3 #5 names the amount held on the other side: "You're long P$300".
  const title =
    t.blocker?.code === "OPPOSITE_SIDE" && t.held
      ? `You're ${t.held.isLong ? "long" : "short"} ${usd(notional(t.held.size, line.price18))}`
      : copy?.title;
  const guest = commit.fix === "createAccount";
  const fix = commit.fix && commit.fix !== "createAccount" ? commit.fix : undefined;
  const why = guest ? undefined : copy ? (fix ? title : [title, copy.action].filter(Boolean).join(" · ")) : note;
  return (
    <View style={styles.zone}>
      <View style={styles.row}>
        <Pressable
          onPress={() => {
            fire("tick");
            addMoney();
          }}
          accessibilityRole="button"
          accessibilityLabel={`Buying power ${t.snapshot ? usd(t.snapshot.freeToTrade) : "unknown"}. Add money`}
          hitSlop={SPACE.sm}
          style={styles.inline}
        >
          <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowDetail, { color: color.text2 }]}>
            Buying power{" "}
            <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.moneyMeta, { color: color.ink }]}>
              {t.snapshot ? usd(t.snapshot.freeToTrade) : "—"}
            </Text>
          </Text>
          <CirclePlus size={SIZE.iconSm} strokeWidth={SIZE.iconStroke} color={color.text2} />
        </Pressable>
        <Pressable
          onPress={() => {
            fire("tick");
            onDetails();
          }}
          disabled={t.preview === undefined}
          accessibilityRole="button"
          accessibilityLabel="Details: fee, spread, funding, borrow and acceptable price"
          hitSlop={SPACE.sm}
          style={[styles.inline, { opacity: t.preview === undefined ? DIM : 1 }]}
        >
          <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowDetail, { color: color.text2 }]}>
            Details
          </Text>
          <ChevronDown size={SIZE.iconSm} strokeWidth={SIZE.iconStroke} color={color.text2} />
        </Pressable>
      </View>
      {why ? (
        <View style={styles.row}>
          <Text
            maxFontSizeMultiplier={CONTROL_FONT_SCALE}
            accessibilityLiveRegion="polite"
            numberOfLines={2}
            style={[TYPE.meta, styles.flex, { color: copy ? color.warn : color.text2 }]}
          >
            {why}
          </Text>
          {fix ? (
            <FixLink fix={fix} t={t} max={line.maxLeverageX} marketId={line.marketId} onAddMoney={addMoney} />
          ) : null}
        </View>
      ) : null}
      {guest ? (
        <Button
          label={commit.label}
          onPress={() => router.push(ROUTES.accountRequired)}
          accessibilityHint="Your order stays as you typed it"
        />
      ) : (
        <SlideToConfirm
          label={commit.label}
          disabled={!commit.holdable}
          busy={commit.busy === true}
          tone={t.side === "long" ? "up" : "down"}
          onConfirm={onConfirm}
          resetKey={resetKey}
          onReset={onReset}
          onAccessibleActivate={onDetails}
        />
      )}
    </View>
  );
}

function FixLink({
  fix,
  t,
  max,
  marketId,
  onAddMoney,
}: {
  fix: Exclude<Fix, "createAccount">;
  t: TicketModel;
  max: number;
  marketId: number;
  onAddMoney: () => void;
}) {
  const { color } = useTheme();
  const act = () => {
    if (fix === "addMoney") onAddMoney();
    else if (fix === "maxLeverage") t.setLeverage(max);
    else router.push(positionRoute(String(marketId)));
  };
  return (
    <Pressable
      onPress={() => {
        fire("tick");
        act();
      }}
      accessibilityRole="button"
      hitSlop={SPACE.sm}
    >
      <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowStrong, { color: color.link }]}>
        {fix === "maxLeverage" ? `Set ${max}×` : FIX_LABEL[fix]} ›
      </Text>
    </Pressable>
  );
}

const DIM = 0.4;

const styles = StyleSheet.create({
  zone: { paddingHorizontal: SIZE.gutter, paddingTop: SPACE.sm, gap: SPACE.sm },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: SPACE.sm },
  inline: { flexDirection: "row", alignItems: "center", gap: SPACE.xs },
  flex: { flex: 1 },
});
