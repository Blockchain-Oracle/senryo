import { StyleSheet, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { SPACE, TYPE, useTheme } from "~/theme";

/**
 * The quiet empty state (Fomo F16 "No positions yet"; build brief §2): one centred line in tertiary ink with at most
 * one action under it. No box, no dashed outline, no illustration.
 */
export function QuietLine({ children, action }: { children: string; action?: { label: string; onPress: () => void } }) {
  const { color } = useTheme();
  return (
    <View style={styles.quiet}>
      <Text style={[TYPE.rowDetail, styles.center, { color: color.text3 }]}>{children}</Text>
      {action ? (
        <Button label={action.label} onPress={action.onPress} variant="outline" size="sm" block={false} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  quiet: { alignItems: "center", gap: SPACE.md, paddingVertical: SPACE.lg },
  center: { textAlign: "center" },
});
