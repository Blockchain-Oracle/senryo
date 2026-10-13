/**
 * Lucky on the phone (S8.8, D-295; the web's `LuckyScreen`): a machine (R7.4) — three reels in the arena behind a gold
 * rim and a payline, a lever that swings down — lands on a draw sealed before this device's seed existed. The reels
 * ratchet, then stop 720 / 980 / 1240 ms after the draw, each with a thunk a step up the chord and a firmer haptic;
 * the top reach rings the jackpot. The deal is priced live; one tap places it as an ordinary call (one-tap or Face
 * ID). The games bed plays from the first pull. The proof and your draws with the streak below. The flow is
 * `@senryo/calls` `useLuckyFlow`, the web's own.
 */
import { luckyBandWord, useLuckyFlow } from "@senryo/calls/react";
import { LUCKY_STAKES_USD } from "@senryo/config";
import { clockText, LUCKY_REACHES, lane, usd } from "@senryo/core";
import { marketId } from "@senryo/identity";
import { PixelMark } from "@senryo/identity/native";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EntityMark } from "~/components/identity/EntityMark";
import { Button } from "~/components/kit/Button";
import { usePullRefresh } from "~/components/kit/PullRefresh";
import { SlotReel } from "~/components/kit/SlotReel";
import { Panel } from "~/components/kit/Surface";
import { celebrate } from "~/feedback/celebrate";
import { playCue } from "~/feedback/cues";
import { fire, music } from "~/feedback/fire";
import { useAccount } from "~/lib/account/provider";
import { accountRequiredRoute } from "~/lib/constants/routes";
import { notify } from "~/lib/notify";
import { RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { pixelColors } from "~/theme/pixel-colors";

const USD = 1_000_000n;
const STAKES = LUCKY_STAKES_USD.map((d) => BigInt(d) * USD);
const DEFAULT_STAKE = STAKES[1] ?? USD;
/** A reel row's mark, inside its 36-point row. */
const FACE = 22;
const SIDES = ["Up", "Down"];
const REACHES = LUCKY_REACHES.map((r) => `${r}×`);
const HUNDRED = 100n;
const CENTS_DIGITS = 2;
/** The stagger: each reel stops this long after the draw is known (research 10 §3). */
const FIRST_STOP_MS = 720;
const STOP_GAP_MS = 260;
const STOPS_MS = [FIRST_STOP_MS, FIRST_STOP_MS + STOP_GAP_MS, FIRST_STOP_MS + STOP_GAP_MS * 2] as const;
/** Light, medium, firm: each reel's thunk lands harder. */
const LAND_HAPTICS = ["tick", "snap", "impact"] as const;
const TOP_REACH = LUCKY_REACHES[LUCKY_REACHES.length - 1];
/** The lever's swing (deg) and its springy return. */
const LEVER_PULL_DEG = 48;
const LEVER_PULL_MS = 140;
const LEVER_SPRING = { damping: 9, stiffness: 220 } as const;
const LEVER_W = 10;
const LEVER_H = 92;
const BALL = 26;
const RIM = 2;
const tick = () => playCue("reelTick");
const multipleText = (e2: bigint) => `${e2 / HUNDRED}.${(e2 % HUNDRED).toString().padStart(CENTS_DIGITS, "0")}×`;

export function LuckyScreen() {
  // Pull down refreshes the page (D4: the owner's iPhone review — every screen with data refreshes).
  const refresh = usePullRefresh();
  const { color } = useTheme();
  const pixels = pixelColors(color);
  const insets = useSafeAreaInsets();
  const account = useAccount();
  const [stake, setStake] = useState<bigint>(DEFAULT_STAKE);
  const [spinId, setSpinId] = useState(0);
  const [landed, setLanded] = useState(0);
  const reduce = useReducedMotion();
  const lever = useSharedValue(0);
  const leverStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${lever.value}deg` }] }));
  useEffect(() => () => music(null), []);
  const flow = useLuckyFlow(account, {
    cue: (c) =>
      c === "spin"
        ? fire("press", { cue: "reelSpin" })
        : c === "filled"
          ? fire("filled", { cue: "open" })
          : c === "fail"
            ? fire("fail", { cue: "error" })
            : fire(c),
    notify: (n) => notify({ ...n, tone: "warning" }),
    needAccount: () => router.push(accountRequiredRoute("make a call", "/games/lucky")),
  });
  const r = flow.reveal;
  const spinning = flow.phase === "spinning" || (spinId > 0 && landed < spinId);
  const q = flow.dealt ? flow.quoteFor(stake) : null;
  const spin = () => {
    music("games");
    if (!reduce)
      lever.value = withSequence(withTiming(LEVER_PULL_DEG, { duration: LEVER_PULL_MS }), withSpring(0, LEVER_SPRING));
    setSpinId((n) => n + 1);
    void flow.spin();
  };
  // Each reel's thunk climbs the chord; the third lands the draw, and the top reach rings the jackpot.
  const land = (i: number) => {
    fire(LAND_HAPTICS[i] ?? "snap", { ladder: ["reelLock", i] });
    if (i === STOPS_MS.length - 1) {
      setLanded(spinId);
      if (r?.reach === TOP_REACH) {
        fire("win", { cue: "jackpot" });
        celebrate();
      }
    }
  };
  return (
    <ScrollView
      refreshControl={refresh}
      style={{ backgroundColor: color.ground }}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACE.xl }]}
    >
      <Text style={[TYPE.body, { color: color.inkMuted }]}>A sealed draw picks a market, a side and a reach</Text>
      <View style={[styles.machine, { backgroundColor: color.arena, borderColor: color.gold }]}>
        <View style={styles.reels}>
          <SlotReel
            label="Market"
            items={flow.seal?.markets ?? ["BTC", "ETH", "SOL", "NVDA", "XAU"]}
            target={r ? r.symbol : null}
            spinId={spinId}
            machine
            stopAfterMs={STOPS_MS[0]}
            onTick={tick}
            onLand={() => land(0)}
            face={(symbol) => <EntityMark id={marketId(symbol)} size={FACE} decorative />}
          />
          <SlotReel
            label="Side"
            items={SIDES}
            target={r ? (r.side === "up" ? "Up" : "Down") : null}
            spinId={spinId}
            machine
            stopAfterMs={STOPS_MS[1]}
            onLand={() => land(1)}
            face={(side) => <PixelMark name={side === "Up" ? "bull" : "bear"} size={FACE} colors={pixels} />}
          />
          <SlotReel
            label="Reach"
            items={REACHES}
            target={r ? `${r.reach}×` : null}
            spinId={spinId}
            machine
            stopAfterMs={STOPS_MS[2]}
            onLand={() => land(2)}
            face={() => <PixelMark name="plate" size={FACE} colors={pixels} />}
          />
        </View>
        <View pointerEvents="none" style={[styles.payline, { borderColor: color.gold }]} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Pull the lever to spin"
          disabled={spinning || flow.phase === "placing"}
          onPress={spin}
          hitSlop={SPACE.md}
          style={styles.leverHit}
        >
          <Animated.View style={[styles.lever, { backgroundColor: color.gold }, leverStyle]}>
            <View style={[styles.ball, { backgroundColor: color.downFill }]} />
          </Animated.View>
        </Pressable>
      </View>

      {flow.phase === "dealt" && flow.dealt && !spinning ? (
        <Panel style={styles.deal}>
          <Text style={[TYPE.caption, { color: color.inkMuted }]}>The deal</Text>
          <Text style={[TYPE.sectionTitle, { color: color.ink }]}>
            {flow.dealt.symbol} · {lane(flow.dealt.cadenceSec)} · {luckyBandWord(flow.dealt.band)}
          </Text>
          <Text style={[TYPE.body, { color: color.inkMuted }]}>
            {q ? `Pays ${multipleText(q.multipleE2)} now · ${usd(q.payout)} on ${usd(stake)}` : "Not priced right now"}
          </Text>
          <Text style={[TYPE.caption, { color: color.inkMuted }]}>
            Calls close in {clockText(Math.max(0, flow.window.closesIn))}
            {q?.drifted ? " · the price moved since the deal" : ""}
          </Text>
        </Panel>
      ) : flow.phase === "nothing" && !spinning ? (
        <Text style={[TYPE.body, { color: color.inkMuted }]}>
          Nothing on {r?.symbol} has room right now · spin again
        </Text>
      ) : flow.phase === "placed" ? (
        <Panel style={styles.deal}>
          <Text style={[TYPE.sectionTitle, { color: color.ink }]}>Placed</Text>
          <Text style={[TYPE.body, { color: color.inkMuted }]}>It pays out on its own when the window closes</Text>
        </Panel>
      ) : null}

      <View accessibilityRole="radiogroup" style={styles.stakes}>
        {STAKES.map((v) => (
          <Pressable
            key={v.toString()}
            accessibilityRole="radio"
            accessibilityState={{ selected: stake === v }}
            onPress={() => {
              fire("tick");
              setStake(v);
            }}
            style={[styles.stake, { backgroundColor: stake === v ? color.primary : color.raised2 }]}
          >
            <Text style={[TYPE.rowTitle, { color: stake === v ? color.primaryForeground : color.ink }]}>
              {usd(v).replace(".00", "")}
            </Text>
          </Pressable>
        ))}
      </View>

      {flow.phase === "dealt" && !spinning ? (
        <View style={styles.pair}>
          <Button label="Spin again" variant="secondary" block={false} style={styles.flex} onPress={spin} />
          <Button
            label={`Call it · ${usd(stake)}`}
            block={false}
            style={styles.flex}
            disabled={!q}
            onPress={() => void flow.place(stake)}
          />
        </View>
      ) : (
        <Button
          label={spinning ? "Spinning…" : flow.phase === "placing" ? "Placing…" : "Spin"}
          loading={spinning || flow.phase === "placing"}
          disabled={spinning || flow.phase === "placing"}
          onPress={spin}
        />
      )}

      {r && flow.seal ? (
        <Text style={[TYPE.caption, { color: flow.verified ? color.inkMuted : color.down }]}>
          {flow.verified
            ? `✓ Sealed before your seed · re-hashed here: matches · draw ${r.digest.slice(0, 10)}…`
            : "✗ The proof doesn't match"}
        </Text>
      ) : null}

      <View style={styles.section}>
        <View style={styles.head}>
          <Text accessibilityRole="header" style={[TYPE.sectionTitle, { color: color.ink }]}>
            Your draws
          </Text>
          <Text style={[TYPE.caption, { color: color.inkMuted }]}>
            {flow.streak > 0 ? `${flow.streak} in a row` : "No streak yet"}
          </Text>
        </View>
        {flow.history.length === 0 ? (
          flow.owner ? (
            <Text style={[TYPE.body, { color: color.inkMuted }]}>Draws you spin show here.</Text>
          ) : (
            <Button
              label="Sign in to spin"
              variant="secondary"
              size="sm"
              block={false}
              onPress={() => router.push(accountRequiredRoute("make a call", "/games/lucky"))}
            />
          )
        ) : (
          flow.history.map((d) => (
            <View key={d.drawId} style={[styles.row, { borderBottomColor: color.hairline }]}>
              <EntityMark id={marketId(d.symbol)} size={FACE} decorative />
              <Text style={[TYPE.rowTitle, styles.flex, { color: color.ink }]}>
                {d.symbol} · {d.side === "up" ? "Up" : "Down"} · {d.reach}×
              </Text>
              <Text style={[TYPE.caption, { color: color.inkMuted }]}>
                {d.ticketId === null ? "not called" : "called"}
              </Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: SIZE.gutter, paddingTop: SPACE.md, gap: SPACE.lg },
  reels: { flexDirection: "row", gap: SPACE.sm },
  machine: {
    paddingVertical: SPACE.lg,
    paddingLeft: SPACE.lg,
    paddingRight: SPACE.xxl + SPACE.lg,
    borderRadius: RADIUS.lg,
    borderWidth: RIM,
  },
  payline: { position: "absolute", left: SPACE.md, right: SPACE.xxl + SPACE.md, top: "50%", borderTopWidth: RIM },
  leverHit: { position: "absolute", right: SPACE.lg, top: SPACE.xl, width: SPACE.xl, height: LEVER_H + BALL },
  lever: {
    position: "absolute",
    right: (SPACE.xl - LEVER_W) / 2,
    top: BALL / 2,
    width: LEVER_W,
    height: LEVER_H,
    borderRadius: LEVER_W / 2,
    transformOrigin: "50% 100%",
  },
  ball: {
    position: "absolute",
    top: -BALL / 2,
    left: (LEVER_W - BALL) / 2,
    width: BALL,
    height: BALL,
    borderRadius: BALL / 2,
  },
  deal: { gap: SPACE.xs, padding: SPACE.md },
  stakes: { flexDirection: "row", gap: SPACE.xs },
  stake: {
    flex: 1,
    height: SIZE.buttonHeightSm,
    borderRadius: RADIUS.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  pair: { flexDirection: "row", gap: SPACE.sm },
  flex: { flex: 1 },
  section: { gap: SPACE.sm },
  head: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    minHeight: SIZE.rowMinHeight,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
