# D — Earn (the Senryo pool)

Capability cards D1–D2. Sources: plan §0.4 "Pool", §0.6 D and §0.9 "Pool". Method: `product-how-tree`.

- Paths are relative to the repo root; line references are at HEAD `924bd93`.
- `UNDEFINED` marks a research task.
- (P) = Practice, (M) = Mainnet.

## Pool facts both cards use

**What the pool is.**
- `LpVault` is an ERC-4626 vault on AUSD ("Senryo LP", `sLP`).
- Its assets sit in SenryoCore's POOL book.
- It is the counterparty to every engine trade (`contracts/src/lp/LpVault.sol:15-20,40`).

**Two prices.**
- Deposits mint at the pool-favourable value: cash + receivables − trader PnL (`LpVault.sol:55-57`; `contracts/src/core/MarketAccounting.sol:32-42`).
- Redeems pay at the conservative value: cash − max(trader PnL, 0) (`LpVault.sol:50-53`).
- So depositing and then redeeming straight away can lose value.

**APR.**
- Formula: Σ(traderFees × 90 % − traderPnl) over the indexed days ÷ current value × 365 ÷ days, over the last 7 days (`packages/query/src/lp.ts:28,59-83`). The 90 % reflects insurance taking 10 % of fees (`contracts/src/libraries/Constants.sol:49`).
- Inputs: `LpDaily` fees and PnL from `PositionUpdated` (`indexer/src/handlers/positions.ts:157-160`).
- **Gaps:**
  - Borrow and funding paid to the pool are left out. The core settles them apart from price PnL (`contracts/src/core/PerpModule.sol:228`); the indexer keeps them only in trade stats (`positions.ts:152-153`). So the APR understates income.
  - The span is `days.length` (`lp.ts:82`), so a single day gets annualised.
- **Decision:**
  - Add borrow and net funding to `LpDaily`.
  - Label the chip with its real window ("APR 12.4% · 3d") until 7 days exist.
  - Show `—` with no history.

**Other numbers.**
- **In use:** open notional ÷ pool value (`apps/mobile/src/features/lp/useLp.ts:40-46`).
- **Cap left:** `tvlCap` − pool-favourable value (`LpVault.sol:63-66`).
- **(M) seeds:** cap $1,000, LP $250, dead-address $1 (`contracts/script/SeedConstants.sol:137-142`).
- **(P) cap:** read live (`apps/mobile/src/features/lp/LpScreen.tsx:130`).

**Modes.**
- (P): `LpVault` on 10143 with MockAUSD.
- (M): not deployed. `/lp` shows "The mainnet liquidity pool opens at launch." (`apps/mobile/src/features/network/PrelaunchMainnet.tsx:30`).
- The capability reason is "Pool investment is unavailable on this network" (`packages/query/src/capabilities.ts:47`).

**Disclosures.** Pre-approval rows, so the copy budget doesn't apply (Part F8). Each is one row with an ⓘ:

| Row | ⓘ | Source |
|---|---|---|
| Capital at risk | The pool pays traders' profits; its value can fall. | `LpScreen.tsx:22-23` |
| 24 h to redeem | Shares wait 24 hours in escrow before a claim. | `Constants.sol:100` |
| Claims need open markets | Claims work only while every market is open. | `LpVault.sol:98` |
| Value moves until claim | You receive the value at claim time, not at request. | `LpVault.sol:100` |
| Entry and exit prices differ | Deposits count open trader losses; claims don't. | `LpVault.sol:51-57` |
| APR is past, not promised | Last 7 days of fees and trader results. | `lp.ts:59-61` |

---

### D1 Deposit to the pool (from any asset)
- **Promise:** Put any holding into the pool with one slide, then see your share and APR.
- **Entry points:** Home → **Earn** tab → pool row (§0.9; today `apps/mobile/src/features/home/HomeTiles.tsx:19`) · Balance sheet → Earn (`apps/mobile/src/features/portfolio/BalanceDetails.tsx:144`) · Asset detail → "Earn with it" (new, dollar assets) · Add money → done → "Earn".
- **Steps:**
  1. **Pool screen:**
     - Hero "Your investment", with the pool mark and an APR chip ("APR 8.2% · 7d" ⓘ).
     - Strip: Pool value · In use · Cap left.
     - Disclosure rows.
     - Deposit, plus Redeem once you hold shares.
     - Mode label: "Practice · Paper money" / "Mainnet · Real money" (`LpScreen.tsx:72-73`).
  2. **Deposit sheet:**
     - $ hero, keypad, presets $10 / $25 / $50 / Max (`features/lp/constants.ts:2`).
     - "Pay with AUSD ⌄" opens the AssetPicker over every holding (rule 1).
     - Max = min(holding value after the swap, Cap left). On MON, Max keeps the fee reserve (B11).
  3. **Details:** "You get ≈ n sLP" · steps (Swap MON → AUSD with route marks and impact, Approve, Deposit) · network fee · Cap left.
  4. **"Slide to deposit".**
     - Signed in session for an AUSD deposit ≤ $250.
     - Otherwise one passkey step-up signs every leg; `useLp.ts:88-104` already does this for approve + deposit.
  5. **`OperationStatus` (Part A8):** "Depositing…" → check + sound → "Deposited $50", then Investment · Share of pool · APR.
  6. **(P):** P$ sits in the trading account (B15). The operation composes withdraw-to-self (in session, `packages/account/src/policy/evaluate.ts:102-105`) → approve → deposit. The pool faucet is removed.
  7. **(M):** the same screen, with the slide locked: "Opens at launch".
