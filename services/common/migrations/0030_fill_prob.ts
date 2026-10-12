/**
 * 0030 — a call's fair chance at its fill (R5.2, D-303). `Filled.probE6` is the model's probability at the fill print,
 * before the spread: the apps count a call's live PnL from it (shares × (chance now − chance at the fill)), so a call
 * starts at $0.00 and the spread shows as its Fees row. Tickets filled before this column read null, and the apps fall
 * back to cash-out − stake for them.
 */
export const id = "0030_fill_prob";

export const sql = /* sql */ `
ALTER TABLE market_tickets ADD COLUMN IF NOT EXISTS fill_prob_e6 int;
`;
