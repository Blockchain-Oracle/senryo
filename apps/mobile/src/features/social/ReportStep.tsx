/**
 * Reporting a post or a profile (S12b.6, App Store 1.2): pick the reason, then send. The reasons are the api's own
 * list; a report is reviewed by a person and never acts by itself. The refusal, if any, is said under the list.
 */
import { REPORT_REASONS, type ReportReason } from "@senryo/api-client";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { ListRow } from "~/components/kit/ListRow";
import { Panel } from "~/components/kit/Surface";
import { Check } from "~/components/kit/symbols";
import { SheetHeading } from "~/components/sheet/SheetRoute";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";

const REASON_LABEL: Record<ReportReason, string> = {
  spam: "Spam",
  scam: "Scam or fraud",
  harassment: "Harassment",
  hate: "Hate",
  sexual: "Sexual content",
  violence: "Violence or threats",
  impersonation: "Pretending to be someone else",
  other: "Something else",
};

export function ReportStep({
  what,
  reason,
  onPick,
  onSend,
  onBack,
  busy,
  failure,
}: {
  /** "post", "reply" or "profile". */
  what: string;
  reason: ReportReason | undefined;
  onPick: (reason: ReportReason) => void;
  onSend: () => void;
  onBack: () => void;
  busy: boolean;
  failure: string | undefined;
}) {
  const { color } = useTheme();
  return (
    <>
      <SheetHeading title={`Report this ${what}`} body="What’s wrong with it? A person reviews every report." />
      <Panel>
        {REPORT_REASONS.map((value) => (
          <ListRow
            key={value}
            title={REASON_LABEL[value]}
            onPress={() => onPick(value)}
            trailing={
              value === reason ? (
                <Check size={SIZE.icon} strokeWidth={SIZE.iconStroke} color={color.link} />
              ) : (
                <View style={styles.slot} />
              )
            }
          />
        ))}
      </Panel>
      {failure ? (
        <Text accessibilityRole="alert" style={[TYPE.rowDetail, styles.center, { color: color.down }]}>
          {failure}
        </Text>
      ) : null}
      <View style={styles.actions}>
        <Button label="Send report" disabled={reason === undefined} loading={busy} onPress={onSend} />
        <Button label="Back" variant="ghost" size="sm" disabled={busy} onPress={onBack} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  /** Keeps a row's width the same whether or not it carries the check. */
  slot: { width: SIZE.icon, height: SIZE.icon },
  actions: { gap: SPACE.sm },
  center: { textAlign: "center" },
});
