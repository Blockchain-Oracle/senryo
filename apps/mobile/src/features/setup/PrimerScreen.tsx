/** Separate optional notification primer using U14's clear form hierarchy. Native prompts remain native. */
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { SPACE, TYPE, useTheme } from "~/theme";
import type { SetupStep } from "./progress";
import { SetupScreen } from "./SetupScreen";

export const PRIMER_ART = 160;
export type PrimerMotion = "sway" | "lift";
export type PrimerTone = "up" | "muted" | "warn";

export interface PrimerAction {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  accessibilityHint?: string;
}

export function PrimerScreen({
  step,
  art,
  title,
  body,
  status,
  primary,
  secondary,
  onBack,
  onSkip,
}: {
  step: SetupStep;
  art: ReactNode;
  motion: PrimerMotion;
  title: string;
  body: string;
  /** What the last attempt did, in place; the line's height is kept so nothing jumps. */
  status?: { text: string; tone: PrimerTone } | undefined;
  /** Kept for callers; permission success is rendered by their status and action. */
  granted: boolean;
  primary: PrimerAction;
  secondary?: PrimerAction | undefined;
  onBack?: (() => void) | undefined;
  /** Every primer can be skipped (A2); Skip moves on like "Not now". */
  onSkip?: (() => void) | undefined;
}) {
  const { color } = useTheme();
  const tone = { up: color.up, muted: color.text3, warn: color.warn } as const;
  return (
    <SetupScreen
      step={step}
      title={title}
      body={body}
      onBack={onBack}
      onSkip={onSkip}
      footer={
        <>
          <Button {...primary} />
          {secondary ? <Button variant="outline" {...secondary} /> : null}
        </>
      }
    >
      <View style={styles.centre}>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.art}>
          {art}
        </View>
        <Text
          accessibilityLiveRegion="polite"
          style={[TYPE.body, styles.center, { color: tone[status?.tone ?? "muted"] }]}
        >
          {status?.text ?? " "}
        </Text>
      </View>
    </SetupScreen>
  );
}
const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: "center", justifyContent: "center", gap: SPACE.xl },
  art: { width: PRIMER_ART, height: PRIMER_ART },
  center: { textAlign: "center" },
});
