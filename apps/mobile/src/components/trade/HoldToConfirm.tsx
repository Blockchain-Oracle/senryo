/**
 * Legacy name for the slide (D-235). Callers keep their props; the rail is `SlideToConfirm`. A label written as
 * "Hold to …" or "Slide to …" reads "Slide to …" when ready and the bare reason when disabled.
 */
import { SlideToConfirm, type SlideTone } from "./SlideToConfirm";

interface Props {
  label: string;
  holdingLabel?: string;
  onConfirm: () => void;
  disabled?: boolean;
  busy?: boolean;
  tone?: SlideTone;
  accessibilityHint?: string;
  resetKey?: string;
  onReset?: () => void;
  onAccessibleActivate?: () => void;
}

const PREFIX = /^(Hold|Slide) to /i;

export function HoldToConfirm({ label, disabled, ...rest }: Props) {
  const action = label.replace(PREFIX, "");
  const shown = disabled ? action : `Slide to ${action.charAt(0).toLowerCase()}${action.slice(1)}`;
  return (
    <SlideToConfirm
      label={shown}
      disabled={disabled === true}
      onConfirm={rest.onConfirm}
      {...(rest.busy !== undefined ? { busy: rest.busy } : {})}
      {...(rest.tone ? { tone: rest.tone } : {})}
      {...(rest.resetKey !== undefined ? { resetKey: rest.resetKey } : {})}
      {...(rest.onReset ? { onReset: rest.onReset } : {})}
      {...(rest.onAccessibleActivate ? { onAccessibleActivate: rest.onAccessibleActivate } : {})}
    />
  );
}
