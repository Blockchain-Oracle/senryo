/**
 * The terminal's five-step tour on the phone (R5.15; the web's `Tutorial`, Owarine's reworded for calls and rides):
 * full screen over everything — progress dashes, Back and Skip; a drawn illustration (the line, UP and DOWN, the line
 * with its PnL pill, a trailing stop, CLOSE); "Step N", a title and a sentence, the network named on every step; Next,
 * and on the last step Start. Each step rises in; under Reduce Motion it simply appears.
 */
import { TOUR_STEPS, tourNote } from "@senryo/calls";
import { TESTNET_CHAIN_ID } from "@senryo/config";
import { useQueryEnv } from "@senryo/query";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Line, Path } from "react-native-svg";
import { Button } from "~/components/kit/Button";
import { fire } from "~/feedback/fire";
import { FONT, SIZE, SPACE, TYPE, useTheme } from "~/theme";

const PATH = "M8 120 C 50 110, 70 70, 110 80 S 170 40, 210 52 S 260 30, 292 26";
const ART = { width: 288, height: 176, viewW: 300, viewH: 150, radius: 20 } as const;
const STEP = { buttons: 1, pnl: 2, trail: 3, close: 4 } as const;
const DOT = { on: 24, off: 6, height: 6 } as const;
const RISE_MS = 200;
const LINE_W = 3;
const TRAIL_DASH = "6 4";
const PILL_PAD = 10;

function Pill({ label, fill, ink, style }: { label: string; fill: string; ink: string; style: object }) {
  return (
    <View style={[styles.pill, { backgroundColor: fill }, style]}>
      <Text style={[styles.pillText, { color: ink }]}>{label}</Text>
    </View>
  );
}

function Illustration({ step }: { step: number }) {
  const { color } = useTheme();
  return (
    <View style={[styles.art, { backgroundColor: color.raised2 }]}>
      {step === STEP.buttons ? (
        <View style={styles.buttons}>
          <Pill label="↑ UP" fill={color.up} ink={color.ground} style={styles.big} />
          <Pill label="↓ DOWN" fill={color.down} ink={color.ground} style={styles.big} />
        </View>
      ) : (
        <Svg width={ART.width} height={ART.height} viewBox={`0 0 ${ART.viewW} ${ART.viewH}`}>
          {step === STEP.trail ? (
            <Line x1="8" x2="292" y1="78" y2="78" stroke={color.up} strokeDasharray={TRAIL_DASH} strokeWidth={1.5} />
          ) : null}
          <Path d={PATH} fill="none" stroke={color.up} strokeWidth={LINE_W} strokeLinecap="round" />
          <Circle cx="292" cy="26" r="4" fill={color.up} />
        </Svg>
      )}
      {step === STEP.pnl || step === STEP.close ? (
        <Pill label="+$1.24" fill={color.up} ink={color.ground} style={styles.topRight} />
      ) : null}
      {step === STEP.trail ? (
        <Pill label="↗ Trailing" fill={color.up} ink={color.ground} style={styles.bottom} />
      ) : null}
      {step === STEP.close ? (
        <Pill label="✕ CLOSE $6.24" fill={color.ink} ink={color.ground} style={styles.bottom} />
      ) : null}
    </View>
  );
}

export function Tutorial({ onDone }: { onDone: () => void }) {
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const { chainId } = useQueryEnv();
  const [step, setStep] = useState(0);
  const s = TOUR_STEPS[step] ?? TOUR_STEPS[0];
  const last = step === TOUR_STEPS.length - 1;
  const finish = () => {
    fire("tick");
    setStep(0);
    onDone();
  };
  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        styles.screen,
        { backgroundColor: color.ground, paddingTop: insets.top + SPACE.sm, paddingBottom: insets.bottom + SPACE.md },
      ]}
      accessibilityViewIsModal
    >
      <View style={styles.head}>
        <Pressable
          accessibilityRole="button"
          disabled={step === 0}
          onPress={() => {
            fire("tick");
            setStep(step - 1);
          }}
          style={[styles.headButton, step === 0 ? styles.hidden : null]}
        >
          <Text style={[TYPE.row, { color: color.text3 }]}>‹ Back</Text>
        </Pressable>
        <View style={styles.dots} accessible accessibilityLabel={`Step ${step + 1} of ${TOUR_STEPS.length}`}>
          {TOUR_STEPS.map((t, i) => (
            <View
              key={t.title}
              style={[
                styles.dot,
                { width: i === step ? DOT.on : DOT.off, backgroundColor: i === step ? color.primary : color.muted },
              ]}
            />
          ))}
        </View>
        <Pressable accessibilityRole="button" onPress={finish} style={styles.headButton}>
          <Text style={[TYPE.row, { color: color.text3 }]}>Skip</Text>
        </Pressable>
      </View>
      <Animated.View key={step} {...(reduce ? {} : { entering: FadeInDown.duration(RISE_MS) })} style={styles.body}>
        <Illustration step={step} />
        <Text style={[styles.step, { color: color.inkMuted }]}>STEP {step + 1}</Text>
        <Text style={[TYPE.pageTitle, styles.center, { color: color.ink }]} accessibilityRole="header">
          {s.title}
        </Text>
        <Text style={[TYPE.body, styles.center, { color: color.text2 }]}>{s.body}</Text>
        <Text style={[TYPE.caption, styles.center, { color: color.text3 }]}>
          {tourNote(chainId === TESTNET_CHAIN_ID)}
        </Text>
      </Animated.View>
      <View style={styles.foot}>
        <Button
          label={last ? "Start" : "Next"}
          onPress={() => {
            if (last) return finish();
            fire("tick");
            setStep(step + 1);
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { zIndex: 100 },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SIZE.gutter,
  },
  headButton: { minHeight: SIZE.touch, minWidth: SIZE.touch, justifyContent: "center" },
  hidden: { opacity: 0 },
  dots: { flexDirection: "row", gap: SPACE.xs },
  dot: { height: DOT.height, borderRadius: DOT.height / 2 },
  body: { flex: 1, alignItems: "center", justifyContent: "center", gap: SPACE.md, paddingHorizontal: SPACE.xl },
  art: {
    width: ART.width,
    height: ART.height,
    borderRadius: ART.radius,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  buttons: { flexDirection: "row", gap: SPACE.md },
  pill: { borderRadius: SIZE.touch, paddingHorizontal: PILL_PAD, paddingVertical: SPACE.xs },
  pillText: { fontFamily: FONT.sansBold, fontSize: 13, lineHeight: 18 },
  big: { paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md },
  topRight: { position: "absolute", top: SPACE.md, right: SPACE.md },
  bottom: { position: "absolute", bottom: SPACE.md, alignSelf: "center" },
  step: { fontFamily: FONT.sansBold, fontSize: 12, lineHeight: 16, letterSpacing: 1.2 },
  center: { textAlign: "center" },
  foot: { paddingHorizontal: SIZE.gutter },
});
