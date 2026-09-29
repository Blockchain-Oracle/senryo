# Mera: the account layer for our app (Face ID sign-in + Face ID transaction confirmation)

Researched 2026-09-29. Library `@category-labs/mera` **0.2.0** (npm: 0.1.0 on 2026-07-23, 0.2.0 on 2026-08-12, still the latest). Repo HEAD `a3102f4` (2026-08-31).
Sources were read in full:
- Library source: `references/mera/library/src/*` (1,846 LOC)
- Tests: `library/test/*`
- Docs: `references/mera/docs/src/content/docs/**`. This covers every page in the live sitemap at `https://mera.category.xyz/sitemap-0.xml`, one-to-one.
- Demos: `demos/{web,mobile,shared,extension}`
- Monad guides: https://docs.monad.xyz/guides/mera.md and https://docs.monad.xyz/guides/mera/react-native.md
- `references/react-native-passkey` (v3.6.2), Mera's native dependency

Context7 does **not** index Mera (checked 2026-09-29), so the repo docs are the canonical source.
Earlier, shallower notes are in `../02-monad/mera.md`. This file supersedes them for our app.

Legend: "(unverified)" = my inference or an untested claim; everything else is quoted from a cited file or URL.

---

## 0. The 8 things that shape our design

1. **Accounts are plain secp256k1 EOAs.** Their keys are derived from 32 PRF bytes. There's no smart account, no P256 precompile use, no backend. Monad guide: *"The accounts are regular EOAs. There is nothing to deploy, and no bundler or MPC service to run."*
2. **The rpId is the account.** Web, iOS and Android must all use one rpId host. Serve AASA and assetlinks on that host. Freeze the domain before any user signs up.
3. **A signing session has no scope and no expiry in Mera.** It is a key in memory with `end()` (`library/src/session.ts`). *All scoping (allowlist, value caps, TTL, idle lock) is our code.* The bounty judges exactly this ("Session design").
4. **Every Mera ceremony requires user verification** (Face ID). This can't be configured off. Prompt-free = "hold a live session".
5. **Stateless test:** local storage holds only non-secret hints. A discoverable `getPasskeyPrfOutput({ rpId })` with no stored credential rebuilds the same address. App state must come from chain or indexer by address.
6. **A fresh account has 0 MON.** Time-to-first-tx needs a sponsor or faucet drip, or EIP-7702 sponsorship. Set explicit `gas` on Monad, and wait about 3 blocks after funding.
7. **Expo needs a development build** (no Expo Go), iOS 18+ / Android 9+. Hermes needs a `getRandomValues` polyfill. Mera pins `react-native-passkey@3.6.1` as an exact peer dependency.
8. **Recovery = passkey sync** (iCloud Keychain / Google Password Manager / 1Password). Offer a mnemonic export, and optionally a second-passkey vault. Losing the passkey loses the accounts.

---

## 1. Account model

### 1.1 PRF → key derivation
```
Face ID ceremony (WebAuthn get/create, userVerification "required", PRF ext)
  PRF(credential, rpId, salt) → 32 bytes          salt default = sha256("mera.prf.salt.v1")
    → BIP-39 entropyToMnemonic (24 words) → mnemonicToSeedSync (PBKDF2, empty passphrase)
      → BIP-32 m/44'/60'/0'/0/{index}  → secp256k1 private key → EOA address (EIP-55)
        → createSecp256k1SigningSession({ privateKey }) → toViemAccount(session)
```
- `library/src/passkey.ts`: `const DEFAULT_PRF_SALT = sha256(utf8ToBytes("mera.prf.salt.v1"));`. JSDoc: *"The default salt … will not change across library versions. The PRF output is a deterministic function of the credential, `rpId`, and salt; a different salt yields an unrelated output."*
- Mera itself stops at the 32 bytes plus the signing session. **The derivation (BIP-39/BIP-32) is app code.** `AGENTS.md`: *"If a default derivation path is not wallet-interoperable, keep it app-owned rather than baking it into core."* Both the docs and `demos/shared/src/hd.ts` use `entropyToMnemonic(prf) → mnemonicToSeedSync → m/44'/60'/0'/0/i`. hd.ts: *"the same phrase imported into a wallet app such as MetaMask reproduces the same addresses. Changing this mapping would change every derived address."* **We must use exactly this mapping on web and native, forever.**
- Mera evaluates only PRF `first` (one salt per ceremony; see `webauthn.ts` `extensions: { prf: { eval: { first } } }`). A second salt costs a second Face ID prompt. For extra non-signing keys (e.g. encrypting user data), derive them from the same PRF output with HKDF in app code. This needs no extra prompt (unverified design choice, standard crypto).

