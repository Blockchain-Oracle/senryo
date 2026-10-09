# S8 research — exits that run with the app closed, and yes/no event markets (9 Oct 2026, read-only agent)

# S8 research fact sheet: exits that run with the app closed, and yes/no event markets

Read-only. Nothing was edited and no git state changed. "CWF" means `/Users/abu/dev/hackathon/crypto-world-fair` (Mitoshi), and "Senryo" means `/Users/abu/dev/hackathon/metropolis`.

## 1. How Mitoshi does exits (D-193, D-209)

**Decisions**
- D-193 is at `CWF/docs/plan/decisions.md:1610-1620`. It adds a sell-only EXIT grant with an on-chain floor and an ops `exit-keeper` that runs Trail, take-profit (TP) and stop-loss (SL). The keeper decides when to sell; the contract decides the lowest price.
- D-209 is at `:1783-1796`. The trigger is EIP-712, signed by the actor of the owner's live SESSION grant. The keeper sells only through `exitFor`, and the trail stop moves only in the position's favour.
- D-213 is at `:1835` and adds an absolute slack. D-200 is at `:1671` and is the version that runs in the tab.

**The floor is not a print at the trigger level.** It is a fair value read from a RedStone "latest" spot, and it is not Pyth.
- `VaultExits.sol:106-115`: `exitFloorRaw` = the side's fair value from `fairGuard.fairUpE6(market, spotProof)`, minus the larger of `toleranceBps × fair` and `slackBps × one`, never below 0.
- `FairValueGuard.sol:67-79,93-99`: verifies a signed spot no older than `maxSpotAgeSec` and returns `FairValue.probUpE6(spot, openE8, σ, expiry − now)`. `previewFairUpE6` is marked "never a bound" (`:81-84`). If the open print or σ is missing, the call is refused (`:94-96`).
- `exitFor` (`VaultExits.sol:75-98`) checks: the grant kind is EXIT, the caller is the grant's actor, the grant is live and in scope, and the side price is at least the floor; otherwise it reverts with `BelowFairFloor` (`:89`). It then sends an IOC into the order book at a price the keeper chose (`:94`).
- The floor exists because the keeper picks `priceRaw` against a book.
- **The trigger condition (TP, SL, trail) is never checked on chain.**

**What the user signs**
1. One passkey transaction: `grantExit(keeper, market=0, now+30d, 1500, 1000)`.
   - Call site: `web/src/features/terminal/ui/ExitsDrawer.tsx:108`. Constants: `server-exits.ts:26-32`.
   - Limits: no budget (`VaultExits.sol:118-120`); it cannot call `placeFor` (`:123-125`); tolerance is capped at 20% and slack at 15¢ (`:19-22,55-56`).
2. For each trigger, an `ExitTrigger` signed by the session key with no extra prompt (`packages/core/src/exits/trigger.ts:44-59`).
   - Fields: owner, market, side, grantId, TP and SL in exit-value base units, trailBps, trailStopE8, a nonce in ms, expiresAtSec.
   - Domain: "Mitoshi exits", with the vault as the verifying contract.

**Server**
- `web/src/app/api/exits/route.ts:20-36`, POST, rate-limited, calls `verifyExitTrigger`.
- `packages/markets/src/server/exits.ts:39-58` checks:
  - the trigger is well formed (`trigger.ts:83-95`);
  - it targets the current v2 vault;
  - the grant belongs to the owner, is a session grant, is not revoked and has not expired;
  - the signature passes Tempo `verifyHash` against the grant's actor.
- Storage keeps one trigger per position. A larger nonce replaces it, an empty write cancels it, and a write while firing gets a 409 (`route.ts:18,29-30`).
- GET returns only the caller's own triggers and needs a server session (`:38-45`).

**Keeper**: `services/ops/src/actors/exit-keeper/index.ts`
- The trail moves on display ticks (`:180-191`) using `rules.ts:10-22`: on spot, with break-even as reference, ratchet only.
- TP and SL are judged on `exitFromBook().proceedsBase` (`:232`) through `judge` (`decide.ts:41-52`).
- `fire` (`:74-139`):
  1. claims the row;
  2. reads the EXIT grant;
  3. fetches a fresh RedStone proof (`:107`);
  4. calls `readExitFloorRaw` (`:111`);
  5. sets the limit to the floor plus `leadTicks`, because the floor rises with `block.timestamp` (`decide.ts:57-64`; it reverted three times on Moderato);
  6. requires book depth at or above the limit (`:119`);
  7. sends the IOC with an expiry of 60 s or less.
- Refusals such as `BelowFairFloor` and `ImmediateOrCancelNoFill` are retried with backoff (`:30`, `decide.ts:55`). The keeper recovers after a restart from the stored transaction hash (`:151-177`).

**Copy**: `web/src/features/terminal/copy.ts:309-328`
- Main line: "Runs with the app closed — Mitoshi's exit keeper sells at no less than the fair value less {allowance}."
- Turn-on text: "…never below the fair value less X, never buy or withdraw. Stop it any time in Settings."
- While it can't sell yet: "The keeper is waiting: … It tries again until the Window locks."

