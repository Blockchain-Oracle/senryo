/**
 * The phone's side of the replay video's scene (Q3, D-350): the fonts at the frame's sizes, and the shared frames and
 * words (`filmSceneOf` — laid out once, strings formatted, hidden balances masked) memoised per film.
 */
import { type FilmSceneData, filmSceneOf, FILM_LAYOUT as L, type ReceiptFilm } from "@senryo/calls";
import { Skia, useTypeface } from "@shopify/react-native-skia";
import { useMemo } from "react";
import type { FilmFonts } from "./drawFilm";

export { FILM_COLOURS } from "@senryo/calls";

const FONT_FILES = {
  regular: require("../../../assets/fonts/Inter-Regular.ttf"),
  semibold: require("../../../assets/fonts/Inter-SemiBold.ttf"),
  bold: require("../../../assets/fonts/Inter-Bold.ttf"),
  display: require("../../../assets/fonts/RobotoCondensed-Black.ttf"),
};

export function useFilmFonts(): FilmFonts | null {
  const regular = useTypeface(FONT_FILES.regular);
  const semibold = useTypeface(FONT_FILES.semibold);
  const bold = useTypeface(FONT_FILES.bold);
  const display = useTypeface(FONT_FILES.display);
  return useMemo(() => {
    if (!regular || !semibold || !bold || !display) return null;
    const f = (tf: typeof regular, size: number) => Skia.Font(tf, size);
    return {
      handle: f(semibold, L.handle.size),
      handleSmall: f(semibold, L.handle.min),
      date: f(regular, L.date.size),
      small: f(regular, L.labels.size),
      caption: f(regular, L.moment.captionSize),
      tiny: f(regular, L.provenance.size),
      pill: f(bold, L.pill.size),
      marker: f(display, L.moment.labelSize),
      market: f(semibold, L.market.nameSize),
      body: f(regular, L.market.idSize),
      pnl: f(display, L.pnl.size),
      pnlSmall: f(display, L.pnl.min),
      roi: f(semibold, L.roi.size),
      statValue: f(semibold, L.stats.valueSize),
      code: f(semibold, L.referral.codeSize),
      codeSmall: f(semibold, L.referral.codeMin),
      stampWord: f(display, L.stamp.wordSize),
    };
  }, [regular, semibold, bold, display]);
}

/** The film's frames and words (`filmSceneOf`), once per film; `handle` null for a guest. */
export function useFilmScene(rf: ReceiptFilm | null, handle: string | null, hidden: boolean): FilmSceneData | null {
  return useMemo(() => filmSceneOf(rf, handle, hidden), [rf, handle, hidden]);
}
