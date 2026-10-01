/**
 * A quiet state on a page (build brief §2; Fomo F16's "No positions yet"): one centred line in the tertiary ink, an
 * optional second line, and at most one action. No box, no illustration.
 */
import { StyleSheet, Text, View } from "react-native";
import { Button, type ButtonVariant } from "~/components/kit/Button";
import { SPACE, TYPE, useTheme } from "~/theme";

export function QuietState({
  line,
  detail,
  action,
}: {
  line: string;
  detail?: string;
  action?: { label: string; onPress: () => void; variant?: ButtonVariant };
}) {
  const { color } = useTheme();
  return (
    <View style={styles.wrap}>
      <Text style={[TYPE.body, styles.center, { color: color.text3 }]}>{line}</Text>
      {detail ? <Text style={[TYPE.rowDetail, styles.center, { color: color.text3 }]}>{detail}</Text> : null}
      {action ? (
        <Button
          label={action.label}
          variant={action.variant ?? "outline"}
          size="sm"
          block={false}
          style={styles.action}
          onPress={action.onPress}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: SPACE.sm, paddingVertical: SPACE.xxxl, paddingHorizontal: SPACE.lg },
  center: { textAlign: "center" },
  action: { alignSelf: "center", marginTop: SPACE.sm },
});
