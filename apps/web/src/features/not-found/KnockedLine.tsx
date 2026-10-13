/**
 * The 404's figure: a price walk drawn across the stage that knocks out — it drops off the bottom with the ride's ×
 * (R5's knock-out mark) — while a faint dashed line keeps going where it would have gone. Drawn once on arrival; still
 * under Reduce Motion (`not-found.css`).
 */

/**
 * The walk: POINTS prices from START climbing to PEAK across the knock-out's span, with a seeded wobble so it reads as
 * a price and draws the same on every visit (the classic `fract(sin(i·a)·b)` hash).
 */
const POINTS = 44;
const START = 112;
const PEAK = 40;
const JITTER = 11;
const SEED_A = 12.9898;
const SEED_B = 43758.5453;
const HALF = 0.5;
const KO_X = 430;
const WIDTH = 600;
const HEIGHT = 160;
const STEP = KO_X / (POINTS - 1);
const CLIMB = (START - PEAK) / (POINTS - 1);
const rand = (i: number) => {
  const x = Math.sin(i * SEED_A) * SEED_B;
  return x - Math.floor(x);
};
const WALK = Array.from({ length: POINTS }, (_, i) =>
  i === 0 || i === POINTS - 1 ? START - i * CLIMB : START - i * CLIMB + (rand(i) - HALF) * JITTER,
);
const KO_TOP = PEAK;
const HEAD = 4.5;
/** Where the drop lands: off the stage's floor, a little past the last price. */
const DROP_RUN = 12;
const FLOOR_GAP = 12;
const DROP_X = KO_X + DROP_RUN;
const DROP_Y = HEIGHT - FLOOR_GAP;
const CROSS = 7;
/** The line it would have taken: on up and to the right. */
const GHOST_END_Y = 14;
const DECIMALS = 1;

const walk = WALK.map((y, i) => `${i === 0 ? "M" : "L"}${(i * STEP).toFixed(DECIMALS)},${y.toFixed(DECIMALS)}`).join(
  " ",
);

export function KnockedLine() {
  return (
    <svg
      className="nf-line"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      aria-hidden
      focusable="false"
    >
      <path className="nf-ghost" d={`M${KO_X},${KO_TOP} L${WIDTH},${GHOST_END_Y}`} />
      <path className="nf-walk" d={walk} pathLength={1} />
      <path className="nf-drop" d={`M${KO_X},${KO_TOP} L${DROP_X},${DROP_Y}`} pathLength={1} />
      <circle className="nf-head" cx={KO_X} cy={KO_TOP} r={HEAD} />
      <g className="nf-ko">
        <path d={`M${DROP_X - CROSS},${DROP_Y - CROSS} L${DROP_X + CROSS},${DROP_Y + CROSS}`} />
        <path d={`M${DROP_X + CROSS},${DROP_Y - CROSS} L${DROP_X - CROSS},${DROP_Y + CROSS}`} />
      </g>
    </svg>
  );
}