### 1.2 EOA? Smart account? P256 precompile?
- **EOA.** `toViemAccount` returns a viem `LocalAccount<"mera">` (`library/src/viem.ts`) whose address is `getEvmAddress(session.publicKey)` (keccak of the secp256k1 public key).
- **Monad's P256 precompile (`0x0100`, RIP-7212) is not used.** The passkey's own P-256 key only signs the WebAuthn assertion over a random 32-byte challenge. Mera discards that signature (attestation `"none"`, no server verification). The chain never sees a passkey signature.
- Security consequence (`docs/.../concepts/security-model.mdx`): *"mera produces software keys and not hardware-backed ones. The PRF output and every key derived from it are bytes in the memory of the code that calls mera. Only the passkey private key stays inside the authenticator."* Also: *"A script in that environment … signs with any live session it reaches."*
- Upgrading the EOA: `toViemAccount` implements `signAuthorization` (EIP-7702), so the Mera EOA can delegate to a smart-account implementation (session-key modules, paymasters). This is the "stack composability" bonus route (see §8).

### 1.3 API surface (complete, from `library/src/index.ts`)
| Export | Notes |
|---|---|
| `createPasskeyWithPrfOutput({ rp:{id,name}, user:{name,displayName}, prfSalt?, timeout?, webAuthnClient? })` → `{ credentialId, transports?, prfSalt, prfOutput }` | Discoverable, UV-required, ES256/RS256. **Random 32-byte user handle per call → every call adds a new passkey = new accounts.** *"On authenticators that do not evaluate PRF during creation, a fallback assertion evaluates the same salt and shows a second prompt."* |
| `getPasskeyPrfOutput({ rpId, credential?, prfSalt?, timeout?, webAuthnClient? })` → `{ credentialId, prfOutput }` | Omit `credential` → discoverable picker (any passkey for the rpId). |
| `createSecp256k1SigningSession({ privateKey })` → `{ publicKey, signDigest, end, [Symbol.dispose] }` | Copies the key. `end()` zeroes it and is permanent. Afterwards, `SESSION_ENDED`. |
| `createEd25519SigningSession`, `getSolanaAddress` | Solana (SLIP-0010, app code) |
| `getEvmAddress(publicKey)` | EIP-55 |
| `toViemAccount(session, { nonceManager? })` from `@category-labs/mera/viem` | `signTransaction`, `signMessage`, `signTypedData`, `signAuthorization`, `sign`. *"signing never shows a passkey prompt."* |
| `reactNativeWebAuthnClient` from `@category-labs/mera/react-native-webauthn-client` | Wraps `react-native-passkey` `createPlatformKey`/`getPlatformKey` |
| `WebAuthnClient` (type) | Public extension point: supply your own `createCredential`/`getCredential` |
| `createSecretVaultWithNewPasskey`, `createSecretVaultWithExistingPasskey`, `decryptSecretVaultWithPasskey`, `parseSecretVault` | AES-256-GCM of an existing secret, with a fresh random salt per vault |
| `isMeraError`, `MeraError.code` | `PASSKEY_OPERATION_FAILED`, `CRYPTO_UNAVAILABLE`, `PRF_UNAVAILABLE`, `SESSION_ENDED`, `DECRYPT_FAILED`, `INPUT_INVALID`, `VAULT_FORMAT_INVALID` |

Runtime dependencies are only `@noble/curves`, `@noble/hashes` and `@scure/base`. Peer dependencies: `viem ^2.28.0` (optional) and `react-native-passkey` **`3.6.1` exact** (optional) (`library/package.json`).

**There is no Mera API for session scoping, expiry, gas, funding, recovery, or immediate/conditional mediation.** Don't look for one.

---

## 2. Passkey creation and sign-in per platform

| | Web (Expo web / Next) | iOS (Expo dev build) | Android (Expo dev build) |
|---|---|---|---|
| WebAuthn client | default `browserWebAuthnClient` (`navigator.credentials`) | `reactNativeWebAuthnClient` → `ASAuthorization` platform provider | `reactNativeWebAuthnClient` → Credential Manager (`androidx.credentials 1.6.0`) |
| Min OS for PRF | see §4 table | **iOS 18+** | **Android 9+** (API 28) with a PRF provider |
| Secure context | HTTPS or `localhost` | associated domain | assetlinks |
| rpId | must equal the page host or a registrable suffix of it | `webcredentials:<rpId>` | assetlinks on `<rpId>` |

- The RN client calls `createPlatformKey`, not the general create. Source comment (`react-native-webauthn-client-internal.ts`): *"The general iOS entry point can offer a security key, whose result has no PRF output. Android treats the platform-only flag as a no-op."*
- Error mapping from the mobile demo (`demos/mobile/src/wallet.ts`):
  - `RequestFailed`: *"On a first run that is usually the association files."* (react-native-passkey *"replaces the platform's association error with a misleading message about missing credentials"*)
  - `NoCredentials`: no passkey for this host synced to the device
  - react-native-passkey README adds `NoCreateOption`: *"No credential provider can create a passkey (Android; e.g. no Google account signed in)"*, and `BadConfiguration` for associated domain / asset links problems
- **Double sign-up hazard:** each `create` adds a new passkey and therefore a new account. UX: the primary button is "Continue with Face ID", which runs `getPasskeyPrfOutput` (discoverable). Fall back to create only on `PASSKEY_OPERATION_FAILED` whose cause is "no credentials" (web: `NotAllowedError`, which is ambiguous with cancel; unverified). Label passkeys with a date, as the demos do (`Account ${new Date().toLocaleString()}`), so the picker can tell them apart.

---

## 3. One passkey across web, iOS and Android (rpId setup)

