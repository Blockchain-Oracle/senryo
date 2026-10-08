import { router, Stack, useLocalSearchParams } from "expo-router";
import type { ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Skeleton } from "~/components/kit/states";
import { ProfileEditor } from "~/features/profile/ProfileEditor";
import { QuietState } from "~/features/profile/QuietState";
import { type OwnProfile, useOwnProfile } from "~/features/profile/useOwnProfile";
import { useAccount } from "~/lib/account/provider";
import { type ProfileFocus, ROUTES } from "~/lib/constants/routes";
import { SIZE, SPACE, useTheme } from "~/theme";

const FOCUSABLE: readonly ProfileFocus[] = ["username", "name", "bio"];
/** Skeleton plates standing in for the three fields while the profile loads. */
const LOADING_FIELDS = [
  { field: "username", height: SIZE.inputHeight },
  { field: "name", height: SIZE.inputHeight },
  { field: "bio", height: SIZE.skeletonPlate },
] as const;

/**
 * Edit profile (J9; Fomo F17/F18): username, display name, bio and who can see the profile on each network, with
 * Save pinned to the bottom. The form needs the owner's own settings, which need an unlocked session — a locked phone
 * says so and offers the unlock instead of raising a prompt by itself. `?focus=` opens it on one field ("Add a bio").
 */
export default function EditProfile() {
  const { color } = useTheme();
  const account = useAccount();
  const { address, profile } = useOwnProfile();
  const params = useLocalSearchParams<{ focus?: string }>();
  const guest = account.ready && !account.hint;
  if (!guest && profile.kind === "ready" && profile.own !== undefined && address) {
    return (
      <>
        <Stack.Screen options={{ title: "Edit profile" }} />
        <ProfileEditor
          key={address}
          base={profile.own}
          address={address}
          focus={FOCUSABLE.find((field) => field === params.focus)}
          toVisibility={params.focus === "visibility"}
        />
      </>
    );
  }
  return (
    <ScrollView style={{ backgroundColor: color.ground }} contentContainerStyle={styles.page}>
      <Stack.Screen options={{ title: "Edit profile" }} />
      {guest ? (
        <QuietState
          line="Create an account to have a profile"
          action={{ label: "Create account", variant: "primary", onPress: () => router.push(ROUTES.accountRequired) }}
        />
      ) : (
        unavailable(profile)
      )}
    </ScrollView>
  );
}

/** Why the form isn't here yet, and the one action that brings it. */
function unavailable(profile: OwnProfile): ReactNode {
  if (profile.kind === "failed") {
    return (
      <QuietState
        line="Couldn’t load your profile"
        detail="Check your connection."
        action={{ label: "Try again", onPress: profile.retry }}
      />
    );
  }
  if (profile.kind === "loading") {
    return (
      <View style={styles.loading} accessibilityRole="progressbar" accessibilityLabel="Loading your profile">
        {LOADING_FIELDS.map((plate) => (
          <Skeleton key={plate.field} height={plate.height} />
        ))}
      </View>
    );
  }
  // Locked: the public view (or nothing) is known, but not the settings the form edits.
  return (
    <QuietState
      line="Unlock to edit your profile"
      detail="Your profile settings load once your account is unlocked."
      action={{ label: "Unlock", variant: "primary", onPress: () => router.push(ROUTES.session) }}
    />
  );
}

const styles = StyleSheet.create({
  page: { padding: SIZE.gutter },
  loading: { gap: SPACE.xl },
});
