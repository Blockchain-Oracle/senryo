import { explorerAddressUrl } from "@senryo/config";
import { shortAddress } from "@senryo/core";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Linking, StyleSheet, Text, TextInput } from "react-native";
import { Button } from "~/components/kit/Button";
import { Screen } from "~/components/kit/Screen";
import { Panel, SectionLabel } from "~/components/kit/Surface";
import { watchRoute } from "~/lib/constants/routes";
import { useNetwork } from "~/lib/network";
import { HAIRLINE_PX, RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

/**
 * F91 watch mode (D-031): any address, read-only — for judges who are geo-blocked or whose authenticator lacks PRF.
 * Nothing here signs. Balances/positions come from the indexer/chain reads (S4/S8 swap-in); until then the screen
 * says so rather than showing someone else's sample numbers as this address's.
 */
export default function WatchScreen() {
  const network = useNetwork();
  const { color } = useTheme();
  const params = useLocalSearchParams<{ address: string }>();
  const raw = typeof params.address === "string" ? params.address : "";
  const [value, setValue] = useState(ADDRESS.test(raw) ? "" : raw);
  const [focused, setFocused] = useState(false);
  const valid = ADDRESS.test(value.trim());

  if (!ADDRESS.test(raw)) {
    return (
      <Screen>
        <Stack.Screen options={{ title: "Watch an account" }} />
        <Panel style={styles.panel}>
          <Text style={[TYPE.rowDetail, { color: color.text2 }]}>
            Paste any Senryo address or open a shared watch link. Read-only: nothing here can move money.
          </Text>
          <TextInput
            value={value}
            onChangeText={setValue}
            placeholder="0x…"
            placeholderTextColor={color.inkMuted}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Address to watch"
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={[
              TYPE.numSm,
              styles.input,
              { color: color.ink, borderColor: value && !valid ? color.down : focused ? color.ring : color.hairline },
            ]}
          />
          {value && !valid ? (
            <Text style={[TYPE.rowDetail, { color: color.down }]}>
              That isn't an address — it starts with 0x and has 40 hex characters.
            </Text>
          ) : null}
          <Button label="Watch" disabled={!valid} onPress={() => router.replace(watchRoute(value.trim()))} />
        </Panel>
      </Screen>
    );
  }
  return (
    <Screen>
      <Stack.Screen options={{ title: `Watching ${shortAddress(raw)}` }} />
      <SectionLabel>Read-only</SectionLabel>
      <Panel style={styles.panel}>
        <Text selectable style={[TYPE.numSm, { color: color.ink }]}>
          {raw}
        </Text>
        <Button
          label={`${network.modeLabel} explorer`}
          variant="outline"
          size="sm"
          block={false}
          onPress={() => void Linking.openURL(explorerAddressUrl(network.chainId, raw))}
        />
      </Panel>
      <Text style={[TYPE.rowDetail, { color: color.text3 }]}>
        This address's live balances, positions and history appear here once the indexer is connected. The explorer
        shows its onchain activity now.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  panel: { padding: SPACE.lg, gap: SPACE.md },
  /** A text input keeps its hairline boundary (the surface rule's one allowed border); focus turns it to the ring. */
  input: { borderWidth: HAIRLINE_PX, borderRadius: RADIUS.sm, paddingHorizontal: SPACE.md, height: SIZE.inputHeight },
});
