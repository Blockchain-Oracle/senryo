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
- [x] Q0 The rules in the gate (D-346) — built `62439a89`, gate green:
  - `restraint-dot-chains` (≤ 3 segments; `chain()` joins at most three by type), `restraint-fact-list`,
    `restraint-no-explainers`, `restraint-retired-words`; surfaces a later area rebuilds are allowed by name with that
    area, and a clean allowed file is itself a finding, so the list only shrinks;
  - one `FactList` per app (typed facts, money masked by type, ≤ 4 at rest) and a dev-only inspector (a fact drawn
    twice, a deadline with two clocks — wired to clocks as Q4 and Q6 land).
- [x] Q1 Trade setup and positions — built (`0f3f666a`, `c05874f5`, `99319578`, `d954a7b1`, `fdd6da0b`):
  - [x] leverage opt-in (D-344): rides open at 1×; the Leverage row is one switch (the native UISwitch lost taps in a
    sheet on iOS 26 — every phone switch is now the kit `Switch`); on, the multiple and a marked slider; the device
    remembers the multiple; storage keys v2 so the old forced 10× doesn't carry over;
  - [x] ride settings: margin line, the two-rail risk ladder (KO and Cap at true distances, the live price in its
    header, tap a level for its move), Trail as a marked ruler, "Open fee ›" (close fee at today's price, the
    early-close fee); deleted: trade size, max profit, the capped rows, the duplicated fee, after this, the explainers;
  - [x] call settings: the type, "Stake" over the hero, the payoff drawing (the line, zones where their edges sit,
    thin "Pays $x" bars on one scale that grows with the stake, the stake tick, a live bead, a ring to settlement),
    "On the line refunds." for Up/Down only, Trail as a bid-cents ruler, "Fees ›";
  - [x] the position row (D-343) on phone Home, Calls and the terminal sheet and the web column, drawer, Home and
    Calls; the quiet Unrealized header; "Close all (N)" / "Close available (N)" opening a review; long-press (phone)
    or right-click / hold (web) for Position details and View receipt;
  - [x] exact-position selection: a link's position stays selected (an older ride, a second call in the window)
    until another is picked or a new trade is placed; on arrival the terminal's CLOSE is ringed;
  - [x] value-first models: `rideLadder`, `callPayoff`, `RideQuote.closeFee`, `positionClock` / `pnlText` /
    `roiText` / `positionDetails`, `feeDollars`; `knockOutWords`, `capWords`, `capText`, `positionSub`,
    `positionHold`, `positionTitle` and `leverageChips` retired. `ride-tick` `upLine` / `downLine` and `stack-words`
    retire with their consumers in Q2 (the KO captions and the order stack);
  - accepted (Release simulator, testnet Practice): a **1× ride opened and closed** (`$5.00 at 1×`); Leverage off in
    one tap on the row; leverage on narrows both KOs on the ladder; the payoff drawing for Up/Down, Range and
    Moonshot; the row's ring, ticking clock, trace and rolling PnL; swipe reveals only "Close $5.00"; a tap opens that
    exact ride with CLOSE ringed. Production web as a guest: both settings sheets (`sha-62439a8`).
  - open: the row's Close after the `d954a7b1` fix, the long-press menu, hidden balances / Reduce Motion / large text
    on the phone — the simulator was in use when the pass reached them; next pass.
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
