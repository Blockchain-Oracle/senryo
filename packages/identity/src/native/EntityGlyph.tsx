/**
 * `<EntityGlyph id size color />` for React Native: a one-colour glyph entity (the passkey icon) drawn in the ink of the
 * label beside it. Only files recorded `tintable` draw here — brand marks keep their owners' colours via EntityMark.
 * Presentation follows FIDO's Passkey Icon Usage Guidelines: one flat colour, never below 24 px (the file's `minPx`),
 * hidden from assistive tech when a visible label names the action.
 */
import { View } from "react-native";
import { ART_COMPONENTS } from "../generated/native/index.ts";
import { glyphFor } from "../registry.ts";

export interface EntityGlyphProps {
  id: string;
  size: number;
  /** The one flat colour: the ink of the adjacent label, ≥ 3:1 against the ground it sits on. */
  color: string;
  /** Accessible name when the glyph stands alone; omitted, the glyph is hidden (its label already says it). */
  label?: string;
}

export function EntityGlyph({ id, size, color, label }: EntityGlyphProps) {
  const glyph = glyphFor(id);
  const Component = glyph ? ART_COMPONENTS[glyph.source.key]?.[glyph.variant] : undefined;
  if (!glyph || !Component) return null;
  const edge = Math.max(size, glyph.file.minPx ?? 0);
  const a11y = label
    ? ({ accessible: true, accessibilityRole: "image", accessibilityLabel: label } as const)
    : ({ accessibilityElementsHidden: true, importantForAccessibility: "no-hide-descendants" } as const);
  return (
    <View style={{ width: edge, height: edge }} {...a11y}>
      <Component width={edge} height={edge} fill={color} />
    </View>
  );
}
