/**
 * The profile form (Fomo F17/F18, adapted): the person as they will appear, then Username, Display name and Bio
 * (label above, counter across, filled plate), then who can see the profile on each network, with "Save changes"
 * pinned to the bottom and lifted above the keyboard. Save is the quiet plate until something changed and every
 * field is valid (F17 → enabled); it shows its spinner while saving, a refusal lands on the field it is about, and a
 * saved profile returns to You. Only what changed is sent (`PUT /v1/profile` keeps the rest).
 * The picture is one of the twelve authored portraits (`AvatarPicker`; there are no uploads). Not here, on purpose:
 * F17's banner, linked accounts (X linking is blocked, B6), the address list (Account identity) and Export keys
 * (Recovery).
 */
import type { Address } from "@senryo/account";
import {
  BIO_MAX_CHARS,
  DISPLAY_NAME_MAX_CHARS,
  HANDLE_MAX_CHARS,
  type MyProfile,
  PROFILE_VISIBILITY_DEFAULTS,
  type ProfileUpdate,
} from "@senryo/api-client";
import { useSaveProfile } from "@senryo/query";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { Keyboard, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Avatar, defaultAvatar } from "~/components/identity/Avatar";
import { Button } from "~/components/kit/Button";
import { fire } from "~/feedback/fire";
import { useSessionRunner } from "~/lib/account/use-session-runner";
import { type ProfileFocus, ROUTES } from "~/lib/constants/routes";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { AvatarPicker } from "./AvatarPicker";
import { cleanBio, cleanLine } from "./format";
import { ProfileField } from "./ProfileField";
import { PROFILE_AVATAR } from "./ProfileHeader";
import { portrait } from "./portrait";
import { type SaveRefusal, saveRefusal } from "./save-refusal";
import { useHandleField } from "./useHandleField";
import { type Visibility, VisibilitySettings, visibilityOf } from "./VisibilitySettings";

const VISIBILITY_KEYS = ["listedPractice", "listedMainnet", "publicTradesPractice", "publicTradesMainnet"] as const;
/** The username's state line holds two lines ("@new is available. @old will be held…"), so nothing below it jumps. */
const USERNAME_MESSAGE_LINES = 2;

