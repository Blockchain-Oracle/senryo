/**
 * Send, step 1 — who (B7; Phantom P22): recents and the people you follow above, the search at the bottom ("Name,
 * @handle or address") with Paste and Scan. A typed @handle is looked up on this network; a pasted or scanned address is
 * taken as written (its checks run once it's picked). Scanning an EIP-681 payment code also carries its token and
 * amount forward.
 */
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Avatar } from "~/components/identity/Avatar";
import { ScanLine } from "~/components/kit/symbols";
import { usePressScale } from "~/components/kit/usePressScale";
import type { ScannedPayment } from "~/features/money/qr-payload";
import { Scanner } from "~/features/money/Scanner";
import { SearchField, TextTool, ToolCircle } from "~/features/money/SearchField";
import { QuietLine } from "~/features/portfolio/QuietLine";
import { useRecipient } from "~/features/withdraw/useRecipient";
import { fire } from "~/feedback/fire";
import { readClipboard } from "~/lib/clipboard";
import { shortAddress } from "~/lib/format";
import { BUTTON, CONTROL_FONT_SCALE, SIZE, SPACE, STAGGER_RISE, TIMING, TYPE, useTheme } from "~/theme";
import type { Person } from "./people";

const INPUT_MAX = 64;
const ROW_PRESS_SCALE = 0.985;

export interface PickedRecipient {
  address: `0x${string}`;
  handle: string | null;
  /** "@kai", a display name, or the short address. */
  label: string;
  avatar: string | null;
  payment?: ScannedPayment | undefined;
}

function labelOf(p: Pick<Person, "address" | "handle" | "displayName">): string {
  return p.handle ? `@${p.handle}` : (p.displayName ?? shortAddress(p.address));
}

export function RecipientStep({
  people,
  loading,
  initial = "",
  onPick,
}: {
  people: readonly Person[];
  loading: boolean;
  initial?: string;
  onPick: (r: PickedRecipient) => void;
}) {
  const { color } = useTheme();
  const [input, setInput] = useState(initial);
  const [scanning, setScanning] = useState(false);
  const recipient = useRecipient(input);
  const query = input.trim().toLowerCase().replace(/^@/, "");
  const shown = query
    ? people.filter(
        (p) =>
          p.address.toLowerCase().includes(query) ||
          p.handle?.toLowerCase().includes(query) ||
          p.displayName?.toLowerCase().includes(query),
      )
    : people;
  const pick = (p: Pick<Person, "address" | "handle" | "displayName" | "avatar">, payment?: ScannedPayment) =>
    onPick({
      address: p.address as `0x${string}`,
      handle: p.handle,
      label: labelOf(p),
      avatar: p.avatar,
      ...(payment ? { payment } : {}),
    });
  const status =
    recipient.status === "resolving"
      ? `Looking up ${input.trim()}`
      : recipient.status === "not-found"
        ? `@${recipient.handle} isn’t on this network`
        : recipient.status === "invalid"
          ? "Enter a 0x address or an @handle"
          : recipient.status === "failed"
            ? "Couldn’t look that up"
            : undefined;
  const match =
    recipient.status === "ready" && !shown.some((p) => p.address.toLowerCase() === recipient.address.toLowerCase())
      ? { address: recipient.address, handle: recipient.handle, displayName: null, avatar: null }
      : undefined;
  return (
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
        {match ? <PersonRow person={match} detail={match.address} onPress={() => pick(match)} /> : null}
        {shown.map((p, i) => (
          <PersonRow
            key={p.address}
            person={p}
            detail={p.recent ? shortAddress(p.address) : `Following · ${shortAddress(p.address)}`}
            index={i}
            onPress={() => pick(p)}
          />
        ))}
        {!match && shown.length === 0 && !loading && !status ? <QuietLine>No recent sends</QuietLine> : null}
      </ScrollView>
      <View style={styles.bottom}>
        {status ? (
          <Text
            accessibilityLiveRegion="polite"
            style={[TYPE.rowDetail, { color: recipient.status === "resolving" ? color.text3 : color.down }]}
          >
            {status}
          </Text>
        ) : null}
        <SearchField
          value={input}
          onChangeText={(t) => setInput(t.slice(0, INPUT_MAX))}
          placeholder="Name, @handle or address"
          label="Recipient"
          input={{ maxLength: INPUT_MAX, returnKeyType: "done" }}
          tools={
            <>
              <TextTool
                label="Paste"
                onPress={() => void readClipboard().then((t) => setInput(t.trim().slice(0, INPUT_MAX)))}
              />
              <ToolCircle icon={ScanLine} label="Scan" onPress={() => setScanning(true)} />
            </>
          }
        />
      </View>
      {scanning ? (
        <Scanner
          onClose={() => setScanning(false)}
          onScan={(payment) => {
            setScanning(false);
            setInput(payment.address);
            pick({ address: payment.address, handle: null, displayName: null, avatar: null }, payment);
          }}
        />
      ) : null}
    </KeyboardAvoidingView>
  );
}

function PersonRow({
  person,
  detail,
  index = 0,
  onPress,
}: {
  person: Pick<Person, "address" | "handle" | "displayName" | "avatar">;
  detail: string;
  index?: number;
  onPress: () => void;
}) {
  const { color } = useTheme();
  const press = usePressScale(ROW_PRESS_SCALE);
  return (
    <Animated.View
      entering={FadeInDown.duration(TIMING.staggerItem)
        .delay(index * TIMING.stagger)
        .withInitialValues({ transform: [{ translateY: STAGGER_RISE }] })}
      style={press.style}
    >
      <Pressable
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        onPress={() => {
          fire("tick");
          onPress();
        }}
        accessibilityRole="button"
        accessibilityLabel={`Send to ${labelOf(person)}`}
        style={({ pressed }) => [styles.row, pressed ? { backgroundColor: color.card } : null]}
      >
        <Avatar avatar={person.avatar} address={person.address} size={SIZE.avatarMd} />
        <View style={styles.text}>
          <Text
            maxFontSizeMultiplier={CONTROL_FONT_SCALE}
            numberOfLines={1}
            style={[TYPE.rowTitle, { color: color.ink }]}
          >
            {labelOf(person)}
          </Text>
          <Text
            maxFontSizeMultiplier={CONTROL_FONT_SCALE}
            numberOfLines={1}
            style={[TYPE.rowDetail, { color: color.text3 }]}
          >
            {detail}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  list: { padding: SIZE.gutter, gap: SPACE.xxs, flexGrow: 1 },
  bottom: { paddingHorizontal: SIZE.gutter, paddingBottom: SPACE.lg, paddingTop: SPACE.sm, gap: SPACE.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    minHeight: SIZE.rowMinHeight,
    paddingVertical: SPACE.sm,
    paddingHorizontal: SPACE.sm,
    marginHorizontal: -SPACE.sm,
    borderRadius: BUTTON.radius.md,
  },
  text: { flex: 1, gap: SPACE.xxs },
});
