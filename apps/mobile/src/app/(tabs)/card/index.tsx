import { BPS_DENOMINATOR } from "@senryo/core";
import { router } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { Button } from "~/components/kit/Button";
import { Icon } from "~/components/kit/Icon";
import { PreviewBadge } from "~/components/kit/PreviewBadge";
import { Panel, SectionLabel } from "~/components/kit/Surface";
import { ReadingView } from "~/components/kit/states";
import { usePressScale } from "~/components/kit/usePressScale";
import { CollapsingScreen } from "~/components/shell/CollapsingScreen";
import { TabTitle } from "~/components/shell/TabTitle";
import { CardFace } from "~/features/card/CardFace";
import { fire } from "~/feedback/fire";
import { cardAuthRoute, ROUTES } from "~/lib/constants/routes";
import { signedUsd, usd } from "~/lib/money";
import { SAMPLE_CARD } from "~/lib/sample";
import { useSample } from "~/lib/useSample";
import { RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";

const STATE_LABEL = { hold: "Hold", settled: "Settled", declined: "Declined" } as const;
/** A wide plate barely moves under the finger (the same reason as a sheet row). */
const PLATE_PRESS_SCALE = 0.985;

/** A tappable plate (the card face, the spend limit): it shrinks a hair under the finger, with a `tick`. */
function PressPlate({ onPress, hint, children }: { onPress: () => void; hint: string; children: ReactNode }) {
  const press = usePressScale(PLATE_PRESS_SCALE);
  return (
    <Animated.View style={press.style}>
      <Pressable
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        onPress={() => {
          fire("tick");
          onPress();
        }}
        accessibilityRole="button"
        accessibilityHint={hint}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

/**
 * Card tab root (Kinpaku; J7 rebuilds it in S1b.15): face, wallet/freeze, the daily spend allowance meter (D-032) and
 * authorizations, under the shell's fixed header (title, mode, utility row). The limit and the authorizations are
 * borderless filled groups; authorization rows are separated by their own height.
 */
export default function Card() {
  const { color } = useTheme();
  const card = useSample("card", SAMPLE_CARD);
  return (
    <CollapsingScreen left={<TabTitle>Kinpaku</TabTitle>}>
      <PreviewBadge />
      <ReadingView reading={card} loading="plate" loadingLabel="Reading your card">
        {(c) => {
          const left = c.dailyLimit6 - c.spentToday6;
          const leftBps = c.dailyLimit6 === 0n ? 0n : (left * BPS_DENOMINATOR) / c.dailyLimit6;
          const stateTint = { hold: color.gold, settled: color.inkMuted, declined: color.down } as const;
          return (
            <>
              <PressPlate onPress={() => router.push(ROUTES.cardReveal)} hint="Reveal card details">
                <CardFace last4={c.last4} holder={c.holder} expires={c.expires} route={c.route} />
              </PressPlate>
              <Text style={[TYPE.rowDetail, styles.center, { color: color.text3 }]}>Tap to reveal · {c.route}</Text>
              <View style={styles.actions}>
                <Button label="Add to Wallet" onPress={() => router.push(ROUTES.cardWallet)} style={styles.flex} />
                <Button label="Freeze" variant="outline" style={styles.flex} disabled />
              </View>
              {/* A safety action can't look live when it isn't (review R16): disabled, with the reason beside it. */}
              <Text style={[TYPE.meta, styles.center, { color: color.text3 }]}>
                Freeze isn’t available in this preview: there is no issued card behind it yet. It arrives with the card
                service.
              </Text>
              <PressPlate onPress={() => router.push(ROUTES.cardAllowance)} hint="Opens the spend limit">
                <Panel style={styles.limit}>
                  <View style={styles.between}>
                    <View style={styles.inline}>
                      <Icon name="shield" size={SIZE.iconSm} tint={color.up} />
                      <Text style={[TYPE.rowTitle, { color: color.ink }]}>Spend limit · 24h</Text>
                    </View>
                    <Text style={[TYPE.rowPrice, { color: color.up }]}>
                      {usd(left, 0)} / {usd(c.dailyLimit6, 0)}
                    </Text>
                  </View>
                  <View style={[styles.meter, { backgroundColor: color.muted }]}>
                    <View style={{ flex: Number(leftBps), backgroundColor: color.up }} />
                    <View style={{ flex: Number(BPS_DENOMINATOR - leftBps) }} />
                  </View>
                  <View style={styles.between}>
                    <Text style={[TYPE.rowDetail, { color: color.text3 }]}>From Free to spend</Text>
                    <Text style={[TYPE.rowDetail, { color: color.text3 }]}>Resets in {c.resetsIn}</Text>
                  </View>
                </Panel>
              </PressPlate>
              <SectionLabel>Authorizations</SectionLabel>
              <Panel>
                {c.auths.map((a) => (
                  <Pressable
                    key={a.id}
                    onPress={() => {
                      fire("tick");
                      router.push(cardAuthRoute(a.id));
                    }}
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.auth, pressed ? { backgroundColor: color.rowPressed } : null]}
                  >
                    <View style={styles.merchant}>
                      <Text style={[TYPE.row, { color: color.ink }]} numberOfLines={1}>
                        {a.merchant}
                      </Text>
                      <Text style={[TYPE.rowDetail, { color: stateTint[a.state] }]}>{STATE_LABEL[a.state]}</Text>
                    </View>
                    <Text style={[TYPE.rowAmount, { color: color.ink }]}>{signedUsd(-a.amount6)}</Text>
                  </Pressable>
                ))}
              </Panel>
            </>
          );
        }}
      </ReadingView>
    </CollapsingScreen>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: "center" },
  actions: { flexDirection: "row", gap: SPACE.md },
  flex: { flex: 1 },
  limit: { padding: SPACE.lg, gap: SPACE.md },
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  inline: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  meter: { flexDirection: "row", height: SIZE.partitionBar, borderRadius: RADIUS.sm, overflow: "hidden" },
  auth: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.md,
    minHeight: SIZE.rowMinHeight - SPACE.sm,
  },
  merchant: { flex: 1, gap: SPACE.xxs },
});
