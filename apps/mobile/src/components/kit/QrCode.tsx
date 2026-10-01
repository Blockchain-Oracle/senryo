import { create } from "qrcode";
import { useMemo } from "react";
import Svg, { Path, Rect } from "react-native-svg";
import { SIZE, useTheme } from "~/theme";

/** The QR spec's quiet zone (modules) — scanners need it light on every side. */
const QUIET_MODULES = 4;

/**
 * A QR code drawn from the `qrcode` module matrix as one SVG path: dark ink on the light paper plate in both themes
 * (scanners need the contrast), error correction M. The payload is exactly `value` — the screen shows the same text.
 */
export function QrCode({ value, label, size = SIZE.qr }: { value: string; label: string; size?: number }) {
  const { color } = useTheme();
  const { path, extent } = useMemo(() => {
    const { modules } = create(value, { errorCorrectionLevel: "M" });
    let d = "";
    for (let row = 0; row < modules.size; row += 1) {
      for (let col = 0; col < modules.size; col += 1) {
        if (modules.get(row, col)) d += `M${col + QUIET_MODULES} ${row + QUIET_MODULES}h1v1h-1z`;
      }
    }
    return { path: d, extent: modules.size + QUIET_MODULES + QUIET_MODULES };
  }, [value]);
  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${extent} ${extent}`}
      accessibilityRole="image"
      accessibilityLabel={label}
    >
      <Rect width={extent} height={extent} fill={color.paper} />
      <Path d={path} fill={color.paperInk} />
    </Svg>
  );
}
