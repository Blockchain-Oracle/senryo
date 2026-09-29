# Spec: user flows

The flow catalogue (F01–F95, personas, feedback/analytics map, stage ownership) is `00-plan.md` §2.5 — the source of truth. This file holds the detailed step lists and copy for the flows that carry the most risk. Blocker order lives in `packages/core/blockers.ts`.

## F01 Create account
1. Splash held until fonts + MMKV + persisted query cache hydrate (font error counts as ready).
2. BrandIntro ~1.2 s (wordmark types in mono, `/` flashes, chime + `snap`); tap to skip; skipped under Reduce Motion.
3. Three pages: live XAU card (static plate fallback) · "One balance: Free to trade · Free to spend · Locked" · "Face ID is your account. No seed phrase."
4. No hint → **Create account** (primary) runs `createPasskeyWithPrfOutput` labelled `Senryo · <date>`; secondary **I already have an account** runs discoverable `getPasskeyPrfOutput({ rpId })`; **Look around first** → Markets.
5. Success → derive address → persist (native: gated PRF in SecureStore `requireAuthentication` + `WHEN_UNLOCKED_THIS_DEVICE_ONLY`, ungated `{address, credentialId}`; web: hint only) → `SessionManager.start` → relayed gas drip → Face ID glyph morphs to a check (`confirm` + unlock sound) → Portfolio (empty state = Add-money card).
Failures: cancel → silent; `PRF_UNAVAILABLE` → "Save the passkey to iCloud Keychain, Google Password Manager or 1Password"; `NoCreateOption` (Android) → "Add a Google account in Settings"; iOS < 18 / Android < 9 → block + web link; two prompts → "One more confirmation" interstitial; orphaned passkey → "Your passkey is saved. Tap I already have an account" (never create twice); reinstall mismatch → wipe + re-persist; offline → disabled "Offline".

## F05 Starter funds
Pill label follows the stage: "Checking…" → "Adding gas…" (wait `FUNDED_WAIT_BLOCKS`) → "Claiming…" → "Ready". Claim signed by the unlocked session (no prompt) and relayed. Balance rolls at Voted (`filled` + deposit sound); CreditWelcome "On the house · practice dollars" auto-closes after `CREDIT_WELCOME_MS`.
Failures: relayer busy (backoff + "Deposit from any chain instead"); already claimed ("Claimed · deposit more"); rate-limited ("One claim per device per day · next in 13h"); budget exhausted; voucher invalid/used/expired; geo (mainnet only); reverted (`fail` + diagnosis, never auto-resent); proposed-not-finalized (roll back + "The claim didn't settle; nothing changed").

## F10 Open gold/silver position
1. Markets → XAU (`press`) → `/trade/XAU` (streams subscribe on focus).
2. First leveraged ticket → 3-card risk explainer ("Leverage multiplies gains and losses" / "Liquidation" / "Market hours") → "I understand" hold → MMKV flag.
3. Ticket: LONG/SHORT (`tick`) · mono keypad (`tick` per key) · chips $10/$25/$50/MAX (= Free to trade) · leverage detents (`tick` each, `snap` at ends) · live NOTIONAL, FEE, FROM FREE·TRADE, AFTER, gauge, "LIQ 2,203.67 · 18.0% away" · SESSION chip · "Oracle price · updated 3m ago".
4. Hold 500 ms ("HOLD · LONG XAU 5×", `press` at press-in, `confirm` on completion; early release springs back silently; VoiceOver `activate` confirms directly).
5. Face ID per D-037 (native biometric / web passkey); ticket untouched on lock.
6. Execution trace: Face ID signed 0.4 s → risk check (local mirror + `simulateContract`) → sent → Proposed (PENDING row) → Voted (FILLED, `filled` + fill sound, ticket morphs into receipt + share card) → Finalized (SETTLED; buckets refetch).
7. After the first fill: push priming sheet.
Blocker order: offline → geo (mainnet) → no account → no gas (auto top-up) → insufficient Free to trade ("Add $240 to trade") → market closed/weekend ("Gold opens Sun 23:00 UTC · in 14h 02m"; reduce-only allowed) → stale/circuit ("price paused; closing still works") → leverage above max (clamp + `warn`) → OI/skew/trade cap ("Market full; try ≤ $Y") → min position → simulate revert (decoded: "Price moved past your slippage. Retry at the new price." + shake) → session ended mid-hold (one Face ID, same order) → RPC error (fallback transport; toast only if the send never happened) → receipt timeout ("Checking onchain…", TxRecovery, never resend) → abandoned (roll back + warn) → nonce conflict (re-read once).

## F13 Perpl first trade
Venue label "Perpl" · explain + move AUSD vault → Perpl (≥ 10 AUSD): withdraw-to-self → `approve` → `createAccount` (inside the trace) → IOC `execOrder` with price = mark ± slippage bps (onchain enum is 0-based; price 0 reverts; `lastExecutionBlock` 0 or ≥ head+20). Failures: geo list → watch/read-only; below minimum; Perpl down ("crypto paused; gold unaffected"); slippage (retry at new price); Perpl withdrawal rate limit on moves back (ETA shown).

## F21 Deposit from any chain
QR: family chips EVM (resolves to Base) / Solana / Bitcoin / Tron / TON / **Monad (inbox, D-041)** → QR inside a "Transfer requirements" block (assets, min, fee, ETA: Base ~37 s, BTC ~13 min) → timeline Waiting → Received → Bridging → Credited to FREE·TRADE (Live Activity from `received`; push on credit). Connect: asset + amount → `preview()` → step-up erc191 sign → deposit by QR → timeline; optional "Open XAU long 5× when funds land" (`depositAndOpen`, EIP-712 `OpenOrder` step-up); `executionId` saved on `created`, `resume(id)` on launch; server poller for new devices.
Failures: `INCOMPLETE_DEPOSIT` (refund explained) · `REFUNDED`/`FAILED` (reason + support link with tx refs) · `EXPIRED` ("late deposits still count") · `OPERATION_FAILED` ("Funds are safe in your transfer account" → Retry / Withdraw) · `EXECUTION_IN_FLIGHT` ("Resume deposit") · signature rejected (silent) · memo chains (blocking checkbox) · Aurora incident (banner; QR disabled with reason).

## F31 Card spend (Lithic)
Tap/simulate → ASA → hold within allowance → push "Card: $4.50 at Blue Bottle · $812 left to spend" → row HOLD (yellow) → capture → SETTLED (mainnet sandbox: RELEASED, "no charge"). Declines as toasts: "Card declined · $64.00 · Not enough Free to spend. Margin untouched." / over allowance / frozen / "Spending paused while prices update" (stale oracle) / issuer outage (last-good values + timestamp).

## F08 Stateless test
Clear site data or fresh device → landing (no hint) → **I already have an account** → picker "Senryo · <date>" → same address → skeletons (never $0.00) → buckets, positions, holds, deposits, encrypted prefs (HKDF(prf, "senryo.prefs.v1") AES-GCM) rebuilt; Aurora persistent address re-fetched (deterministic). Cross-platform proof: create on iPhone, sign in on desktop Chrome (GPM) or Safari → identical address shown large in Account.

## F90 Judge path
Landing "Judge? Start here" → judge guide (regions, practice mode, voucher, watch link, video) → practice: claim → gold trade → card simulate → stateless test; mainnet (if allowed): voucher → Perpl trade → gold trade; geo-blocked → watch mode + demo video.
