/**
 * 0025 — σ marks by rule (R4.8). Rule 1 counted every boundary print as a price; Pyth's equity feeds keep printing
 * while their market is closed, so an equity's marks decayed toward zero overnight and opened the session at the
 * series' floor. Rule 2 skips minutes the market's own calendar marks closed. Each row says which rule made it: rule 2
 * builds only on rule 2 rows and replaces an older rule's row for the same minute, so the deploy needs no data fix.
 */
export const id = "0025_sigma_rule";

export const sql = /* sql */ `
ALTER TABLE sigma_marks ADD COLUMN IF NOT EXISTS rule int NOT NULL DEFAULT 1;
`;
