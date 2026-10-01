# Response to the 1 Oct mobile review (lead)

Answers [the review](2026-10-01-mobile-ux-review.md) and [the brief](2026-10-01-mobile-agent-brief.md). State: `main` at the merge `583c93d` (A3's shell and ticket, finished by the lead). Build checked: iPhone 17 simulator, iOS 26.5, 402×874, Practice mode, guest (no account), the release app with this bundle embedded (`expo export:embed --bytecode`), 1 Oct 07:30–07:45 UTC. Screenshots are local only, beside the review's own evidence: `docs/design/reference-study-2026-09-30/reviews/2026-10-01-senryo-mobile/lead-response/`.

**Not verified here, stated plainly:** nothing below was exercised with a signed-in account, a live order or a physical device. VoiceOver/TalkBack, Reduce Motion, large text, Android Back and motion recordings are still owed (R12, R17). The TP/SL logic is covered by a logic check, not by a live partial failure.

## P1 findings

| Finding | What changed | Where | Evidence |
|---|---|---|---|
| R01 TP/SL reports the last leg as the whole outcome | Each stop loss, take profit and removal is its own transaction with its own trace and its own line of outcome. A build/sign failure is surfaced. A level that didn't finalize keeps its typed value (kept outside React, so closing the child keeps it too). Stop loss goes first; if it doesn't finalize, take profit is not sent and says it was skipped. A transaction that was signed but lost by the live watch reads "not confirmed yet", is settled from the send journal, and pauses saving so nothing is placed twice. An identical active level is never sent again. The position page's TP/SL panel had the same fault and uses the same code now. | `apps/mobile/src/features/trade/useTriggerLegs.ts`, `trigger-legs.ts`, `tpsl-draft.ts`, `TpSlChild.tsx`; `features/positions/TriggerPanel.tsx`; `packages/query/src/trace.ts` (`traceOutcome`, `settledOutcome`) | `pnpm --filter @senryo/drive trigger-outcome-check` — the review's scenarios against the app's own functions, 24/24 pass. Live partial failure: not exercised. |
| R02 hold not voided on unmount | Unmount voids the attempt, clears the Reduce Motion timer and cancels the animation. `submit` re-checks, after the gas top-up, that the ticket is still mounted on the same account and network; otherwise nothing is signed. | `components/trade/HoldToConfirm.tsx`, `features/trade/useTicket.ts` | Code only. Dismiss-during-hold on device: owed. |
| R04 recovery warning vs primary action | After a create that may have saved a passkey, "I already have an account" is the primary action; creating again is only reachable from a sign-in that finds no passkey. Failures a retry can't repair lead to the web app. Every failure has Back. No promise about passkey sync. | `features/auth/AuthFailure.tsx` | Code only (needs a forced failure to capture). |
| R05 TP/SL scope | The ticket's entry reads "SL/TP after opening" with no position and "Protect current position" with one. The child names market, side, size and mode before any field and says an order still being entered is not covered. **Lead decision:** attaching SL/TP to a new order ("open, then protect": three transactions, each with its own outcome) is wanted for C42 parity and is recorded as its own step (S1b.8a); until it ships, C42 stays Adapted. | `features/trade/Ticket.tsx`, `TpSlChild.tsx` | `tpsl-no-position.png` |
| R06 no visible close | The transaction sheet has a close button beside the handle. While an order runs, the trace offers "Leave this screen" and says the order continues and can't be cancelled from there. An unknown result never offers "Back to ticket" (no retry) until the journal settles it. The typed order is kept on close. | `components/sheet/TransactionSheet.tsx`, `features/trade/TradeTrace.tsx`, `TicketScreen.tsx`, `send-outcome.ts` | `ticket-guest.png`. Android Back, relaunch: owed. |
| R07 partition bar | The old register is gone from every mobile route (A3's independent cells are what merged); the web keeps its own layout until S11b. | `features/home/Availability.tsx` | Needs a funded account to capture. |

## P2 findings touched in the same pass

- **R08** child sheet: bounded between the status bar and the keyboard; its body scrolls (`components/sheet/ChildSheet.tsx`).
- **R11** ticket: the number is labelled "Margin · Paper money / Real money", with the leveraged size on the same line; a guest gets one "Create an account to trade" button (`ticket-guest.png`).
- **R14** guest Home: one invitation tied to what an account gives in this mode, and the listed markets with their prices; the session chip says "Browsing" (`home-guest.png`). Social and You still need their own guest/empty/unavailable states.
- **R15** identity: every market row resolves to its real mark — Perpl's nine mainnet markets, the five FX pairs as pairs (EUR/USD…), Nvidia (`markets-identities.png`, `fetched-marks-contact-sheet.png`). Marks are now fetched by script (`packages/identity/scripts/fetch-marks.ts`); no entity has an artwork gap. Original art (six scenes, foil, avatars, the Kinpaku recolour) is in progress on `stage/S1b-art` with its own Codex review; B12 stays open.

## R03 / R09, first half (added later on 1 Oct, `ba409c9`)

The welcome is now the six-scene story: an inset rounded hero whose colour fields crossfade while the artwork layers
travel at different depths, one headline and one sentence per scene, and Create account / I have an account / Browse
markets fixed below and usable from the first frame. No timed logo intro, no uppercase kicker lines. Evidence:
`story-scenes-1-3.png`, `story-scenes-4-6.png` (guest, dark). The art is the first pass from `stage/S1b-art`, still in
its own review; B12 is open. **Not done:** the new-account setup sequence after the passkey (handle, follow, voucher,
terms, notifications, completion) and its resumable state — the second half of R03. Light theme, large text and
VoiceOver on the story are not captured yet.

## Still open (not claimed)

R03 second half (the new-account state machine), R10 (blank-chart capture: the detail chart renders in `tour-markets-detail-card.png`; the clipped-fan capture was not reproduced), R12, R13, R16 (the card still shows the lemon D2 art and a live-looking Freeze), R17.

## Next smallest complete journey for review

J4 with a practice account on the simulator: claim → open → the trace → receipt → protect the position (both levels, then remove one) → close, in dark and light, with the motion clips. Then J3 Markets (search, watchlist, detail sections).
