/**
 * A new leg's flight on the web (P3, R7.10; 21st motion-add-to-basket #24524, Mitoshi's fly-to-slip; the phone's
 * `FlyLayer`): a copy of the card's mark lifts and arcs into its socket over 320 ms, shrinking to the socket's mark,
 * then is removed — the socket's spring takes over (`LegSockets`). Reduced motion skips it.
 */
export const FLY_MS = 320;
/** How far above the higher end the arc peaks. */
const ARC = 96;
const STEPS = 16;
/** Mitoshi's fly ease: a slow lift, then a quick drop into the target. */
const FLY_EASE = "cubic-bezier(0.74, 0.18, 0.93, 0.69)";
const TARGET_MARK = 40;

export function flyMark(from: HTMLElement, to: HTMLElement): void {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const a = from.getBoundingClientRect();
  const b = to.getBoundingClientRect();
  const ghost = from.cloneNode(true) as HTMLElement;
  Object.assign(ghost.style, {
    position: "fixed",
    left: `${a.left}px`,
    top: `${a.top}px`,
    width: `${a.width}px`,
    height: `${a.height}px`,
    margin: "0",
    zIndex: "70",
    pointerEvents: "none",
  });
  ghost.setAttribute("aria-hidden", "true");
  document.body.append(ghost);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  const peak = Math.min(0, dy) - ARC;
  const end = TARGET_MARK / a.width;
  const frames = Array.from({ length: STEPS + 1 }, (_, i) => {
    const p = i / STEPS;
    const q = 1 - p;
    const y = 2 * q * p * peak + p * p * dy;
    return { transform: `translate(${dx * p}px, ${y}px) scale(${1 + (end - 1) * p})`, offset: p };
  });
  const run = ghost.animate(frames, { duration: FLY_MS, easing: FLY_EASE, fill: "forwards" });
  run.onfinish = () => ghost.remove();
  run.oncancel = () => ghost.remove();
}
