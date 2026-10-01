/**
 * `<EntityGlyph id size color />` for the web: a one-colour glyph entity (the passkey icon) drawn in the ink of the label
 * beside it — `currentColor` by default, so it follows the text. Only files recorded `tintable` draw here.
 * Presentation follows FIDO's Passkey Icon Usage Guidelines: one flat colour, never below 24 px (the file's `minPx`),
 * aria-hidden when a visible label names the action.
 */
import { ART_COMPONENTS } from "../generated/web/index.ts";
import { glyphFor } from "../registry.ts";

export interface EntityGlyphProps {
  id: string;
  size: number;
  /** The one flat colour (a CSS value); defaults to the surrounding text colour. */
  color?: string;
  /** Accessible name when the glyph stands alone; omitted, the glyph is aria-hidden. */
  label?: string;
  className?: string;
}

export function EntityGlyph({ id, size, color = "currentColor", label, className }: EntityGlyphProps) {
  const glyph = glyphFor(id);
  const Component = glyph ? ART_COMPONENTS[glyph.source.key]?.[glyph.variant] : undefined;
  if (!glyph || !Component) return null;
  const edge = Math.max(size, glyph.file.minPx ?? 0);
  const a11y = label ? ({ role: "img", "aria-label": label } as const) : ({ "aria-hidden": true } as const);
  return (
    <span
      className={className}
      {...a11y}
      style={{ display: "inline-flex", flexShrink: 0, width: edge, height: edge, color }}
    >
      {/* Inline size: a host's descendant-svg rule (e.g. a button's `[&_svg]:size-4`) must not shrink it below 24 px. */}
      <Component
        width={edge}
        height={edge}
        style={{ width: edge, height: edge }}
        fill="currentColor"
        aria-hidden
        focusable={false}
      />
    </span>
  );
}
