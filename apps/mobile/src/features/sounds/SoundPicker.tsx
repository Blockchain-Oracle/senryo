/**
 * Preferences → Sounds (flow book G5): each cue with its three original variants, chosen by ear. Tap a variant to
 * hear it at the cue's own level; the selection is kept on this device and swaps the cue at once. "Default" returns
 * to the bundled cue. Respects the silent switch like every sound.
 */

import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Check } from "~/components/kit/symbols";
import { previewSound, reloadSound, type SoundName } from "~/feedback/sound";
import { chooseVariant, chosenVariant, SOUND_VARIANTS } from "~/feedback/sound-variants";
import { BUTTON, SIZE, SPACE, TYPE, useTheme } from "~/theme";

const CUES: readonly { name: SoundName; label: string }[] = [
  { name: "deposit", label: "Money arrived" },
  { name: "send", label: "Sent" },
  { name: "onboarding", label: "Welcome" },
  { name: "scene", label: "Welcome swipe" },
  { name: "unlock", label: "Unlocked" },
  { name: "error", label: "Error" },
];

export function SoundPicker() {
  const { color } = useTheme();
  const [, bump] = useState(0);
  const pick = (name: SoundName, index: number | undefined) => {
    chooseVariant(name, index);
    reloadSound(name);
    bump((n) => n + 1);
  };
  return (
    <ScrollView contentContainerStyle={styles.list}>
      {CUES.map((cue) => {
        const chosen = chosenVariant(cue.name);
        return (
          <View key={cue.name} style={styles.cue}>
            <Text accessibilityRole="header" style={[TYPE.rowTitle, { color: color.ink }]}>
              {cue.label}
            </Text>
            <View style={styles.options}>
              {[undefined, ...SOUND_VARIANTS[cue.name].map((_, i) => i)].map((index) => {
                const selected = chosen === index;
                const label = index === undefined ? "Default" : `Option ${index + 1}`;
                return (
                  <Pressable
                    key={label}
                    onPress={() => {
                      const source = index === undefined ? undefined : SOUND_VARIANTS[cue.name][index];
                      if (source) previewSound(cue.name, source);
                      pick(cue.name, index);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${cue.label}, ${label}`}
                    style={[styles.option, { backgroundColor: selected ? color.selectedRow : color.raised2 }]}
                  >
                    <Text style={[TYPE.buttonLabel, { color: color.ink }]}>{label}</Text>
                    {selected ? <Check size={SIZE.iconSm} color={color.primary} /> : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: SIZE.gutter, paddingVertical: SPACE.lg, gap: SPACE.xl },
  cue: { gap: SPACE.sm },
  options: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.xs,
    paddingHorizontal: SPACE.md,
    minHeight: BUTTON.utility,
    borderRadius: BUTTON.radius.sm,
  },
});
