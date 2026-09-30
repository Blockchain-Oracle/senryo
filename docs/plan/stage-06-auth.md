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
- [ ] S6.6 Starter claim: StarterDrip `Claim`/`Voucher` typed data read from the contract, signed in session; app-side
      `StarterClient` interface (S3 relay `POST /v1/starter/claim` integration left open) · 7702 spike: signed
      authorization construction (signing only, step-up) + findings D-entry
- [ ] S6.7 Web auth (S11a): account provider, onboarding Create-first / "I already have an account" / hint path,
      session chip, step-up + Face ID dialogs, BroadcastChannel sync, lock on `pagehide`/idle, watch-only `/watch`,
      recovery (vault + Advanced export), security settings, delete data · 21st items re-tokenized
- [ ] S6.8 Mobile auth: onboarding (intro + value pages + Create-first), SecureStore gated PRF + ungated hint, unlock,
      session chip, step-up / session / account-required sheets live, lock on background + privacy plate, watch-only,
      recovery, security, delete data · RN ports recorded in `apps/mobile/.21st/design.json`
- [ ] S6.9 `.well-known` generator (AASA + assetlinks from config + `~/.config/senryo/{apple,android}.env` or env) ·
      nginx config per runbook §6 (`location =`, `application/json`, no redirect) · web Dockerfile copies dot-folders
- [ ] S6.10 Measurement hooks: TTFT start/stop + prompt counts per authenticator (log format, local sink)
- [ ] S6.11 Gate + Handoff (fast gate, web build, expo export, parity + policy checks, local web sign-in)
- [ ] **(user)** Apple **Team ID** → `~/.config/senryo/apple.env` (`APPLE_TEAM_ID=…`); `eas credentials` → Android
      signing SHA-256 → `~/.config/senryo/android.env`; then run the generator and commit the two files
- [ ] **[OK?]** DNS A record `@` → Coolify; Coolify project + `senryo-web` deploy; `.well-known` checks (curl, Apple
      CDN, Google Digital Asset Links)
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

## Handoff
