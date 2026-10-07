import { TESTNET_CHAIN_ID } from "@senryo/config";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { ChevronDown, CirclePlus, Info } from "~/components/kit/symbols";
import { SlideToConfirm } from "~/components/trade/SlideToConfirm";
import { fire } from "~/feedback/fire";
import { useTermsGate } from "~/lib/account/terms-gate";
import { accountRequiredRoute, perplPositionRoute, ROUTES, ticketRoute } from "~/lib/constants/routes";
import { CONTROL_FONT_SCALE, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { perplUsd } from "./format";
import type { PerplTicketModel } from "./usePerplTicket";
import { blockCopy, type PerplFix } from "./words";

const DIM = 0.4;

const FIX_LABEL: Record<Exclude<PerplFix, "maxLeverage" | "why">, string> = {
  addMoney: "Add money",
  closePosition: "Close it",
};

/** What the slide says and whether it can be held, from the ticket's state (the first blocker wins). */
export function perplCommit(t: PerplTicketModel): { label: string; holdable: boolean } {
  if (t.block) return { label: blockCopy(t.block, t.meta.symbol).label, holdable: false };
  if (t.amountUsd6 === 0n) return { label: "Enter an amount", holdable: false };
  if (t.planFailed) return { label: "Perpl didn’t answer · retrying", holdable: false };
  if (!t.ready || t.planning || !t.plan) return { label: "Preparing order…", holdable: false };
  // A planner refusal the blocker chain hasn't named yet (its reads are a moment apart): never holdable.
  if (t.plan.blocker) return { label: "Preparing order…", holdable: false };
  const verb = `Slide to ${t.side}`;
  return { label: t.confirmWith === "passkey" ? `${verb} · passkey` : verb, holdable: true };
}

/**
 * The Perpl ticket's action zone (flow book C4; Fomo F37/F41): "Buying power $X ⊕" — what's free on Perpl plus the
 * wallet's AUSD — with Details at the right; one line naming the first blocker and its fix (the AUSD missing with Add
 * money, the network fee in MON, the side already held), or, before a first order, what the operation will also do
 * ("Opens a Perpl account · $10.00"); then the slide in the side's colour, naming the passkey when it will ask for one.
 */
export function PerplTicketFooter({
  t,
  note,
  resetKey,
  onReset,
  onConfirm,
  onDetails,
  onWhy,
  onFunds,
}: {
  t: PerplTicketModel;
  note: string | undefined;
  resetKey: string;
  onReset: () => void;
  onConfirm: () => void;
  onDetails: () => void;
  onWhy: () => void;
  onFunds: () => void;
}) {
  const { color } = useTheme();
  const gate = useTermsGate();
  const addMoney = () =>
    t.meta.chainId === TESTNET_CHAIN_ID && t.block?.code !== "fees"
      ? onFunds()
      : gate(() => router.push(ROUTES.addMoney), { verb: "add money", next: ROUTES.addMoney });
  const commit = perplCommit(t);
  const copy = t.block ? blockCopy(t.block, t.meta.symbol) : undefined;
  const guest = t.block?.code === "guest";
  const plan = t.plan && !t.plan.blocker ? t.plan : undefined;
  const disclosure =
    plan && plan.depositCNS > 0n
      ? plan.account
        ? `Moves ${perplUsd(plan.depositCNS)} AUSD to Perpl`
        : `Opens a Perpl account · ${perplUsd(plan.depositCNS)}`
      : undefined;
  const line = copy ? (copy.line ?? (copy.fix && copy.fix !== "why" ? copy.label : undefined)) : (note ?? disclosure);
  const fix = copy?.fix;
  const act = () => {
    fire("tick");
    if (fix === "addMoney") addMoney();
    else if (fix === "maxLeverage" && t.maxX !== undefined) t.setLeverage(t.maxX);
    else if (fix === "closePosition") router.push(perplPositionRoute(t.meta.marketId));
    else if (fix === "why") onWhy();
  };
  return (
    <View style={styles.zone}>
      <View style={styles.row}>
        <Pressable
          onPress={() => {
            fire("tick");
            addMoney();
          }}
          accessibilityRole="button"
          accessibilityLabel={`Buying power ${t.buyingPowerUsd6 === undefined ? "unknown" : perplUsd(t.buyingPowerUsd6)}. Add money`}
          hitSlop={SPACE.sm}
          style={styles.inline}
        >
          <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowDetail, { color: color.text2 }]}>
            Buying power{" "}
            <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.moneyMeta, { color: color.ink }]}>
              {t.buyingPowerUsd6 === undefined ? "—" : perplUsd(t.buyingPowerUsd6)}
            </Text>
          </Text>
          <CirclePlus size={SIZE.iconSm} strokeWidth={SIZE.iconStroke} color={color.text2} />
        </Pressable>
        <Pressable
          onPress={() => {
            fire("tick");
            onDetails();
          }}
          disabled={t.lots === 0n}
          accessibilityRole="button"
          accessibilityLabel="Details: fee, acceptable price, funding and the steps"
          hitSlop={SPACE.sm}
          style={[styles.inline, { opacity: t.lots === 0n ? DIM : 1 }]}
        >
          <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowDetail, { color: color.text2 }]}>
            Details
          </Text>
          <ChevronDown size={SIZE.iconSm} strokeWidth={SIZE.iconStroke} color={color.text2} />
        </Pressable>
      </View>
      {line || fix === "why" ? (
        <View style={styles.row}>
          <Text
            maxFontSizeMultiplier={CONTROL_FONT_SCALE}
            accessibilityLiveRegion="polite"
            numberOfLines={2}
            style={[TYPE.meta, styles.flex, { color: copy ? color.warn : color.text2 }]}
          >
            {line ?? ""}
          </Text>
          {fix ? (
            <Pressable onPress={act} accessibilityRole="button" hitSlop={SPACE.sm} style={styles.inline}>
              {fix === "why" ? (
                <Info size={SIZE.iconSm} strokeWidth={SIZE.iconStroke} color={color.link} />
              ) : (
                <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowStrong, { color: color.link }]}>
                  {fix === "maxLeverage" ? `Set ${t.maxX ?? ""}×` : FIX_LABEL[fix]} ›
                </Text>
              )}
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {guest ? (
        <Button
          label={commit.label}
          onPress={() => router.push(accountRequiredRoute("trade", ticketRoute(t.meta.symbol, t.side)))}
          accessibilityHint="Your order stays as you typed it"
        />
      ) : (
        <SlideToConfirm
          label={commit.label}
          disabled={!commit.holdable}
          busy={commit.holdable === false && commit.label === "Preparing order…"}
          tone="action"
          surface="solid"
          onConfirm={onConfirm}
          resetKey={resetKey}
          onReset={onReset}
          onAccessibleActivate={onDetails}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  zone: { paddingHorizontal: SIZE.gutter, paddingTop: SPACE.sm, gap: SPACE.sm },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: SPACE.sm },
  inline: { flexDirection: "row", alignItems: "center", gap: SPACE.xs },
  flex: { flex: 1 },
});