export function ProfileEditor({
  base,
  address,
  focus,
  toVisibility = false,
}: {
  /** The saved profile; `null` for an account that has never saved one (the API's first-save defaults are shown). */
  base: MyProfile | null;
  address: Address;
  focus?: ProfileFocus | undefined;
  /** Opened from "Make public on Mainnet": scroll to who can see the profile. */
  toVisibility?: boolean;
}) {
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  const scroll = useRef<ScrollView>(null);
  const revealed = useRef(false);
  const keyboard = useAnimatedKeyboard();
  const lift = useAnimatedStyle(() => ({
    paddingBottom: Math.max(insets.bottom, keyboard.height.value) + SPACE.md,
  }));
  const save = useSaveProfile(address, useSessionRunner());
  const handle = useHandleField(base?.handle ?? null);
  const saved = {
    name: base?.displayName ?? "",
    bio: base?.bio ?? "",
    ...visibilityOf(base ?? PROFILE_VISIBILITY_DEFAULTS),
  };
  const [name, setName] = useState(saved.name);
  const [bio, setBio] = useState(saved.bio);
  const [visibility, setVisibility] = useState<Visibility>(() => visibilityOf(saved));
  const savedAvatar = base?.avatar ?? null;
  const [avatar, setAvatar] = useState<string | null>(savedAvatar);
  const [refusal, setRefusal] = useState<SaveRefusal>();

  const update: ProfileUpdate = {};
  if (handle.change !== undefined) update.handle = handle.change;
  if (name.trim() !== saved.name) update.displayName = name.trim() || null;
  if (bio.trim() !== saved.bio) update.bio = bio.trim() || null;
  for (const key of VISIBILITY_KEYS) if (visibility[key] !== saved[key]) update[key] = visibility[key];
  // Choosing the portrait the account already shows by default is not a change.
  const shownAvatar = avatar ?? defaultAvatar(address) ?? null;
  const savedShown = savedAvatar ?? defaultAvatar(address) ?? null;
  if (shownAvatar !== savedShown) update.avatar = avatar;
  const changed = Object.keys(update).length > 0;
  // A first save states every visibility choice shown, rather than leaning on the server's defaults.
  const body: ProfileUpdate = base ? update : { ...visibility, ...update };

  const submit = () => {
    setRefusal(undefined);
    Keyboard.dismiss();
    save.mutate(body, {
      onSuccess: () => {
        fire("confirm");
        if (router.canGoBack()) router.back();
        else router.replace(ROUTES.more);
      },
      onError: (error) => {
        const refused = saveRefusal(error, update.handle !== undefined);
        if (!refused) return;
        fire("fail");
        if (refused.field === "username") handle.refuse(refused.message);
        else setRefusal(refused);
      },
    });
  };
  const reveal = (y: number) => scroll.current?.scrollTo({ y: Math.max(0, y - SPACE.lg), animated: true });
  const preview = name.trim() || (handle.typed ? `@${handle.typed}` : "Your name");

  return (
    <View style={[styles.root, { backgroundColor: color.ground }]}>
      <ScrollView
        ref={scroll}
        style={styles.root}
        contentContainerStyle={styles.form}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        <View style={styles.person}>
          <Avatar {...portrait(avatar, address)} size={PROFILE_AVATAR} />
          <View style={styles.personText}>
            <Text numberOfLines={1} style={[TYPE.rowTitle, { color: color.ink }]}>
              {preview}
            </Text>
            <Text style={[TYPE.rowDetail, { color: color.text3 }]}>Pick a portrait below.</Text>
          </View>
        </View>
        <AvatarPicker value={avatar} address={address} onChange={setAvatar} />
        <ProfileField
          label="Username"
          value={handle.text}
          onChangeText={handle.onChangeText}
          placeholder="username"
          prefix="@"
          message={handle.message}
          tone={handle.tone}
          messageLines={USERNAME_MESSAGE_LINES}
          autoFocus={focus === "username"}
          onFocus={reveal}
          max={HANDLE_MAX_CHARS}
          counter={false}
          input={{ autoCapitalize: "none", returnKeyType: "done" }}
        />
        <ProfileField
          label="Display name"
          value={name}
          onChangeText={(text) => {
            if (refusal?.field === "name") setRefusal(undefined);
            setName(cleanLine(text));
          }}
          placeholder="Your name"
          max={DISPLAY_NAME_MAX_CHARS}
          {...(refusal?.field === "name" ? { message: refusal.message, tone: "bad" as const } : {})}
          autoFocus={focus === "name"}
          onFocus={reveal}
          input={{ autoCapitalize: "words", returnKeyType: "done" }}
        />
        <ProfileField
          label="Bio"
          value={bio}
          onChangeText={(text) => {
            if (refusal?.field === "bio") setRefusal(undefined);
            setBio(cleanBio(text));
          }}
          placeholder="Describe yourself"
          max={BIO_MAX_CHARS}
          multiline
          {...(refusal?.field === "bio" ? { message: refusal.message, tone: "bad" as const } : {})}
          autoFocus={focus === "bio"}
          onFocus={reveal}
          input={{ autoCapitalize: "sentences" }}
        />
        <View
          onLayout={(e) => {
            if (!toVisibility || revealed.current) return;
            revealed.current = true;
            reveal(e.nativeEvent.layout.y);
          }}
        >
          <VisibilitySettings value={visibility} onChange={setVisibility} />
        </View>
      </ScrollView>
      <Animated.View style={[styles.footer, { backgroundColor: color.ground }, lift]}>
        {refusal?.field === "page" ? (
          <Text accessibilityRole="alert" style={[TYPE.rowDetail, styles.center, { color: color.down }]}>
            {refusal.message}
          </Text>
        ) : null}
        <Button
          label="Save changes"
          disabled={!changed || !handle.ok}
          loading={save.isPending}
          onPress={submit}
          accessibilityHint={changed ? "Saves your profile and returns to You" : "Nothing has changed yet"}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  form: { padding: SIZE.gutter, gap: SPACE.xl },
  person: { flexDirection: "row", alignItems: "center", gap: SPACE.lg },
  personText: { flex: 1, gap: SPACE.xxs },
  footer: { paddingHorizontal: SIZE.gutter, paddingTop: SPACE.md, gap: SPACE.sm },
  center: { textAlign: "center" },
});
