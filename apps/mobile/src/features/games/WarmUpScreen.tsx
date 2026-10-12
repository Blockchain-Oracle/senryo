/**
 * Warm-up on the phone (R7.5; the web's `WarmUpScreen`): beat the coin. Five big live cards dealt with their sound,
 * each swiped Up or Down at the live price — the coin's own pick flips in beside yours — then a 30-second watch where
 * the five races run live (the move since your pick and who leads it), and a reveal, card by card 220 ms apart with
 * each verdict's sound, then the score and a fanfare. The flow is `@senryo/calls` `useWarmUp`, the web's own. No stake,
 * no account, nothing on chain.
 */
import { useDayLine, useWarmUp, type WarmUpFlow } from "@senryo/calls/react";
import {
  lane,
  WARM_UP_DECK_MAX,
  WARM_UP_WATCH_SEC,
  type WarmUpCard,
  type WarmUpResult,
  type WarmUpSide,
  warmUpLeader,
} from "@senryo/core";
import { marketId } from "@senryo/identity";
import { PixelMark } from "@senryo/identity/native";
import { useSampledPrice } from "@senryo/live/react";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FlipInYRight, ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EntityMark } from "~/components/identity/EntityMark";
import { ChangeChip } from "~/components/kit/ChangeChip";
import { ProgressBar } from "~/components/kit/ProgressBar";
import { Sparkline } from "~/components/kit/Sparkline";
import { SwipeDeck } from "~/components/kit/SwipeDeck";
import { ArrowDown, ArrowUp } from "~/components/kit/symbols";
import { celebrate } from "~/feedback/celebrate";
import { playCue } from "~/feedback/cues";
import { fire, music, soundsEnabled } from "~/feedback/fire";
import { RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { pixelColors } from "~/theme/pixel-colors";

const REVEAL_MS = 220;
const DEAL_GAP_MS = 90;
const BEEP_FROM_SEC = 5;
const PRICE_MS = 250;
const CARD_HEIGHT = 300;
const CARD_MARK = 64;
const SLOT_MARK = 22;
const ROW_MARK = 28;
const CHIP = 26;
const E8 = 1e8;
const BP = 10_000;
const PRICE_DIGITS = 2;
const BP_DIGITS = 1;
const COIN_DIM = 0.8;
const RESULT_WORD: Record<WarmUpResult, string> = { won: "RIGHT", lost: "WRONG", flat: "FLAT" };
const LEAD_WORD = { you: "You lead", coin: "Coin leads", even: "Even" } as const;

const priceText = (e8: number | null | undefined) =>
  e8 === null || e8 === undefined ? "—" : (e8 / E8).toLocaleString(undefined, { maximumFractionDigits: PRICE_DIGITS });
const sound = (cue: Parameters<typeof playCue>[0]) => {
  if (soundsEnabled()) playCue(cue);
};

function SideChip({ side, dim = false }: { side: WarmUpSide; dim?: boolean }) {
  const { color } = useTheme();
  const Arrow = side === "up" ? ArrowUp : ArrowDown;
  return (
    <View style={[styles.chip, { backgroundColor: side === "up" ? color.upFill : color.downFill }, dim && styles.dim]}>
      <Arrow size={SIZE.iconSm} color={color.onDirectionFill} strokeWidth={3} />
    </View>
  );
}

/** The reveal: one card a beat, each with its verdict, then the score's fanfare. */
function useReveal(w: WarmUpFlow): number {
  const [shown, setShown] = useState(0);
  const flow = useRef(w);
  flow.current = w;
  const scored = w.round.phase === "scored";
  const total = w.round.cards.length;
  useEffect(() => {
    if (!scored) {
      setShown(0);
      return;
    }
    const score = flow.current.score;
    if (!score || shown > total) return;
    const t = setTimeout(() => {
      const c = score.cards[shown];
      if (c) fire(c.you === "won" ? "snap" : "tick", c.you === "won" ? { ladder: ["gap", shown] } : { cue: "adverse" });
      else if (score.winner === "you") {
        fire("win", { cue: "jackpot" });
        celebrate();
      } else fire(score.winner === "bot" ? "loss" : "tick", { cue: score.winner === "bot" ? "loss" : "refund" });
      setShown((n) => n + 1);
    }, REVEAL_MS);
    return () => clearTimeout(t);
  }, [scored, shown, total]);
  return shown;
}

function WarmCard({ card, of }: { card: WarmUpCard; of: number }) {
  const { color } = useTheme();
  const price = useSampledPrice(card.symbol, PRICE_MS);
  const day = useDayLine(card.symbol);
  return (
    <View style={styles.card}>
      <Text style={[TYPE.caption, { color: color.inkMuted }]}>
        Card {card.index + 1} of {of} · {lane(card.cadenceSec)}
      </Text>
      <EntityMark id={marketId(card.symbol)} size={CARD_MARK} decorative />
      <Text style={[TYPE.title, { color: color.ink }]}>{card.symbol}</Text>
      <Text style={[TYPE.sectionTitle, { color: color.ink }]}>{priceText(price)}</Text>
      {day ? (
        <View style={styles.dayRow}>
          <View style={styles.spark}>
            <Sparkline symbol={card.symbol} day={day} />
          </View>
          <ChangeChip symbol={card.symbol} day={day} />
        </View>
      ) : null}
    </View>
  );
}

function RaceRow(p: {
  card: WarmUpCard;
  side: WarmUpSide;
  coin: WarmUpSide;
  entryE8: number;
  closeE8: number | null;
  result: WarmUpResult | null;
}) {
  const { color } = useTheme();
  const live = useSampledPrice(p.card.symbol, PRICE_MS);
  const now = p.closeE8 ?? live ?? p.entryE8;
  const moveBp = p.entryE8 === 0 ? 0 : ((now - p.entryE8) / p.entryE8) * BP;
  const lead = warmUpLeader(p.side, p.coin, p.entryE8, now);
  const tone = (v: "up" | "down" | "flat") => (v === "up" ? color.up : v === "down" ? color.down : color.inkMuted);
  return (
    <View style={[styles.row, { borderBottomColor: color.hairline }]}>
      <EntityMark id={marketId(p.card.symbol)} size={ROW_MARK} decorative />
      <View style={styles.rowText}>
        <Text style={[TYPE.rowTitle, { color: color.ink }]}>{p.card.symbol}</Text>
        <Text style={[TYPE.caption, { color: tone(moveBp > 0 ? "up" : moveBp < 0 ? "down" : "flat") }]}>
          {moveBp > 0 ? "+" : ""}
          {moveBp.toFixed(BP_DIGITS)} bp · {priceText(now)}
        </Text>
      </View>
      <SideChip side={p.side} />
      <SideChip side={p.coin} dim />
      {p.result ? (
        <Animated.Text
          entering={ZoomIn}
          style={[
            TYPE.rowTitle,
            styles.verdict,
            { color: tone(p.result === "won" ? "up" : p.result === "lost" ? "down" : "flat") },
          ]}
        >
          {RESULT_WORD[p.result]}
        </Animated.Text>
      ) : (
        <Text
          style={[
            TYPE.caption,
            styles.verdict,
            { color: tone(lead === "you" ? "up" : lead === "coin" ? "down" : "flat") },
          ]}
        >
          {LEAD_WORD[lead]}
        </Text>
      )}
    </View>
  );
}

export function WarmUpScreen() {
  const { color } = useTheme();
  const pixels = pixelColors(color);
  const insets = useSafeAreaInsets();
  const w = useWarmUp();
  const r = w.round;
  const dealt = r.cards.length > 0;
  const shown = useReveal(w);
  const score = r.phase === "scored" ? w.score : null;
  const finished = score !== null && shown > r.cards.length;

  useEffect(() => () => music(null), []);
  useEffect(() => {
    if (r.phase === "watching" && w.watchLeft !== null && w.watchLeft > 0 && w.watchLeft <= BEEP_FROM_SEC) {
      sound("countBeep");
    }
  }, [r.phase, w.watchLeft]);

  const deal = () => {
    fire("press", { cue: "tap" });
    music("games");
    w.deal();
    for (let i = 0; i < WARM_UP_DECK_MAX; i++) setTimeout(() => sound("cardDeal"), i * DEAL_GAP_MS);
  };

  return (
    <ScrollView
      style={{ backgroundColor: color.ground }}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACE.xl }]}
    >
      {dealt ? (
        <View style={styles.slots} accessibilityLabel="You against the coin">
          {r.cards.map((c) => {
            const pick = r.picks.find((p) => p.cardIndex === c.index);
            const result = score && c.index < shown ? score.cards[c.index]?.you : null;
            const ring = result === "won" ? color.upFill : result === "lost" ? color.downFill : "transparent";
            return (
              <View key={c.index} style={[styles.slot, { backgroundColor: color.raised2, borderColor: ring }]}>
                <EntityMark id={marketId(c.symbol)} size={SLOT_MARK} decorative />
                {pick ? (
                  <SideChip side={pick.side} />
                ) : (
                  <View style={[styles.chip, { backgroundColor: color.hairline }]} />
                )}
                {pick ? (
                  <Animated.View entering={FlipInYRight.delay(REVEAL_MS)}>
                    <SideChip side={w.coinOf(c.index)} dim />
                  </Animated.View>
                ) : (
                  <PixelMark name="coin" size={CHIP} colors={pixels} />
                )}
              </View>
            );
          })}
        </View>
      ) : null}

      {!dealt || finished ? (
        <View style={[styles.table, { backgroundColor: color.arena }]}>
          {finished && score ? (
            <>
              <Animated.Text entering={ZoomIn} style={[TYPE.title, { color: color.arenaInk }]}>
                {score.winner === "you" ? "You beat the coin" : score.winner === "bot" ? "The coin won" : "A tie"}
              </Animated.Text>
              <Text style={[TYPE.displayPrice, { color: color.arenaInk }]}>
                {score.youWon}–{score.botWon}
              </Text>
            </>
          ) : (
            <>
              <Text style={[TYPE.title, { color: color.arenaInk }]}>Beat the coin</Text>
              <Text style={[TYPE.body, styles.center, { color: color.arenaInk }]}>
                Five live cards. Call each Up or Down; a coin calls them too. Thirty seconds later, the better caller
                wins. No stakes.
              </Text>
            </>
          )}
          <Pressable
            accessibilityRole="button"
            disabled={!w.ready}
            onPress={deal}
            style={({ pressed }) => [
              styles.deal,
              { backgroundColor: color.upFill, borderBottomColor: color.upFillEdge },
              pressed && styles.pressed,
              !w.ready && styles.dim,
            ]}
          >
            <Text style={[TYPE.sectionTitle, { color: color.onDirectionFill }]}>
              {!w.ready ? "Loading markets…" : finished ? "Deal again" : "Deal the cards"}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {dealt && (r.phase === "dealt" || r.phase === "picking") ? (
        <SwipeDeck<WarmUpCard>
          items={r.cards.slice(r.picks.length)}
          itemKey={(c) => `${c.symbol}:${c.cadenceSec}`}
          itemLabel={(c) => c.symbol}
          onDecide={(c, side) => {
            fire("tick", { cue: "cardSlam" });
            w.swipe(side === "right" ? "up" : "down");
            setTimeout(() => sound("cardFlip"), REVEAL_MS);
            if (c.index === r.cards.length - 1) sound("eventLock");
          }}
          leftLabel="Down"
          rightLabel="Up"
          emptyLabel="Watching…"
          height={CARD_HEIGHT}
        >
          {(c) => <WarmCard card={c} of={r.cards.length} />}
        </SwipeDeck>
      ) : null}

      {r.phase === "watching" ? (
        <ProgressBar
          value={WARM_UP_WATCH_SEC - (w.watchLeft ?? 0)}
          max={WARM_UP_WATCH_SEC}
          label="The watch"
          valueText={`Scores in ${w.watchLeft ?? 0}s`}
          tone={(w.watchLeft ?? 0) <= BEEP_FROM_SEC ? "late" : "calm"}
        />
      ) : null}

      {r.phase === "watching" || r.phase === "scored"
        ? r.picks.map((p) => {
            const card = r.cards[p.cardIndex];
            if (!card) return null;
            const scored =
              score && p.cardIndex < shown ? score.cards.find((c) => c.card.index === p.cardIndex) : undefined;
            return (
              <RaceRow
                key={p.cardIndex}
                card={card}
                side={p.side}
                coin={w.coinOf(p.cardIndex)}
                entryE8={p.entryE8}
                closeE8={scored ? scored.closeE8 : null}
                result={scored ? scored.you : null}
              />
            );
          })
        : null}
      <Text style={[TYPE.caption, { color: color.inkMuted }]}>
        Scored on the live price, not a window's close · nothing is staked
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: SPACE.inset, gap: SPACE.md },
  slots: { flexDirection: "row", gap: SPACE.sm },
  slot: {
    flex: 1,
    alignItems: "center",
    gap: SPACE.xs,
    paddingVertical: SPACE.sm,
    borderRadius: RADIUS.sm,
    borderWidth: 2,
  },
  chip: { width: CHIP, height: CHIP, borderRadius: RADIUS.xs, alignItems: "center", justifyContent: "center" },
  dim: { opacity: COIN_DIM },
  table: { borderRadius: RADIUS.lg, padding: SPACE.xl, alignItems: "center", gap: SPACE.md },
  center: { textAlign: "center" },
  deal: {
    height: SIZE.buttonHeight,
    paddingHorizontal: SPACE.xl,
    borderRadius: RADIUS.sm,
    borderBottomWidth: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { transform: [{ translateY: 2 }] },
  card: { flex: 1, alignItems: "center", justifyContent: "center", gap: SPACE.sm, padding: SPACE.lg },
  dayRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACE.md },
  spark: { height: SPACE.xxxl, justifyContent: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    paddingVertical: SPACE.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowText: { flex: 1 },
  verdict: { width: 72, textAlign: "right" },
});
