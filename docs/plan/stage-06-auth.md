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
- [x] S6.8 Mobile auth: onboarding (intro + value pages + Create-first), SecureStore gated PRF + ungated hint, unlock,
      session chip, step-up / session / account-required sheets live, lock on background + privacy plate, watch-only,
      recovery, security, delete data · RN ports recorded in `apps/mobile/.21st/design.json`
- [x] S6.9 `.well-known` generator (AASA + assetlinks from config + `~/.config/senryo/{apple,android}.env` or env) ·
      nginx config per runbook §6 (`location =`, `application/json`, no redirect) · web Dockerfile copies dot-folders
- [x] S6.10 Measurement hooks: TTFT start/stop + prompt counts per authenticator (log format, local sink)
- [x] S6.11 Gate + Handoff (fast gate, web build, expo export, parity + policy checks, local web sign-in)
- [x] **(user)** Apple **Team ID** (`86C6ZFJ6V6`) + Android EAS keystore SHA-256 → constants in `@senryo/config`
      (`APPLE_TEAM_ID`, `ANDROID_CERT_SHA256S`); generator run, AASA + assetlinks committed (df0f559)
- [x] **[OK?]** DNS: `@`, `www`, `api`, `indexer`, `docs` → 84.46.247.92 (user OK, set by lead 30 Sep; dd4f002)
- [x] **[OK?]** Coolify project + `senryo-web` deploy; `.well-known` checks (curl, Apple CDN, Google Digital Asset Links) — live 30 Sep (2zeju5a5afmf7s0g4bzdgzjp); Apple CDN serves AASA; Google DAL linked: true
- [ ] **(user)** dev builds on iPhone + Android: same address web/iOS/Android, fresh-device rebuild, prompt counts per
      authenticator (iCloud, GPM, 1Password), TTFT (practice claim)
- [x] S6.12 Integration after S3 merges: starter claim client → `POST /v1/starter/claim` (`packages/api-client`
      schemas); sends through `packages/chain` with `getSigner()`; 7702 send (type-4) through `packages/chain`
      — web + mobile on `@senryo/api-client` (claim/voucher/status/relay, SIWE session, prefs D-152, vault D-153),
      `userSender` = chain `createSender` + scoped signer + `queuedNonces`; chain `authorizationList` → type-4 (D-155);
      `pnpm --filter @senryo/drive session-e2e` 13/13 on the testnet fork (30 Sep)

## Gate
**Evidence (2026-09-30, final):** fast gate green (typecheck 7/7, lint 342 files, invariants 0 errors) · account
checks 26/26 · `pnpm --filter @senryo/web build` ✓ · `well-known --check` ✓ · `expo export -p ios -p android` ✓
(iOS 9.1 MB / Android 9.3 MB hbc) · iOS Release simulator build ✓ + visual pass · local web sign-in ✓ (Findings).

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
- **Mobile export gate:** `expo export -p ios -p android` passes with `@senryo/account` resolved through the
  `react-native` export condition (Mera RN client, expo-secure-store store, quick-crypto PBKDF2): iOS `index-*.hbc`
  9.1 MB, Android 9.3 MB (S5: 6.0 / 6.2). Source-map breakdown (Android): viem ≈ 1.3 MB source, `@noble/curves` 0.8 MB
  (Mera's 2.x + viem's 1.x), `@senryo/contracts` ABIs 0.2 MB, `@scure/*` 0.26 MB — Metro bundles whole module graphs
  (no tree shaking), and viem arrives with `packages/chain` anyway. One harmless warning: `@noble/hashes@1.8.0/crypto.js`
  is outside that package's `exports` (viem's dependency); Metro falls back to file resolution.
- **Mobile visual check** (Release build, iPhone 17 simulator, iOS 26; `design/screens/mobile-s6/`, dark + light):
  onboarding pages (swipe, "N / 3" rule), Create account → the real native path (Mera RN client → react-native-passkey →
  ASAuthorization) → ceremony card → honest "This build isn't linked to senryo.xyz yet" (unsigned simulator builds
  have no associated domain; `RequestFailed` → `bad-configuration`, D-150) with Try again / Open senryo.xyz; guest
  portfolio strip + `SIGN UP` chip; account-required sheet; Account without an account; Diagnostics recorded the
  failed create (flow, outcome, ms). Signed-in screens (session sheet, security, recovery phrase) need a signed build
  on a device with the AASA live — the user's device step.
