/**
 * Pixel marks for the games (replan R2.6; Lucky and Warm-up draw them, R7 builds on them): a bull for Up, a bear for
 * Down, a coin and a plate for Lucky's reach. Authored in the owner's Owarine project
 * (owarine web/src/features/games/art/PixelArt.tsx at 2b968b59) and ported here as data. Colours are roles the host maps
 * to its theme (no hex but the glint's white), so the marks flip with it; each is drawn as one path per role with
 * square pixels (`crispEdges`), never as hundreds of nodes.
 */

export type PixelRole = "up" | "down" | "gold" | "ground" | "white" | "soft";

export interface PixelMark {
  rows: readonly string[];
  /** Grid character → role; any other character is clear. */
  roles: Readonly<Record<string, PixelRole>>;
}

/** The glint and highlight colour, the same in both themes. */
export const PIXEL_WHITE = "#FFFFFF";

export const PIXEL_MARKS = {
  /** The bull, horns up, in the Up colour. */
  bull: {
    roles: { G: "up", W: "white", K: "ground" },
    rows: [
      "....W......W....",
      "....WW....WW....",
      ".....GGGGGG.....",
      "....GGGGGGGG....",
      "...GGKGGGGKGGG..",
      "...GGGGGGGGGGG..",
      "..GGGGGGGGGGGG..",
      "..GGGGGWWGGGGG..",
      "..GGGGGWWGGGGG..",
      "...GGGGGGGGGG...",
      "....GGGGGGGG....",
      ".....GG..GG.....",
      ".....GG..GG.....",
      "................",
    ],
  },
  /** The bear, round ears, in the Down colour. */
  bear: {
    roles: { R: "down", W: "white", K: "ground" },
    rows: [
      "..RR........RR..",
      ".RRRR......RRRR.",
      ".RRRRRRRRRRRRRR.",
      "..RRRRRRRRRRRR..",
      "..RRKRRRRRRKRR..",
      "..RRRRRRRRRRRR..",
      "..RRRRRWWWRRRR..",
      "..RRRRRWKWRRRR..",
      "...RRRRRWRRRR...",
      "....RRRRRRRR....",
      ".....RR..RR.....",
      ".....RR..RR.....",
      "................",
    ],
  },
  /** The coin at rest, in gold leaf, with a glint. */
  coin: {
    roles: { V: "gold", W: "white", K: "ground" },
    rows: [
      ".....VVVVVV.....",
      "...VVVVVVVVVV...",
      "..VVWWVVVVVVVV..",
      ".VVWVVVVVVVVVVV.",
      ".VVVVVVKKVVVVVV.",
      "VVVVVVKKKKVVVVVV",
      "VVVVVKKVVKKVVVVV",
      "VVVVVKKVVKKVVVVV",
      "VVVVVKKVVKKVVVVV",
      "VVVVVVKKKKVVVVVV",
      ".VVVVVVKKVVVVVV.",
      ".VVVVVVVVVVVVVV.",
      "..VVVVVVVVVVVV..",
      "...VVVVVVVVVV...",
      ".....VVVVVV.....",
    ],
  },
  /** A bordered plate with the mark in its middle: Lucky's reach sits on it (gold: `#FA00FF` is for actions only). */
  plate: {
    roles: { B: "soft", V: "gold", W: "white" },
    rows: [
      "BBBBBBBBBBBBBBBB",
      "B..............B",
      "B.B..........B.B",
      "B..............B",
      "B......VV......B",
      "B.....VVVV.....B",
      "B....VVWWVV....B",
      "B...VVVWWVVV...B",
      "B...VVVWWVVV...B",
      "B....VVWWVV....B",
      "B.....VVVV.....B",
      "B......VV......B",
      "B..............B",
      "B.B..........B.B",
      "B..............B",
      "BBBBBBBBBBBBBBBB",
    ],
  },
} as const satisfies Record<string, PixelMark>;

export type PixelMarkName = keyof typeof PIXEL_MARKS;

/** The grid's size in pixels. */
export function pixelBox(mark: PixelMark): { w: number; h: number } {
  return { w: Math.max(...mark.rows.map((r) => r.length)), h: mark.rows.length };
}

/** One SVG path per role, each pixel a unit square (`M x y h1 v1 h-1z`), in first-seen order. */
export function pixelPaths(mark: PixelMark): { role: PixelRole; d: string }[] {
  const byRole = new Map<PixelRole, string[]>();
  mark.rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const role = mark.roles[ch];
      if (!role) return;
      const parts = byRole.get(role) ?? [];
      parts.push(`M${x} ${y}h1v1h-1z`);
      byRole.set(role, parts);
    });
  });
  return [...byRole].map(([role, parts]) => ({ role, d: parts.join("") }));
}

/** Every mark's paths, computed once. */
export const PIXEL_PATHS: Readonly<Record<PixelMarkName, readonly { role: PixelRole; d: string }[]>> = {
  bull: pixelPaths(PIXEL_MARKS.bull),
  bear: pixelPaths(PIXEL_MARKS.bear),
  coin: pixelPaths(PIXEL_MARKS.coin),
  plate: pixelPaths(PIXEL_MARKS.plate),
};

/** What the host maps each themed role to (its theme's colours; the glint's white is fixed). */
export type PixelColors = Readonly<Record<Exclude<PixelRole, "white">, string>>;

/** A role's paint: the host's colour, or the fixed white. */
export const pixelFill = (role: PixelRole, colors: PixelColors): string =>
  role === "white" ? PIXEL_WHITE : colors[role];
