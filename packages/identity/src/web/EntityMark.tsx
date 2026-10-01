/**
 * `<EntityMark id size variant badge status />` for the web: the same plan as the native mark (../registry.ts), drawn
 * with inline SVG components. Colours come in through `theme` as CSS values (usually `var(--…)` tokens).
 */
import type { CSSProperties } from "react";
import {
  BADGE_OUTSET_RATIO,
  BADGE_RATIO,
  BADGE_RING_MIN,
  BADGE_RING_RATIO,
  FALLBACK_DASH_RATIO,
  FALLBACK_LEADING,
  FALLBACK_RIM_MIN,
  FALLBACK_RIM_RATIO,
  FALLBACK_WEIGHT,
  PLATE_STROKE,
  TILE_RADIUS_RATIO,
} from "../constants.ts";
import { ART_COMPONENTS } from "../generated/web/index.ts";
import { type MarkStatus, markLabel } from "../labels.ts";
import { entityLabel, type MarkPlan, type Plate, planMark, type VariantRequest } from "../registry.ts";
import { fallbackFontSize, fallbackText, type IdentityTheme, innerSize, markBox } from "../theme.ts";

export interface EntityMarkProps {
  id: string | undefined;
  size: number;
  variant?: VariantRequest;
  badge?: string | undefined;
  status?: MarkStatus;
  label?: string | undefined;
  decorative?: boolean;
  theme: IdentityTheme;
  className?: string;
}

const center: CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };
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
    <span style={{ ...center, position: "relative", width: size, height: size }}>
      <svg width={size} height={size} aria-hidden style={{ position: "absolute", inset: 0 }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={(size - rim) / 2}
          fill={dashed ? "none" : theme.skeleton}
          stroke={theme.rim}
          strokeWidth={rim}
          strokeDasharray={dashed ? `${dash} ${dash}` : undefined}
        />
      </svg>
      {dashed ? (
        <span
          aria-hidden
          style={{
            position: "relative",
            color: theme.fallbackInk,
            fontSize,
            lineHeight: FALLBACK_LEADING,
            fontWeight: FALLBACK_WEIGHT,
            fontFamily: theme.fontFamily,
          }}
        >
          {short}
        </span>
      ) : null}
    </span>
  );
}

function Art({ plan, size, theme }: { plan: Extract<MarkPlan, { kind: "art" }>; size: number; theme: IdentityTheme }) {
  const Component = ART_COMPONENTS[plan.source.key]?.[plan.variant];
  if (!Component) return <Fallback size={size} text={plan.entity.symbol ?? plan.entity.name} theme={theme} dashed />;
  if (plan.wordmark) return <Component width={size * plan.aspect} height={size} aria-hidden focusable={false} />;
  // A one-colour glyph (passkey) takes the theme's secondary-text ink; EntityGlyph lets a caller match its label.
  if (plan.file.tintable)
    return <Component width={size} height={size} fill={theme.fallbackInk} aria-hidden focusable={false} />;
  const fill = plateColor(plan.plate, theme);
  const inner = innerSize(size, plan.file.insetPermille, fill !== undefined, plan.file.shape !== "free");
  const plate: CSSProperties =
    fill === undefined
      ? {}
      : {
          backgroundColor: fill,
          borderRadius: radiusFor(plan.shape, size),
          boxShadow: `inset 0 0 0 ${PLATE_STROKE}px ${theme.rim}`,
        };
  return (
    <span style={{ ...center, width: size, height: size, ...plate }}>
      <Component width={inner} height={inner} aria-hidden focusable={false} />
    </span>
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
  if (status === "failed" || !plan || plan.kind !== "art")
    return <Fallback size={size} text={text} theme={theme} dashed />;
  return <Art plan={plan} size={size} theme={theme} />;
}

export function EntityMark(props: EntityMarkProps) {
  const { id, variant = "disc", badge, status = "ready", label, decorative = false, theme, className } = props;
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
    ? ({ "aria-hidden": true } as const)
    : ({ role: "img", "aria-label": markLabel(plan, status, text, badgePlan) } as const);
  return (
    <span
      className={className}
      {...a11y}
      style={{ ...center, position: "relative", width: box.width, height: box.height }}
    >
      <Body plan={plan} status={status} size={size} text={text} theme={theme} />
      {badgePlan && badge !== undefined ? (
        <span
          style={{
            ...center,
            position: "absolute",
            width: outer,
            height: outer,
            right: -outset - ring,
            bottom: -outset - ring,
            borderRadius: radiusFor(badgePlan.kind === "art" ? badgePlan.shape : "disc", outer),
            backgroundColor: theme.ground,
          }}
        >
          <Body plan={badgePlan} status="ready" size={badgeSize} text={entityLabel(badge)} theme={theme} />
        </span>
      ) : null}
    </span>
  );
}