- Found and fixed on the simulator: an unsigned build can't reach the Keychain (`errSecMissingEntitlement`), which
  left the welcome actions on "Opening Senryo" — a failed hint read is now "no hint" (the stateless path) on both
  platforms; the "your passkey may already be saved" note now shows only when a create can have left a passkey
  (`mayHaveLeftPasskey`: unknown / interrupted / timed-out), not for association or provider refusals.
- Metro pins `react-native-passkey` and `expo-secure-store` as singletons: `@senryo/account` carries dev copies for its
  own typecheck, and the app's autolinked copies must be the ones bundled.
- Android authenticates SecureStore *writes*: sign-up on Android = passkey sheet + one biometric prompt to save the
  unlock item (D-142) — expected in the prompt-count report.
- Mera 0.2.0 vaults need WebCrypto `subtle` (HKDF + AES-GCM): fine on web; native relies on react-native-quick-crypto's
  subtle (types list HKDF/AES-GCM) — unverified on device, so backup-passkey setup is web-first on mobile (F07 "vault
  web-first"); the 24-word export works on native (no subtle needed).

## Handoff
**Branch** `stage/S6-auth` (not pushed; the lead merges). Everything below is committed; S6.12 is the only code step left.

**`@senryo/account` public API** (`packages/account/src/index.ts`; signs, never sends):
- `AccountClient({ rpId, passkey, store, sync?, pbkdf2?, clock?, settings?, measure?, onExtraPrompt? })` →
  `load()` (hint, no prompt) · `create()` · `signIn()` (discoverable) · `unlock(prompt?)` (native biometric read, else
  pinned passkey) · `confirm(prompt)` (D-037 gate) · `stepUp(fn)` (fresh ceremony → one-shot unscoped `LocalAccount`,
  `end()` in `finally`) · `signer(() => PolicyContext)` (**the scoped viem `LocalAccount` `packages/chain` signs with**)
  · `lock()` · `signOut()` · `session: SessionManager` (`snapshot`/`subscribe` for `useSyncExternalStore`, `settings`).
- Platform subpaths: `@senryo/account/passkey` · `/secret-store` · `/sync` (`react-native` → native, `default` → web).
- Derivation (FROZEN): `openAccount(prf, { pbkdf2? })`, `openAccountFromMnemonic`, `prfOutputToMnemonic`, `mnemonicToSeed`.
- Policy: `evaluateTransaction`, `evaluateTypedData`, `evaluateMessage`, `decodeCall`, `scopeTargets(chainId)`,
  `judgeAction`, `recordUsage`, types `Action`/`Verdict`/`PolicyContext`/`FaceIdMode`, `defaultFaceIdMode`.
- Session: `SessionManager`, `DEFAULT_SETTINGS`, `isLoosening`, `chipState`, `enqueue(address, task)` (one ordered queue
  per address — wrap it as S3's `NonceSource.withNext`), `UNLOCK_PROMPT`.
- Starter: `signStarterClaim`, `signVoucher`, `claimTypedData`, `voucherTypedData`, `canonicalVoucherCode`.
- Recovery: `revealRecoveryPhrase`, `addRecoveryPasskey`, `recoverWithVault`. 7702: `signDelegation`, `clearDelegation`,
  `DELEGATES`. Errors/copy: `AuthError`, `OutOfScopeError { reason, stepUp }`, `SessionLockedError`,
  `classifyAuthError`, `isSilent`, `mayHaveLeftPasskey`, `authFailureCopy`, `scopeCopy`. Measurement: `MeasureEvent`,
  `formatMeasure`, `ttftMs`.
- Checks: `pnpm --filter @senryo/account check` (26). Viem types re-exported (`Address`, `Hex`, `LocalAccount`) so apps
  never import viem.

**Routes / screens added or made live**
- Web: `/` (welcome actions: Create first / I already have an account / Continue / recover with backup passkey / host
  guard), top-bar session chip + session sheet, `StepUpProvider`, `/account/` (identity, practice claim, security,
  recovery + Advanced export, mode, diagnostics, sign out / delete), `/watch/?address=` (read-only), portfolio
  account strip. `apps/web/deploy/nginx.conf`, `apps/web/Dockerfile`, `apps/web/scripts/well-known.mjs`.
- Mobile: `welcome` (intro + 3 value pages + actions), sheets `account-required` / `step-up` / `session` live,
  top-strip `SessionChip`, `account` (identity, practice claim, diagnostics), `account/security`, `account/recovery`,
  `account/delete-data`, `account/mode`, `watch/[address]`, portfolio `AccountStrip`, root `PrivacyPlate`. New SDK-pinned
  deps: `react-native-passkey@3.6.1` (exact), `expo-screen-capture`, `expo-clipboard`. RN ports recorded in
  `apps/mobile/.21st/design.json`; evidence in `design/screens/{web-s6,mobile-s6}/`.

**Pending and why**
- **S6.12 done (30 Sep, lead):** claim/voucher/status/relay through `@senryo/api-client`; sends via
  `apps/*/src/lib/account/sender.ts` (`userSender`); prefs + vault server copies (D-152/D-153, CORS D-154); type-4
  through `packages/chain` (D-155). Evidence: `session-e2e` 13/13 (anvil fork of 10143 + local api). The batched
  7702 `execute` (approve + deposit + increase in one signature) is S8's trade flow on top of D-155.
- Market room / equity in `PolicyContext` come from S8 reads; until then `increase` is `context-unavailable` (step-up).
- Backup-passkey vault creation on native is web-first (Mera vaults need WebCrypto `subtle`; quick-crypto's subtle is
  unverified on device) — the 24-word export works natively.
- `images.yml` needs a `web` entry for `apps/web/Dockerfile` (S3 owns the file).
- Web landing bundle ≈ 207 KB gz (framework ≈ 190 KB) vs the 120 KB target → S11 (D-149). Mobile Hermes bundle
  9.1/9.3 MB (viem, noble, scure, ABIs; Metro doesn't tree-shake) → evaluate Expo tree shaking in S12/S15 (D-151).
- Signed-in mobile screens (session sheet, security, recovery phrase, step-up with a request) are built but only
  visually checked on the web; on native they need a signed build with the AASA live (user step 2).

**User / [OK?] steps (exact)**
1. **[OK?] Coolify `senryo-web`:** build `docker build -f apps/web/Dockerfile .` (or via images.yml) → deploy on the apex
   with Auto Deploy off; then `curl -sI https://senryo.xyz/.well-known/apple-app-site-association` and
   `…/assetlinks.json` → 200, `content-type: application/json`, no `location:`; Apple CDN
   `https://app-site-association.cdn-apple.com/a/v1/senryo.xyz`; Google
   `https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://senryo.xyz&relation=delegate_permission/common.get_login_creds`.
   (DNS is live per the lead — tick that box at merge.)
2. **(user) dev builds:** `eas build -p ios --profile development` and `-p android --profile development` (or local
   `expo run:*` with the user's signing). On each device: Create account → note the address; web on senryo.xyz →
   "I already have an account" → **same address**; Account → Delete my data → "I already have an account" → same
   address (fresh-device rebuild); Account → Diagnostics → read **prompts per flow** for iCloud Keychain, Google
   Password Manager, 1Password; claim practice funds once S3's relay is deployed → **TTFT + taps**. Record the numbers
   in acceptance.md and D-029's prompt-count note.
3. If Play distribution is used, append the Play App Signing SHA-256 to `ANDROID_CERT_SHA256S` and rerun
   `pnpm --filter @senryo/web well-known`.

**Files outside S6 ownership touched:** `scripts/invariants/rules.mjs` (+`account-signs-only`), `biome.json` (ignores
generated `apps/web/public/.well-known`), `packages/config/src/hosts.ts` (additive `APPLE_TEAM_ID`, `IOS_BUNDLE_ID`,
`ANDROID_PACKAGE`, `ANDROID_CERT_SHA256S`), `apps/web/src/components/ui/vercel-tabs.tsx` (no tab active off-tab),
`apps/mobile/metro.config.js` (singletons + `react-native-passkey`, `expo-secure-store`), mobile top strip shows the
network name without block time (room for the chip).
