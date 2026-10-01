import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WelcomeActions } from "~/features/auth/WelcomeActions";
import { Story } from "~/features/onboarding/Story";
import { SIZE, SPACE, useTheme } from "~/theme";

/**
 * First launch and sign-in (J1; F01 / F02 / F03 / F08): the six-scene story with the account actions pinned below it
 * and usable from the first frame — Create account first when this phone has no account, Continue when it has one
 * (D-029). No timed intro: nobody waits for a logo.
 */
export default function Welcome() {
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.root,
        { backgroundColor: color.ground, paddingTop: insets.top, paddingBottom: insets.bottom + SPACE.md },
      ]}
    >
      <View style={styles.top}>
        <Story />
      </View>
      <View style={styles.bottom}>
        <WelcomeActions />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "space-between", gap: SPACE.lg },
  top: { flex: 1 },
  bottom: { paddingHorizontal: SIZE.gutter },
});
