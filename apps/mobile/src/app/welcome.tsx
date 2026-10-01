import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AuthFlowSheet } from "~/features/auth/AuthFlowSheet";
import { useAuthFlow } from "~/features/auth/useAuthFlow";
import { WelcomeActions } from "~/features/auth/WelcomeActions";
import { Story } from "~/features/onboarding/Story";
import { ROUTES } from "~/lib/constants/routes";
import { SIZE, SPACE, useTheme } from "~/theme";

const toHome = () => router.replace(ROUTES.home);

/**
 * First launch and sign-in (J1; F01 / F02 / F03 / F08): the six-scene story with the account actions pinned below it
 * and usable from the first frame — Create account first when this phone has no account, Continue when it has one
 * (D-029). No timed intro: nobody waits for a logo. The passkey ceremony and its outcome rise as a sheet over the
 * story, which stays where it was.
 */
export default function Welcome() {
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  const flow = useAuthFlow({ onDone: toHome });
  return (
    <View style={[styles.root, { backgroundColor: color.ground }]}>
      <View style={[styles.page, { paddingTop: insets.top, paddingBottom: insets.bottom + SPACE.md }]}>
        <View style={styles.top}>
          <Story />
        </View>
        <View style={styles.bottom}>
          <WelcomeActions flow={flow} />
        </View>
      </View>
      <AuthFlowSheet flow={flow} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  page: { flex: 1, justifyContent: "space-between", gap: SPACE.lg },
  top: { flex: 1 },
  bottom: { paddingHorizontal: SIZE.gutter },
});
