import { useState } from "react";
import { type ImageSourcePropType, StyleSheet, View } from "react-native";
import Animated, { type SharedValue, useAnimatedStyle } from "react-native-reanimated";
import { FONT, RADIUS, useTheme } from "~/theme";
import { ART_SIZE, LAYER_DEPTH, LAYER_ORDER, SCENES, type SceneLabel } from "./scenes";

/** A layer starts fading once the scene is this far from centre and is gone when the next scene is centred. */
const FADE_FROM = 0.5;
/** A label's cap height against its plate's height (the masters' plates are drawn for this). */
const LABEL_FONT_RATIO = 0.44;

/**
 * The story's hero (C01, S01–S06, M01): one inset, rounded, clipped stage. The scenes' colour fields crossfade in
 * place; their artwork layers travel with the page at different depths (the foreground a little faster, the back a
 * little slower), so objects move independently instead of one flat picture sliding. The artwork leaves a few label
 * plates blank (pair names, mode names): the app draws them as text on the plate's own layer, placed by the same
 * cover fit as the images. `position` is the scene index as a float. Reduce Motion: nothing travels, scenes crossfade.
 */
export function StoryHero({
  position,
  reduce,
  activeIndex,
}: {
  position: SharedValue<number>;
  reduce: boolean;
  activeIndex: number;
}) {
  const [stage, setStage] = useState({ width: 0, height: 0 });
  const scenes = SCENES.map((scene, index) => ({ scene, index })).filter(
    ({ index }) => Math.abs(index - activeIndex) <= 1,
  );
  const travelOf = (depth: number) => (reduce ? 0 : stage.width * depth);
  return (
    <View
      style={styles.hero}
      onLayout={(e) => setStage({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {scenes.map(({ scene, index }) => (
        <Layer key={scene.key} source={scene.field} index={index} position={position} travel={0} />
      ))}
      {scenes.flatMap(({ scene, index }) =>
        LAYER_ORDER.map((name) => {
          const source = scene.layers[name];
          return source === undefined ? null : (
            <Layer
              key={`${scene.key}-${name}`}
              source={source}
              index={index}
              position={position}
              travel={travelOf(LAYER_DEPTH[name])}
            />
          );
        }),
      )}
      {stage.width > 0
        ? scenes.flatMap(({ scene, index }) =>
            (scene.labels ?? []).map((label) => (
              <Label
                key={`${scene.key}-${label.text}`}
                label={label}
                stage={stage}
                index={index}
                position={position}
                travel={travelOf(LAYER_DEPTH[label.layer])}
              />
            )),
          )
        : null}
    </View>
  );
}

/** How a layer of scene `index` sits while the story is at `position`. `travel` 0 = a crossfade in place. */
function useLayerStyle(index: number, position: SharedValue<number>, travel: number) {
  return useAnimatedStyle(() => {
    const offset = index - position.value;
    const away = Math.min(1, Math.abs(offset));
    if (travel === 0) return { opacity: 1 - away, transform: [{ translateX: 0 }] };
    return {
      opacity: away <= FADE_FROM ? 1 : (1 - away) / (1 - FADE_FROM),
      transform: [{ translateX: offset * travel }],
    };
  });
}

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
  const style = useLayerStyle(index, position, travel);
  return <Animated.Image source={source} resizeMode="cover" style={[StyleSheet.absoluteFill, styles.image, style]} />;
}

/** One label, centred in its plate. The box is mapped from the master's units by the images' cover fit. */
function Label({
  label,
  stage,
  index,
  position,
  travel,
}: {
  label: SceneLabel;
  stage: { width: number; height: number };
  index: number;
  position: SharedValue<number>;
  travel: number;
}) {
  const { color } = useTheme();
  const style = useLayerStyle(index, position, travel);
  const scale = Math.max(stage.width / ART_SIZE.width, stage.height / ART_SIZE.height);
  const left = (stage.width - ART_SIZE.width * scale) / 2 + label.x * scale;
  const top = (stage.height - ART_SIZE.height * scale) / 2 + label.y * scale;
  const fontSize = label.height * scale * LABEL_FONT_RATIO;
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.label, { left, top, width: label.width * scale, height: label.height * scale }, style]}
    >
      <Animated.Text
        allowFontScaling={false}
        numberOfLines={1}
        style={{ fontFamily: FONT.sansStrong, fontSize, lineHeight: label.height * scale, color: color[label.ink] }}
      >
        {label.text}
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  hero: { flex: 1, borderRadius: RADIUS.xl, overflow: "hidden" },
  image: { width: "100%", height: "100%" },
  label: { position: "absolute", alignItems: "center", justifyContent: "center" },
});
