/**
 * A game's pixel mark on the phone (../pixel.ts): one react-native-svg path per colour role, square pixels at any size.
 * Decorative unless given a label.
 */
import { View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { PIXEL_MARKS, PIXEL_PATHS, type PixelColors, type PixelMarkName, pixelBox, pixelFill } from "../pixel.ts";

export interface PixelMarkProps {
  name: PixelMarkName;
  /** The longer side, in points. */
  size: number;
  colors: PixelColors;
  label?: string;
}

export function PixelMark({ name, size, colors, label }: PixelMarkProps) {
  const { w, h } = pixelBox(PIXEL_MARKS[name]);
  const unit = size / Math.max(w, h);
  const a11y = label
    ? ({ accessible: true, accessibilityRole: "image", accessibilityLabel: label } as const)
    : ({ accessibilityElementsHidden: true, importantForAccessibility: "no-hide-descendants" } as const);
  return (
    <View {...a11y}>
      <Svg width={w * unit} height={h * unit} viewBox={`0 0 ${w} ${h}`}>
        {PIXEL_PATHS[name].map((p) => (
          <Path key={p.role} d={p.d} fill={pixelFill(p.role, colors)} />
        ))}
      </Svg>
    </View>
  );
}
