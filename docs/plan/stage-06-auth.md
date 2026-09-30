# S6 — Auth + rpId: Mera passkeys, session policy, onboarding (web + mobile) (wave B)

**Goal:** one passkey on the rpId `senryo.xyz` opens the same EOA on web, iOS and Android. `@senryo/account` is the
Mera island: frozen derivation, platform ceremonies, a scoped signing session (`SessionManager` + `Policy` + step-up +
Face ID gate) that **signs and never sends**. Onboarding (Create-first, D-029), sign-in, session chip, step-up,
watch-only (D-031), recovery (second-passkey vault; 24-word export under Advanced) and the practice starter claim
(D-030) run on web and mobile with honest states. `.well-known` is generated from config + the user's Team ID / signing
fingerprints. S11a (web shell + auth) is folded in here (D-103).
- **Plan:** `00-plan.md` §1 (D-007, D-011, D-012, D-026, D-028, D-029, D-030, D-031, D-033, D-034 recovery, D-037,
  D-038, D-041), §2.4 (packages, session policy, screens), §2.5 (F01, F02, F04, F05, F06, F07, F08, F09, F17, F18, F19,
  F65, F91 + failure paths), §4 (S6 row).
- **Open first:** `specs/client.md` (binding: package table, "Session policy", data flow), `specs/flows.md` (F01, F05,
  F08), `specs/contracts.md` (StarterDrip `Claim`/`Voucher` EIP-712, SenryoCore selectors), `specs/deploy-runbook.md` §6,
  `context/08-integrations/mera.md`, `context/08-integrations/platforms-and-stores.md` §1–2,
  `context/09-product/ux-product-feel.md` (A.2 onboarding/faucet/keys, B.11, B.12, D.2, D.3, D.8),
  `references/mera` (`library/src/*`, `demos/shared/src/hd.ts`, `demos/mobile/src/{wallet,storage}.ts`,
  `demos/web/src/connect.ts`), `references/react-native-passkey`, S5 Handoff (swap-in points), S1 Handoff (web shell).
- **Ownership (D-103):** `packages/account`, `docs/plan/specs/session-policy.md`, auth/onboarding/session/step-up/
  watch/recovery surfaces in `apps/{web,mobile}`, `apps/web/public/.well-known` + its generator, web deploy prep
  (nginx). `packages/{config,core}` additive only, each change listed in the Handoff.
**D-number range:** D-140…D-159.

## Steps
- [x] S6.1 Stage file
- [x] S6.2 Docs read + recorded (Mera source, react-native-passkey, expo-secure-store, expo-local-authentication,
      WebAuthn PRF, viem accounts + EIP-7702) · `@senryo/account` scaffold: `exports` conditions (`react-native` vs
      `default`) for `passkey`, `secret-store`, `sync`; exact pins (`@category-labs/mera@0.2.0`,
      `react-native-passkey@3.6.1`); viem-client-free boundary
- [x] S6.3 Frozen derivation (`derive.ts`, PRF → BIP-39 → `m/44'/60'/0'/0/0` per `hd.ts`) · ceremonies `.web`/`.native`
      (create, discoverable get, pinned get) · hints (non-secret) · error → copy map · rpId host guard (web)
- [x] S6.4 `specs/session-policy.md` · `Policy` (allowlist, selectors, caps decoded from calldata against the
      `@senryo/contracts` ABIs, reduce-only uncapped, withdraw-to-self in scope, typed-data + message scope) ·
      `SessionManager` (TTL 30 / idle 5, lock, chip state, events) · step-up (pinned ceremony, one-shot, `end()` in
      `finally`) · Face ID gate (native SecureStore biometric read, web passkey assertion; D-037 defaults) · one ordered
      queue per address · `getSigner()`
- [x] S6.5 Targeted checks: derivation parity (web and native code paths, same PRF → same address; known vector) and
      session-policy scope checks
