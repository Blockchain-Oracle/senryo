/** Window lengths the terminal offers (1m · 5m · 15m · 1h); each divides one hour (contracts `CADENCE_DIVIDES_SEC`). */
export const CADENCES_SEC = [60, 300, 900, 3600] as const;
export type CadenceSec = (typeof CADENCES_SEC)[number];
