/**
 * `<EntityMark id size variant badge status />` for React Native (react-native-svg). The real mark for a known entity;
 * a labelled neutral fallback — readable text in a dashed ring, never a logo — while loading, after a failure, for a
 * known entity whose first-party art is a recorded gap, and for an unidentified id. A badge (venue or network) is a
 * separate layer at the lower right with a cut-out ring, never painted into the asset's art (study 08).
 */
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Rect } from "react-native-svg";
import {
  BADGE_OUTSET_RATIO,
  BADGE_RATIO,
  BADGE_RING_MIN,
  BADGE_RING_RATIO,
  FALLBACK_DASH_RATIO,
  FALLBACK_LEADING,
  FALLBACK_RIM_MIN,
  FALLBACK_RIM_RATIO,
  PLATE_STROKE,
  TILE_RADIUS_RATIO,
} from "../constants.ts";
import { ART_COMPONENTS } from "../generated/native/index.ts";
import { type MarkStatus, markLabel } from "../labels.ts";
import { entityLabel, type MarkPlan, type Plate, planMark, type VariantRequest } from "../registry.ts";
import { fallbackFontSize, fallbackText, type IdentityTheme, innerSize, markBox } from "../theme.ts";

export interface EntityMarkProps {
  /** Canonical entity id (see `ids`); undefined renders the unidentified fallback. */
  id: string | undefined;
  size: number;
  variant?: VariantRequest;
  /** A contextual entity (venue, network) shown as a small overlapping badge. */
  badge?: string | undefined;
  /** `loading` while the entity itself is still being read; `failed` when reading it failed. */
  status?: MarkStatus;
  /** Text for fallbacks and the accessible name when the registry has none (e.g. an unknown token's ticker). */
  label?: string | undefined;
  /** Hide from assistive tech when adjacent text already names the entity. */
  decorative?: boolean;
  theme: IdentityTheme;
}

const radiusFor = (shape: "disc" | "tile", size: number) => (shape === "disc" ? size / 2 : size * TILE_RADIUS_RATIO);

function plateColor(plate: Plate, theme: IdentityTheme): string | undefined {
  if (plate === "theme") return theme.plate;
  if (plate === "light") return theme.plateLight;
  if (plate === "dark") return theme.plateDark;
  return undefined;
}

function Fallback({
  size,
  text,
  theme,
  dashed,
}: {
  size: number;
  text: string;
  theme: IdentityTheme;
  dashed: boolean;
}) {
  const rim = Math.max(FALLBACK_RIM_MIN, size * FALLBACK_RIM_RATIO);
  const dash = size * FALLBACK_DASH_RATIO;
  const short = fallbackText(text);
  const fontSize = fallbackFontSize(size, short);
  return (
    <View style={[styles.center, { width: size, height: size }]}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={(size - rim) / 2}
          fill={dashed ? "none" : theme.skeleton}
          stroke={theme.rim}
          strokeWidth={rim}
          {...(dashed ? { strokeDasharray: `${dash} ${dash}` } : {})}
        />
      </Svg>
      {dashed ? (
        <Text
          numberOfLines={1}
          allowFontScaling={false}
          style={{
            color: theme.fallbackInk,
            fontSize,
            lineHeight: fontSize * FALLBACK_LEADING,
            fontFamily: theme.fontFamily,
          }}
        >
          {short}
        </Text>
      ) : null}
    </View>
  );
}

function Art({ plan, size, theme }: { plan: Extract<MarkPlan, { kind: "art" }>; size: number; theme: IdentityTheme }) {
  const Component = ART_COMPONENTS[plan.source.key]?.[plan.variant];
  if (!Component) return <Fallback size={size} text={plan.entity.symbol ?? plan.entity.name} theme={theme} dashed />;
  if (plan.wordmark) return <Component width={size * plan.aspect} height={size} />;
  // A one-colour glyph (passkey) takes the theme's secondary-text ink; EntityGlyph lets a caller match its label.
  if (plan.file.tintable) return <Component width={size} height={size} fill={theme.fallbackInk} />;
  const fill = plateColor(plan.plate, theme);
  const plated = fill !== undefined;
  const inner = innerSize(size, plan.file.insetPermille, plated, plan.file.shape !== "free");
  const radius = radiusFor(plan.shape, size);
  return (
    <View style={[styles.center, { width: size, height: size }]}>
      {plated ? (
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          <Rect
            x={PLATE_STROKE / 2}
            y={PLATE_STROKE / 2}
            width={size - PLATE_STROKE}
            height={size - PLATE_STROKE}
            rx={radius}
            fill={fill}
            stroke={theme.rim}
            strokeWidth={PLATE_STROKE}
          />
        </Svg>
      ) : null}
      <Component width={inner} height={inner} />
    </View>
  );
}

function Body(props: {
  plan: MarkPlan | undefined;
  status: MarkStatus;
  size: number;
  text: string;
  theme: IdentityTheme;
}) {
  const { plan, status, size, text, theme } = props;
  if (status === "loading") return <Fallback size={size} text={text} theme={theme} dashed={false} />;
  if (status === "failed" || !plan || plan.kind !== "art") {
    return <Fallback size={size} text={text} theme={theme} dashed />;
  }
  return <Art plan={plan} size={size} theme={theme} />;
}

export function EntityMark(props: EntityMarkProps) {
  const { id, variant = "disc", badge, status = "ready", label, decorative = false, theme } = props;
  const text = label ?? entityLabel(id);
  const plan = status === "ready" ? planMark(id, variant, theme.scheme) : undefined;
  const box = markBox(plan, props.size);
  const size = box.height;
  const badgePlan = badge === undefined ? undefined : planMark(badge, "disc", theme.scheme);
  const badgeSize = Math.round(size * BADGE_RATIO);
  const ring = Math.max(BADGE_RING_MIN, badgeSize * BADGE_RING_RATIO);
  const outer = badgeSize + ring * 2;
  const outset = size * BADGE_OUTSET_RATIO;
  const a11y = decorative
    ? ({ accessibilityElementsHidden: true, importantForAccessibility: "no-hide-descendants" } as const)
    : ({
        accessible: true,
        accessibilityRole: "image",
        accessibilityLabel: markLabel(plan, status, text, badgePlan),
      } as const);
  return (
    <View style={{ width: box.width, height: box.height }} {...a11y}>
      <Body plan={plan} status={status} size={size} text={text} theme={theme} />
      {badgePlan && badge !== undefined ? (
        <View
          style={[
            styles.center,
            styles.badge,
            {
              width: outer,
              height: outer,
              right: -outset - ring,
              bottom: -outset - ring,
              borderRadius: radiusFor(badgePlan.kind === "art" ? badgePlan.shape : "disc", outer),
              backgroundColor: theme.ground,
            },
          ]}
        >
          <Body plan={badgePlan} status="ready" size={badgeSize} text={entityLabel(badge)} theme={theme} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  badge: { position: "absolute" },
});
