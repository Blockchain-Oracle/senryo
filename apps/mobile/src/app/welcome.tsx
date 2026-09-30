import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Onboarding } from "~/features/auth/Onboarding";
import { WelcomeActions } from "~/features/auth/WelcomeActions";
import { SIZE, SPACE, useTheme } from "~/theme";

/**
 * First launch and sign-in (F01 / F02 / F03 / F08): brand intro → three value pages, with the account actions pinned
 * below — Create account first when this phone has no account, Continue when it has one (D-029).
 */
export default function Welcome() {
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.root,
        { backgroundColor: color.ground, paddingTop: insets.top, paddingBottom: insets.bottom + SPACE.xl },
      ]}
    >
      <View style={styles.top}>
        <Onboarding />
      </View>
      <View style={styles.bottom}>
        <WelcomeActions />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "space-between" },
  top: { flex: 1 },
  bottom: { paddingHorizontal: SIZE.gutter },
});
