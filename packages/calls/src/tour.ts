/**
 * The terminal's five-step tour (R5.15; Tradash's tour by way of Owarine's `tour-copy.ts`, reworded for calls and
 * rides): shown once on the first terminal visit on each device, and again from Settings. One step a screen, the
 * network named on every step.
 */
export const TOUR_STEPS = [
  {
    title: "Watch the market",
    body: "The live price is your whole workspace: the line, its levels and your positions on it. No forms.",
  },
  {
    title: "Tap UP or DOWN",
    body: "Think it ends higher? Tap UP. Lower? Tap DOWN. One tap places a call on the window; Ride holds the move with leverage.",
  },
  {
    title: "Watch your PnL move",
    body: "Your result moves live on the line: green while you're up, red while you're down. The button shows what you'd get now.",
  },
  {
    title: "Trail to lock profit",
    body: "Once you're up, tap TRAIL. It follows the price your way and closes if it turns, even with the app closed.",
  },
  {
    title: "Close to bank it",
    body: "Tap CASH OUT or CLOSE any time for the amount on the button. That's the loop: watch, tap, manage, close.",
  },
] as const;

/** Said on every step: where this runs and what the money is. */
export const tourNote = (practice: boolean): string =>
  practice
    ? "This is Practice: free test dollars, no real money."
    : "This is Real: USDC. A call can lose its whole stake.";