Choose **one host** as rpId, e.g. `ourapp.xyz`. Serve the web app on `ourapp.xyz` or a subdomain such as `app.ourapp.xyz`. WebAuthn lets a page use a registrable parent domain as rpId (standard WebAuthn rule; unverified against Mera docs, which only say *"The relying party ID is the host the passkeys belong to"*).

**Never use a Vercel preview URL as rpId.** Security model: *"after a domain migration, passkey accounts can no longer be reproduced."*

Both files: *"must be public over HTTPS and return JSON without a redirect"* (`docs/.../recipes/use-mera-with-react-native.md`).

`https://<rpId>/.well-known/apple-app-site-association`
```json
{ "webcredentials": { "apps": ["TEAMID.xyz.ourapp.mobile"] } }
```
`https://<rpId>/.well-known/assetlinks.json`
```json
[{
  "relation": ["delegate_permission/common.get_login_creds"],
  "target": {
    "namespace": "android_app",
    "package_name": "xyz.ourapp.mobile",
    "sha256_cert_fingerprints": ["<debug SHA-256>", "<EAS/upload key SHA-256>", "<Play App Signing SHA-256>"]
  }
}]
```
- *"Include every certificate used to sign the app."* Debug fingerprint: `keytool -list -v -keystore android/app/debug.keystore -alias androiddebugkey -storepass android -keypass android` (Monad RN guide). For EAS builds, take the keystore SHA-256 from `eas credentials`. For Play, also add the Play App Signing key (standard Android practice, unverified for Mera).
- Mera's own `docs/public/.well-known/assetlinks.json` lists fingerprint `FA:C6:17:45:…:3B:9C`, the stock React Native template debug keystore, for package `xyz.category.mera.demo`. `https://mera.category.xyz/.well-known/apple-app-site-association` returns **404** (checked 2026-09-29), so the demo host only works for Android debug builds. **We need our own host for iOS.**
- Expo config (from `demos/mobile/app.config.ts`): `ios.associatedDomains: ["webcredentials:<rpId>"]`. Associated Domains needs a paid Apple Developer team (unverified; free personal teams lack the capability). During development, Apple's `webcredentials:<rpId>?mode=developer` bypasses the AASA CDN cache (Apple behaviour, unverified in this project).
- If on Vercel: put the files in `public/.well-known/`. Make sure there's no redirect (apex↔www) and the response is JSON. Mera PR #313 *"Keep .well-known in the docs Pages artifact"* shows that static hosts can silently drop dot-folders.
- Cross-device address mismatch checklist (Monad RN guide): *"Confirm that both apps use the same `rpId`, the same passkey, and the same BIP-44 account index."*

---

## 4. Which providers return PRF (from `docs/.../authenticator-support.md`, tested by Category Labs)

| Authenticator | Where | Status / since |
|---|---|---|
| iCloud Keychain | Safari iOS 18+, Safari macOS 15+, Chrome macOS 15+ (Chrome 132+), Chrome iOS 18+, Firefox macOS (139+) | ✓ |
| Google Password Manager | Chrome Android, Edge Android, Chrome desktop **signed-in** (132+) | ✓ |
| 1Password | any browser with 1Password active (2.26.1 beta / Android 8.10.38 beta, 2024-07) | ✓ |
| Windows Password Manager | Win 11 25H2+ (Edge; Chrome 147+; Firefox 148+) | ✓ |
| YubiKey 5 (hmac-secret) | Chrome 116+ | ✓ |
| Proton Pass | Chrome desktop | ✓ |
| **Chrome local profile** | Chrome desktop | ✗ (2026-06-01) |
| Bitwarden, Dashlane | Chrome desktop | ✗ (2026-06-01) |

- Native: *"Native apps can use PRF on iOS 18 or later and Android 9 or later."* react-native-passkey: *"As of version 3.3 the PRF extension will work for Android and iOS 18+."*
- Desktop Chrome trap: *"only passkeys saved to Google Password Manager carry PRF"*. With "Offer to save passwords and passkeys" off, or a password-manager extension intercepting, *"the passkey exists but returns no PRF output … createPasskeyWithPrfOutput fails"* (`PRF_UNAVAILABLE`).
- Third-party providers inside native iOS apps (e.g. 1Password as an iOS credential provider): PRF there is (unverified). Test on device.
- Cross-device hybrid (QR scan: phone as authenticator for a desktop browser): PRF over hybrid is (unverified). Test before relying on it in the demo.
- Surface `PRF_UNAVAILABLE` with the demo's copy: *"This passkey provider does not support the WebAuthn PRF extension. iOS needs 18 or newer; on Android, Google Password Manager and 1Password both supply it."*

---

## 5. Signing sessions vs re-prompting Face ID

