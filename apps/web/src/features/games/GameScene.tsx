"use client";
/**
 * Each game's card art (R7.7, research 10 §3: "show the sled, reel machine, candle canyon and card table — not four
 * interchangeable icons"): a 16:9 scene of the game itself on the arena (D-316), moving — the reels tumble behind the
 * payline while the lever swings, the sled rides a neon price line with sparks, the coin bobs through a candle canyon,
 * a card flips on the table. Each is a self-contained animated SVG in `public/games/` (its colours are the arena's
 * and the direction fills, the same in both themes), still under reduced motion.
 */
const LABEL: Readonly<Record<string, string>> = {
  lucky: "Lucky: a slot machine with its lever",
  "line-rider": "Line Rider: a sled riding the price line",
  "candle-hop": "Candle Hop: a coin through the candles",
  "warm-up": "Warm-up: a table of live cards",
};

export function GameScene({ game }: { game: string }) {
  const label = LABEL[game];
  if (!label) return null;
  // biome-ignore lint/performance/noImgElement: a static export; an animated SVG plays inside a plain img
  return <img src={`/games/${game}.svg`} alt={label} className="game-scene" draggable={false} />;
}
