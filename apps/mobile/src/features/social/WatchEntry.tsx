/**
 * The way into a public profile when the link names nobody (F91 watch mode, D-031): paste an address or type a
 * @handle. Read-only: nothing here can move money. A text input keeps its hairline boundary (the surface rule's one
 * allowed border); focus turns it to the ring, a wrong shape to the down colour.
 */
import { HANDLE_PATTERN, normalizeHandle } from "@senryo/api-client";
import { type Href, router, Stack } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, TextInput } from "react-native";
import { Button } from "~/components/kit/Button";
import { Screen } from "~/components/kit/Screen";
import { Panel } from "~/components/kit/Surface";
import { watchRoute } from "~/lib/constants/routes";
import { HAIRLINE_PX, RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

/** What `/watch/[address]` looks up: the address as given, a normalised handle, or nothing when it is neither. */
export function profileLookup(raw: string): string | undefined {
  const text = raw.trim();
  if (ADDRESS.test(text)) return text;
  const handle = normalizeHandle(text);
  return HANDLE_PATTERN.test(handle) ? handle : undefined;
}

export function WatchEntry({ initial }: { initial: string }) {
  const { color } = useTheme();
  const [value, setValue] = useState(initial);
  const [focused, setFocused] = useState(false);
  const lookup = profileLookup(value);
  const wrong = value.trim() !== "" && !lookup;
  return (
    <Screen>
      <Stack.Screen options={{ title: "Find a trader" }} />
      <Panel style={styles.panel}>
        <Text style={[TYPE.rowDetail, { color: color.text2 }]}>
          Paste a Senryo address or type a @handle to open that trader’s public profile. Read-only: nothing here can
          move money.
        </Text>
        <TextInput
          value={value}
          onChangeText={setValue}
          placeholder="0x… or @handle"
          placeholderTextColor={color.text3}
          selectionColor={color.primary}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Address or handle"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[
            TYPE.numSm,
            styles.input,
            { color: color.ink, borderColor: wrong ? color.down : focused ? color.ring : color.hairline },
          ]}
        />
        {wrong ? (
          <Text accessibilityRole="alert" style={[TYPE.rowDetail, { color: color.down }]}>
            That is neither an address (0x and 40 hex characters) nor a handle (4 to 20 letters, digits or underscores).
          </Text>
        ) : null}
        <Button
          label="Open profile"
          disabled={!lookup}
          onPress={() => {
            if (lookup) router.replace(watchRoute(lookup) as Href);
          }}
        />
      </Panel>
    </Screen>
  );
}

const styles = StyleSheet.create({
  panel: { padding: SPACE.lg, gap: SPACE.md },
  input: { borderWidth: HAIRLINE_PX, borderRadius: RADIUS.sm, paddingHorizontal: SPACE.md, height: SIZE.inputHeight },
});