### 5.1 What a session actually is (source-level)
`library/src/session.ts`: the session holds `activePrivateKey` (a copy). `use()` returns it. `end()` does `fill(0)` and sets it to undefined, and later calls throw `SESSION_ENDED`. **That's the entire mechanism.**
- No TTL, no allowlist, no spend limit, no per-call hook. `toViemAccount` signs **any** tx, message, typed data or 7702 authorization without prompting.
- Docs (`concepts/signing-sessions.mdx`): *"Session lifetime is a trade-off between that prompt and the open window. An app that signs frequently may keep the session for a burst of work and end it when the burst finishes. Apps that sign occasionally are better served by holding no session at all."*
- Monad guide offers two patterns:
  - **"Hold the session"**: *"This suits high-frequency workflows like trading … Call `disconnect()` on sign-out, and consider calling it on an idle timeout as well."*
  - **"Prompt per transaction"**: `using session = …` so the key lives only for the send.
- `using` depends on runtime support (*"Support depends on the JavaScript runtime"*). On Hermes, use `try/finally { session.end() }`.

### 5.2 How the mobile demo does "Face ID confirm" without a passkey sheet
`demos/mobile/src/storage.ts` stores the PRF output in `expo-secure-store` with `requireAuthentication: true, keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY`. Reading it shows the OS biometric prompt (Face ID), not the passkey sheet. The address and credentialId are stored **ungated**, so launch renders the portfolio with no prompt.
README: *"A launch reads only the ungated address … The first trade asks for the biometric or device credential, reads the stored PRF output, and derives the signing key; no passkey prompt appears. **Lock** ends the signing session but keeps the stored account. **Sign out** ends the session and removes the stored account. **Export account** asks for the passkey again."*
Monad RN guide: *"Do not store the PRF output in `AsyncStorage` or application logs. End the signing session when the user locks the wallet, signs out, or the app's session expires."*
The web demo does **not** persist PRF output: after a reload it is "locked" and the next trade runs a passkey ceremony (`demos/web/src/account.ts`).

### 5.3 Our session policy (proposal; this is what the bounty grades as "Session design")
| Action | Signing | Prompt |
|---|---|---|
| Place / cancel / modify order (Perpl + our perp engine), within the notional cap | live **trading session** | none |
| Add margin from vault to position, within the cap | live session | none |
| Open app / unlock after idle | SecureStore read (native) or passkey ceremony (web) | 1× Face ID |
| Withdraw off-platform, send to a new address, raise card limit, over-cap trade, EIP-7702 authorization | **step-up**: fresh `getPasskeyPrfOutput` + one-shot session, ended in `finally` | Face ID every time |
| Show recovery phrase | fresh passkey ceremony pinned to the stored credential (demo `revealMnemonic`) | Face ID |

Session rules we implement (all our code):
- **Scope:** allowlist of `to` contracts (Perpl exchange, our vault, AUSD) plus function selectors, `value == 0` and a notional cap. Anything else throws `OutOfScope`, which triggers step-up.
- **Expiry:** absolute TTL (e.g. 30 min) plus idle timeout (e.g. 5 min). `AppState` → background ends the session (the demo clears secrets on `state !== "active"`). Show the visible countdown chip "Trading unlocked · 24:10" and a "Lock" button.
- **Expiry UX:** on `SESSION_ENDED` / TTL expiry, the next trade tap shows one Face ID prompt and then continues the same order. Never lose the order ticket.
- **Stronger, on-chain scoping (bonus, unverified integration):** derive a separate trading key (`m/44'/60'/0'/0/1`) and register it on-chain as a limited agent/session key. Options: a 7702-delegated smart account with a session-key module, or Perpl's own delegate mechanism if it has one (check `agora-ausd-and-perpl.md`). Then even a leaked session key can only trade, not withdraw.

---

## 6. Recovery
- **Primary:** passkey sync (*"iCloud Keychain across Apple devices, Google Password Manager across Android and Chrome, 1Password wherever it runs"*, `concepts/passkeys-and-prf.mdx`).
- **Failure modes** (`concepts/passkey-accounts.md`): *"deleted, not synced, tied to a lost provider account, unavailable under the app's rpId after a domain migration, or overwritten by a second passkey with the same user handle. Recovery then depends on an app-provided export, import, or backup path, taken while the passkey still works."*
- **Export:** a 24-word BIP-39 phrase, which imports into MetaMask/Rabby with the same address. Gate it behind a fresh ceremony. Clear it when the app is backgrounded (demo `TradingScreen.tsx`).
- **Second passkey / cross-ecosystem** (e.g. iPhone user moves to Android): a second passkey gives a *different* PRF, so a different account. To let passkey B open account A, use a vault: `createSecretVaultWithExistingPasskey`/`...WithNewPasskey` encrypts account A's mnemonic under B, and we store the vault JSON on our server. The vault JSON is safe on untrusted storage: AES-GCM plus a per-vault salt, and *"tampering with the stored bytes makes decryption fail."* This is an app design, not a built-in Mera flow.
- A web `localStorage` wipe loses nothing. On iOS, *"SecureStore data may remain after an iOS app is removed and installed again"* (demo README), so check the stored address against a fresh ceremony, as the demo does with `isAddressEqual`.

---

## 7. The bounty's stateless test and how we pass it

Bounty text (`_portal/bounties/monad-foundation-best-mera-powered-ux-on-monad.md`): *"judges clear local storage or open the app on a fresh device mid-demo, and identity/access must fully reconstruct from the passkey (plus untrusted storage if used)."*