**Tests**
- `contracts/test/products/vault/EventVault.exits.t.sol:67-231`: sells at or above the floor; below the floor is refused; a crashed signed spot lowers the floor so the SL can fire (`:101-110`); no budget; actor, kind, live and scope checks; never sells more than the owner holds; two fuzz tests on the floor.
- Also: `decide.test.ts:9-38`, `packages/markets/src/ops/exits.test.ts:18` (floor rounded up onto the grid), `server/exits.test.ts:36-56`, `packages/db/src/exit-triggers.test.ts:45`.

**How it avoids a bad price, and what it doesn't cover**
- Price: the contract floor (fair value less the larger of 15% or 10¢), plus an IOC at floor plus lead, plus a depth check.
- Timing: not covered. D-209 accepts that a stolen key could at worst sell at the floor.

## 2. Mapping this onto Senryo

**Senryo's close already does what D-193's floor is for.**
- `_fillClose` (`contracts/src/markets/BandBook.sol:229-260`) pays `proceedsFor(shares, prob − halfSpread)` at the unique print of `target = commit block + FILL_DELAY_SEC (1 s)` (`:128`; `MarketTypes.sol:54`).
- Nobody picks the print or the price.
- `limit` is the minimum proceeds, and a fill below it is refused as `REFUSE_SLIPPAGE` (`:238`).
- Senryo needs no Mitoshi-style fair-value floor. The only open risk is when the keeper sells.

**Can a stored, pre-signed close intent work with no contract change?** Here are the rules it has to pass.
- `commit` and `finalize` are permissionless, so the keeper can submit (`BandBook.sol:62,153`).
- `_commitClose` (`:115-134`) requires:
  - the ticket is OPEN with no close pending;
  - `0 < amount ≤ t.payout`, otherwise `BadShares`;
  - the recipient matches;
  - the window is trading (before expiry − 20 s, `MarketTypes.sol:52`);
  - the ticket was held at least 3 s.
- **`configVersion` must equal the current value at commit (`:67`, `WrongConfig`) and at fill (`:270`, `REFUSE_CONFIG`).**
  - It is one global counter, bumped by every `setSigma` (`:54`) and `setParams` (`BandPool.sol:105`).
  - Every listing run calls `setSigma` (`contracts/script/MarketsBase.s.sol:246`), and S7.9 will list 124 series.
  - So any stored intent dies at the next listing or parameter change.
- `_authorize` (`SessionGrants.sol:126-147`) checks the deadline (`:127`) and the epoch (`:128-129`).
  - **For a delegate signature, the session must still be live (`:136`).** Sessions last at most 15 min on Real and 60 min on Practice (D-267; enforced at `_grant`, `:118`).
  - A new session overwrites the delegate (`:120`), and revoking bumps the epoch (`:177-181`).
  - Closes do not spend session caps (`:138`).
- **The nonce is burned at commit (`:146`).** `_refuseClose` (`BandBook.sol:287-291`) does not restore it, so an intent is single-shot: a fill refused for slippage or price needs a new signature.
- Fills are only allowed for probabilities between `minProbE6` and `maxProbE6`: 3% to 97% (`packages/config/src/pool-terms.ts:97-98`; `BandBook.sol:234`). An SL on a position near 0, or a TP near 1, can never fill.
- The API relay caps deadlines at 120 s (`services/api/src/relay/constants.ts:4`, `gates.ts:63-64`). That is API policy, not a contract rule.
- The owner is a passkey-PRF-derived secp256k1 EOA (`packages/account/src/derive.ts:1-5`), so an owner signature can carry any deadline.

**Verdict**

| Option | Works? | What it gives |
|---|---|---|
| Session-delegate-signed stored intent | No | Expires within 15 or 60 min; dies when the session is replaced or the epoch bumps |
| Owner-signed stored intent (one Face ID per trigger) | Yes, today, for one-shot TP or SL | See below |

Owner-signed intents only hold until the next `configVersion` bump, and they are fragile:
- `amount` is a fixed number of shares, so after a manual partial close the intent fails with `BadShares`.
- One refusal ends it.
- A trail's moving stop can't raise the limit without a new signature.

How each exit type maps:
- **TP:** set `limit = TP` and the contract enforces the trigger exactly.
- **SL:** set `limit = SL × (1 − tol)`. The contract enforces only the floor, so the keeper could sell early, above SL. That is the same timing trust Mitoshi accepts.
- **Trail:** timed by the keeper, with a fixed floor.

**A robust version needs a contract change.** Three small changes would cover it:
1. Stop pinning `configVersion` for closes (or pin it per series).
2. Add a `ceiling` field to the close intent. A stop-loss would then fill only if `limit ≤ proceeds ≤ ceiling` at the fill print, which makes timing trustless for SL as well as TP. This changes `INTENT_TYPEHASH`.
3. Add a long-lived, close-only grant (no caps, expiry up to the window or 30 days) and burn its nonce only when a fill succeeds. This mirrors Mitoshi's split between the EXIT grant and the session-signed trigger.

