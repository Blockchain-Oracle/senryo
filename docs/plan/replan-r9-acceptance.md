# R9 — Acceptance, then S8b → S9 → S10 (replan stage 9)

**Goal:** every replan row is accepted with evidence on both apps. Then the remaining pivot stages run on v3.

**Authority:**
- `replan-2026-10-10.md` R9;
- `pivot-2026-10-08.md` (S8b, S9, S10);
- D-299, D-305, D-306, D-309;
- memory rules: built, accepted, deployed and mainnet-verified are kept as separate facts.

**Gate:**
- `parity-replan.md` with every row at built / accepted / deployed, or a named reason;
- `acceptance.md` rows;
- `pnpm gate` 0.

## Steps
- [ ] R9.1 One simulator pass per merged area (R1, R2, R4, R5, R6, R7, R8) on the phone; the web through the preview tools
  (console, network, screenshots, light and dark, phone width).
- [ ] R9.2 Price gates still open from R1 (G1 load, G2 soak, G4 phone transport, G5 smoothness) run or recorded with
  their reason.
- [ ] R9.3 `parity-replan.md` closed; `docs/judges.md` and the README describe what is on screen.
- [ ] S8b Agents and desks (strategies, copy/fade, the hourly desk), as planned.
- [ ] S9 Mainnet 143:
  - v3 fresh with the mainnet terms (D-301), Up/Down plus the bands that pass calibration (D-306);
  - real rides web-only (D-305);
  - Aurora deposit, Pay with MON and the MON market;
  - the seed waits on the owner's funding.
- [ ] S10 Ship, as planned (`pivot-2026-10-08.md` S10).

## Handoff
(written at the end of the stage)
