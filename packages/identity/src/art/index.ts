/**
 * Every artwork record by key: first-party, public-domain and Senryo original (written by hand in this folder), plus
 * the fetched ones (`./generated/fetched.ts`, written by `scripts/fetch-marks.ts` from `scripts/catalog.ts`).
 */
import type { ArtSource } from "../types.ts";
import { AUTH_ART } from "./auth.ts";
import { EXCHANGE_ART } from "./exchanges.ts";
import { FLAG_ART } from "./flags.ts";
import { FETCHED_ART } from "./generated/fetched.ts";
import { NETWORK_ART } from "./networks.ts";
import { ORIGINAL_ART } from "./originals.ts";
import { PROVIDER_ART } from "./providers.ts";

export const ART_SOURCES: readonly ArtSource[] = [
  ...NETWORK_ART,
  ...PROVIDER_ART,
  ...EXCHANGE_ART,
  ...AUTH_ART,
  ...FLAG_ART,
  ...ORIGINAL_ART,
  ...FETCHED_ART,
];

export const ART: Readonly<Record<string, ArtSource>> = Object.fromEntries(ART_SOURCES.map((a) => [a.key, a]));
