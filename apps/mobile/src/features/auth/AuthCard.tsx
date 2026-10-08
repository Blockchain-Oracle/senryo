/**
 * The body of an auth sheet (Fomo F08/F36; Codex consult 1 Oct): no card inside the sheet — the sheet is the surface.
 * One optional glyph in the tone's ink, a centred title, one centred explanation, a spinner while a ceremony is in
 * flight, then the action stack. No tile, no boxed note, no border. Recorded in apps/mobile/.21st/design.json.
 */
import type { ReactNode } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { PasskeyGlyph } from "~/components/identity/PasskeyGlyph";
import { Icon } from "~/components/kit/Icon";
import type { IconName } from "~/components/kit/icons";
import { FONT, type Palette, SIZE, SPACE, TYPE, useTheme } from "~/theme";

export type GlyphTone = "primary" | "gold" | "down";

/** One glyph, 36 pt (FIDO: the passkey icon is never below 24). */
const GLYPH = SIZE.icon + SPACE.md;

function ink(tone: GlyphTone, c: Palette): string {
  if (tone === "gold") return c.gold;
  if (tone === "down") return c.down;
  return c.link;
}

export function AuthCard({
  glyph,
  art,
  tone = "primary",
  busy = false,
  title,
  body,
  children,
  footer,
}: {
  /** A kit icon, or `passkey` for a passkey ceremony (the identity glyph, one flat colour). Omit for a plain message. */
  glyph?: IconName | "passkey";
  /** Authored artwork in place of the glyph (the pending-passkey art while a ceremony is in flight). */
  art?: ReactNode;
  tone?: GlyphTone;
  /** A ceremony is in flight: the spinner sits under the explanation. */
  busy?: boolean;
  title: string;
  body?: string;
  children?: ReactNode;
  /** One quiet line under the actions. */
  footer?: string;
}) {
  const { color } = useTheme();
  const tint = ink(tone, color);
  return (
    <View accessibilityRole={tone === "down" ? "alert" : undefined} style={styles.wrap}>
      <View style={[styles.head, tone === "down" ? styles.failure : null]}>
        {art ? (
          art
        ) : glyph === "passkey" ? (
          <PasskeyGlyph size={GLYPH} color={tint} />
        ) : glyph ? (
          <Icon name={glyph} size={GLYPH} tint={tint} />
        ) : null}
        <Text
          accessibilityRole="header"
          style={[TYPE.sheetHeading, styles.title, tone === "down" ? styles.left : styles.center, { color: color.ink }]}
        >
          {title}
        </Text>
        {body ? (
          <Text style={[TYPE.body, tone === "down" ? styles.left : styles.center, { color: color.text2 }]}>{body}</Text>
        ) : null}
        {busy ? <ActivityIndicator size="small" color={color.text2} style={styles.spinner} /> : null}
      </View>
      {children ? <View style={styles.actions}>{children}</View> : null}
      {footer ? <Text style={[TYPE.meta, styles.center, { color: color.text3 }]}>{footer}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: SPACE.lgPlus },
  head: { alignItems: "center", gap: SPACE.sm, paddingHorizontal: SPACE.sm },
  title: { fontFamily: FONT.display },
  failure: { alignItems: "stretch" },
  left: { textAlign: "left" },
  center: { textAlign: "center" },
  spinner: { marginTop: SPACE.sm },
  actions: { gap: SPACE.sm },
});
