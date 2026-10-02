/**
 * What a sign-in turned out to be (A3, A5), inside the ceremony's own sheet:
 * - `SignedIn`: the account's avatar, a check, "Signed in as @handle" — a ~1 s moment (with the unlock sound already
 *   fired) before Home. The handle comes from this phone's cache or the public profile; without one, the short address.
 * - `CheckAccount`: the opened account is empty — "This passkey opens a different account" (or "…an empty account")
 *   with Use it / Pick another. Nothing on the phone has changed yet.
 * - `SameAccount`: a deliberate switch picked the account already in use.
 */
import type { Address } from "@senryo/account";
import { shortAddress } from "@senryo/core";
import { useProfile } from "@senryo/query";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";
import { Avatar } from "~/components/identity/Avatar";
import { Button } from "~/components/kit/Button";
import { CircleCheck } from "~/components/kit/symbols";
import { cachedIdentity, cacheIdentity } from "~/lib/account/identity-cache";
import { SIZE, SPACE, TIMING, TYPE, useTheme } from "~/theme";
import { AuthCard } from "./AuthCard";
import type { CheckReason } from "./useAuthFlow";

/** The avatar in the signed-in moment (A3: large). */
const SIGNED_IN_AVATAR = 72;
/** The check sits on the avatar's lower edge. */
const BADGE = SIZE.icon + SPACE.xs;
const BADGE_FROM_SCALE = 0.6;

/** The account's @handle and avatar: the public profile when it loads (and then cached), else this phone's cache. */
export function useAccountIdentity(address: Address | undefined) {
  const profile = useProfile(address);
  const live = profile.status === "fresh" || profile.status === "stale" ? profile.value : undefined;
  useEffect(() => {
    if (address && live) cacheIdentity(address, { handle: live.handle, avatar: live.avatar });
  }, [address, live]);
  const cached = cachedIdentity(address);
  return { handle: live?.handle ?? cached?.handle ?? null, avatar: live?.avatar ?? cached?.avatar ?? null };
}

export function accountName(handle: string | null, address: Address | undefined): string {
  if (handle) return `@${handle}`;
  return address ? shortAddress(address) : "your account";
}

export function SignedIn({ address }: { address: Address }) {
  const { color } = useTheme();
  const { handle, avatar } = useAccountIdentity(address);
  return (
    <View style={styles.signed} accessibilityLiveRegion="polite">
      <View>
        <Avatar avatar={avatar} address={address} size={SIGNED_IN_AVATAR} />
        <Animated.View
          entering={ZoomIn.duration(TIMING.selection).withInitialValues({ transform: [{ scale: BADGE_FROM_SCALE }] })}
          style={[styles.badge, { backgroundColor: color.ground }]}
        >
          <CircleCheck size={BADGE} color={color.up} />
        </Animated.View>
      </View>
      <Text accessibilityRole="header" style={[TYPE.sheetHeading, styles.center, { color: color.ink }]}>
        Signed in as {accountName(handle, address)}
      </Text>
    </View>
  );
}

const CHECK_TITLE: Record<CheckReason, string> = {
  different: "This passkey opens a different account",
  empty: "This passkey opens an empty account",
};

export function CheckAccount({
  reason,
  address,
  onUse,
  onPick,
}: {
  reason: CheckReason;
  address: Address;
  onUse: () => void;
  onPick: () => void;
}) {
  return (
    <AuthCard glyph="passkey" tone="gold" title={CHECK_TITLE[reason]} body={`${shortAddress(address)} · empty`}>
      <Button label="Pick another" onPress={onPick} />
      <Button label="Use it" variant="ghost" size="sm" onPress={onUse} />
    </AuthCard>
  );
}

export function SameAccount({ address, onClose }: { address: Address; onClose: () => void }) {
  const { handle } = useAccountIdentity(address);
  return (
    <AuthCard glyph="passkey" title={`Already using ${accountName(handle, address)}`}>
      <Button label="OK" variant="secondary" onPress={onClose} />
    </AuthCard>
  );
}

const styles = StyleSheet.create({
  signed: { alignItems: "center", gap: SPACE.lg, paddingVertical: SPACE.lg },
  badge: { position: "absolute", right: -SPACE.xxs, bottom: -SPACE.xxs, borderRadius: BADGE },
  center: { textAlign: "center" },
});
