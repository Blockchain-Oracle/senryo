import { useState } from "react";
import { type ImageSourcePropType, StyleSheet, View } from "react-native";
import Animated, { type SharedValue, useAnimatedStyle } from "react-native-reanimated";
import { imageModule } from "~/lib/native-modules";
import { FONT, useTheme } from "~/theme";
import { ART_SIZE, LAYER_DEPTH, LAYER_ORDER, SCENES, type SceneLabel } from "./scenes";

/** A layer starts fading once the scene is this far from centre and is gone when the next scene is centred. */
const FADE_FROM = 0.5;
/**
 * Scenes kept mounted either side of the current one. ±1 decoded the next scene's five layers on every settle — the
 * hitch the user felt mid-swipe — and a fast swipe could outrun it; ±2 keeps the next scene decoded before it is
 * needed (all six would hold ~180 MB of bitmaps).
 */
const MOUNT_WINDOW = 2;
/** A label's cap height against its plate's height (the masters' plates are drawn for this). */
const LABEL_FONT_RATIO = 0.44;

/**
 * The story's hero (Senryo art adapted to U14-S01–S04): one full-width transparent stage. The owned foreground layers crossfade in
 * place; their artwork layers travel with the page at different depths (the foreground a little faster, the back a
 * little slower), so objects move independently instead of one flat picture sliding. The artwork leaves a few label
 * plates blank (pair names, mode names): the app draws them as text on the plate's own layer, placed by the same
 * contain fit as the images. `position` is the scene index as a float. Reduce Motion: nothing travels, scenes crossfade.
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
    ({ index }) => Math.abs(index - activeIndex) <= MOUNT_WINDOW,
  );
  const travelOf = (depth: number) => (reduce ? 0 : stage.width * depth);
  return (
    <View
      style={styles.hero}
      onLayout={(e) => setStage({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
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
  const expoImage = imageModule();
  // Scene art is always a bundled require (a module number); anything else stays on React Native's Image.
  if (!expoImage || typeof source !== "number") {
    return (
      <Animated.Image source={source} resizeMode="contain" style={[StyleSheet.absoluteFill, styles.image, style]} />
    );
  }
  const { Image } = expoImage;
  // The layer moves as one native view; expo-image keeps the decoded bitmap in memory, so re-entering a scene never
  // decodes again.
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]}>
      <Image source={source} contentFit="contain" cachePolicy="memory" transition={0} style={styles.image} />
    </Animated.View>
  );
}

/** One label, centred in its plate. The box is mapped from the master's units by the images' contain fit. */
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
  const scale = Math.min(stage.width / ART_SIZE.width, stage.height / ART_SIZE.height);
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
  hero: { flex: 1, overflow: "hidden" },
  image: { width: "100%", height: "100%" },
  label: { position: "absolute", alignItems: "center", justifyContent: "center" },
});
