/**
 * RN port of 21st felipemenezes098/sign-in-4 (#19045) + verify-identity-3 (#19036) — the D2 auth card: glyph tile
 * (tone-tinted, optional spinner badge), title, one balanced line, the action stack, a trust footer. Recorded in
 * apps/mobile/.21st/design.json.
 */
import type { ReactNode } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { PasskeyGlyph } from "~/components/identity/PasskeyGlyph";
import { Icon } from "~/components/kit/Icon";
import type { IconName } from "~/components/kit/icons";
import { HAIRLINE_PX, type Palette, RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";

export type GlyphTone = "primary" | "gold" | "down";

const GLYPH_TILE = SIZE.touch + SPACE.md;
const BADGE = SIZE.icon + SPACE.xs;

function tint(tone: GlyphTone, c: Palette) {
  if (tone === "gold") return { ink: c.warn, wash: c.warnWash };
  if (tone === "down") return { ink: c.down, wash: c.downWash };
  return { ink: c.up, wash: c.upWash };
}

export function AuthCard({
  glyph,
  tone = "primary",
  busy = false,
  title,
  body,
  children,
  footer,
}: {
  /** A kit icon, or `passkey` for a passkey ceremony (the identity glyph, one flat colour in the tone's ink). */
  glyph: IconName | "passkey";
  tone?: GlyphTone;
  /** verify-identity-3's spinner badge on the glyph while a ceremony is in flight. */
  busy?: boolean;
  title: string;
  body?: string;
  children?: ReactNode;
  footer?: string;
}) {
  const { color } = useTheme();
  const t = tint(tone, color);
  return (
    <View
      accessibilityRole={tone === "down" ? "alert" : undefined}
      style={[styles.card, { backgroundColor: color.card, borderColor: color.hairline }]}
    >
      <View style={styles.head}>
        <View style={[styles.tile, { backgroundColor: t.wash, borderColor: t.ink }]}>
          {glyph === "passkey" ? (
            <PasskeyGlyph size={SIZE.icon + SPACE.sm} color={t.ink} />
          ) : (
            <Icon name={glyph} size={SIZE.icon + SPACE.sm} tint={t.ink} />
          )}
          {busy ? (
            <View style={[styles.badge, { backgroundColor: color.primary, borderColor: color.card }]}>
              <ActivityIndicator size="small" color={color.primaryForeground} />
            </View>
          ) : null}
        </View>
        <Text accessibilityRole="header" style={[TYPE.numSm, styles.center, { color: color.ink }]}>
          {title}
        </Text>
        {body ? <Text style={[TYPE.caption, styles.center, { color: color.inkMuted }]}>{body}</Text> : null}
      </View>
      {children ? <View style={styles.body}>{children}</View> : null}
      {footer ? (
        <View style={[styles.footer, { borderTopColor: color.hairline }]}>
          <Icon name="shield" size={SIZE.iconSm} tint={color.inkMuted} />
          <Text style={[TYPE.micro, { color: color.inkMuted }]}>{footer}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: HAIRLINE_PX, borderRadius: RADIUS.sm, overflow: "hidden" },
  head: {
    alignItems: "center",
    gap: SPACE.sm,
    paddingHorizontal: SPACE.xl,
    paddingTop: SPACE.xl,
    paddingBottom: SPACE.md,
  },
  tile: {
    width: GLYPH_TILE,
    height: GLYPH_TILE,
    borderRadius: RADIUS.sm,
    borderWidth: HAIRLINE_PX,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACE.xs,
  },
  badge: {
    position: "absolute",
    right: -SPACE.xs,
    bottom: -SPACE.xs,
    width: BADGE,
    height: BADGE,
    borderRadius: RADIUS.pill,
    borderWidth: SIZE.sealStroke,
    alignItems: "center",
    justifyContent: "center",
  },
  center: { textAlign: "center" },
  body: { gap: SPACE.md, paddingHorizontal: SPACE.xl, paddingBottom: SPACE.lg },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.xs,
    borderTopWidth: HAIRLINE_PX,
    paddingVertical: SPACE.md,
  },
});