## 3. Yes/no event markets

**Mitoshi has none.**
- `contracts/src/engine/verifiers/AttestedPrintVerifier.sol:12-18` is labelled "demo data, opt-in".
- It accepts any one of up to four attestors (`:44-54,126-130`), so it is not a quorum.
- It signs prices, with `price > 0` required (`:85`), and EIP-712 binds each signature to the engine, market and slot (`:114-123`).

**Owarine (Daml) is the real committee design.**
- Contract: `owarine/daml/abu-pm-main/daml/PM/Event.daml:1-33,59-94,108-155`.
  - `EventTerms` holds the question, the attestors and a quorum.
  - Each member signs their own YES or NO.
  - `Event_Resolve` needs a counted quorum and a unanimous answer: all YES resolves Up, all NO resolves Down, and a mix voids as `SourceDisagreement`.
  - From `closeDeadline + 1 s`, `Event_Void` names its reason: `MissingPrint` or `QuorumNotMet`.
  - An `EventVerdict` records every attestation.
- `owarine/packages/core/src/market/committee-event.ts:1-18`: the statement hash binds "agari-event-v1", the market, question, answer, the source read and the time. The older 0.3.0 encoding was a 1.0 baseline resolved to 2.0 (YES) or 0.5 (NO).
- Labels:
  - Yes/No, never Up/Down (`SideSegments.tsx:13`, `TicketCta.tsx:20`, `history/copy.ts:37-38`).
  - "Settles on the oracle committee's signed answers" (`lanes/lane-view.ts:70`).
  - "Oracle committee", and a committee answer "is not a price" (`price-source/source-label.ts:41,137`).
  - Docs: `docs-site/.../price-sources.mdx:57`.

**Masayume** (`sommina-events`) uses Somnia's OracleHub with a 2-of-3 subcommittee (`contracts/src/range/WindowQuestion.sol:14-15,60-61`). It is used for numeric closing prices, not yes/no, and it does not run on Monad.

**Could Senryo use a window with an attested verifier and Up/Down = Yes/No?**
- **Resolving it: yes, with a new M-of-N verifier that implements `IPrintVerifier`** (`interfaces/IPrintVerifier.sol:18-21`).
  - `Windows.resolve` (`Windows.sol:197-219`) compares the close print with the open print.
  - `BandMath.outcome` (`BandMath.sol:127-131`) pays Up if close > K and refunds if close == K.
  - Use the 0.3.0 encoding: open = 1e8, close = 2e8 for YES, 0.5e8 for NO, and 1e8 means "undecided", which refunds. `voidExpired` (`:223-231`) refunds when no answer comes.
  - Don't use a literal 0/1: K = 0 breaks the z and offset maths.
  - A check source with zero allowed divergence would void on disagreement, as Owarine does.
- **Pricing and fills: no.**
  - Every open and close fills at a print from the primary source in the next second (`BandBook.sol:153-156`; `_expiryReason` refunds after `admissionSec`, `:185-194`).
  - The price is `probE6(band, K, spot, σ, τ)` (`:273-276`).
  - A committee won't sign every second. If it signed the baseline each time, spot == K gives a fixed 50%: calls always at 52¢ and cash-out at 48¢ whatever the news, so anyone who learns the answer early takes money from the pool.
  - Events need their own pricing (parimutuel, or signed quoted odds), cash-out rules, and calls closing before the event.

**What honest labelling should say**
- "Yes / No", never Up/Down.
- "Settled by a committee of N signers, M must agree — not a price feed", with the signers named, plus the question and the source they read.
- "If they disagree or don't answer by {deadline}, everyone is refunded."
- The Proof page shows each signature and statement hash.
- Name it as Senryo-run if the signers are ours, and as test dollars on Practice.
- Never say "Pyth-proved" or "trustless".

## UNDEFINED / contradictory / dead-end

- **Contradictory:** the plan says "Pyth-proved floor" (`docs/plan/pivot-2026-10-08.md:409`). CWF's floor is a RedStone fair value at a signed latest spot, not a print at the sell instant. Senryo's Pyth fill print already covers the price side; how the trigger itself is enforced is undefined.
- **Dead end:** stored intents signed by a session delegate. Sessions last 15 or 60 min.
- **Dead end without a contract change or a frozen config:** the global `configVersion` pin.
- **Fragile:** the nonce is single-shot and burns even when the fill is refused; fixed `amount` breaks after a partial close; the 3–97% band blocks SL and TP near the extremes.
- **Undefined for Senryo:**
  - whether Trail follows spot (Mitoshi) or value;
  - whether TP and SL are on proceeds;
  - the tolerance values;
  - whether trigger signatures need Face ID each time or a new close-only grant.
- **Dead end:** pricing events with BandBook. The pricing model, cash-out and the committee's members and keys are all undefined. Mitoshi's verifier is 1-of-N "demo data", not a committee.
- **Not portable:** Mitoshi verifies a Tempo P-256 session key with `verifyHash`, and Senryo uses secp256k1 EIP-712. Masayume's committee is Somnia-only.