Design rules:
1. Client storage holds **only hints**: `credentialId`/`transports`, cached address, UI prefs. Every reader treats "missing" as the normal path.
2. The sign-in path with no stored record is `getPasskeyPrfOutput({ rpId })` (discoverable). Monad guide: *"With a fresh device, `getPasskeyPrfOutput` will prompt the authenticator in a discoverable mode, and the user should be able to choose a previously saved passkey."*
3. All user state is keyed by the derived address and read from chain plus our Envio indexer: AUSD balance, vault collateral, positions, card holds, fills. Never keep it in localStorage/SecureStore alone.
4. Any server-side user data (settings, watchlist, KYC-less profile) is stored **encrypted** under a key derived from the PRF output (HKDF, app code), or with auth by signature from the derived address. The server is then "untrusted storage".
5. Deterministic derivation is identical on web and native (same path, same index 0, same default salt).
6. **Rehearse both variants:**
   - (a) DevTools → clear site data → Continue with Face ID → same address, positions visible
   - (b) a second device on the same iCloud/Google account running the app → same address

   For native, use "Sign out" (clears SecureStore) and a reinstall.
7. Cross-platform proof shot for the demo: create on iPhone app → sign in on Safari/Chrome web → identical address.

---

## 8. Gas and funding a fresh account on Monad

- A new Mera EOA holds 0 MON and can't pay gas. Mera has no gas or sponsorship feature (grep of `library/src`: none). The demos fund via a private network method `demo_fundAccount` on a Foundry/Anvil chain (chainId 31337, `demos/shared/src/network.ts`), **not Monad**.
- **Explicit gas:** Monad guide: *"Monad charges the `gasLimit` you declare, not the gas used. Pass an explicit `gas` value, such as `21_000n` for a native transfer."* For contract calls, `estimateGas` plus a small buffer (e.g. +10%), then pass `gas`.
- **Reserve balance** (`../02-monad/differences-from-ethereum.md` §2):
  - 10 MON per-EOA budget. A tx that lowers the balance below 10 MON via *value* spend reverts, except for an "emptying transaction" (undelegated, no other tx in the last 3 blocks).
  - *"Newly funded account: wait until the funding transaction is 3 blocks old before spending from it."*
  - *"EIP-7702-delegated EOAs can never dip below 10 MON through a transaction that decreases their balance … Gas-sponsored flows where the EOA holds ~0 MON and doesn't send MON out are fine."*
  - Our users trade in AUSD (ERC-20), so value spend is ~0 and the rule mostly bites on MON withdrawals.
- **Route A (fastest to build): sponsor drip.** On first sign-in, our backend (a funded hot wallet, not custody of user funds) sends e.g. 0.2 MON to the new address. The client waits for the receipt plus ~3 blocks (~1.2 s), then sends the first tx. Rate-limit per address/device. Testnet top-ups: https://faucet.monad.xyz/.
- **Route B (bonus "stack composability"): EIP-7702 sponsored.** The user EOA signs a 7702 authorization with `toViemAccount(session).signAuthorization(...)` (supported, `library/src/viem.ts`). A relayer or 4337 paymaster pays gas. Monad 7702 caveats: the 10 MON dip rule above; code running *as* a delegated EOA can't `CREATE`/`CREATE2`. Bundlers/paymasters on Monad: Alchemy, Biconomy, FastLane, Gelato, Openfort, Pimlico, Sequence, thirdweb, ZeroDev (`differences-from-ethereum.md` §10). Specific kit compatibility with a Mera `LocalAccount` is (unverified), but any viem kit that accepts a `LocalAccount` owner should work.
- Time-to-first-tx target: land → 1 Face ID (create) → (drip lands in parallel) → tap "Buy" → confirmed. Monad finalizes in about 0.8 s. Note that `createPasskeyWithPrfOutput` shows **2 prompts** on authenticators that don't evaluate PRF at creation. Which of iCloud/GPM do that is (unverified): measure on our target devices.

---

## 9. Expo compatibility
- **Expo Go: no.** *"Expo Go cannot run this app because it does not include the native passkey module."* Use `npx expo prebuild` + `npx expo run:ios|android` or EAS development builds.
- **Config plugins:** react-native-passkey has **no Expo config plugin**. Autolinking via prebuild is enough. The only config is `ios.associatedDomains` in app config. Add the `expo-secure-store` plugin with `faceIDPermission` (sets the Face ID usage string, `demos/mobile/app.config.ts`).
- **Polyfill:** `expo-crypto` `getRandomValues`, imported first in `index.ts` (*"Hermes ships no CSPRNG"*). The vault functions also need `crypto.subtle`, which isn't polyfilled in the demo. **Treat vaults as web-only unless we add a subtle polyfill** (unverified on Hermes).
- **Versions in the demo:** `expo ~57.0.12`, `react-native 0.86.2`, `react-native-passkey 3.6.1`, `viem 2.55.13`, Node 24+.
- Mera's peer dependency is `react-native-passkey` **exactly `3.6.1`**; the latest is 3.6.2 (2026-09-08: an Android Kotlin/AGP build fix and an iOS no-credential detection fix). Install `react-native-passkey@3.6.1`. If the Android build fails on the Kotlin plugin, use npm `overrides` to 3.6.2 (unverified that Mera behaves identically, but the API is unchanged per its CHANGELOG).
- **Expo web:** `@category-labs/mera/react-native-webauthn-client` imports `react-native-passkey`, so keep it out of the web bundle with platform files (`passkey.native.ts` / `passkey.web.ts`). This is standard Metro platform resolution; bundling behavior on web is (unverified).

