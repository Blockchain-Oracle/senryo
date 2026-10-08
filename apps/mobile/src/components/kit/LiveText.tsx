/**
 * Text that changes with ticks without rendering React (the ReText pattern): a shared string drives a read-only
 * `TextInput`'s `text` prop on the UI thread. For quote lines ("pays 1.92× · about 52%") and distances to the line.
 */
import { StyleSheet, TextInput, type TextStyle } from "react-native";
import Animated, { type SharedValue, useAnimatedProps } from "react-native-reanimated";

const AnimatedInput = Animated.createAnimatedComponent(TextInput);

export function LiveText({ text, style }: { text: SharedValue<string>; style?: TextStyle | TextStyle[] }) {
  const props = useAnimatedProps(() => ({ text: text.value, defaultValue: text.value }) as never);
  return (
    <AnimatedInput
      editable={false}
      underlineColorAndroid="transparent"
      style={[styles.reset, style]}
      animatedProps={props}
      defaultValue={text.value}
      accessibilityRole="text"
    />
  );
}

const styles = StyleSheet.create({ reset: { padding: 0, margin: 0 } });
