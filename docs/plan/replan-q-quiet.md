# Q — Quiet and alive (the owner's 13 Oct review; runs before R8)

**Goal:** every surface has one hero figure, draws its risk, payoff and time, moves when it's live, and keeps detail
behind one disclosure; leverage is opt-in; the gate keeps it that way.

**Why:** the owner's 13 Oct review — the white capsule on a dark Home (fixed, D-342), the open-position card ("too much
unnecessary stuff… slop"; a time that never counts down; no way to the trade), the ride settings sheet ("too much
text, boring, not creative"), leverage forced at 10× with no way off, and "look for the patterns even where I don't
say". Memory `feedback-restraint-not-text-dumps`.

**Authority:**
- the audit: `docs/research/review-2026-10-13/density-audit.md` (both apps, the references' 20 rules);
- Codex 15, the position row: `docs/research/replan-2026-10-10/15-position-row-direction.md`;
- Codex 16, the whole pass: `docs/research/replan-2026-10-10/16-quiet-direction.md`;
- decisions D-343…D-348; 21st.dev first.

**Gate (each area):**
- `pnpm gate` 0 with the new invariants (Q0);
- one Release simulator pass (hidden balances, Reduce Motion, a narrow phone, large text) and a production web check
  as the Practice guest;
- deployed one service at a time when the box's load is under 8; a phone OTA after the pass.

## Steps
- [ ] Q0 The rules in the gate (D-346): " · " chains ≤ 3 segments on operational surfaces; one `FactList` per app
  (typed facts, money marked) with ad-hoc grids banned outside it and ≤ 4 facts at rest; no explainer props in the
  settings and exit components; retired sentence helpers can't be imported; a dev-only inspector for a fact drawn
  twice or a deadline with two clocks.
- [ ] Q1 Trade setup and positions:
  - leverage opt-in (D-344): rides open at 1× ("No leverage"), a Leverage switch reveals one multiple and one marked
    slider; the device remembers an explicit choice;
  - ride settings: margin control, the two-rail risk ladder (KO and Cap at true distances), "Trail ›", "Open fee ›";
  - call settings: stake hero over the payoff drawing (line, zones, pay bars on one scale), "Trail 5¢ ›";
  - the position row (D-343) on every list, quiet Unrealized header, "Close all" as a review;
  - exact-position selection on the terminal (an older ride or call drives the chart);
  - value-first quote models (`ride-quote.ts`, `quote.ts`, `ride-tick.ts`, `stack-words.ts`).
- [ ] Q2 The terminal surface: the order stack as one control, payouts inside the buttons, CLOSE ≥ 28 with its net,
  the captions under the chart deleted, exit sheets as one draggable ruler, toasts title-only (the opened toast no
  longer sits over the dock).
- [ ] Q3 Receipts and the Calls record: one composition (figure, replay stage with pins, stamp once, ≤ 4 facts, a pin
  strip for timeline and proof, one "Proof ›"); no full slips inline in lists; the record as two figures and an
  outcome strip; history rows with one verdict word.
- [ ] Q4 Events and Duel: one phase clock, the split bar as the figure, the committee as a quorum, a timeline strip,
  "Verified ›" and "Rules ›"; Duel's pot fixed (D-347), coins between the seats, one ring.
- [ ] Q5 Earn (share hero, capacity bar with cap tick, hour ring, risk once), Wallet and Receive (one QR, no dead
  rows), Settings (icon · name · value), Status (one verdict and the strips).
- [ ] Q6 One market row contract with one round clock (D-348); Home as balance · positions · three markets ·
  "All markets ›"; Everything / More without descriptions; the games hub; Parlay's rule behind ⓘ.

**Folded in:** R5's Home JS load (Q6) and a guest's late ride result (Q2); R6's opened toast over the dock (Q2) and
⌘↵ for events and games (Q4); D-340's exact-position selection (Q1). The terminal's ~1 s tab switch stays an R9 item.

## Handoff
(written at the end of the stage)