---

## 10. Limitations and known issues
- **GitHub issues: none filed** (API check 2026-09-29: `has_issues: true`, and all 8 "open" items are PRs: dependabot bumps plus #338 "Vue 3 passkey wallet demo"). 35 stars. Feedback channel: GitHub issues / Monad dev Discord.
- **Preview status:** 0.x. The docs state no stability promise except the default salt. Pin `0.2.0` exactly.
- Software keys in JS memory: XSS or a malicious dependency can sign with a live session or capture PRF output (security model). Mitigations: strict CSP on web, a minimal dependency surface in the signing path, short sessions.
- *"Mera treats the selected `WebAuthnClient` as trusted. In the included React Native client, the trusted code also includes `react-native-passkey`."*
- Zeroing is *"defense-in-depth … not a guarantee"*. BIP-32 keeps internal node keys until GC (demo comment in `wallet.ts`).
- No immediate/conditional mediation (autofill or silent "has passkey?" check) through Mera. react-native-passkey has `Passkey.getImmediate()`, but Mera's RN client uses `getPlatformKey`. A custom `WebAuthnClient` could add it (unverified).
- `createPasskeyWithPrfOutput`: *"Any failure after the creation ceremony completes leaves the passkey on the authenticator, but the thrown error does not carry its metadata."* That leaves an orphaned passkey in the picker. Handle it by telling the user to "Continue with Face ID" instead.
- Testing: Chrome DevTools virtual authenticator with `hasPrf: true` works (`library/test/passkey.e2e.ts`). Use it for Playwright CI of the web flow.

---

## 11. Copy-paste code (APIs verified against `library/src` 0.2.0)

Install:
```sh
# web + shared
npm i @category-labs/mera@0.2.0 viem @scure/bip32 @scure/bip39 @noble/hashes
# native (Expo)
npm i react-native-passkey@3.6.1
npx expo install expo-crypto expo-secure-store
```

### 11.1 Shared: derivation + session (`src/mera/account.ts`, all platforms)
```ts
import { createSecp256k1SigningSession, getEvmAddress, type Secp256k1SigningSession, type EvmAddress } from "@category-labs/mera";
import { HDKey } from "@scure/bip32";
import { entropyToMnemonic, mnemonicToSeedSync } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";

export const RP_ID = "ourapp.xyz";          // FROZEN. Same on web, iOS, Android.
export const RP_NAME = "OurApp";
export const ACCOUNT_INDEX = 0;              // FROZEN. Same on every platform.

/** PRF output -> BIP-39 -> BIP-32 m/44'/60'/0'/0/i (same mapping as Mera docs and demos). Zeroes seed and prf. */
export function openAccount(prfOutput: Uint8Array, index = ACCOUNT_INDEX): { session: Secp256k1SigningSession; address: EvmAddress } {
  const seed = mnemonicToSeedSync(entropyToMnemonic(prfOutput, wordlist));
  prfOutput.fill(0);
  let privateKey: Uint8Array | undefined;
  try {
    const node = HDKey.fromMasterSeed(seed).derive(`m/44'/60'/0'/0/${index}`);
    if (node.privateKey === null) throw new Error("derivation produced no key");
    privateKey = node.privateKey;
    const session = createSecp256k1SigningSession({ privateKey }); // copies the key
    return { session, address: getEvmAddress(session.publicKey) };
  } finally {
    seed.fill(0);
    privateKey?.fill(0);
  }
}
```

### 11.2 Web sign-up / sign-in (`src/mera/passkey.web.ts`)
```ts
import { createPasskeyWithPrfOutput, getPasskeyPrfOutput, isMeraError, type PasskeyCredentialMetadata } from "@category-labs/mera";
import { RP_ID, RP_NAME, openAccount } from "./account";

const HINT_KEY = "app.credential"; // non-secret hint; safe to lose (stateless test)

function readHint(): PasskeyCredentialMetadata | undefined {
  try { const raw = localStorage.getItem(HINT_KEY); return raw ? JSON.parse(raw) : undefined; } catch { return undefined; }
}

export async function signUp() {
  const created = await createPasskeyWithPrfOutput({
    rp: { id: RP_ID, name: RP_NAME },
    user: { name: "trader", displayName: `OurApp ${new Date().toLocaleDateString()}` },
  });
  localStorage.setItem(HINT_KEY, JSON.stringify({ credentialId: created.credentialId, transports: created.transports }));
  return openAccount(created.prfOutput);
}

/** Works with or without the hint. Without it, the platform shows every passkey for RP_ID. */
export async function signIn() {
  const known = readHint();
  const { prfOutput, credentialId } = await getPasskeyPrfOutput({ rpId: RP_ID, credential: known });
  localStorage.setItem(HINT_KEY, JSON.stringify(known?.credentialId === credentialId ? known : { credentialId }));
  return openAccount(prfOutput);
}

