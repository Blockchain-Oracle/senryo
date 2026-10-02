# Spec: session policy (Mera "Session design")

Owner S6 · code `packages/account/src/{policy,session}` · checks `packages/account/checks/{policy,session}.check.ts` ·
plan §2.4 "Session policy", D-028/D-037/D-039, spec `client.md` "Session policy". Mera gives us a key in memory with
`end()` and nothing else (no TTL, scope or idle lock — `library/src/session.ts`); everything below is our code.

## 1. Model
- **Account:** passkey PRF (rpId `senryo.xyz`, Mera default salt) → BIP-39 24 words → `m/44'/60'/0'/0/0` (FROZEN,
  `derive.ts`, parity check). Plain secp256k1 EOA on Monad.
- **States:** `none` (no hint on this device) · `locked` (hint known: address + credential id, no key) · `unlocked`
  (one live Mera `Secp256k1SigningSession`). The snapshot is immutable; apps render it via `useSyncExternalStore`.
- **Signer:** `AccountClient.signer(context)` returns a viem `LocalAccount`. `packages/chain` signs every transaction
  with it; **every** `signTransaction` / `signTypedData` / `signMessage` runs `Policy` first. `sign(hash)` and
  `signAuthorization` (7702) never sign in session.
- **Step-up:** `AccountClient.stepUp(fn)` = a fresh passkey ceremony pinned to the stored credential → derive → verify
  the address equals the account → a one-shot unscoped signer → `session.end()` in `finally`. A different passkey is
  refused (`wrong-account`), never adopted.

## 2. Timing
| Rule | Default | Where |
|---|---|---|
| Absolute TTL | 30 min | `SESSION_TTL_MS` |
| Idle lock | 5 min since the last signature | `SESSION_IDLE_MS` |
| Expiry | `min(startedAt + TTL, lastUsedAt + idle)`; a timer locks on time and every read re-checks | `SessionManager` |
| Warning window | last 60 s: chip `LOCKS IN 0:59`, `warn` haptic if a ticket is open | `SESSION_WARN_MS` |
| Background (native) | AppState `background` → lock; `inactive` → privacy plate | app |
| Web | `pagehide` → lock; `visibilitychange` hidden counts as idle; BroadcastChannel: an unlock in one tab locks the others, lock/sign-out reach every tab | app + `sync.web.ts` |
| Choices (Security) | TTL 5/15/30/60 min, idle 1/5/15 min | `SESSION_*_CHOICES_MS` |
| Loosening | longer TTL/idle or a weaker Face ID mode needs a step-up first | `isLoosening()` |

## 3. Scope (in session, no prompt unless §4 asks)
Targets come from the generated address book (`@senryo/contracts`), per network. Calldata is decoded with
`decodeFunctionData` against the real ABIs; amounts, destinations and receivers are read from calldata.

