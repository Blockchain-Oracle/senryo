import { useState } from "react";
import { type ImageSourcePropType, StyleSheet, View } from "react-native";
import Animated, { type SharedValue, useAnimatedStyle } from "react-native-reanimated";
import { RADIUS } from "~/theme";
import { LAYER_DEPTH, LAYER_ORDER, SCENES } from "./scenes";

/** A layer starts fading once the scene is this far from centre and is gone when the next scene is centred. */
const FADE_FROM = 0.5;

/**
 * The story's hero (C01, S01–S06, M01): one inset, rounded, clipped stage. The scenes' colour fields crossfade in
 * place; their artwork layers travel with the page at different depths (the foreground a little faster, the back a
 * little slower), so objects move independently instead of one flat picture sliding. `position` is the scene index as
 * a float. Reduce Motion: nothing travels, scenes crossfade.
 */
export function StoryHero({ position, reduce }: { position: SharedValue<number>; reduce: boolean }) {
  const [width, setWidth] = useState(0);
  return (
    <View
      style={styles.hero}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {SCENES.map((scene, index) => (
        <Layer key={scene.key} source={scene.field} index={index} position={position} travel={0} />
      ))}
      {SCENES.flatMap((scene, index) =>
        LAYER_ORDER.map((name) => {
          const source = scene.layers[name];
          return source === undefined ? null : (
            <Layer
              key={`${scene.key}-${name}`}
              source={source}
              index={index}
              position={position}
              travel={reduce ? 0 : width * LAYER_DEPTH[name]}
            />
          );
        }),
      )}
    </View>
  );
}

/** `travel` 0 = a crossfade in place (fields, and every layer under Reduce Motion). */
function Layer({
  source,
  index,
  position,
  travel,
}: {
  source: ImageSourcePropType;
  index: number;
  position: SharedValue<number>;
  travel: number;
}) {
  const style = useAnimatedStyle(() => {
    const offset = index - position.value;
    const away = Math.min(1, Math.abs(offset));
    if (travel === 0) return { opacity: 1 - away, transform: [{ translateX: 0 }] };
    return {
      opacity: away <= FADE_FROM ? 1 : (1 - away) / (1 - FADE_FROM),
      transform: [{ translateX: offset * travel }],
    };
  });
  return <Animated.Image source={source} resizeMode="cover" style={[StyleSheet.absoluteFill, styles.image, style]} />;
}

const styles = StyleSheet.create({
  hero: { flex: 1, borderRadius: RADIUS.xl, overflow: "hidden" },
  image: { width: "100%", height: "100%" },
});
