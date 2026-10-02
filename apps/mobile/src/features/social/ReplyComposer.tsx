/**
 * The reply composer, pinned at the bottom of a thread and lifted by the keyboard: a filled field that grows to a few
 * lines, a round send control that only wakes with text, a counter once the limit is near, and the api's refusal said
 * in place (posting needs a profile listed on this network; the content filter; the hourly budget). A guest sees the
 * one way in instead of a field. A text input is one of the few places a hairline is allowed; it takes the ring on focus.
 */
import { POST_MAX_CHARS, type Post } from "@senryo/api-client";
import { useCreatePost } from "@senryo/query";
import { type Href, router } from "expo-router";
import { type RefObject, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Animated from "react-native-reanimated";
import { Button } from "~/components/kit/Button";
import { ArrowUp } from "~/components/kit/symbols";
import { usePressScale } from "~/components/kit/usePressScale";
import { fire } from "~/feedback/fire";
import { ROUTES } from "~/lib/constants/routes";
import { BUTTON, HAIRLINE_PX, RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { isNotListed, nameOf, socialErrorCopy } from "./format";
import { useSocialAccount } from "./useSocialAccount";

/** The counter appears when this few characters are left. */
const COUNTER_FROM = 40;
/** The field grows to four lines of body text, then scrolls. */
const FIELD_MAX_LINES = 4;
const FIELD_MAX_HEIGHT = (TYPE.body.lineHeight ?? 0) * FIELD_MAX_LINES + 2 * SPACE.md;
/** A round control shrinks a little more than a button (as the shell's utilities do). */
const SEND_PRESS_SCALE = 0.94;

export function ReplyComposer({
  thesis,
  onPosted,
  inputRef,
}: {
  /** The thread's head post: a thesis or a trade post. */
  thesis: Post;
  onPosted: () => void;
  /** Lets the head post's reply control focus the field. */
  inputRef?: RefObject<TextInput | null>;
}) {
  const { color } = useTheme();
  const { guest, session } = useSocialAccount();
  const create = useCreatePost(session);
  const press = usePressScale(SEND_PRESS_SCALE);
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState<unknown>();
  const body = text.trim();
  const left = POST_MAX_CHARS - text.length;
  const ready = body.length > 0 && !create.isPending;

  if (guest || !session) {
    return (
      <View style={styles.bar}>
        <Button
          label="Create an account to reply"
          variant="outline"
          size="sm"
          onPress={() => router.push(ROUTES.accountRequired)}
        />
      </View>
    );
  }

  const send = () => {
    if (!ready) return;
    setError(undefined);
    create.mutate(
      { kind: "reply", parentId: thesis.id, text: body },
      {
        onSuccess: () => {
          fire("confirm");
          setText("");
          onPosted();
        },
        onError: (failure) => {
          fire("fail");
          setError(failure);
        },
      },
    );
  };

  return (
    <View style={styles.bar}>
      {error === undefined ? null : (
        <View style={styles.notice}>
          <Text accessibilityRole="alert" style={[TYPE.rowDetail, styles.noticeText, { color: color.down }]}>
            {socialErrorCopy(error, "Couldn’t post that reply")}
          </Text>
          {isNotListed(error) ? (
            <Text
              onPress={() => router.navigate(ROUTES.profileSettings as Href)}
              accessibilityRole="link"
              style={[TYPE.rowDetail, { color: color.link }]}
            >
              Settings
            </Text>
          ) : null}
        </View>
      )}
      <View style={styles.line}>
        <View style={[styles.field, { backgroundColor: color.card, borderColor: focused ? color.ring : color.border }]}>
          <TextInput
            ref={inputRef}
            value={text}
            onChangeText={(next) => {
              setText(next);
              if (error !== undefined) setError(undefined);
            }}
            placeholder={`Reply to ${nameOf(thesis.author)}`}
            placeholderTextColor={color.text3}
            selectionColor={color.primary}
            multiline
            maxLength={POST_MAX_CHARS}
            editable={!create.isPending}
            accessibilityLabel="Your reply"
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={[TYPE.body, styles.input, { color: color.ink }]}
          />
          {left <= COUNTER_FROM ? (
            <Text
              accessibilityLabel={`${left} characters left`}
              style={[TYPE.moneyMeta, styles.counter, { color: left <= 0 ? color.warn : color.text3 }]}
            >
              {left}
            </Text>
          ) : null}
        </View>
        <Animated.View style={press.style}>
          <Pressable
            onPressIn={() => {
              if (ready) fire("press");
              press.onPressIn();
            }}
            onPressOut={press.onPressOut}
            onPress={send}
            disabled={!ready}
            accessibilityRole="button"
            accessibilityLabel="Send reply"
            accessibilityState={{ disabled: !ready, busy: create.isPending }}
            hitSlop={(SIZE.touch - BUTTON.utility) / 2}
            style={({ pressed }) => [
              styles.send,
              { backgroundColor: ready ? (pressed ? color.primaryPressed : color.primary) : color.raised2 },
            ]}
          >
            {create.isPending ? (
              <ActivityIndicator size="small" color={color.text3} />
            ) : (
              <ArrowUp
                size={BUTTON.icon}
                strokeWidth={SIZE.iconStroke}
                color={ready ? color.primaryForeground : color.text3}
              />
            )}
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { paddingHorizontal: SIZE.gutter, paddingTop: SPACE.sm, paddingBottom: SPACE.sm, gap: SPACE.sm },
  notice: { flexDirection: "row", alignItems: "center", gap: SPACE.md },
  noticeText: { flex: 1 },
  line: { flexDirection: "row", alignItems: "flex-end", gap: SPACE.sm },
  field: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    minHeight: SIZE.touch,
    maxHeight: FIELD_MAX_HEIGHT,
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.sm,
    borderRadius: RADIUS.md,
    borderWidth: HAIRLINE_PX,
  },
  /** iOS gives a multiline input its own top inset; the field's padding is the only one wanted. */
  input: { flex: 1, paddingTop: 0, paddingBottom: 0 },
  counter: { alignSelf: "flex-end" },
  send: {
    width: BUTTON.utility,
    height: BUTTON.utility,
    borderRadius: RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: (SIZE.touch - BUTTON.utility) / 2,
  },
});
