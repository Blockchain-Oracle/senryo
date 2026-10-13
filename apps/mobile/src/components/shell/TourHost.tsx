/**
 * The terminal's tour, mounted once over the whole app (R5.15): open on the first terminal visit on this phone
 * (`TerminalScreen`) and from Settings; done or skipped, it is remembered as seen.
 */
import { Tutorial } from "~/features/terminal/Tutorial";
import { closeTour, useTourOpen, useTourSeen } from "~/lib/tour";

export function TourHost() {
  const open = useTourOpen();
  const [, markSeen] = useTourSeen();
  if (!open) return null;
  return (
    <Tutorial
      onDone={() => {
        markSeen();
        closeTour();
      }}
    />
  );
}