- [x] S6.6 Starter claim: StarterDrip `Claim`/`Voucher` typed data read from the contract, signed in session; app-side
      `StarterClient` interface (S3 relay `POST /v1/starter/claim` integration left open) · 7702 spike: signed
      authorization construction (signing only, step-up) + findings D-entry
- [x] S6.7 Web auth (S11a): account provider, onboarding Create-first / "I already have an account" / hint path,
      session chip, step-up + Face ID dialogs, BroadcastChannel sync, lock on `pagehide`/idle, watch-only `/watch`,
      recovery (vault + Advanced export), security settings, delete data · 21st items re-tokenized
- [ ] S6.8 Mobile auth: onboarding (intro + value pages + Create-first), SecureStore gated PRF + ungated hint, unlock,
      session chip, step-up / session / account-required sheets live, lock on background + privacy plate, watch-only,
      recovery, security, delete data · RN ports recorded in `apps/mobile/.21st/design.json`
- [x] S6.9 `.well-known` generator (AASA + assetlinks from config + `~/.config/senryo/{apple,android}.env` or env) ·
      nginx config per runbook §6 (`location =`, `application/json`, no redirect) · web Dockerfile copies dot-folders
- [ ] S6.10 Measurement hooks: TTFT start/stop + prompt counts per authenticator (log format, local sink)
- [ ] S6.11 Gate + Handoff (fast gate, web build, expo export, parity + policy checks, local web sign-in)
- [x] **(user)** Apple **Team ID** (`86C6ZFJ6V6`) + Android EAS keystore SHA-256 → constants in `@senryo/config`
      (`APPLE_TEAM_ID`, `ANDROID_CERT_SHA256S`); generator run, AASA + assetlinks committed (df0f559)
- [ ] **[OK?]** DNS A record `@` → Coolify (**live per lead 30 Sep: apex/www/api/indexer/docs → 84.46.247.92** — tick
      at merge); Coolify project + `senryo-web` deploy; `.well-known` checks (curl, Apple CDN, Google Digital Asset Links)
- [ ] **(user)** dev builds on iPhone + Android: same address web/iOS/Android, fresh-device rebuild, prompt counts per
      authenticator (iCloud, GPM, 1Password), TTFT (practice claim)
- [ ] S6.12 Integration after S3 merges: starter claim client → `POST /v1/starter/claim` (`packages/api-client`
      schemas); sends through `packages/chain` with `getSigner()`; 7702 send (type-4) through `packages/chain`

## Gate
Fast gate green · `pnpm --filter @senryo/web build` · `pnpm --filter @senryo/mobile exec expo export -p ios -p android`
· derivation parity check (same PRF → same address on the web and native code paths) · session-policy scope checks ·
web sign-in in a local Chrome (rpId-matched, documented below). Device/deploy parts of the plan's S6 gate (same address
on web/iOS/Android, fresh-device rebuild on devices, prompt counts, TTFT) stay open with exact steps.

## Findings
- **Web sign-in works end to end in real Chrome** (headless, CDP virtual authenticator ctap2 + resident key + UV +
  `hasPrf`) on the production rpId: origin `http://local.senryo.xyz:3461` mapped by `--host-resolver-rules` and made
  secure by `--unsafely-treat-insecure-origin-as-secure`, served by the real `deploy/nginx.conf` in an nginx container
  (D-146). Walked: create → session unlocked → account page shows the same address → clear site data → "I already have
  an account" → **same address** → Continue (pinned unlock) → starter claim → honest "relay offline" (S3 not deployed)
  → step-up → 24-word phrase → backup passkey vault → clear data → recover from the file → **same address** (mode vault).
  No console errors. Host guard verified on `localhost` (refuses, links to senryo.xyz).
- Targeted checks (`pnpm --filter @senryo/account check`): **26/26** — derivation parity (24 random PRFs: web JS PBKDF2
  == native `pbkdf2Sync` path == standard wallet import; fixed vector all-zero PRF → `0xF278cF59…1cdb`), policy scope
  (11), signer wiring (6: one prompt when locked, TTL/idle, raw hash + 7702 refused, typed data/SIWE scope), starter
  typed data == OZ `_hashTypedDataV4` from the `.sol` source.