- **Rules:**
  - **Asset:** AUSD only (`LpVault.sol:38-40`).
    - Every other verified holding, including USDC, is swapped first (rule 4, D6).
    - Unverified tokens can't fund (§0.4).
  - **Cap:** blocked before the slide. Revalidation copy: "The pool capacity or wallet balance changed. Review again." (`useLp.ts:70-76`).
  - **Minimum:**
    - On-chain: none (`UNDEFINED`). A zero redeem reverts (`LpVault.sol:85`).
    - **Decision:** a $1 / P$1 floor in the UI, so dust can't mint unredeemable shares.
  - **Session policy** (`evaluate.ts:106-113`; `packages/account/src/constants.ts:38-41`):
    - deposit-to-self ≤ $250 per action, counted toward the $1,000 session;
    - known-spender approve ≤ $250;
    - swap ≤ $250, counted.
    - Anything above steps up, and approvals and swaps always step up (rule 11).
    - The Face ID trade gate doesn't apply (`evaluate.ts:50-61`); only the session unlock does.
  - **Swap impact:** warn above 1 %, block above 5 % and show the max size (D-5).
  - **Guardian pause:** doesn't stop deposits. `fundPool` has no pause check (`contracts/src/core/AccountLedger.sol:63`); the guard covers only opens and card holds (`PerpModule.sol:96`; `CardModule.sol:202`).
  - **Gas caps:** deposit 1,150,000, claim 1,160,000 (`packages/config/src/gas.ts:73,80`). (P) is sponsored; (M) pays in MON (B11).
- **States:** skeleton, never $0 (`LpScreen.tsx:62`) · "Earn from the pool" + Deposit · "Pool full" · "Swap ~$0.31 · 0.2%" · "Confirm with passkey" · "Depositing…" · "Deposited $50" · "Not deposited · Review again" (never resubmits) · "Checking…" · guest: "Create account" (`LpScreen.tsx:52-59`).
- **After:** A pool row under Home → Earn · Activity → Money: "LP vault deposit" (`apps/mobile/src/features/portfolio/activity-copy.ts:30,88`) · Receipt with the steps and txs. No push.
- **Built (claude/compose, 2 Oct):** "Pay with ⌄" over every holding — AUSD from the wallet then the trading balance
  (withdrawn to self), any other verified holding swapped to AUSD on Mainnet, one operation (`features/lp/deposit-op.ts`,
  `DepositSheet.tsx`); Practice "dollars only" — test USDC (wallet part) pays through the par `PracticeSwap` to test AUSD
  in the same operation ("Approve USDC · Swap USDC → AUSD · Approve AUSD · Deposit", D-252).
  Web (claude/web3, 3 Oct): the same composition (`@senryo/query` `pool-deposit.ts`) behind a "Pay with ⌄" chip on the
  web pool. Live on 10143 (account `0x5023…8748`, 10 test USDC): one passkey, "Deposited P$10.00" — approve
  `0x736d…3dcb`, par swap `0x45e2…e089`, approve `0x8f3d…b19e`, deposit `0xf38b…89ce`.
- **Was:** deposits came from wallet AUSD only (`LpScreen.tsx:143-149`; `useLp.ts:73`), so P$ in trades couldn't be used; the faucet sits on the pool screen (`LpScreen.tsx:150-157`); the disclosures are paragraphs (`:22-23,135-137`); with an allowance in place, a deposit over $250 hits `over-move-cap` with no step-up route (`useLp.ts:56`; `apps/mobile/src/lib/account/sender.ts:81-99`), the same class as defect 1; the presets constant is unused; there's no pool mark (Part A3) and no Earn tab; the APR leaves out borrow and funding.
- **Acceptance:**
  - [ ] (P) With P$ only in trades, deposit P$20: one slide; the status shows withdraw → approve → deposit; "Deposited P$20".
  - [ ] (P) Deposit P$300: exactly one passkey prompt.
  - [ ] (M, after deploy) Deposit $10 paying with MON: the swap route and impact show, then one step-up.
  - [ ] Typing more than Cap left shows "Pool full" before the slide.
  - [ ] Kill the app mid-deposit and reopen: the status resumes and there's no second deposit.
  - [ ] The APR chip names its window; a new pool shows `—`.

