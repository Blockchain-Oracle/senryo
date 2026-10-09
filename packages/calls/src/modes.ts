/**
 * The ways to call (S7.4, D-285): Up / Down, Range and Moonshot — the series' fixed menu on chain, offered by mode. A
 * mode shows at most two buttons: Up and Down; Range alone (inside its edges); ▲ Moonshot and ▼ Crash (beyond their
 * strikes). Each button is a menu index the call is placed on.
 */
import { BAND_INDEX } from "@senryo/config";
import { bandName, bandWhere } from "@senryo/core";
import type { BandSpecLike } from "./quote.ts";

export type CallMode = "updown" | "range" | "moonshot";

export const CALL_MODES = [
  { value: "updown", label: "Up / Down" },
  { value: "range", label: "Range" },
  { value: "moonshot", label: "Moonshot" },
] as const;

/** The menu indexes a mode's two buttons place (the second absent for Range). */
export const MODE_OFFER: Readonly<Record<CallMode, readonly [number, number | null]>> = {
  updown: [BAND_INDEX.up, BAND_INDEX.down],
  range: [BAND_INDEX.range, null],
  moonshot: [BAND_INDEX.moonshot, BAND_INDEX.crash],
};

export const isCallMode = (v: string | null | undefined): v is CallMode =>
  v === "updown" || v === "range" || v === "moonshot";

/** One button: the band it places, its name and where it wins (edges once K is known). */
export interface OfferedBand {
  index: number;
  band: BandSpecLike;
  label: string;
  where: string;
  /** The button's tone: up for Up and Moonshot, down for Down and Crash, neutral for Range. */
  tone: "up" | "down" | "neutral";
}

export type Offer = readonly [OfferedBand | undefined, OfferedBand | undefined];

const TONE: Readonly<Record<BandSpecLike["kind"], OfferedBand["tone"]>> = {
  up: "up",
  moonshot: "up",
  down: "down",
  crash: "down",
  range: "neutral",
};

export function offerOf(mode: CallMode, menu: readonly BandSpecLike[] | undefined, k: bigint | undefined): Offer {
  const one = (index: number | null): OfferedBand | undefined => {
    const band = index === null ? undefined : menu?.[index];
    if (index === null || !band) return undefined;
    return { index, band, label: bandName(band.kind), where: bandWhere(band, k), tone: TONE[band.kind] };
  };
  const [a, b] = MODE_OFFER[mode];
  return [one(a), one(b)];
}
