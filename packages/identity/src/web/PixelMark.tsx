/**
 * A game's pixel mark on the web (../pixel.ts): one path per colour role, square pixels at any size. Decorative unless
 * given a label.
 */
import { PIXEL_MARKS, PIXEL_PATHS, type PixelColors, type PixelMarkName, pixelBox, pixelFill } from "../pixel.ts";

export interface PixelMarkProps {
  name: PixelMarkName;
  /** The longer side, in px. */
  size: number;
  colors: PixelColors;
  label?: string;
  className?: string;
}

export function PixelMark({ name, size, colors, label, className }: PixelMarkProps) {
  const { w, h } = pixelBox(PIXEL_MARKS[name]);
  const unit = size / Math.max(w, h);
  return (
    <svg
      width={w * unit}
      height={h * unit}
      viewBox={`0 0 ${w} ${h}`}
      shapeRendering="crispEdges"
      className={className}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      {PIXEL_PATHS[name].map((p) => (
        <path key={p.role} d={p.d} fill={pixelFill(p.role, colors)} />
      ))}
    </svg>
  );
}