### D2 Redeem and claim (window rule)
- **Promise:** Ask for your money back, know exactly when it can be claimed, and claim it with one slide.
- **Entry points:** Pool → Redeem · Home → Earn → pending row · Push "Redemption ready" (new) · Balance sheet → Earn ("n redeems waiting", `BalanceDetails.tsx:138-144`).
- **Steps:**
  1. **Redeem sheet:** chips 25 / 50 / 100 % of sLP (`features/lp/constants.ts:4`), plus a $ keypad showing "Est. $49.80".
  2. **Review:** shares · value now · "Claim from Fri 14:02 UTC" · "Can't be cancelled" · disclosure rows.
  3. **"Slide to request".** Signed in session, with no cap and no Face ID (`evaluate.ts:114-115`). Status: "Redemption requested".
  4. **Pending row:** "Claim in 14h 02m" (`packages/core/src/blockers.ts:108-124`). Once ready but a market is shut, it reads "Claim opens Mon 23:05 UTC".
  5. **"Slide to claim":** "Claimed $49.80", and AUSD arrives in the wallet. (P) and (M) behave the same; (M) stays locked until the deploy.
- **Rules:**
  - **Request:**
    - Escrows the shares with `claimableAt` = now + 86,400 s (`LpVault.sol:84-92`; `Constants.sol:100`).
    - Several requests can coexist (`LpVault.sol:88`). There is no cancel.
  - **Claim** reverts before `claimableAt`, or unless every listed market is OPEN (`LpVault.sol:97-98`; `contracts/src/oracle/SessionOracle.sol:96-101`).
  - **Window (derived):**
    - Metals close daily 21:00–23:00 UTC and from Fri 21:00 to Sun 23:00 (`SeedConstants.sol:164-169,186-188`).
    - FX trades 24/5, Sun 23:00–Fri 21:00 (`:176-180`).
    - The first 300 s after an open are REOPENING (`Constants.sol:88`).
    - **So claims work Sun–Thu from 23:05 to 21:00 UTC the next day**, minus holidays and any STALE, CIRCUIT or HALTED spell.
  - **(P) only:** the keeper must keep relaying the mirrors. FX goes STALE after 10,800 + 600 s (`SeedConstants.sol:63`; `Constants.sol:82`), so a keeper out of gas (D0) blocks claims.
  - **Value:** the conservative value at claim time (`LpVault.sol:100`). Escrowed shares stay in supply, so gains and losses accrue until the claim. The receiver is always self (`lp.ts:95-97`).
  - **Next window:** computed from every market's calendar plus 300 s. This function is new; only the per-market `nextTransition` exists (`packages/core/src/risk/calendar.ts:45`).
- **States:** "Claim in 14h 02m" · "Ready · Claim" · "Claim opens Mon 23:05 UTC" · "Waiting for prices" · "Claiming…" · "Claimed $49.80" · "Updating…" (the indexer is behind).
- **After:** AUSD shows under Assets · Activity → Money: "LP redeem requested" / "LP redeem claimed" (`activity-copy.ts:31-32,89-90`) · Push and inbox entry at `claimableAt` (new G1 channel).
- **Today → gap:** the amount is typed in $ and then converted to shares (`LpScreen.tsx:178-197`), and the chips are unused; the window copy has no time: "Claims open when every market is open (weekend-gap protection)." (`:120-124`); rows read "Request 12" (`:106`); there's no ready push; partial indexer reads show a sentence (`:208-211`; `packages/query/src/lp-requests.ts:7-42`).
- **Acceptance:**
  - [ ] (P) Request 50 %: the review shows the claim time and "Can't be cancelled", and the row counts down.
  - [ ] A ready claim between 21:00 and 23:05 UTC, or at the weekend, shows "Claim opens … UTC" with the slide disabled.
  - [ ] After 24 h with markets open, one slide claims and the wallet gains the value shown.
  - [ ] Two requests show as two rows with their own times.
  - [ ] A push arrives when a request becomes claimable inside a window.
  - [ ] Activity shows both the request and the claim.

## UNDEFINED (D)
1. The on-chain deposit minimum: none found. The $1 UI floor is decided above.
2. Whether liquidation losses reach `LpDaily.traderPnl` (the liquidation path, `positions.ts:146-155`).
3. Whether the pool needs its own pause; `fundPool` has none.
4. The testnet `tvlCap`: read live; it isn't in the seeds.
5. Holiday entries that shorten the claim windows (`MAX_HOLIDAYS` 32, `Constants.sol:97`): none recorded.