export function explain(e: unknown): string {
  if (!isMeraError(e)) return String(e);
  switch (e.code) {
    case "PRF_UNAVAILABLE": return "Save the passkey to iCloud Keychain, Google Password Manager or 1Password (Chrome's local profile doesn't support it).";
    case "PASSKEY_OPERATION_FAILED": return "Face ID was cancelled or failed. Try again.";
    case "CRYPTO_UNAVAILABLE": return "Open the app over HTTPS.";
    case "SESSION_ENDED": return "Trading locked. Confirm with Face ID to continue.";
    default: return e.message;
  }
}
```

### 11.3 React Native sign-in (`index.ts` polyfill + `src/mera/passkey.native.ts`)
```ts
// src/polyfills.ts — import FIRST in index.ts:  import "./src/polyfills";
import { getRandomValues } from "expo-crypto";
if (typeof globalThis.crypto?.getRandomValues !== "function") {
  Object.defineProperty(globalThis, "crypto", { configurable: true, value: { ...globalThis.crypto, getRandomValues } });
}
```
```ts
// src/mera/passkey.native.ts
import { createPasskeyWithPrfOutput, getPasskeyPrfOutput, type getPasskeyPrfOutput as GetPrf } from "@category-labs/mera";
import { reactNativeWebAuthnClient } from "@category-labs/mera/react-native-webauthn-client";
import { base64urlnopad } from "@scure/base";
import * as SecureStore from "expo-secure-store";
import { RP_ID, RP_NAME, openAccount } from "./account";

const PRF_KEY = "app.prf.v1";          // secret: biometric-gated, this device only
const ACCOUNT_KEY = "app.account.v1";  // non-secret hint: address + credentialId
const GATED = { requireAuthentication: true, keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY, authenticationPrompt: "Unlock trading" };
const UNGATED = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

async function persist(r: GetPrf.Result) {
  await SecureStore.setItemAsync(PRF_KEY, JSON.stringify({ credentialId: r.credentialId, prfOutput: base64urlnopad.encode(r.prfOutput) }), GATED);
}

export async function signUp() {
  const created = await createPasskeyWithPrfOutput({
    rp: { id: RP_ID, name: RP_NAME },
    user: { name: "trader", displayName: `OurApp ${new Date().toLocaleDateString()}` },
    webAuthnClient: reactNativeWebAuthnClient,
  });
  await persist(created);
  const acct = openAccount(created.prfOutput);
  await SecureStore.setItemAsync(ACCOUNT_KEY, JSON.stringify({ address: acct.address, credentialId: created.credentialId }), UNGATED);
  return acct;
}

/** Passkey ceremony (Face ID). No credential => picker offers passkeys synced from web/other devices. */
export async function signIn() {
  const asserted = await getPasskeyPrfOutput({ rpId: RP_ID, webAuthnClient: reactNativeWebAuthnClient });
  await persist(asserted);
  const acct = openAccount(asserted.prfOutput);
  await SecureStore.setItemAsync(ACCOUNT_KEY, JSON.stringify({ address: acct.address, credentialId: asserted.credentialId }), UNGATED);
  return acct;
}

/** Face ID via Keychain (no passkey sheet). Returns undefined if nothing stored => call signIn(). */
export async function unlock() {
  const raw = await SecureStore.getItemAsync(PRF_KEY, GATED);
  if (raw === null) return undefined;
  const { prfOutput } = JSON.parse(raw) as { prfOutput: string };
  return openAccount(new Uint8Array(base64urlnopad.decode(prfOutput)));
}

export async function signOut() {
  await SecureStore.deleteItemAsync(PRF_KEY);
  await SecureStore.deleteItemAsync(ACCOUNT_KEY);
}
```
(`@scure/base` is already a Mera dependency. Add it explicitly to package.json.)

### 11.4 Send a transaction on Monad with viem
```ts
import { toViemAccount } from "@category-labs/mera/viem";
import { createPublicClient, createWalletClient, http, parseEther, erc20Abi, type Address } from "viem";
import { monadTestnet } from "viem/chains"; // mainnet: `monad` (chainId 143); testnet 10143

export async function sendMon(session: Parameters<typeof toViemAccount>[0], to: Address, mon: string) {
  const wallet = createWalletClient({ account: toViemAccount(session), chain: monadTestnet, transport: http() });
  return wallet.sendTransaction({ to, value: parseEther(mon), gas: 21_000n }); // explicit gas: Monad bills gasLimit
}

export async function transferErc20(session: Parameters<typeof toViemAccount>[0], token: Address, to: Address, amount: bigint) {
  const account = toViemAccount(session);
  const pub = createPublicClient({ chain: monadTestnet, transport: http() });
  const wallet = createWalletClient({ account, chain: monadTestnet, transport: http() });
  const est = await pub.estimateContractGas({ account, address: token, abi: erc20Abi, functionName: "transfer", args: [to, amount] });
  const hash = await wallet.writeContract({ address: token, abi: erc20Abi, functionName: "transfer", args: [to, amount], gas: (est * 11n) / 10n });
  return pub.waitForTransactionReceipt({ hash });
}
```

### 11.5 Scoped signing session (our code on top of Mera; Mera has no scope/expiry API)
```ts
import type { Secp256k1SigningSession } from "@category-labs/mera";
import { toViemAccount } from "@category-labs/mera/viem";
import { createWalletClient, http, type Address, type Hex } from "viem";
import { monadTestnet } from "viem/chains";

