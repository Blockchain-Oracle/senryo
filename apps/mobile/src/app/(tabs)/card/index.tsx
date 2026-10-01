import { BPS_DENOMINATOR } from "@senryo/core";
import { useAccountRisk } from "@senryo/query";
import { router, useFocusEffect } from "expo-router";
import { type ReactNode, useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { Button } from "~/components/kit/Button";
import { Panel } from "~/components/kit/Surface";
import { ReadingView, Skeleton } from "~/components/kit/states";
import { usePressScale } from "~/components/kit/usePressScale";
import { CollapsingScreen } from "~/components/shell/CollapsingScreen";
import { TabTitle } from "~/components/shell/TabTitle";
import { AuthorizationRow } from "~/features/card/AuthorizationRow";
import { CardFace } from "~/features/card/CardFace";
import { CardHero } from "~/features/card/CardHero";
import { SampleTag } from "~/features/card/SampleTag";
import { fire } from "~/feedback/fire";
import { useAccount } from "~/lib/account/provider";
import { ROUTES } from "~/lib/constants/routes";
import { usd } from "~/lib/money";
import { useNetwork } from "~/lib/network";
import { SAMPLE_CARD } from "~/lib/sample";
import { STORAGE_KEYS, storage } from "~/lib/storage";
import { useSample } from "~/lib/useSample";
import { HERO_FONT_SCALE, RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";

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
 * Card tab root (J7; Solflare S15/S18 adapted): the Kinpaku card as the hero, one line of its state, then the real
 * **Free to spend** — what your positions don't need, which is all the card can ever draw on — as the page's figure,
 * the controls, the daily limit (D-032) as a filled cell, and authorizations as bare rows. There is no issued card or
 * card service yet: the card's number, limit and authorizations are sample data and each such section says so with a
 * small tag. Freeze stays disabled with its reason (review R16). The first visit opens the short tutorial (C21).
 */
export default function Card() {
  const { color } = useTheme();
  const network = useNetwork();
  const card = useSample("card", SAMPLE_CARD);
  const practice = network.key === "testnet";
  useFocusEffect(
    useCallback(() => {
      if (!storage.getBoolean(STORAGE_KEYS.cardIntroSeen)) router.push(ROUTES.cardIntro);
    }, []),
  );
  return (
    <CollapsingScreen left={<TabTitle>Kinpaku</TabTitle>}>
      <ReadingView reading={card} loading="plate" loadingLabel="Reading your card">
        {(c) => {
          const left = c.dailyLimit6 - c.spentToday6;
          const leftBps = c.dailyLimit6 === 0n ? 0n : (left * BPS_DENOMINATOR) / c.dailyLimit6;
          return (
            <>
              <View style={styles.hero}>
                <PressPlate onPress={() => router.push(ROUTES.cardReveal)} hint="Card details">
                  <CardHero>
                    <CardFace last4={c.last4} holder={c.holder} expires={c.expires} route={c.route} />
                  </CardHero>
                </PressPlate>
                <Text style={[TYPE.rowDetail, styles.center, { color: color.text3 }]}>
                  {practice ? "Sandbox card · no charge" : "Preview · no card has been issued yet"} ·{" "}
                  <Text
                    accessibilityRole="link"
                    onPress={() => router.push(ROUTES.cardIntro)}
                    style={{ color: color.link }}
                  >
                    How it works
                  </Text>
                </Text>
              </View>
              <FreeToSpend />
              <View style={styles.controls}>
                <View style={styles.actions}>
                  <Button label="Add to Wallet" onPress={() => router.push(ROUTES.cardWallet)} style={styles.flex} />
                  <Button label="Freeze" variant="outline" style={styles.flex} disabled />
                </View>
                {/* A safety action can't look live when it isn't (review R16): disabled, with the reason beside it. */}
                <Text style={[TYPE.meta, styles.center, { color: color.text3 }]}>
                  Freeze arrives with the card service: there is no issued card behind this preview yet.
                </Text>
              </View>
              <PressPlate onPress={() => router.push(ROUTES.cardAllowance)} hint="Opens the spend limit">
                <Panel style={styles.limit}>
                  <View style={styles.between}>
                    <Text style={[TYPE.rowTitle, styles.shrink, { color: color.ink }]}>Spend limit · 24h</Text>
                    <Text style={[TYPE.rowPrice, { color: color.ink }]}>
                      {usd(left, 0)} <Text style={{ color: color.text3 }}>of {usd(c.dailyLimit6, 0)}</Text>
                    </Text>
                  </View>
                  <View style={[styles.meter, { backgroundColor: color.raised2 }]}>
                    <View style={{ flex: Number(leftBps), backgroundColor: color.gold }} />
                    <View style={{ flex: Number(BPS_DENOMINATOR - leftBps) }} />
                  </View>
                  <View style={styles.between}>
                    <Text style={[TYPE.rowDetail, { color: color.text3 }]}>Resets in {c.resetsIn}</Text>
                    <SampleTag />
                  </View>
                </Panel>
              </PressPlate>
              <View>
                <View style={styles.heading}>
                  <Text accessibilityRole="header" style={[TYPE.sectionTitle, { color: color.ink }]}>
                    Authorizations
                  </Text>
                  <SampleTag />
                </View>
                {c.auths.map((a) => (
                  <AuthorizationRow key={a.id} auth={a} />
                ))}
              </View>
            </>
          );
        }}
      </ReadingView>
    </CollapsingScreen>
  );
}

/** The real figure: what the card can draw on, from the account's risk read. A guest is invited instead. */
function FreeToSpend() {
  const { color } = useTheme();
  const address = useAccount().hint?.address;
  const risk = useAccountRisk(address, "finalized");
  if (!address) {
    return (
      <View style={styles.figure}>
        <Text style={[TYPE.body, { color: color.text2 }]}>
          Kinpaku spends what your positions don’t need. Create an account to see yours.
        </Text>
        <Button label="Create account" block={false} onPress={() => router.push(ROUTES.accountRequired)} />
      </View>
    );
  }
  const value = risk.status === "fresh" || risk.status === "stale" ? risk.value.freeToSpend : undefined;
  return (
    <View
      style={styles.figure}
      accessible
      accessibilityLabel={value === undefined ? "Free to spend, loading" : `Free to spend ${usd(value)}`}
    >
      <Text style={[TYPE.rowDetail, { color: color.text3 }]}>Free to spend</Text>
      {value === undefined ? (
        <Skeleton width="50%" height={TYPE.displayBalance.lineHeight ?? SIZE.skeletonPlate} />
      ) : (
        <Text
          maxFontSizeMultiplier={HERO_FONT_SCALE}
          adjustsFontSizeToFit
          numberOfLines={1}
          style={[TYPE.displayBalance, { color: color.ink }]}
        >
          {usd(value)}
        </Text>
      )}
      <Text style={[TYPE.rowDetail, { color: color.text2 }]}>
        What your positions don’t need. The card can never spend margin.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // The card rests tilted: a little inset keeps its corners inside the screen.
  hero: { gap: SPACE.md, paddingTop: SPACE.sm, paddingHorizontal: SPACE.sm },
  center: { textAlign: "center" },
  figure: { gap: SPACE.xs },
  controls: { gap: SPACE.sm },
  actions: { flexDirection: "row", gap: SPACE.md },
  flex: { flex: 1 },
  limit: { padding: SPACE.lg, gap: SPACE.md },
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: SPACE.sm },
  shrink: { flexShrink: 1 },
  heading: { flexDirection: "row", alignItems: "center", gap: SPACE.sm, paddingBottom: SPACE.xs },
  meter: { flexDirection: "row", height: SIZE.partitionBar, borderRadius: RADIUS.pill, overflow: "hidden" },
});