- `.well-known` through nginx: AASA and assetlinks → **200 `application/json`, no redirect**; `/portfolio` (no slash)
  → 200 (no slash redirect); `/healthz` 200.
- Web landing JS ≈ 207 KB gz, of which ≈ 190 KB is the Next 16 + React 19.2 framework baseline (> the 120 KB plan
  target before S6 — for S11); the account runtime (~85 KB gz) and all auth sheets load lazily (D-149).
- 7702: Simple7702Account (v0.8) is on mainnet only; MetaMask EIP7702StatelessDeleGator is on both (D-145).
- Android authenticates SecureStore *writes*: sign-up on Android = passkey sheet + one biometric prompt to save the
  unlock item (D-142) — expected in the prompt-count report.
- Mera 0.2.0 vaults need WebCrypto `subtle` (HKDF + AES-GCM): fine on web; native relies on react-native-quick-crypto's
  subtle (types list HKDF/AES-GCM) — unverified on device, so backup-passkey setup is web-first on mobile (F07 "vault
  web-first"); the 24-word export works on native (no subtle needed).

## Handoff
**Stopped at (2026-09-30, usage limit):** S6.8 mobile auth code written and committed as `wip` — fast gate green
(typecheck, lint, invariants); **not yet run: `pnpm --filter @senryo/mobile exec expo export -p ios -p android`**, the
mobile visual pass, and the mobile `.21st/design.json` records. Next, in order:
1. Run the mobile export gate; fix any Metro resolution issue (new: `@senryo/account` via exports conditions,
   `react-native-passkey@3.6.1`, SINGLETONS now pin `react-native-passkey` + `expo-secure-store`, quick-crypto PBKDF2).
2. `apps/mobile/.21st/design.json`: record the RN ports — AuthCard ← sign-in-4 #19045, CeremonyCard ← verify-identity-3
   #19036 + Task Steps #23569, PhraseGrid ← Encrypted Text #18575, SessionChip (D2 status pill), Onboarding pager.
3. Tick S6.8, S6.10 (measurement hooks exist on both apps: `recordMeasure` → ring buffers, Account → Diagnostics),
   S6.11; write the final Handoff sections below (API, routes, pending, user steps); final commit; report to lead.

**`@senryo/account` public API (so far):** `AccountClient` (`load`, `create`, `signIn`, `unlock`, `confirm`, `stepUp`,
`signer(context)`, `lock`, `signOut`, `session: SessionManager`); platform subpaths `@senryo/account/{passkey,
secret-store,sync}`; `openAccount` / `openAccountFromMnemonic` / `prfOutputToMnemonic` / `mnemonicToSeed(pbkdf2?)`;
policy `evaluateTransaction` / `evaluateTypedData` / `evaluateMessage` / `decodeCall` / `scopeTargets`; `chipState`;
`enqueue` (per-address queue); starter `signStarterClaim` / `signVoucher` / `claimTypedData` / `voucherTypedData` /
`canonicalVoucherCode`; recovery `revealRecoveryPhrase` / `addRecoveryPasskey` / `recoverWithVault`; 7702
`signDelegation` / `DELEGATES`; errors `AuthError` / `OutOfScopeError` / `SessionLockedError` / `classifyAuthError`;
copy `authFailureCopy` / `scopeCopy`; measurement `MeasureEvent` / `formatMeasure` / `ttftMs`.
**Files outside S6 ownership touched:** `scripts/invariants/rules.mjs` (+`account-signs-only`), `biome.json`
(ignore generated `apps/web/public/.well-known`), `packages/config/src/hosts.ts` (additive: `APPLE_TEAM_ID`,
`IOS_BUNDLE_ID`, `ANDROID_PACKAGE`, `ANDROID_CERT_SHA256S`).
