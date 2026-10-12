/**
 * A new leg's flight (P3, R7.10; ported from 21st motion-add-to-basket #24524 and Mitoshi's fly-to-slip): the card's
 * mark lifts and arcs into its socket over 320 ms, shrinking to the socket's mark, then lands with a tick — the
 * socket's spring takes over (`LegSockets`). Reduced Motion skips the flight; the socket still settles.
 */
import { marketId } from "@senryo/identity";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { EntityMark } from "~/components/identity/EntityMark";
import { fire } from "~/feedback/fire";
import { FLY_CURVE } from "./constants";
import { FLY_MS } from "./LegSockets";
import type { MarkBox } from "./ParlayCard";

/** How far above the higher end the arc peaks. */
const ARC = 96;
const FLY_EASE = Easing.bezier(...FLY_CURVE);
const LAND_FADE = 0.96;

export interface Flight {
  id: number;
  symbol: string;
  /** Both in the layer's own coordinates. */
  from: MarkBox;
  to: MarkBox;
}

export function FlyLayer({ flight, onLand }: { flight: Flight | null; onLand: () => void }) {
  if (!flight) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Flyer key={flight.id} flight={flight} onLand={onLand} />
    </View>
  );
}

function Flyer({ flight, onLand }: { flight: Flight; onLand: () => void }) {
  const reduce = useReducedMotion();
  const t = useSharedValue(0);
  const { from, to } = flight;
  useEffect(() => {
    const land = () => {
      fire("tick");
      onLand();
    };
    if (reduce) {
      land();
      return;
    }
    t.value = withTiming(1, { duration: FLY_MS, easing: FLY_EASE }, (done) => {
      if (done) scheduleOnRN(land);
    });
  }, [reduce, t, onLand]);
  const style = useAnimatedStyle(() => {
    const p = t.value;
    // The box keeps the start size and scales about its centre, so aim its centre at the socket's.
    const x0 = from.x;
    const y0 = from.y;
    const x1 = to.x + to.size / 2 - from.size / 2;
    const y1 = to.y + to.size / 2 - from.size / 2;
    const peak = Math.min(y0, y1) - ARC;
    const q = 1 - p;
    return {
      opacity: p >= LAND_FADE ? 0 : 1,
      transform: [
        { translateX: x0 + (x1 - x0) * p },
        { translateY: q * q * y0 + 2 * q * p * peak + p * p * y1 },
        { scale: 1 + (to.size / from.size - 1) * p },
      ],
    };
  });
  if (reduce) return null;
  return (
    <Animated.View style={[styles.box, { width: from.size, height: from.size }, style]}>
      <EntityMark id={marketId(flight.symbol)} size={from.size} decorative />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  box: { position: "absolute", left: 0, top: 0 },
});
