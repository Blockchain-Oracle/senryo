import { BPS_DENOMINATOR } from "@senryo/core";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { Icon } from "~/components/kit/Icon";
import { PreviewBadge } from "~/components/kit/PreviewBadge";
import { Screen } from "~/components/kit/Screen";
import { Panel, SectionLabel } from "~/components/kit/Surface";
import { ReadingView } from "~/components/kit/states";
import { CardFace } from "~/features/card/CardFace";
import { fire } from "~/feedback/fire";
import { cardAuthRoute, ROUTES } from "~/lib/constants/routes";
import { signedUsd, usd } from "~/lib/money";
import { notify } from "~/lib/notify";
import { SAMPLE_CARD } from "~/lib/sample";
import { useSample } from "~/lib/useSample";
import { HAIRLINE_PX, RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";

const STATE_LABEL = { hold: "HOLD", settled: "SETTLED", declined: "DECLINED" } as const;

/** Card (D2, Kinpaku): face, wallet/freeze, the daily spend allowance meter (D-032) and authorizations. */
export default function Card() {
  const { color } = useTheme();
  const card = useSample("card", SAMPLE_CARD);
  return (
    <Screen>
      <PreviewBadge />
      <ReadingView reading={card} loading="plate" loadingLabel="Reading your card">
        {(c) => {
          const left = c.dailyLimit6 - c.spentToday6;
          const leftBps = c.dailyLimit6 === 0n ? 0n : (left * BPS_DENOMINATOR) / c.dailyLimit6;
          const stateTint = { hold: color.gold, settled: color.inkMuted, declined: color.down } as const;
          return (
            <>
              <Pressable onPress={() => router.push(ROUTES.cardReveal)} accessibilityHint="Reveal card details">
                <CardFace last4={c.last4} holder={c.holder} expires={c.expires} route={c.route} />
              </Pressable>
              <Text style={[TYPE.label, styles.center, { color: color.inkMuted }]}>
                TAP TO REVEAL · {c.route.toUpperCase()}
              </Text>
              <View style={styles.actions}>
                <Button label="Add to Wallet" onPress={() => router.push(ROUTES.cardWallet)} style={styles.flex} />
                <Button
                  label="Freeze"
                  variant="outline"
                  style={styles.flex}
                  onPress={() =>
                    notify({ title: "Freeze arrives with the card service", description: "Nothing was changed." })
                  }
                />
              </View>
              <Pressable onPress={() => router.push(ROUTES.cardAllowance)} accessibilityRole="button">
                <Panel style={styles.limit}>
                  <View style={styles.between}>
                    <View style={styles.inline}>
                      <Icon name="shield" size={SIZE.iconSm} tint={color.up} />
                      <Text style={[TYPE.label, { color: color.ink }]}>SPEND LIMIT · 24H</Text>
                    </View>
                    <Text style={[TYPE.numSm, { color: color.up }]}>
                      {usd(left, 0)} / {usd(c.dailyLimit6, 0)}
                    </Text>
                  </View>
                  <View style={[styles.meter, { backgroundColor: color.muted }]}>
                    <View style={{ flex: Number(leftBps), backgroundColor: color.up }} />
                    <View style={{ flex: Number(BPS_DENOMINATOR - leftBps) }} />
                  </View>
                  <View style={styles.between}>
                    <Text style={[TYPE.caption, { color: color.inkMuted }]}>from FREE·SPEND</Text>
                    <Text style={[TYPE.caption, { color: color.inkMuted }]}>Resets in {c.resetsIn}</Text>
                  </View>
                </Panel>
              </Pressable>
              <SectionLabel>AUTHORIZATIONS</SectionLabel>
              <Panel>
                {c.auths.map((a, i) => (
                  <Pressable
                    key={a.id}
                    onPress={() => {
                      fire("tick");
                      router.push(cardAuthRoute(a.id));
                    }}
                    accessibilityRole="button"
                    style={[
                      styles.auth,
                      i > 0 ? { borderTopWidth: HAIRLINE_PX, borderTopColor: color.hairline } : null,
                    ]}
                  >
                    <Text style={[TYPE.numSm, styles.flex, { color: color.ink }]}>{a.merchant.toUpperCase()}</Text>
                    <Text style={[TYPE.numSm, { color: stateTint[a.state] }]}>{STATE_LABEL[a.state]}</Text>
                    <Text style={[TYPE.numSm, styles.amount, { color: color.ink }]}>{signedUsd(-a.amount6)}</Text>
                  </Pressable>
                ))}
              </Panel>
            </>
          );
        }}
      </ReadingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: "center" },
  actions: { flexDirection: "row", gap: SPACE.md },
  flex: { flex: 1 },
  limit: { padding: SPACE.md, gap: SPACE.md },
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  inline: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  meter: { flexDirection: "row", height: SIZE.partitionBar, borderRadius: RADIUS.sm, overflow: "hidden" },
  auth: { flexDirection: "row", alignItems: "center", gap: SPACE.md, padding: SPACE.md, minHeight: SIZE.touch },
  amount: { minWidth: SIZE.sparklineWidth, textAlign: "right" },
});