export type Scope = {
  allowed: Record<Address, Hex[]>;   // lowercase contract => allowed 4-byte selectors
  maxNotional: bigint;               // app-computed notional cap (AUSD 6dp, etc.)
  ttlMs: number;                     // absolute lifetime
  idleMs: number;                    // idle auto-lock
};
export class OutOfScope extends Error {}
export class SessionExpired extends Error {}

export class TradingSession {
  private readonly startedAt = Date.now();
  private lastUsed = Date.now();
  private readonly wallet;
  constructor(private session: Secp256k1SigningSession | undefined, readonly scope: Scope, readonly onEnd: () => void) {
    this.wallet = createWalletClient({ account: toViemAccount(session!), chain: monadTestnet, transport: http() });
  }
  get address() { return this.wallet.account.address; }
  expiresAt() { return Math.min(this.startedAt + this.scope.ttlMs, this.lastUsed + this.scope.idleMs); }
  end() { this.session?.end(); this.session = undefined; this.onEnd(); }

  /** Prompt-free: only allowlisted calls under the cap. Everything else => caller does step-up. */
  async send(tx: { to: Address; data: Hex; gas: bigint; notional: bigint }) {
    if (!this.session || Date.now() > this.expiresAt()) { this.end(); throw new SessionExpired(); }
    const selectors = this.scope.allowed[tx.to.toLowerCase() as Address];
    if (!selectors?.includes(tx.data.slice(0, 10).toLowerCase() as Hex) || tx.notional > this.scope.maxNotional) throw new OutOfScope();
    this.lastUsed = Date.now();
    return this.wallet.sendTransaction({ to: tx.to, data: tx.data, value: 0n, gas: tx.gas });
  }
}

// Wiring (RN): end on background; web: end on visibilitychange/idle.
// AppState.addEventListener("change", s => { if (s !== "active") trading?.end(); });

// Step-up for out-of-scope actions: fresh Face ID ceremony, one-shot session, always ended.
import { getPasskeyPrfOutput } from "@category-labs/mera";
import { openAccount, RP_ID } from "./account";
export async function withStepUp<T>(fn: (s: Secp256k1SigningSession) => Promise<T>, webAuthnClient?: Parameters<typeof getPasskeyPrfOutput>[0]["webAuthnClient"]) {
  const { prfOutput } = await getPasskeyPrfOutput({ rpId: RP_ID, ...(webAuthnClient ? { webAuthnClient } : {}) });
  const { session } = openAccount(prfOutput);
  try { return await fn(session); } finally { session.end(); }
}
```

### 11.6 Deriving the same account on a new device (stateless test path)
```ts
// Nothing in storage (fresh device, or localStorage cleared). Discoverable ceremony => same PRF => same address.
import { getPasskeyPrfOutput } from "@category-labs/mera";
import { openAccount, RP_ID } from "./account";

export async function restoreOnNewDevice(webAuthnClient?: Parameters<typeof getPasskeyPrfOutput>[0]["webAuthnClient"]) {
  const { prfOutput, credentialId } = await getPasskeyPrfOutput({ rpId: RP_ID, ...(webAuthnClient ? { webAuthnClient } : {}) });
  const { session, address } = openAccount(prfOutput);  // same rpId + same passkey + same path/index => same address
  // Rebuild ALL state from chain/indexer by `address` (balances, positions, card holds). Re-cache hints only.
  return { session, address, credentialId };
}
```

### 11.7 First-transaction funding (sponsor drip, Route A)
```ts
// Backend (sponsor hot wallet; holds no user keys). Client then waits ~3 blocks before spending.
import { createWalletClient, createPublicClient, http, parseEther, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { monadTestnet } from "viem/chains";
const sponsor = createWalletClient({ account: privateKeyToAccount(process.env.SPONSOR_PK as `0x${string}`), chain: monadTestnet, transport: http() });
const pub = createPublicClient({ chain: monadTestnet, transport: http() });
export async function drip(to: Address) {
  if ((await pub.getBalance({ address: to })) > parseEther("0.05")) return;
  const hash = await sponsor.sendTransaction({ to, value: parseEther("0.2"), gas: 21_000n });
  const r = await pub.waitForTransactionReceipt({ hash });
  return r.blockNumber; // client: wait until blockNumber >= r.blockNumber + 3n before its first MON-spending tx
}
```

---

## 12. Open items to verify on real devices
1. Prompt count of `createPasskeyWithPrfOutput` on iOS 18 iCloud Keychain (native + Safari) and Android GPM: 1 or 2?
2. PRF from 1Password as an iOS/Android credential provider inside our native app.
3. PRF over hybrid (QR) for the "fresh laptop" stateless variant.
4. Expo SDK version vs react-native-passkey 3.6.1 Android build (Kotlin plugin fix in 3.6.2).
5. Whether Perpl supports a delegated/agent trading key (enables true on-chain session scoping).
