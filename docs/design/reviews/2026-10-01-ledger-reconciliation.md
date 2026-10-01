# Parity ledger reconciliation — 1 Oct 2026 (review S07)

This pass reconciles `docs/design/senryo-parity-ledger.json` with the acceptance record, the stage docs, STATUS, the
decisions and the code on `main` at `0a8c915`. Finding S07 in
`docs/design/reviews/2026-10-01-expanded-product-design-review.md` asked for it. Every one of the 216 rows now has a
status from one vocabulary, plus the revision it stands on, pointers to its evidence and what it still owes.

**Not changed:** plans, classifications (Exact/Adapted/…), `required` texts, and every other existing field. The
contradictions found are listed in section 5 and left for their owners.

## 1. Counts

| Status | Before | After |
|---|---:|---:|
| `pending` | 178 | 16 |
| `built` | — | 125 |
| `accepted-simulator` | — | 29 |
| `accepted-device` | — | 0 |
| `deployed` | — | 0 |
| `mainnet-verified` | — | 0 |
| `blocked` | — | 27 |
| `excluded` | — | 19 |
| free-text identity statuses ("acquired", "not attempted yet", "pattern adopted", …, 28 distinct strings) | 38 | 0 |

Transitions:
- 178 `pending` → 105 built, 27 accepted-simulator, 14 blocked, 17 excluded; 15 stay pending.
- 38 free-text identity statuses → 20 built, 2 accepted-simulator, 13 blocked, 2 excluded, 1 pending. The old text is
  kept in `acceptance_evidence.prior_status`.

**Why three statuses are empty:**
- No acceptance row comes from a physical device. The phone runs the dev-server bundle, but nothing from it was
  recorded.
- No app build has been distributed. Service deploys on Coolify (api, keeper, indexer, web) are named in evidence,
  but they do not make a row `deployed`.
- Nothing has run on mainnet.

## 2. How a status was decided

The definitions are stored in the ledger itself, under `acceptance_status_vocabulary`.

- **`accepted-simulator`** needs two things:
  - an `acceptance.md` row recorded on the simulator that exercises the row's primary behaviour;
  - a Result in that row that does not exclude the behaviour.

  The S1b.17 fidelity items that the row did not record stay in `remaining`: the 402×874 screenshot beside the
  reference frames, the motion clip, parent restoration, loading/empty/error/retry, and reduced motion/transparency.
  No acceptance row records them yet, so every accepted row still lists them.
- **Partial evidence keeps the lower status.** If an acceptance row covers only part of a row's behaviour (create but
  not sign-in, a quote but no swap, a deposit but no redemption), the row stays `built` and the missing part is named.
- **`built`** was confirmed in code. `accepted_revision` is the implementing commit, taken from the commit message or
  `git log -1` on the module. Gaps found in the code are named in `remaining`, for example "no pan gesture" or
  "no recents list".
- **`blocked`** is used only for the ledger's own blocker codes (B1–B12), a provider, or a user step. The blocker is
  named in `blocked_by`. A stage that simply hasn't been built yet, such as S9 Aurora, is `pending` with
  `depends_on`.
- **`excluded`** is used only where a decision excludes the row: D-194, D-195, or the binding D-029. It is named in
  `excluded_by`.
- **Revisions.** Some acceptance rows give their commit as "(this commit)". Those were resolved with `git blame`:

| acceptance.md UTC | Revision | | acceptance.md UTC | Revision |
|---|---|---|---|---|
| 08:30Z | f2ae8af (named) | | 13:04Z–13:15Z | 22b0732 |
| 08:32Z | a423cfb (named) | | 13:40Z | 5ae3106 |
| 09:05Z | 3d44e5b (named) | | 14:23Z | 2a2e27c |
| 09:40Z | 4f5832e | | 14:55Z | 08262bf (named) |
| 10:15Z | cb09307 (named) | | 15:40Z–15:55Z | 166181d |
| 10:40Z | e7310b8 | | 16:50Z | 9d22903 |
| 10:55Z / 11:10Z / 11:35Z | bd3e87f / ae9784d / fd9bc9f | | 12:01Z | 52de228 (named) |
| 11:25Z–11:32Z / 11:45Z | 7efcbd3 / 7de75a7 | | | |

