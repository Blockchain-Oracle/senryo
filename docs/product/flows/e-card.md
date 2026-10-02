# E — Card (Kinpaku)

Capability cards E1–E6 from the plan (§0.4 "Card", §0.5 rules, §0.6 E, §0.7 #13, §0.9 "Card", Part 1 defect 8, Part D D3). Paths are relative to the repo root; line numbers are at `96411ec` on `claude/premium-takeover`. `UNDEFINED` = not settled by code or docs; each one is a research task, not a question for the user.

**Not verified, stated first.**
- Nothing in this file has been walked on a device. No card can be issued today: there is no issue route and no Lithic sandbox key (`docs/plan/STATUS.md:14`, `LITHIC_SANDBOX_KEY [ ]`).
- Whether `senryo-card` is deployed on either network is UNDEFINED (D3/D9 list the deploy as pending).
- Lithic endpoints the service doesn't call yet (card create, simulate clearing/void/return) are named from Lithic's public docs, not from code. D3 confirms them with `ctx7` before building.

## Card facts every card uses

**One balance.** The card has no wallet of its own. It spends from the trading account that also backs positions (`contracts/src/core/CardModule.sol:14-18`, D-032 at `docs/plan/00-plan.md:76`).

**Spendable** is the onchain `freeToSpend`:
- `FreeToTrade = E_init − Σ IM − max(R, H) − B`, where H = open holds, R = envelope, B = $1 safety buffer once the account carries risk (`contracts/src/core/RiskModule.sol:84-86`, `docs/plan/specs/risk-math.md:20-23`).
- `Spendable = min(FreeToTrade + max(R − H, 0), allowance left today)` (`RiskModule.sol:87-89`, `risk-math.md:24`).
- At authorization the service also subtracts holds that have not landed yet, and the $1 buffer for an idle account (`services/card/src/reserve.ts:56-73`, D-120 at `docs/plan/decisions.md:74`).

**Holds and debt count against liquidation equity.**
- `E_liq = collateral + uPnL − fees − D − H`: card debt D and open holds H are subtracted (`RiskModule.sol:82`, `risk-math.md:22`).
- Liquidation repays card debt first (senior); holds stay reserved against what remains (`risk-math.md:47-48`, `contracts/src/core/LiquidationModule.sol:14,43-44`).
- **Correction of the intro** (`apps/mobile/src/app/(tabs)/card/intro.tsx:21`, "a card payment can't cause a liquidation"):
  - True: a payment is approved only if it fits Spendable, which already excludes margin. So at the moment of approval it can't take the account below initial margin.
  - False: the hold and any debt then lower liquidation equity, so a later price move liquidates sooner. An over-capture can also book debt beyond free funds (`CardModule.sol:127-134`).
  - Copy (intro, the Spendable ⓘ, and the Balance sheet rows "Card holds (−)" and "Card debt (−)"): **"Card holds and debt count against your positions."**

**Limits** (all on chain):
- The daily limit is a user-signed EIP-712 `SpendAllowance`. Its expiry is 30 days from signing (`CardModule.sol:22-38`, `apps/mobile/src/features/card/useCardAllowance.ts:28`).
- Presets are $50 / $100 / $250 / $500 (`apps/mobile/src/features/card/constants.ts:2`). The day resets at 00:00 UTC (D-096, `decisions.md:45`).
- Per payment: hold ≤ $250 (`MAX_HOLD_USD6`, `contracts/src/libraries/Constants.sol:76`; `services/card/src/constants.ts:26`).
- Hold buffers: foreign currency +3 % (`FX_BUFFER_BPS`); tip merchants +20 % (MCC 4121, 5812–5814, 7230, 7298) (`services/card/src/constants.ts:13-16`, `services/card/src/amounts.ts:32-53`).
- Hold life: 7 days + 1 day grace; after that anyone may release it (`Constants.sol:77-78`, `CardModule.sol:145-150`).
- Over-capture tolerance is 20 % (`Constants.sol:79`).

**Practice vs Mainnet.** One card service runs per network. A session for the other network gets a 400 (`services/card/src/routes/app.ts:37-43`).

| | Practice (10143) | Mainnet (143) |
|---|---|---|
| Issuer | Lithic sandbox, instant virtual card (`constants.ts:32,45`) | **Real card: locked, "Needs issuer approval".** A production programme needs company KYB: Lithic production is "contact Sales" and Immersve live needs partner onboarding (`context/09-product/company-and-real-integrations.md:30-31`). **Test card** (E-D1): Lithic sandbox in release-only mode (D-036, `00-plan.md:80`) |
| Money | P$ held and captured on testnet | Holds encumber the real balance; clearing **releases** with no charge (`CardModule.sol:115-118`, `services/card/src/env.ts:20-21`) |
| Pay | Simulate (`app.ts:64`, sandbox only) | Test card: Simulate. Real card: merchants |
| KYC | none | Issuer-hosted (Immersve-conducted KYC, `company-and-real-integrations.md:30`). UNDEFINED until an issuer signs |
| Card debt | possible (over-capture) | test card: never (no capture) |

## Decisions (settled here; numbered into D-237… at execution)

- **E-D1. Mainnet offers both.** A "Test card · no charge" (D-036 is approved and kept) sits next to a locked "Real card · Needs issuer approval". Practice parity holds, and the dependency is named.
- **E-D2. Limit first, then issue.** The user signs the allowance before the card is created (`services/common/migrations/0003_cards.ts:2-4`). A card without an allowance can't spend anyway.
- **E-D3. Freeze is one tap; unfreeze is a passkey.**
  - Freeze = allowance revoke (session scope, `packages/account/src/policy/evaluate.ts:96-98`) + Lithic `PAUSED`.
  - Unfreeze = a new signed limit (card setting → step-up, `evaluate.ts:118-119`) + Lithic `OPEN`.
  - Safety beats ceremony on freeze, and loosening needs step-up (A10).
- **E-D4. Every decline carries a reason in ≤4 words.** The reason is mapped from `result` + `reason` (E4 table).
- **E-D5. Card pushes come from the card service.** They write the shared `push_sends` ledger on channel `card` (the keeper's `LedgerNotifier` pattern, `services/keeper/src/notify.ts:46-66`). Event keys are `card:{txnToken}:{stage}`, and the collapse key is the transaction.
- **E-D6. "Keep card ready" (default on).** At the next unlock it moves only **new** AUSD/USDC arrivals since the last unlock into the trading account, never existing wallet balances. It runs as a `deposit` (session scope, uncapped, `evaluate.ts:99-100`). The switch lives on the Card tab (Spendable ⓘ) and in Settings → Preferences.
- **E-D7. Strict mode only.** The envelope (`setCardEnvelope`, `CardModule.sol:50-55`) stays at 0 and is not exposed: Monad finality fits the 2.8 s budget. If p99 misses the budget, revisit (acceptance measures it).
- **E-D8. One row per purchase.** A Card-tab row shows the purchase lifecycle (Pending → Paid / Released / Refunded, or Declined), never raw ASA statuses.
- **E-D9. Repay draws on the trading account's dollars.** It runs in session scope (`evaluate.ts:96-98`). If the account is short, the repay composes "Add funds" first (rule 4).

---

### E1 Get card
- **Promise:** a working virtual card in under a minute, spending from the same balance as trades.
- **Entry points:**
  - Card tab (unissued) → **Get card**;
  - deep link `/card`;
  - intro "How it works" (re-open).
- **Steps:**
  1. **Card tab, unissued:** Kinpaku art floating with a gentle tilt and no numbers (`apps/mobile/src/features/card/CardHero.tsx`, `CardFace.tsx:44`); "Get your Kinpaku card"; one line ("Spends your free balance"); button **Get card**. Practice: **Instant test card**. Mainnet: two rows, **Test card · no charge** and **Real card** (lock, "Needs issuer approval").
  2. **Who:**
     - A guest gets the account sheet, which resumes here (A1).
     - A locked user gets Face ID: the card service needs a session (`apps/mobile/src/features/card/useCardSummary.ts:15`, `app.ts:37-43`).
     - Terms are gated before the first money action (A11).
  3. **Intro, the first time only.** Three steps: art + title + one line each, Next / Got it, Skip:
     1. "Spend your balance" / "Uses what positions don't need";
     2. "Holds count as risk" / "Card holds and debt count against your positions";
     3. Practice: "Test card" / "Practice money · simulate payments". Mainnet test card: "No charge" / "Holds show, nothing is paid".
  4. **Daily limit:** chips $50 · **$100** · $250 · $500, "For 30 days" → **Slide to set** → passkey (card setting) → `setSpendAllowance` finalized (`useCardAllowance.ts:57-90`).
  5. **Issue:** `POST /v1/card/issue` (new) → Lithic sandbox virtual card → `cards` row (account, chain, issuer label) → returns last4. On Mainnet the test card uses the same route against the release-only issuer.
  6. **Ready:** the card turns to show •••• last4 (`CardFace.tsx:44-49`); "Card ready" check + sound; the Spendable hero; Practice / test card: **Simulate a payment**.
- **Rules:**
  - One active card per account per network. The tab reads `cards[0]` (`apps/mobile/src/app/(tabs)/card/index.tsx:29`); the issue route refuses a second card. Card states are `ACTIVE | PAUSED | CLOSED` (`0003_cards.ts:14`).
  - The PAN is never stored or logged. Only the sandbox `GET /v1/cards/{token}` returns it, and only to drive Simulate (`services/card/src/lithic/api.ts:8,34-36`).
  - The service needs `LITHIC_API_KEY`; without it, card routes answer 503 `NOT_DEPLOYED` (`app.ts:44-47`, `services/card/src/main.ts:57`). The ASA needs `LITHIC_ASA_SECRET`; without it, every authorization is a 401, which is a decline (`main.ts:60`).
  - Release-only on Mainnet requires the ADMIN call `setReleaseOnly(keccak("lithic-sandbox"), true)` (`CardModule.sol:169-173`) **and** `CARD_RELEASE_ONLY=true` (`env.ts:21`). Its deployment state is UNDEFINED.
  - Lithic create call: `POST /v1/cards {type: "VIRTUAL"}` per Lithic docs. **UNDEFINED in code:** to be confirmed via `ctx7` (D3).
- **States:**

| State | Shows |
|---|---|
| Loading | art + skeleton line (never "$0") |
| Guest | "Get your Kinpaku card" · **Create account** |
| Locked | "Unlock to see your card" · **Unlock** |
| Service down | "Card unavailable" · **Retry** |
| Mainnet real | row lock · "Needs issuer approval" |
| Signing limit | slide busy · "Setting limit…" |
| Issuing | "Creating card…" |
| Limit set, issue failed | "Card not created" · **Try again** (limit kept) |
| Ready | •••• 4821 · "Card ready" |

- **After:**
  - Activity row "Daily spend limit set" (`apps/mobile/src/features/portfolio/activity-copy.ts:85`).
  - Card tab switches to the issued layout (E2–E6).
  - Issuing itself is offchain, so it has no indexer row. UNDEFINED: whether a "Card issued" Activity row is needed; decision: no, the card itself is the receipt.
- **Today → gap:**
  - **No issue route.** The app routes are simulate, freeze, embed, allowance and summary only (`services/card/src/routes/app.ts:56-196`). Cards exist only through the drive script (`scripts/drive/src/card-concurrency.ts:88`) (D3).
  - Unissued copy is two sentences plus "Refresh card status" (`card/index.tsx:71-82`). The raw state is printed (`card/index.tsx:57`).
  - **Defect 8:** the intro's liquidation claim (`intro.tsx:21`) and "In preview" (`intro.tsx:24-25`).
  - The intro is never opened: `cardIntroSeen` is only written (`intro.tsx:42`) and `ROUTES.cardIntro` is unused (`apps/mobile/src/lib/constants/routes.ts:19`).
  - Dead sample code: `SAMPLE_CARD` "SENRYO PREVIEW 4242" (`apps/mobile/src/lib/sample.ts:272-285`), `AuthorizationRow.tsx`, `SampleTag.tsx`.
  - §0.9 cites "defect 10" for the fake card art, but Part 1 #10 is Delete data. The fake art now lives only in that dead code.
- **Acceptance:**
  - [ ] Practice, a new account: Card tab → Instant test card → intro (3 steps) → $100 limit → passkey → •••• last4 shown within ~5 s.
  - [ ] A second Get card is refused; the tab still shows one card.
  - [ ] The intro reads "Card holds and debt count against your positions." It doesn't show again after Got it, and opens from "How it works".
  - [ ] Mainnet: "Real card" is locked with "Needs issuer approval"; the test card issues and is labelled "No charge".
  - [ ] Card service unset (no key): "Card unavailable" + Retry, no sentence, no crash.
  - [ ] Kill the app between limit and issue: on reopen, Get card skips the limit step (limit already live).

### E2 Spendable and funding
- **Promise:** one number says what the card can spend now, and any asset can top it up.
- **Entry points:**
  - Card tab hero;
  - Home → Balance sheet ("Card holds", "Card debt" rows; B16);
  - **Add funds** circle;
  - a decline reason "Not enough spendable" → **Add funds**.
- **Steps:**
  1. **Hero:** "Spendable" + amount (rolling digits). Under it, one line: "Limit left $64 of $100" or "Limit used".
  2. **Tap the hero → breakdown sheet:**
     - Free in account;
     - Open holds (−);
     - Card debt (−);
     - Limit left today;
     - "P$300 in positions ›" (rule 2: the path to free it);
     - ⓘ "Card holds and debt count against your positions."
     - Values come from the snapshot (`holds`, `cardDebt`, `freeToSpend`; `packages/chain/src/reads.ts:26-27`) and `openHoldsUsd6` (`app.ts:151-153,183`).
  3. **Add funds** → "Pay with" picker (every holding, marks, balances) → amount (units ↔ $, Max net of fee reserve) → review listing the composed steps ("Swap MON → AUSD", "Move to account") → **Slide** → status → receipt. Practice: P$ claim/faucet lands in the trading account directly (B15).
  4. **Keep card ready** switch (default on), under the hero's ⓘ: "Moves new dollars at unlock".
- **Rules:**
  - The hero equals the onchain `freeToSpend` (`RiskModule.sol:87-89`). It never adds positive uPnL (`risk-math.md:21`).
  - When the binding limit is the allowance, the line says "Limit used" and the action is **Limit**. When it is funds, the action is **Add funds**. The responder makes the same split (`reserve.ts:70-72`).
  - Add funds: swap + deposit is one composed operation (rule 4, `packages/query/src/operations.ts`). A deposit is session-scoped and uncapped (`evaluate.ts:99-100`); the swap follows B6's impact rule.
  - Keep card ready: only AUSD/USDC that **arrived** since the last unlock. It never moves the fee reserve or other tokens. Arrival detection depends on D8 wallet-transfer indexing (**UNDEFINED until D8**).
- **States:** loading "—" (never $0) · "Spendable $212.40" · "Limit used" · "Limit expired · Renew" · "Frozen" (hero dimmed) · "No limit set · Set limit" · offline (stale stamp).
- **After:** Add funds → Activity rows (swap, deposit), a push when async, the hero rolls up. Keep card ready → one Activity row "Moved 50 USDC to account" + push "Card ready · $50 added".
- **Today → gap:**
  - The label is "Trading-account card capacity" (`card/index.tsx:109`).
  - Home shows "Card availability" (`apps/mobile/src/features/home/Availability.tsx:22-31`); §0.9 removes it.
  - No Add funds, no breakdown, no keep-ready.
  - `SpendLimit` uses boxed panel sentences (`apps/mobile/src/features/card/SpendLimit.tsx:21-31`).
- **Acceptance:**
  - [ ] Practice: the hero equals `freeToSpend` from the snapshot; open a position and watch the hero fall by its margin.
  - [ ] With a $50 limit and $300 free, the hero shows $50 and the line "Limit left $50 of $50".
  - [ ] Add funds from MON (Mainnet) or P$ (Practice): one slide; the hero rises; Activity shows the steps.
  - [ ] Receive 20 USDC in the wallet, lock and unlock: it moves once, with a push; pre-existing wallet USDC is untouched.
  - [ ] Tap the hero: the breakdown rows add up to the hero.

### E3 Controls (freeze, unfreeze, limit)
- **Promise:** stop the card instantly; restart or change the limit with one passkey.
- **Entry points:**
  - Card tab circles **Freeze/Unfreeze · Limit · Details · Add funds**;
  - push "Declined · Card frozen" → Card tab;
  - deep link `/card/allowance` (needs an account, `apps/mobile/src/lib/incoming-link.ts:11`).
- **Steps:**
  1. **Freeze** (one tap, haptic): revoke the allowance (session) → Lithic `PAUSED` → art dims, "Frozen". Code order is revoke first, then pause (`card/index.tsx:42-48`).
  2. **Unfreeze** → sheet: limit chips (last limit preselected), "For 30 days" → **Slide to unfreeze** → passkey → `setSpendAllowance` finalized → `POST /v1/card/freeze {frozen:false}` → "Active".
  3. **Limit** → the same sheet without unfreeze: chips → **Slide to set** → passkey → "Limit $250 a day".
- **Rules:**
  - Freeze has two layers. ASA declines `CARD_PAUSED` whenever the DB card state isn't `ACTIVE` (`services/card/src/asa.ts:70-73`). The revoked allowance also makes `placeHold` revert onchain (`CardModule.sol:187-189`, `AllowanceExpired`).
  - Freeze API: `PATCH /v1/cards/{token} {state}` + DB update (`app.ts:77-84`, `api.ts:38-40`). `frozen:false` is already supported server-side (`app.ts:81-82`).
  - Revoke is `revokeSpendAllowance` (`CardModule.sol:40-48`), in session scope (`useCardAllowance.ts:45-55`). Limit is a fresh passkey (`useCardAllowance.ts:61-87`).
  - Partial outcomes:
    - Revoke not finalized → nothing paused → "Freeze not confirmed · Retry" (`card/index.tsx:43-44`).
    - Revoke done, Lithic pause failed → still frozen in effect (no allowance) → "Frozen" + silent retry of the pause.
    - Unfreeze with the limit signed but Lithic open failed → "Limit set · Unfreeze pending" + Retry.
  - Never two limit changes at once: busy while a trace is unresolved (`apps/mobile/src/app/(tabs)/card/allowance.tsx:39-40`). The relay route is one-in-flight per user (`app.ts:110-112`).
- **States:** "Active" · "Frozen" · "Freezing…" · "Freeze not confirmed · Retry" · "Limit $100 a day" · "Limit expired · Renew" · "Expires in 3 days".
- **After:**
  - Activity "Daily spend limit set" / "Card frozen" (allowance 0, `activity-copy.ts:85`).
  - Push "Card frozen" on the device that didn't act (E-D5).
  - Expiry reminder push 3 days before: **new**, on the card channel. Sender: the card service's daily job (UNDEFINED job host; decision: card service).
- **Today → gap:**
  - **Defect 8: no unfreeze.** The button reads "Frozen" and is disabled (`card/index.tsx:88-92`).
  - Error sentence (`card/index.tsx:51`).
  - Limit page: prose (`allowance.tsx:65-67`) and hold-to-confirm (`allowance.tsx:75-80`; replaced by `SlideToConfirm`, Part A).
  - "Freeze the card" lives inside the limit page (`allowance.tsx:81-88`).
  - Result sentence (`useCardAllowance.ts:97`).
- **Acceptance:**
  - [ ] Freeze → Simulate $5 → "Declined · Card frozen" within 3 s + push.
  - [ ] Unfreeze → passkey → Simulate $5 → approved.
  - [ ] Set $50 → Simulate $60 → "Declined · Over daily limit".
  - [ ] Airplane mode during Freeze → "Freeze not confirmed · Retry"; after Retry, the card is frozen.
  - [ ] Limit chips never show while a previous change is unresolved.

### E4 Pay or simulate (authorization → hold → capture/refund → debt)
- **Promise:** each payment is decided in under 3 seconds against the live balance, with a clear reason when declined.
- **Entry points:**
  - Practice / test card: **Simulate a payment** (Card tab);
  - a real tap at a merchant (real card, locked);
  - push → that transaction.
- **Steps:**
  1. **Simulate sheet:** merchant chips (Coffee 5814 · Groceries 5411 · Taxi 4121 · Online), amount keypad (USD), **Pay** → `POST /v1/card/simulate` (`app.ts:56-75`; positive cents, descriptor, optional 4-char MCC: `packages/api-client/src/routes/card.ts:25-30`).
  2. **Decision** (server, ≤2.8 s; Lithic declines at 6 s):
     1. idempotency row (`asa.ts:60-68`);
     2. card state (`asa.ts:70-73`);
     3. hold amount with buffers (`asa.ts:90-95`);
     4. reserve under the account lock (`reserve.ts:30-54`);
     5. `placeHold` finalized → APPROVED, or the envelope covers it, or decline with the hold released if it lands later (`asa.ts:108-123`).
  3. **In the app:** the row appears as "Pending · Hold $6.00" with the merchant; push "$5.00 at Blue Bottle · Pending". If the hold exceeds the amount (tip/FX), the line says "may settle lower".
  4. **Sandbox follow-ups** on the transaction detail: **Settle** (clearing) · **Void** · **Refund** (return). Lithic simulate endpoints (**UNDEFINED in code**: only `simulateAuthorize` exists, `api.ts:42-49`).
  5. **Lifecycle** (`services/card/src/events.ts:8-16`):
     - CLEARING → `captureHold` → "Paid $5.00";
     - REVERSAL / EXPIRY → `releaseHold` → "Released";
     - ADVICE above the hold → `increaseHold`;
     - RETURN → `refund` → "Refunded $5.00".
     - Each is queued in the outbox and finalized onchain (`services/card/src/outbox.ts:15-20,88-122`).
  6. **Over-capture:** above the hold, up to +20 %:
     - first the extra is charged from FreeToTrade;
     - the remainder becomes **card debt** (`CardModule.sol:110-139`);
     - a red banner appears: "Card debt $3.20 · **Repay**".
  7. **Repay** → sheet:
     - amount (default full; partial allowed);
     - source = account dollars (Add funds composes first if short);
     - **Slide** → `repayCardDebt` (`CardModule.sol:57-67`; session scope) → "Debt repaid".
- **Rules:**
  - USD billing only: a non-USD cardholder currency is rejected (`amounts.ts:41`).
  - Strict mode (E-D7): approval waits for `placeHold` at `finalized` (`risk-math.md:53`, `services/card/src/submit.ts:35-71`).
  - Non-envelope holds are refused while any market the user holds is STALE / CIRCUIT / HALTED (`CardModule.sol:200-211`, `risk-math.md:38-45`).
  - Refunds repay card debt first, then credit the user (`CardModule.sol:152-167`). Release-only issuers never capture or refund (`CardModule.sol:115-118`, `events.ts:57`).
  - Expired holds are released by the keeper (`services/keeper/src/jobs/maintenance.ts:19-20`) or by anyone (`CardModule.sol:146-150`).
  - Outbox: 8 attempts, exponential backoff from 2 s, then `FAILED` (`services/card/src/constants.ts:37-43`, `outbox.ts:74-81`). **UNDEFINED:** who is told when a capture lands `FAILED` (e.g. `CaptureTooLarge` above +20 %); decision: an ops alert plus the row shows "Settling".
  - Unknown hold outcome stays pending and is cleaned up by `releaseIfLanded` (`submit.ts:73-80`, `asa.ts:120-121`). The user sees "Declined · Network slow", never a second charge.
  - **Decline reasons** (E-D4). The summary must return `reason`; today it returns only `result`/`status` (`app.ts:166`):

| `result` (+ `reason`) | Source | Copy |
|---|---|---|
| CARD_PAUSED (card PAUSED) | `asa.ts:70-73` | Card frozen |
| VELOCITY_EXCEEDED (allowance) | `asa.ts:102-105` | Over daily limit |
| VELOCITY_EXCEEDED (allowance, expired) | `reserve.ts:69` (left = 0) | Limit expired |
| VELOCITY_EXCEEDED (amount too-large) | `asa.ts:91-92` | Over $250 per payment |
| INSUFFICIENT_FUNDS (insufficient) | `asa.ts:102-105` | Not enough spendable |
| INSUFFICIENT_FUNDS (placeHold reverted `UnsafeMarketForHold`) | `CardModule.sol:207`, `asa.ts:122` | Prices paused |
| INSUFFICIENT_FUNDS (deadline before finality) | `asa.ts:122` | Network slow · retry |
| UNAUTHORIZED_MERCHANT (currency) | `asa.ts:91-92` | Currency not supported |
| INSUFFICIENT_FUNDS (handler error) | `services/card/src/routes/lithic.ts:63-66` | Card service error |

  Expired vs exceeded can't be told apart from `reason` today (both "allowance"). Decision: the app picks the copy from `allowanceState` (`SpendLimit.tsx:19`).
- **States:** "Pending · Hold $6.00" · "Paid $5.00" · "Released" · "Refunded $5.00" · "Declined · Over daily limit" · "Settling" · "Card debt $3.20 · Repay".
- **After:**
  - A push per stage (decision, paid, refunded, declined). There is no push today: the card channel exists (`notify.ts:22,28`; `packages/api-client/src/routes/engagement.ts:49`), but no code pushes on it (defect 8; E-D5).
  - An inbox entry (G1); an Activity row (E6); a receipt with the hold, capture and refund transactions.
- **Today → gap:**
  - No Simulate UI: `cardSimulateRoute` has no mobile caller.
  - No settle/void/refund simulation.
  - No debt banner or repay: nothing in `apps/mobile` reads `cardDebt`.
  - No decline reasons: raw `status` (`card/index.tsx:123`).
  - Summary rows lack `reason`, the transaction token and the hold lifecycle (`app.ts:154-167`).
  - No card push sender (defect 8).
- **Acceptance:**
  - [ ] Simulate $5 Coffee: approved; the hold shows $6.00 (tip +20 %); the push arrives; `latency_samples` p99 < 2.8 s over 20 runs (`lithic.ts:55-70`).
  - [ ] Settle at $5: "Paid $5.00"; the hold is released to $0; Spendable is back minus $5.
  - [ ] Settle at $6.50 on a $6.00 hold with no free funds: "Card debt" banner → Repay → debt 0, Activity "Card debt repaid".
  - [ ] Refund after debt: the debt drops first.
  - [ ] Simulate $260: "Over $250 per payment".
  - [ ] Mark a held market STALE on the fork, then Simulate: "Prices paused".
  - [ ] Two rapid Simulates whose sum exceeds Spendable: one approved, one "Not enough spendable" (`scripts/drive/src/card-concurrency.ts`).
  - [ ] Mainnet test card: Settle → "Released · no charge"; the balance is unchanged.

### E5 Reveal details and Add to Wallet
- **Promise:** see the full number briefly and safely; Wallet shows its real blocker.
- **Entry points:** **Details** circle; the "Add to Apple Wallet" row (Wallet mark); deep links `/card-reveal`, `/card/wallet` (account required, `incoming-link.ts:11`).
- **Steps:**
  1. **Details** → passkey step-up → sheet with capture protection on (`apps/mobile/src/lib/capture-protection.ts:43-63`) → Lithic embed (PAN, expiry, CVV) in a WebView from `GET /v1/card/embed` (`app.ts:86-96`, `api.ts:51-65`) → a countdown ring → auto-hide at expiry (60 s, `app.ts:29`; max 300 s, `routes/card.ts:20,39`) or on background → "Hidden".
  2. **Add to Apple Wallet** row: locked; tap → small sheet with the Wallet mark + "Needs Apple approval" + ⓘ: "Apple grants in-app provisioning to the card issuer's app."
- **Rules:**
  - No reveal unless protection is active: `failed` → "Can't protect screen" and no number (`capture-protection.ts:44-57`).
  - The PAN is never in app state or logs. Only the iframe holds it; there is no copy button.
  - The embed route is session-only today (`app.ts:86-88`), so the server can't verify a step-up. Decision: client step-up + 60 s TTL + rate limit (none today). **UNDEFINED:** a server-checked step-up token.
  - Wallet: `capabilities.walletProvisioning` is `false` (`app.ts:179`). The named dependency is Apple's Apple Pay In-App Provisioning entitlement: production Team ID, requested by the Account Holder, normally after an issuer partnership (`company-and-real-integrations.md:99`). Android push provisioning: issuer-dependent (Immersve "soon", `company-and-real-integrations.md:30`), so it is locked "Needs issuer support".
  - Mainnet real-card reveal: the issuer's own method (UNDEFINED until an issuer signs).
- **States:** "Details" · passkey · "Showing · 0:42" · "Hidden" · "Can't protect screen" · "Details unavailable" (no key) · Wallet: "Needs Apple approval".
- **After:** nothing recorded beyond a security log line (UNDEFINED; decision: none in Activity).
- **Today → gap:**
  - `card-reveal` is a placeholder sentence (`apps/mobile/src/app/(sheets)/card-reveal.tsx:5-8`).
  - `/card/wallet` is a placeholder with two sentences (`apps/mobile/src/app/(tabs)/card/wallet.tsx:5-9`).
  - The Card tab rows have no `onPress` and use prose detail (`card/index.tsx:102-103`).
  - `cardEmbedRoute` has no caller; capture protection is used only by the recovery phrase (`apps/mobile/src/features/auth/PhraseGrid.tsx:52`).
- **Acceptance:**
  - [ ] Practice: Details → passkey → number visible → a screenshot gives a blank capture (iOS) / is blocked (Android).
  - [ ] It auto-hides at 60 s and on app switch; reopening needs the passkey again.
  - [ ] The Wallet row shows the lock and "Needs Apple approval"; nothing else happens.

### E6 Card activity
- **Promise:** every purchase as one row from pending to final, also in the app-wide Activity.
- **Entry points:** Card tab → Transactions; Activity (clock) → **Card**; push tap; deep link `/card/auth/{id}`.
- **Steps:**
  1. **Card tab → Transactions** (last 20, `app.ts:30`). Each row: merchant name + category glyph (from MCC), status word, amount (coloured only by direction).
  2. Practice: "Simulate a payment" sits above the list.
  3. **See all** → Activity filtered to Card (`activity-copy.ts:37-46`).
  4. **Row → detail sheet:**
     - merchant, amount, status line;
     - steps "Authorized → Hold $6.00 → Paid $5.00" with times;
     - hold, captured, refunded, debt created;
     - Practice / test card actions (E4.4);
     - **Share** receipt; Explorer for each onchain step.
- **Rules:**
  - The service rows (`card_auth`, every decision including declines) are joined with `holds` (status, `captured_usd6`). The summary must add `holdStatus`, `capturedUsd6`, `reason` and the transaction token (E-D8).
  - Activity → Card merges the indexer kinds `CARD_HOLD / _INCREASED / CAPTURE / RELEASE / REFUND / DEBT_REPAID / ALLOWANCE` (`activity-copy.ts:37-46`) with service declines, which never reach the chain. **UNDEFINED:** the merge source; decision: the Activity screen reads both and joins on `holdId`.
  - Deep links must resolve any id (`GET /v1/card/auth/:id`, new), not only the last 20 (`apps/mobile/src/app/(tabs)/card/auth/[id].tsx:15`).
  - The MCC → glyph map is UNDEFINED (decision: 8 groups — food, transport, shopping, travel, entertainment, services, cash, other).
- **States:** skeleton rows · "No payments yet" + **Simulate a payment** (Practice) · "Activity unavailable" + Retry · stale stamp.
- **After:** Share receipt (F7 style); the row updates live while the Card tab is focused (summary refresh 30 s, `useCardSummary.ts:7`).
- **Today → gap:**
  - Rows show `row.status` raw and a date only (`card/index.tsx:118-127`).
  - Detail uses `KeyValue` boxes (`card/auth/[id].tsx:23-24`, against Part A5).
  - Unknown ids read "This record is unavailable…" (`card/auth/[id].tsx:27-31`).
- **Acceptance:**
  - [ ] Simulate → Settle → Refund: one row moves Pending → Paid → Refunded; the detail shows all three steps with Explorer links.
  - [ ] A declined Simulate appears in both the Card tab and Activity → Card with its reason.
  - [ ] A push tap on a payment older than the last 20 still opens its detail.
