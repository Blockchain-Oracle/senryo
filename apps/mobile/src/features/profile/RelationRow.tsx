/**
 * One person in Blocked & muted (F5): avatar, name over @handle (the short address when the person isn't listed on
 * this network), and Unmute / Unblock sized to its label at the trailing edge; the row waits while its undo is in
 * flight and says so when it failed. `UndoConfirm` is the one-line confirm before the row leaves.
 */
import { shortAddress } from "@senryo/core";
import { Modal, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Avatar } from "~/components/identity/Avatar";
import { Button } from "~/components/kit/Button";
import { Sheet, useSheetClose } from "~/components/sheet/Sheet";
import { SheetHeading } from "~/components/sheet/SheetRoute";
import { SIZE, SPACE, STAGGER_RISE, TIMING, TYPE, useTheme } from "~/theme";
import type { Person } from "./PersonRow";
import { portrait } from "./portrait";

/** Only the first screenful staggers (30 ms once per mount). */
const STAGGERED_ROWS = 8;

export function personName(person: Person): { name: string; second: string | null } {
  const short = shortAddress(person.address);
  const name = person.displayName ?? (person.handle ? `@${person.handle}` : short);
  const second = person.displayName && person.handle ? `@${person.handle}` : name === short ? null : short;
  return { name, second };
}

export function RelationRow({
  person,
  index,
  action,
  busy,
  failed,
  onPress,
}: {
  person: Person;
  index: number;
  action: "Unmute" | "Unblock";
  busy: boolean;
  failed: boolean;
  onPress: (name: string) => void;
}) {
  const { color } = useTheme();
  const { name, second } = personName(person);
  return (
    <Animated.View
      {...(index < STAGGERED_ROWS
        ? {
            entering: FadeInDown.duration(TIMING.staggerItem)
              .delay(index * TIMING.stagger)
              .withInitialValues({ transform: [{ translateY: STAGGER_RISE }] }),
          }
        : {})}
      style={styles.row}
    >
      <Avatar {...portrait(person.avatar, person.address)} size={SIZE.markDetail} />
      <View style={styles.text}>
        <Text numberOfLines={1} style={[TYPE.rowTitle, { color: color.ink }]}>
          {name}
        </Text>
        {failed ? (
          <Text accessibilityRole="alert" style={[TYPE.rowDetail, { color: color.down }]}>
            Didn’t go through · try again
          </Text>
        ) : second ? (
          <Text numberOfLines={1} style={[TYPE.rowDetail, { color: color.text3 }]}>
            {second}
          </Text>
        ) : null}
      </View>
      <Button
        label={action}
        variant="secondary"
        size="sm"
        block={false}
        loading={busy}
        accessibilityHint={`${action} ${name}`}
        onPress={() => onPress(name)}
      />
    </Animated.View>
  );
}

const UNDO = {
  mutes: { verb: "Unmute", line: "Their posts and trades show in your feed again" },
  blocks: { verb: "Unblock", line: "They can see, follow and reply to you again" },
} as const;

export function UndoConfirm({
  kind,
  name,
  onConfirm,
  onClose,
}: {
  kind: "mutes" | "blocks";
  name: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.fill}>
        <View style={StyleSheet.absoluteFill}>
          <Sheet onClose={onClose} closeLabel={`Close ${UNDO[kind].verb.toLowerCase()}`}>
            <SheetHeading title={`${UNDO[kind].verb} ${name}?`} body={UNDO[kind].line} />
            <Actions verb={UNDO[kind].verb} onConfirm={onConfirm} />
          </Sheet>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

function Actions({ verb, onConfirm }: { verb: string; onConfirm: () => void }) {
  const close = useSheetClose();
  return (
    <View style={styles.actions}>
      <Button label={verb} onPress={() => close(onConfirm)} />
      <Button label="Cancel" variant="ghost" size="sm" onPress={() => close()} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: SPACE.md, minHeight: SIZE.rowMinHeight },
  text: { flex: 1, gap: SPACE.xxs },
  fill: { flex: 1 },
  actions: { gap: SPACE.sm },
});
