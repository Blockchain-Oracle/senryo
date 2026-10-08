/** The one confetti layer over the app (S5.9 result reveal): bursts on `celebrate()`, in the Senryo colours. */
import { useEffect, useMemo, useState } from "react";
import { Confetti } from "~/components/kit/Confetti";
import { onCelebrate } from "~/feedback/celebrate";
import { useTheme } from "~/theme";

export function ConfettiHost() {
  const { color } = useTheme();
  const [burst, setBurst] = useState(0);
  useEffect(() => onCelebrate(() => setBurst((n) => n + 1)), []);
  const colours = useMemo(
    () => [color.chartUp, color.accent, color.gold, color.practice, color.ink],
    [color.chartUp, color.accent, color.gold, color.practice, color.ink],
  );
  return <Confetti burst={burst} colours={colours} />;
}
