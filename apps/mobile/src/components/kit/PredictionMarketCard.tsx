/**
 * React Native port of 21st:isaiahbjork/prediction-market-card (#2537; the web's `prediction-market-card.tsx`): a
 * yes/no question with its pool, each side's stakes, Yes's share as a split bar, and Yes / No; choosing a side slides
 * the call view up inside the card (an exact amount, presets, what it would pay as the pools stand) and Confirm places
 * it. As on the web: the pools are the book's, a panel one step above its ground (no border), the kit's button geometry
 * and 0.97 press, an exact amount in dollars and cents, both sides' marks, the receipt in place once the call lands.
 */
import { formatUnits, parseUnits } from "@senryo/core";
import { type ReactNode, useEffect, useState } from "react";
import { type LayoutChangeEvent, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { fire } from "~/feedback/fire";
import { BUTTON, DISABLED_OPACITY, RADIUS, SIZE, SPACE, SPRING, TYPE, useTheme } from "~/theme";
import { useGroupFill } from "./Surface";
import { ArrowLeft } from "./symbols";
import { usePressScale } from "./usePressScale";

const DOLLAR_DECIMALS = 6;
const CENTS = 2;
const PERCENT = 100;
const BAR = 12;
const CLOSING_BAR = 4;
/** The question behind the call view: lifted, dimmed and shrunk (the source's values). */
const BEHIND_LIFT = -20;
const BEHIND_OPACITY = 0.3;
const BEHIND_SCALE = 0.95;
const SKEW_WIDTH = 8;
/** The divider overhangs the bar by a quarter of its height above and below (the source's 150 %). */
const SKEW_OVERHANG = 3;
const SKEW_HEIGHT = 18;
const usd = (v: bigint) => `$${formatUnits(v, DOLLAR_DECIMALS, CENTS)}`;

export interface PredictionCallView {
  title: string;
  lines: readonly string[];
  action?: { label: string; onPress: () => void };
  /** A secondary link (the transaction). */
  link?: { label: string; onPress: () => void };
}

export function PredictionMarketCard(p: {
  marks: ReactNode;
  meta: string;
  question: string;
  onQuestion?: () => void;
  clock: string | null;
  closing: number;
  pools: { yes: bigint; no: bigint };
  calls: number;
  open: boolean;
  status: string;
  limits: { min: bigint; max: bigint };
  presets: readonly bigint[];
  balance: bigint | undefined;
  estimate: (yes: boolean, stake: bigint) => string;
  busy: string | null;
  onConfirm: (yes: boolean, stake: bigint) => Promise<boolean>;
  receipt: PredictionCallView | null;
  blocked?: string | null;
}) {
  const { color } = useTheme();
  const fill = useGroupFill();
  const reduce = useReducedMotion();
  const [side, setSide] = useState<boolean | null>(null);
  const [text, setText] = useState("");
  const [height, setHeight] = useState(0);
  const total = p.pools.yes + p.pools.no;
  const share = total === 0n ? null : Number((p.pools.yes * BigInt(PERCENT)) / total);
  const parsed = parseUnits(text === "" ? "0" : text, DOLLAR_DECIMALS);
  const stake = parsed.ok ? parsed.value : 0n;
  const problem = !parsed.ok
    ? "Dollars and cents only"
    : stake === 0n
      ? null
      : stake < p.limits.min
        ? `At least ${usd(p.limits.min)}`
        : stake > p.limits.max
          ? `At most ${usd(p.limits.max)}`
          : p.balance !== undefined && stake > p.balance
            ? "More than your balance"
            : null;
  const ready = side !== null && stake > 0n && problem === null && p.busy === null;
  const showForm = side !== null || p.receipt !== null;

  const t = useSharedValue(0);
  useEffect(() => {
    t.value = reduce ? (showForm ? 1 : 0) : withSpring(showForm ? 1 : 0, SPRING.tallDetail);
  }, [showForm, reduce, t]);
  const front = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0, 1], [1, BEHIND_OPACITY]),
    transform: [
      { translateY: interpolate(t.value, [0, 1], [0, BEHIND_LIFT]) },
      { scale: interpolate(t.value, [0, 1], [1, BEHIND_SCALE]) },
    ],
  }));
  const over = useAnimatedStyle(() => ({
    opacity: t.value,
    transform: [{ translateY: interpolate(t.value, [0, 1], [height, 0]) }],
  }));

  const choose = (yes: boolean) => {
    fire("tick");
    setSide(yes);
  };
  const back = () => {
    setSide(null);
    setText("");
  };
  const confirm = async () => {
    if (side === null || !ready) return;
    if (await p.onConfirm(side, stake)) back();
  };

  return (
    <View
      style={[styles.card, { backgroundColor: fill }]}
      onLayout={(e: LayoutChangeEvent) => setHeight(e.nativeEvent.layout.height)}
    >
      <Animated.View
        style={[styles.body, front]}
        importantForAccessibility={showForm ? "no-hide-descendants" : "auto"}
        accessibilityElementsHidden={showForm}
      >
        <View style={styles.row}>
          <Text numberOfLines={1} style={[TYPE.caption, styles.flex, { color: color.inkMuted }]}>
            {p.meta}
          </Text>
          {p.clock ? <Text style={[TYPE.caption, styles.strong, { color: color.ink }]}>{p.clock}</Text> : null}
        </View>
        <View style={styles.question}>
          <View style={styles.marks}>{p.marks}</View>
          <Text
            onPress={p.onQuestion}
            accessibilityRole={p.onQuestion ? "link" : "text"}
            style={[TYPE.rowTitle, styles.flex, { color: color.ink }]}
          >
            {p.question}
          </Text>
        </View>
        <View style={styles.figures}>
          <Figure label="Pool" value={usd(total)} ink={color.ink} />
          <Figure label="On Yes" value={usd(p.pools.yes)} ink={color.up} />
          <Figure label="On No" value={usd(p.pools.no)} ink={color.down} />
        </View>
        <View style={styles.row}>
          <Text style={[TYPE.sectionTitle, { color: color.up }]}>{share === null ? "—" : `${share}%`}</Text>
          <Text style={[TYPE.caption, { color: color.inkMuted }]}>
            {p.calls === 1 ? "1 call" : `${p.calls} calls`} · share of stakes
          </Text>
          <Text style={[TYPE.sectionTitle, { color: color.down }]}>{share === null ? "—" : `${PERCENT - share}%`}</Text>
        </View>
        <View
          accessible
          accessibilityLabel={share === null ? "Nothing staked yet" : `${share}% of stakes on Yes`}
          style={[styles.bar, { backgroundColor: share === null ? color.raised2 : color.down }]}
        >
          {share === null ? null : (
            <>
              <View style={[styles.barFill, { width: `${share}%`, backgroundColor: color.up }]} />
              <View style={[styles.skew, { left: `${share}%`, backgroundColor: fill }]} />
            </>
          )}
        </View>
        {p.open ? (
          <View style={styles.sides}>
            <SideButton yes onPress={() => choose(true)} disabled={Boolean(p.blocked)} />
            <SideButton yes={false} onPress={() => choose(false)} disabled={Boolean(p.blocked)} />
          </View>
        ) : null}
        <Text accessibilityLiveRegion="polite" style={[TYPE.caption, { color: color.inkMuted }]}>
          {p.open && p.blocked ? p.blocked : p.status}
        </Text>
      </Animated.View>

      {showForm ? (
        <Animated.View style={[StyleSheet.absoluteFill, styles.body, { backgroundColor: fill }, over]}>
          {p.receipt ? (
            <Receipt receipt={p.receipt} />
          ) : (
            <>
              <View style={styles.row}>
                <Pressable onPress={back} accessibilityRole="button" hitSlop={SPACE.sm} style={styles.back}>
                  <ArrowLeft size={SIZE.iconSm} color={color.inkMuted} />
                  <Text style={[TYPE.caption, { color: color.inkMuted }]}>Back</Text>
                </Pressable>
                {p.clock ? <Text style={[TYPE.caption, styles.strong, { color: color.ink }]}>{p.clock}</Text> : null}
              </View>
              <View style={styles.center}>
                <Text style={[TYPE.caption, { color: color.inkMuted }]}>Your call</Text>
                <Text style={[TYPE.sectionTitle, { color: side ? color.up : color.down }]}>{side ? "Yes" : "No"}</Text>
              </View>
              <View style={[styles.input, { backgroundColor: color.raised2 }]}>
                <Text style={[TYPE.sectionTitle, { color: color.inkMuted }]}>$</Text>
                <TextInput
                  value={text}
                  onChangeText={(v) => setText(v.replace(/[^0-9.,]/g, ""))}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={color.inkMuted}
                  accessibilityLabel="Stake in dollars"
                  style={[TYPE.sectionTitle, styles.flex, { color: color.ink }]}
                />
              </View>
              <View style={styles.presets}>
                {p.presets.map((v) => (
                  <Preset
                    key={v.toString()}
                    label={usd(v).replace(".00", "")}
                    on={stake === v}
                    onPress={() => setText(formatUnits(v, DOLLAR_DECIMALS, CENTS))}
                  />
                ))}
              </View>
              <Text accessibilityLiveRegion="polite" style={[TYPE.caption, { color: color.inkMuted }]}>
                {p.busy ?? problem ?? (side !== null && stake > 0n ? p.estimate(side, stake) : "Pick or type a stake")}
              </Text>
              <View style={styles.flex} />
              <SideButton
                yes={side ?? true}
                label={p.busy ?? `Call ${side ? "Yes" : "No"}${stake > 0n ? ` · ${usd(stake)}` : ""}`}
                onPress={() => void confirm()}
                disabled={!ready}
              />
            </>
          )}
        </Animated.View>
      ) : null}

      <View style={[styles.closing, { backgroundColor: color.raised2 }]}>
        <View
          style={[
            styles.closingFill,
            { width: `${Math.round(Math.max(0, Math.min(1, p.closing)) * PERCENT)}%`, backgroundColor: color.down },
          ]}
        />
      </View>
    </View>
  );
}

