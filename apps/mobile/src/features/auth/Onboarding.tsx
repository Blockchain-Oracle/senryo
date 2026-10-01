/**
 * First launch (flows F01 1–3): a brand intro (~1.2 s, tap to skip, skipped under Reduce Motion) then three value pages
 * in a paging row with an "N / 3" progress rule. Port of the pre-existing onboarding mechanics (plan §2.4), D2 look;
 * the pages are static plates (no invented prices — the live XAU card joins with real market data in S8).
 */
import { ids } from "@senryo/identity";
import { useEffect, useState } from "react";
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, { FadeIn, FadeOut, useReducedMotion, ZoomIn } from "react-native-reanimated";
import { EntityMark } from "~/components/identity/EntityMark";
import { fire } from "~/feedback/fire";
import { INTRO_HOLD_MS } from "~/lib/constants/auth";
import { DURATION, FONT, RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";

/** The real seal (brand/senryo-seal.svg via @senryo/identity) — never 千 set in a live font (brand/README.md). */
const SEAL = ids.brand("senryo");

const PAGES = [
  {
    kicker: "GOLD · SILVER · CRYPTO",
    title: "Gold, silver and crypto perps.",
    body: "Gold and silver perps at the oracle price on Monad; crypto perps via Perpl. Practice first with test dollars.",
  },
  {
    kicker: "ONE BALANCE",
    title: "Free to trade · Free to spend · Locked.",
    body: "One risk-accounted balance: the same dollar backs your position or your Kinpaku card — never both.",
  },
  {
    kicker: "FACE ID IS YOUR ACCOUNT",
    title: "No seed phrase. No password.",
    body: "A passkey on this phone opens your account on any device with the same passkey — web included.",
  },
] as const;

function Intro({ onDone }: { onDone: () => void }) {
  const { color } = useTheme();
  useEffect(() => {
    fire("snap");
    const t = setTimeout(onDone, INTRO_HOLD_MS);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <Pressable onPress={onDone} accessibilityLabel="Skip intro" style={styles.intro}>
      <Animated.View entering={ZoomIn.duration(DURATION.slow)}>
        <EntityMark id={SEAL} size={SIZE.seal} variant="symbol" decorative />
      </Animated.View>
      <Animated.Text entering={FadeIn.delay(DURATION.base)} style={[styles.word, { color: color.ink }]}>
        SENRYO<Text style={{ color: color.primary }}>/</Text>
        <Text style={{ color: color.inkMuted }}>千両</Text>
      </Animated.Text>
    </Pressable>
  );
}

function Pages() {
  const { color } = useTheme();
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / Math.max(1, width));
    if (next !== page) {
      fire("tick");
      setPage(next);
    }
  };
  return (
    <Animated.View entering={FadeIn.duration(DURATION.slow)} exiting={FadeOut} style={styles.pagesWrap}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        accessibilityRole="adjustable"
        accessibilityLabel={`Page ${page + 1} of ${PAGES.length}`}
      >
        {PAGES.map((p) => (
          <View key={p.kicker} style={[styles.page, { width }]}>
            <Text style={[TYPE.label, { color: color.up }]}>{p.kicker}</Text>
            <Text accessibilityRole="header" style={[TYPE.numLg, { color: color.ink }]}>
              {p.title}
            </Text>
            <Text style={[TYPE.body, { color: color.inkMuted }]}>{p.body}</Text>
          </View>
        ))}
      </ScrollView>
      <View style={styles.progress}>
        <View style={[styles.track, { backgroundColor: color.hairline }]}>
          <View
            style={[
              styles.fill,
              { backgroundColor: color.primary, width: `${((page + 1) / PAGES.length) * FULL_PERCENT}%` },
            ]}
          />
        </View>
        <Text style={[TYPE.numSm, { color: color.inkMuted }]}>
          {page + 1} / {PAGES.length}
        </Text>
      </View>
    </Animated.View>
  );
}

export function Onboarding() {
  const reduced = useReducedMotion();
  const [intro, setIntro] = useState(!reduced);
  return intro ? <Intro onDone={() => setIntro(false)} /> : <Pages />;
}

const FULL_PERCENT = 100;
const PROGRESS_HEIGHT = SPACE.xxs;
const PROGRESS_WIDTH = SIZE.touch + SPACE.xl;

const styles = StyleSheet.create({
  intro: { flex: 1, alignItems: "center", justifyContent: "center", gap: SPACE.lg },
  word: { ...TYPE.numLg, fontFamily: FONT.monoStrong },
  pagesWrap: { flex: 1, justifyContent: "center" },
  page: { paddingHorizontal: SIZE.gutter, gap: SPACE.md, justifyContent: "center" },
  progress: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    paddingHorizontal: SIZE.gutter,
    marginTop: SPACE.xl,
  },
  track: { width: PROGRESS_WIDTH, height: PROGRESS_HEIGHT, borderRadius: RADIUS.pill, overflow: "hidden" },
  fill: { height: PROGRESS_HEIGHT, borderRadius: RADIUS.pill },
});