| Call | Verdict | Cap |
|---|---|---|
| any tx with `value > 0` (MON send) | step-up (`value`) | — |
| any tx with an `authorizationList` (7702) | step-up (`delegation`) | — |
| wrong `chainId` | never (`wrong-chain`) | — |
| unknown contract / selector (incl. every admin / keeper function) | never (`out-of-scope`) | — |
| `SenryoCore.increase` | sign | per trade ≤ min($250, market OI room); notional ≤ equity × 10; session total ≤ $1,000; ≤ 20 signed/min |
| `decrease`, `close`, `cancelTrigger`, `placeTrigger` (own `order.user` only) | sign | **uncapped**, rate-exempt (reduce-only must always work) |
| `deposit(stable)`, `depositFor(stable, self)` | sign | uncapped (own funds into own account) |
| `depositFor(…, other)` | step-up (`send`) | — |
| `withdraw(token, amount, to == self)` | sign (D-039) | uncapped — the key that signs keeps the funds |
| `withdraw(…, to != self)` | step-up (`destination`) | — |
| `swapCollateral` | sign | ≤ $250 per action, counts to the session total |
| stable `approve(spender ∈ {SenryoCore, LpVault, Perpl Exchange})` (Perpl's AUSD decoded like a stable) | sign | ≤ $250 per action |
| stable `approve(other spender)` | step-up (`unknown-spender`) | — |
| stable `transfer` | step-up (`send`) | — |
| testnet `faucet()` | sign | — |
| `LpVault.deposit(receiver == self)` | sign | ≤ $250, counts to the session total |
| `LpVault.requestRedeem / claimRedeem` (to self) | sign | — |
| `repayCardDebt`, `revokeSpendAllowance` | sign | uncapped (risk-reducing) |
| `setCardEnvelope`, `setSpendAllowance` | step-up (`card-setting`) | — |
| Perpl `execOrder` OpenLong / OpenShort (market decimals known) | sign | notional at the order's limit price ≤ $250; `leverageHdths` 1…1000 (≤ 10x; 0 = market max is refused); counts to the session total; Face ID gate as opens |
| Perpl `execOrder` CloseLong / CloseShort | sign | **uncapped**, rate-exempt (reduce-only by contract) |
| Perpl `createAccount` / `depositCollateral` | sign | ≤ $250 per action, counts to the session total (funds leave the Senryo account for a third-party venue) |
| Perpl `withdrawCollateral` | sign | uncapped — the contract pays `msg.sender` |
| any other Perpl selector (cancel, change, forwarding, …) or an open on a market with unknown decimals | never (`out-of-scope`) | — |

Missing live reads (equity, market room) never widen the scope: `increase` becomes `context-unavailable` (step-up or
wait). Perpl (D1) is traded from the wallet: `approve` (capped) + `createAccount`/`depositCollateral` (capped, counted)
+ `execOrder`; Perpl's own margin applies, so a Perpl open is bounded by calldata (notional, leverage), not by the
engine's equity/OI reads. Targets come from `@senryo/config` (`PERPL_EXCHANGE`, `PERPL_COLLATERAL`,
`PERPL_MARKET_SCALES`), not the address book.

### Typed data and messages
- In session: EIP-712 `Claim` / `Voucher` (domain `SenryoStarterDrip` v1, this chain, the book's StarterDrip) and
  `TriggerOrder` (domain `SenryoCore` v1, the book's core) — only when `message.user` is the session address.
- Step-up: `SpendAllowance` (card limit), `OpenOrder` (Aurora / IntentRouter), Perpl key enrolment, AUSD 3009, anything
  else.
- Messages in session: `Senryo:claim:` / `Senryo:push:` prefixes; SIWE (EIP-4361) only for `senryo.xyz` or a
  subdomain, the session address, this chain, a nonce, and an expiry ≤ 10 min ahead. Anything else: step-up.

## 4. Face ID per trade (D-028 → D-037)
| Mode | Default on | Gate |
|---|---|---|
| `off` | practice (testnet) | none — the prompt-free scoped session (the Mera criterion) |
| `above-threshold` | mainnet | opens with notional ≥ `FACE_ID_TRADE_THRESHOLD_USD6` ($50) |
| `every-trade` | user choice | every open, reduce and swap |
The gate is **native**: a SecureStore `requireAuthentication` read (OS biometric sheet, no passkey sheet, D-028);
**web**: a passkey assertion pinned to the stored credential. When the session is locked, the one unlock prompt *is*
the confirmation (prompt text = the trade: "Confirm long $250.00 Gold"), so a trade never costs two prompts. Card
allowance changes are always step-up (§3).

## 5. Always step-up (fresh passkey ceremony)
Withdraw/send to another address, MON sends, reveal card PAN, export the recovery phrase, raise card limits
(`SpendAllowance`, envelope), Aurora intent / Perpl key / 7702 signatures, loosening session settings, adding a
recovery passkey.

## 6. Ordering
`enqueue(address, task)` — one promise chain per address, so sign → send → nonce happen one at a time per key
(`packages/chain` wraps each send). A failed task never blocks the next.

## 7. What is persisted
| Where | What | Secret? |
|---|---|---|
| web `localStorage` `senryo.account.v1` | address, credential id (+ transports), mode, vault JSON (ciphertext) | no |
| native SecureStore `senryo.account.v1` (ungated) | same hint | no |
| native SecureStore `senryo.unlock.v1` (biometric-gated, this device only) | credential id + PRF output | **yes** — the only one; invalidated by the OS when biometrics change |
| anywhere else | PRF output, private key, mnemonic | never (invariant `session-secret-non-persisted`) |

## 8. Failure copy
`packages/account/src/copy.ts` — one table for both apps (`authFailureCopy`, `scopeCopy`); cancel is silent; the
biometric word follows the surface (Face ID · fingerprint or screen lock · passkey).