function Figure(p: { label: string; value: string; ink: string }) {
  const { color } = useTheme();
  return (
    <View style={styles.flex}>
      <Text style={[TYPE.caption, { color: color.inkMuted }]}>{p.label}</Text>
      <Text numberOfLines={1} style={[TYPE.rowTitle, { color: p.ink }]}>
        {p.value}
      </Text>
    </View>
  );
}

function SideButton(p: { yes: boolean; onPress: () => void; disabled: boolean; label?: string }) {
  const { color } = useTheme();
  const press = usePressScale();
  return (
    <Animated.View style={[styles.flex, press.style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: p.disabled }}
        disabled={p.disabled}
        onPress={p.onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={[
          styles.sideButton,
          { backgroundColor: p.yes ? color.up : color.down, opacity: p.disabled ? DISABLED_OPACITY : 1 },
        ]}
      >
        <Text style={[TYPE.buttonLabel, { color: p.yes ? color.upForeground : color.downForeground }]}>
          {p.label ?? (p.yes ? "Yes" : "No")}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

function Preset(p: { label: string; on: boolean; onPress: () => void }) {
  const { color } = useTheme();
  const press = usePressScale();
  return (
    <Animated.View style={[styles.flex, press.style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: p.on }}
        onPress={() => {
          fire("tick");
          p.onPress();
        }}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={[styles.preset, { backgroundColor: p.on ? color.primary : color.raised2 }]}
      >
        <Text style={[TYPE.rowTitle, { color: p.on ? color.primaryForeground : color.ink }]}>{p.label}</Text>
      </Pressable>
    </Animated.View>
  );
}

function Receipt({ receipt }: { receipt: PredictionCallView }) {
  const { color } = useTheme();
  return (
    <View style={styles.receipt} accessibilityLiveRegion="polite">
      <Text style={[TYPE.sectionTitle, { color: color.ink }]}>{receipt.title}</Text>
      {receipt.lines.map((line) => (
        <Text key={line} style={[TYPE.caption, { color: color.inkMuted }]}>
          {line}
        </Text>
      ))}
      {receipt.link ? (
        <Text
          accessibilityRole="link"
          onPress={receipt.link.onPress}
          style={[TYPE.caption, styles.link, { color: color.ink }]}
        >
          {receipt.link.label}
        </Text>
      ) : null}
      <View style={styles.flex} />
      {receipt.action ? (
        <Pressable
          accessibilityRole="button"
          onPress={receipt.action.onPress}
          style={[styles.sideButton, { backgroundColor: color.raised2 }]}
        >
          <Text style={[TYPE.buttonLabel, { color: color.ink }]}>{receipt.action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: RADIUS.lg, overflow: "hidden" },
  body: { padding: SPACE.md, gap: SPACE.md },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: SPACE.sm },
  flex: { flex: 1 },
  strong: { fontWeight: "600" },
  question: { flexDirection: "row", alignItems: "flex-start", gap: SPACE.sm },
  marks: { flexDirection: "row", gap: SPACE.xxs },
  figures: { flexDirection: "row", gap: SPACE.sm },
  bar: { height: BAR, borderRadius: RADIUS.xs / 2, overflow: "hidden" },
  barFill: { position: "absolute", top: 0, bottom: 0, left: 0 },
  skew: {
    position: "absolute",
    top: -SKEW_OVERHANG,
    height: SKEW_HEIGHT,
    width: SKEW_WIDTH,
    transform: [{ translateX: -SKEW_WIDTH }, { skewX: "-15deg" }],
  },
  sides: { flexDirection: "row", gap: SPACE.sm },
  sideButton: {
    height: SIZE.buttonHeight,
    borderRadius: BUTTON.radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACE.md,
  },
  back: { flexDirection: "row", alignItems: "center", gap: SPACE.xs, minHeight: SIZE.touch },
  center: { alignItems: "center", gap: SPACE.xxs },
  input: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.xs,
    height: SIZE.buttonHeight,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACE.md,
  },
  presets: { flexDirection: "row", gap: SPACE.xs },
  preset: { height: SIZE.buttonHeightSm, borderRadius: RADIUS.sm, alignItems: "center", justifyContent: "center" },
  receipt: { flex: 1, gap: SPACE.sm },
  link: { textDecorationLine: "underline" },
  closing: { height: CLOSING_BAR },
  closingFill: { height: CLOSING_BAR },
});