**Fields added.** Inside `acceptance_evidence`:
- `accepted_revision`, `evidence`, `remaining`;
- `blocked_by`, `depends_on` or `excluded_by`, where they apply;
- `prior_status`, which keeps a replaced free-text status.

At the top level, `acceptance_status_vocabulary` and `reconciliation` were added, and `summary` gained
`acceptance_status` and `acceptance_status_before_reconciliation`.

## 3. Rows that moved, and why

### `accepted-simulator` (29)

| Rows | Acceptance row(s) | Why accepted; what is still owed beyond S1b.17 |
|---|---|---|
| FT038, FT039, FT065, FT068, C09 | 09:05Z @3d44e5b | Handle with live availability, address-derived suggestion and terms, walked to Home. Owed: invalid/unavailable/held states, keyboard-up layout, resume after kill; the Terms text is the lead's draft |
| FT006, FT042, C06 | 13:04Z @22b0732 | Face ID primer through the OS sheet to a match. Owed: no-Face-ID, refused and missing-module branches |
| FT008, FT043, FT063, C07 | 13:05Z, 13:08Z, 13:11Z @22b0732 | Notification primer, OS prompt, `PUT /v1/push/token`, simctl push tap, You → Notifications. Owed: device delivery (the user's Apple login), denied branch, Android 13 prompt |
| FT007, C08 | 13:05Z @22b0732 (+ 09:05Z) | Setup ends on the completion foil, then Home. Owed: the M18 motion clip, B12 |
| FT102, C39 | 08:32Z @a423cfb, 14:23Z @2a2e27c | Margin and leveraged size on the ticket, P$10 and P$5 at 5×, finalized |
| C43 | 08:32Z, 14:23Z | Hold to confirm, and a disabled reason ("Market full · Try ≤ P$27.65") |
| FT110, C42 | 09:40Z @4f5832e, 12:01Z @52de228, 14:23Z @2a2e27c | TP/SL placed and removed from a position; planned on a new order and placed after the open. Owed: a level that fails after the open, keyboard lift, Perpl B10 |
| C25 | 09:40Z @4f5832e | Tall own-position page, close All by hold, finalized. Owed: the shared variant |
| FT069 | 13:40Z @5ae3106 | Home's 24 h change net of money moved. Owed: reconciliation against indexed flows; cache/error states |
| FT071, C22 | 15:40Z @166181d; 13:15Z @22b0732 | Market and token rows, including FX pairs and Tokens with token-list art. Owed: JPY's price squeezes its pair; OI and chips not described |
| FT098 | 14:55Z @08262bf | Holders tab against the deployed api (`social check` 142/142). Owed: Friends switched on |
| FT044 | 15:45Z @166181d | Practice → Switch to Mainnet through the mode sheet |
| FT024 | 11:35Z @fd9bc9f | Card tab on the real onchain limit and Freeze (D-198). Owed: issuance B11 |
| FT058 | 11:10Z @ae9784d, 16:50Z @9d22903 | Send recipient → exact amount → step-up → stable receipt. Owed: the recents / no-recents state is not built; the unknown-outcome branch exercised |
| LG20 | 15:40Z @166181d | Spot tokens with their token-list logos. Owed: a stored screenshot |
| LG32 | 14:55Z @08262bf, 10:15Z @cb09307 | Authored portraits picked, saved and shown in Holders. Owed: a stored screenshot; B12 |

### `built` (125): code on main, acceptance owed

Grouped by journey (`row@revision`). Named gaps are in each row's `remaining`.

- **J1:**
  - Rows: FT001/C01/M01@ba409c9, FT035/C02/C04/M18/LG30@812fce3, FT062/LG29/LG31@8fc1326,
    FT002/C03/FT114/M17@a423cfb, FT066/C11/C12@3d44e5b, FT041/FT067/C10@ae9784d.
  - Partial runs: FT114 recorded only the create branch, on f2ae8af, before the D-196 auth-sheet rebuild.
    FT066/FT067: the 09:05Z row says a real follow and a voucher redemption were not exercised.
- **J2:**
  - Rows: FT011/FT012/FT013/FT060/FT087/FT091/C32/C33/M04@05c2384, FT057@5917f97, FT056/FT093/C37@9d22903,
    M07/M12@a423cfb, and the marks LG04/LG13/LG23/LG24@c731503, LG09/LG10@1137f57.
  - FT056/C37 (swap): the 15:55Z Result is "partial". There were quotes but no swap, because a real swap needs the
    user's mainnet USDC and MON.
- **J3:**
  - Rows: FT033/FT048/FT072/FT095/FT096/FT097/FT099/FT100/C26/M08@dd08d0c, FT045@0a8c915, C14@166181d, and the marks
    LG01/LG02/LG03/LG16/LG17@c731503, LG06/LG19/LG38@1137f57.
  - Gaps found in code: trending assets (FT033), perps education (FT072), chart pan (FT096). In FT097, history became
    a price alert.
- **J4:** FT103/FT104/C40/M14@7efcbd3, FT105/FT106/FT109/FT112/C41@a423cfb, FT107/FT108@2a2e27c,
  FT111/M15@52de228, LG07@1137f57.
- **J5:** FT075@69958c3. There is no position chart: the page has a P&L hero and a stats grid.
- **J6:** FT009@d949f6a, FT046@a423cfb, FT070/C23@d18c97a, C19@7efcbd3, C20@1e29a4e.
- **J7:** FT022/FT023/C21/M03@b924f1a.
- **J8:**
  - Rows: FT074/FT076/FT077/FT078/FT083/FT085/C27/C28/C30@4a4bf0f, FT079/C29@cb09307, FT086/C31@f9cd161,
    FT059/C38@9d22903, M11@ad2a657.
  - Gaps found in code: no QR scan (expo-camera is not in the app) and no contacts list (FT059/C38).
- **J9:** FT010/FT080/FT081/FT082@ad2a657.
- **J10:** FT026@9d22903. The 10:40Z row covers the deposit only; redeem → wait → claim is owed.
- **Shell:** FT034/FT055/FT061/FT073/C13/C15–C18/M02/M06/M09/M10@a423cfb.
- **Cross-journey:**
  - FT116@7de75a7 is partial: light theme, large text, Reduce Motion and the a11y tree are recorded, but the spoken
    VoiceOver pass, Reduce Transparency, haptics and TalkBack are not.
  - C44@0a8c915, LG36@1137f57, LG37@884b8d6.

### `blocked` (27)

- The 26 rows classified Blocked keep their codes:
  - FT003/FT036 (B4);
  - FT020/FT021/FT089/FT090/C36/LG22/LG27/LG35 (B3);
  - FT029/LG33 (B5);
  - FT031/FT040/FT047/FT084/LG34 (B6);
  - LG28 (B11);
  - LG05/LG08/LG11/LG12/LG14/LG15/LG18 (B12, plus the route or B2 dependency each one names);
  - FT115 (B1).
- FT115 also lists the lifecycles already recorded (open, TP/SL, close, LP deposit, withdraw, send) and the ones still
  owed: credited deposit, card spend, real swap, recovery after a kill.
- **FT092** (Adapted) is `blocked`: the card KYC handoff waits on the S10 card provider (B11), and no provider sandbox
  key is set.

### `excluded` (19)

| Decision | Rows |
|---|---|
| D-194 | FT025, FT027, FT028, FT030, FT049–FT054, C24 |
| D-195 | FT004, FT005, FT113, C05 |
| D-029 (binding) | FT037, FT064, LG25, LG26 |

Excluded branches inside other rows keep their `branches` entries.

### Identity: free-text status → vocabulary (38)

- "acquired … gap" and licence flags (LG01–LG04, LG09, LG13) → `built`. The supplements in c731503 closed the gaps,
  and stage S1b.2 closed the licence flags as nominative use.
- "lands with J11" (LG20) and "avatars not authored yet (B12)" (LG32) → `accepted-simulator`.
- "pattern adopted" / "rule enforced in registry" (LG16, LG17, LG19), "brand/" (LG29, LG31), "B12 art open" (LG30) and
  "first pass in brand/art" (LG38) → `built`. B12 stays in `remaining`.
- "acquired", "Perpl PNG kit + HYPE acquired", "site icon acquired", "site-hosted first-party file", "built (S1b.1)" and
  "lucide-react-native" (LG06, LG07, LG10, LG23, LG24, LG36, LG37) → `built`. LG23/LG24 have no shipped surface yet:
  the exchange chooser is FT094.
- "pattern adopted" (LG21) → `pending`. No token status badge is drawn.
- "not attempted yet" (LG08/LG11/LG12) → `blocked`. Their art is in the registry since c731503 (see §5).
- "not acquired", "route support unverified", "reserved" and "pending S10 provider evidence" (LG05, LG14, LG15, LG18,
  LG22, LG27, LG28, LG33–LG35) → `blocked`, with their codes.
- "binding exclusion" (LG25, LG26) → `excluded` (D-029).

## 4. Still pending (16), by journey

| Journey | Rows | Dependency |
|---|---|---|
| J2 Add money | FT014, FT015, FT016, FT017, FT018, FT019, FT088, C34, C35, M16 | S9 Aurora intents. Other-chain routes are reserved `ShellScreen`s (`app/fund/qr/[family].tsx`, `fund/wallet.tsx`, `fund/deposit/[id].tsx`); `AURORA_API_KEY` is not set |
| J2 Add money | FT094 | S1b.12 exchange chooser with withdrawal instructions. Add money has no exchange row; the marks are ready |
| J3 Markets | FT032 | Indicative equity discovery on the D-220 wrapper feeds. Today there is only a non-interactive "Arriving" Nvidia row (review S03) |
| J4 Ticket | FT101, M13 | The C12 eligibility checkbox sheet before a Mainnet ticket (D-023/D-165). Today a geo block is only a commit reason |
| J1 Onboarding | M05 | Ambient 6–10 s loops for the hero and pending-passkey art over `brand/art/onboarding/layers.json`. No loop exists in code |
| J11 Spot tokens | LG21 | A token status badge backed by token-list membership |

## 5. Contradictions found (recorded, not fixed)

**Follow-up (1 Oct, records pass):** items 1–4, 6–11, 13 and 16–20 are now fixed in the stage doc, STATUS,
`acceptance.md`, the ledger rows (`reconciliation.followups`) and `v2-plan.md`, in the commit "docs(S1b): records match
main …". Four are left. Item 5 was mostly covered by the lead's STATUS update (56755d9). Items 12, 14 and 15 each need
their owner's call. Since this report, main also closed three code gaps named in §3: FT058's recents list (7393673),
FT072's perps intro (185aedd) and FT096's chart pan (b838dc5). Their rows' `remaining` entries are updated; none of the
three has an acceptance row yet.

### Stage doc and STATUS

1. **S1b.8 is ticked**, but its scope lists Mainnet eligibility, and the stage's own finding says "Not done in S1b.8:
   … mainnet eligibility on the ticket". FT101 and M13 are still not built.
2. **S1b.9 is ticked**, yet three rows in its scope are short:
   - equity discovery (FT032) is not built;
   - perps education (FT072) is missing;
   - chart pan (FT096) is missing.
3. **S1b.16 says "Open: holdings on Home"**, but d949f6a shipped Home holdings, and STATUS credits it.
4. **Stale "still open" lines in `stage-01b-design-v2.md`**, each contradicted by a later bullet or by main:
   - the afternoon "Still open" line lists push, the primers and Holders;
   - the J3 bullet says "No Holders tab";
   - "Still open in J1" lists the primers, the completion foil and the avatars;
   - the primer art and keeper push are each marked "pending merge", but both are merged (c70d1ca/7c01665,
     7db9389/dd3a8b1);
   - the Handoff "Resume here" list (art package, J4 acceptance, the J1 sequence) is done.
5. **STATUS lags main by four commits.** It was written at 16:25 and does not mention 64d8b7c, f9cd161, 9d22903
   (review S01/S02/S06) or 0a8c915 (S05).
6. **STATUS milestones are all unticked.** Yet 08:30Z and 08:32Z record a testnet passkey account and trade, on the
   simulator. If M1 needs a physical device, STATUS should say so.

### Acceptance record

7. **10:15Z (portrait picker) cites FT066**, which is the onboarding follow selection. The matching rows are
   FT079/C29 and LG32.
8. **09:40Z cites FT110–FT112**, but its text only evidences FT110 and C25. It does not describe the keyboard lift
   (FT111) or the nested dismissal that restores the market (FT112). Both are kept at `built`.
9. **09:05Z cites FT066/FT067**, but its Result says "voucher redeem and a real follow not exercised". Both are kept
   at `built`.
10. **08:30Z (create account) ran on f2ae8af**, before the D-196 rebuild (a423cfb) of the auth step the user
    rejected. The current auth presentation (C04) has no acceptance row.
11. **16:50Z and 11:10Z cite FT058 (send recipient empty state)**, but no recents list exists. The no-recents state
    the row describes is not built.
12. **"S1b.17" labels four rows** (11:25Z–11:45Z): light theme, large text, Reduce Motion and the a11y tree. These are
    sweeps, not the per-journey fidelity rows the step requires, so S1b.17 is still owed for every journey.
13. **The rows are not in the order the file promises** ("Newest last"): 10:15Z comes after 10:40Z, and 11:25Z comes
    after 11:35Z.

### Ledger text vs decisions and code

14. **LG08/LG11/LG12 (BNB, Polygon, Tron)** are still "Blocked (B12), not attempted yet". Stage S1b.2 says c731503
    fetched them ("No entity in the table has an artwork gap left"). They stay `blocked` because web3icons is not
    first-party and their source-chain rows wait on S9. The classification should be revisited.
15. **LG05 (USDT)** is blocked on B12, but its real dependency is a configured USDT route (S9). USDT0 already renders
    its token-list logo in J11.
16. **FT063's `target_treatment` still says "Tracking … B9".** D-194 removed B9; the branch is Excluded.
17. **The `required` text of the Excluded rows** (FT004/FT005/FT113, FT025…FT054) still asks for a "reserved screen
    [that] states the blocker". D-194 and D-195 say there is no screen and no reserved placeholder.
18. **FT070's note says Top Trades open the shared-position sheet.** In code (`TopTrades.tsx`), a card opens the
    trader's account read-only.
19. **FT097 promises a history destination.** The code puts a price alert in that slot (`MarketActions.tsx`), and the
    ledger records no deviation for it.
20. **`v2-plan.md` §7 is stale.**
    - Its class table still files 027/028 under B7, 049–054 under B8, 004/005/113 under B4 and 063's tracking under
      B9. The appended "Decided 1 Oct" note supersedes these assignments, but the table was never updated.
    - Its heading still says "awaiting the user's explicit decision".
    - Line 311 still says "C24 → B8, C05 → B4".

## 6. Gates

- The JSON parses, and the existing structure is kept. The file is written with `json.dumps(indent=2,
  ensure_ascii=False)`, which round-trips the original byte for byte before the edits.
- Every file path cited in `evidence` exists on main.
- `pnpm invariants` exits 0. The repo has no parity-ledger invariant.
- `pnpm exec biome check docs` exits 1 with "No files were processed": `biome.json` excludes `docs`, so biome does not
  cover the ledger.
- The script that applied these decisions was a scratch tool. It is not committed; every decision is in this report
  and in the rows.
