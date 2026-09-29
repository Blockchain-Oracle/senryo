# Platforms and stores: one codebase for iOS, Android and web

**Researched 29 Sep 2026.** Covers the framework, passkeys on each platform, Apple Pay / Google Pay card provisioning, App Store and Google Play policy (with a route for each restriction), how judges can test the app, and a mobile trading design stack. Items marked **(unverified)** were not confirmed in a primary source. Related: [mera.md](../02-monad/mera.md), [codex-evaluation.md](../07-decision/codex-evaluation.md) ("Wallet provisioning" and "Recommended implementation").

---

## 0. Summary

| Question | Answer |
|---|---|
| Framework | **Expo SDK 57** (stable since 30 Jun 2026; `expo@57.0.26`, React Native 0.86.3, React 19.2.3, `react-native-web ~0.21`) with **Expo Router** and **EAS Build**. SDK 58 (RN 0.88) is in beta (`58.0.0-preview.8`). Mera's own mobile demo is on Expo `~57.0.12`. |
| Dev loop | **Development build** (`expo-dev-client`). **Expo Go won't work**, because Mera needs `react-native-passkey` (native code) and SecureStore biometrics need `NSFaceIDUsageDescription`. |
| Passkeys | One **rpId** (for example `example.com`) shared by web, iOS and Android. iOS: `webcredentials:` associated domain plus an AASA file. Android: `assetlinks.json` with `get_login_creds` plus **every** signing-cert SHA-256 (EAS keystore **and** Play App Signing key). Web: Mera's default browser client. Native: `reactNativeWebAuthnClient` (wraps `react-native-passkey` 3.6.x). PRF needs iOS 18+ / Android 9+. |
| Card to Wallet | In-app push provisioning is **issuer-gated** on both platforms: Apple's `com.apple.developer.payment-pass-provisioning` entitlement (requested by the Account Holder via Apple's form; production Team ID only; testable only through TestFlight/App Store) and Google's private TapAndPay SDK plus the Push Provisioning API (request access). RN library: **`@expensify/react-native-wallet`** (MIT, Expo plugin, both platforms). The fallback is a **manual add in the Wallet app**, which Rain publicly documents. |
| Store policy | Apple 3.1.5(iv): crypto **futures** trading apps "must come from established banks, securities firms, futures commission merchants… or other approved financial institutions". Apple 3.2.1(viii) and 3.2.2(viii) require licensing for trading and derivatives/FX. Apple 3.1.5(i) and 5.1.1(ix), and Google Play, require an **organization** account (D-U-N-S). Google Play's crypto policy scopes out **non-custodial wallets**, but country licensing applies to exchanges. |
| Judge channels | (1) **Expo web URL** (no install; PRF works in Safari 18+ and in Chrome with Google Password Manager). (2) **Android APK link** from EAS internal distribution. (3) iOS **internal TestFlight** (no review; judges added as App Store Connect users) or EAS **ad hoc** (register judges' device UDIDs). A TestFlight **public link** needs Beta App Review. |
| Charts | Candles: TradingView **Lightweight Charts** on web, and on native through an Expo **DOM component** (`'use dom'`, WebView). Native-first alternative: **react-native-wagmi-charts** (line and candlestick; web "experimental"). Sparklines and area charts: **Skia** (`victory-native` / `react-native-graph`). Haptics: `expo-haptics`. |

---

## 1. Framework: Expo / React Native

### 1.1 Versions (npm registry, 29 Sep 2026)
- `expo` latest = **57.0.26** (`sdk-57` tag); `57.0.0` published 2026-06-30. The `next` tag is `58.0.0-preview.8` (2026-09-28). [npm expo](https://www.npmjs.com/package/expo), [SDK 57 changelog](https://expo.dev/changelog/sdk-57), [SDK 58 beta](https://expo.dev/changelog/sdk-58-beta)
- SDK 57 `bundledNativeModules.json` pins: `react-native 0.86.3`, `react 19.2.3`, `react-dom 19.2.3`, `react-native-web ~0.21.0`, `expo-router ~57.0.24`, `react-native-reanimated 4.5.1`, `react-native-worklets 0.10.1`, `react-native-gesture-handler ~2.32.0`, `@shopify/react-native-skia 2.6.2`, `react-native-webview 13.16.1`, `expo-haptics ~57.0.3`, `expo-secure-store ~57.0.4`, `expo-local-authentication ~57.0.3`, `expo-crypto ~57.0.3`, `react-native-svg 15.15.4`, `@shopify/flash-list 2.0.2`. Use `npx expo install` so these pins are respected.
- SDK 57 = RN 0.86, "no breaking changes from 0.85". SDK 58 beta targets RN 0.88 and iOS 27's required scene-based lifecycle; its stable release follows RN 0.88. [SDK 57](https://expo.dev/changelog/sdk-57), [SDK 58 beta](https://expo.dev/changelog/sdk-58-beta)
- Mera demo app: `expo ~57.0.12`, `react-native 0.86.2`, `react-native-passkey 3.6.1`, `expo-secure-store`, `expo-crypto`, `viem`. Local copy: `references/mera/demos/mobile/package.json`.

### 1.2 Development builds vs Expo Go
- Expo Go supports "only libraries within the Expo SDK" and is "not suitable for custom native dependencies". Development builds give "full support for any third-party library, including those that require custom native code". [Expo: development builds](https://docs.expo.dev/tutorial/eas/configure-development-build)
- Mera RN requires "an Expo **development build** (Expo Go won't work)" ([mera.md](../02-monad/mera.md)). SecureStore's `requireAuthentication` "is not supported in Expo Go when biometric authentication is available due to a missing `NSFaceIDUsageDescription` key". [expo-secure-store](https://docs.expo.dev/versions/latest/sdk/securestore/)
- Route: create `development` (`developmentClient: true`, `distribution: internal`) and `development-simulator` profiles. Use `npx expo prebuild` / `expo run:ios --device` locally, or `eas build --profile development`. [EAS dev builds](https://docs.expo.dev/eas/workflows/examples/create-development-builds)

### 1.3 EAS Build: iOS, Android APK vs AAB
- **AAB is the default** Android output: "optimized for distribution to the Google Play Store. However, AABs can't be installed directly on your device." [Expo: Build APKs](https://docs.expo.dev/build-reference/apk/)
- **APK:** set `android.buildType: "apk"`, a Gradle `assemble*` command, `developmentClient: true`, or `distribution: "internal"` (internal distribution switches the default to APK). [Expo: APK](https://docs.expo.dev/build-reference/apk/), [internal distribution](https://docs.expo.dev/build/internal-distribution)
- **iOS internal distribution** uses ad hoc (or enterprise) provisioning. EAS builds a profile with an allow-list of device UDIDs; add devices with `eas device:create` and rebuild. Internal build URLs are open to anyone with the link unless you disable "Unauthenticated access to internal builds". [Expo: internal distribution](https://docs.expo.dev/build/internal-distribution)
- Suggested `eas.json`:
```json
{
  "build": {
    "development": { "developmentClient": true, "distribution": "internal" },
    "preview":     { "distribution": "internal", "android": { "buildType": "apk" } },
    "production":  { "autoIncrement": true }
  },
  "submit": { "production": {} }
}
```
`production` gives an AAB for Play and an App Store build for TestFlight (`eas submit`).

### 1.4 Expo Router and web export
- `web.output`: `single` (SPA, default), `static` (HTML per route, Expo Router only), or `server` (adds API routes). Export with `npx expo export -p web` and host on EAS Hosting or any static host. [Expo: publishing websites](https://docs.expo.dev/guides/publishing-websites), [app config `web.output`](https://docs.expo.dev/versions/latest/config/app)
- Platform-specific modules: `file.web.tsx` / `file.native.tsx` (or `.ios`/`.android`), resolved by Metro. [Expo Router platform-specific modules](https://docs.expo.dev/router/advanced/platform-specific-modules)
- **The web host must also serve** `/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json` on the rpId host, over HTTPS with **no redirect**. With a static export, put them in the served `public/.well-known/` folder and check that the host returns JSON (a correct content-type is recommended; (unverified) whether each host sets it automatically).

### 1.5 What does not work on web (plan `.web.tsx` alternatives)
| Feature | Native | Web route |
|---|---|---|
| `react-native-passkey` / Mera `reactNativeWebAuthnClient` | ✓ | Use Mera's **default browser client** (`navigator.credentials`), same rpId. |
| `expo-secure-store` (biometric-gated PRF cache) | Android, iOS, tvOS only ([docs](https://docs.expo.dev/versions/latest/sdk/securestore/)) | Don't persist the PRF output. Re-prompt the passkey, keep the session in memory, `end()` on idle ([mera.md](../02-monad/mera.md)). |
| `expo-local-authentication` | ✓ | The passkey prompt itself is the biometric gate. |
| Apple Pay / Google Pay **push provisioning** | ✓ (entitlement-gated) | Not possible on web. Show the card details/PAN reveal (issuer-dependent) and "open Wallet on your phone". |
| `expo-haptics` | ✓ | Web via the Vibration API only: Chrome Android yes, **Safari iOS no**, Firefox Android disabled (MDN BCD 8.1.3). Treat as a no-op. |
| Skia | ✓ | Works via CanvasKit WASM (**2.9 MB gzipped**, loaded async with `LoadSkiaWeb`/`WithSkiaWeb`). [Skia web](https://shopify.github.io/react-native-skia/docs/getting-started/web) |
| Android WebView PRF | ✗ (`webview_android` PRF = not supported, MDN BCD) | Never do passkey ceremonies inside a WebView or DOM component. Use native ceremonies. |

### 1.6 Alternatives
No alternative is clearly better for "iOS + Android + web from one codebase with native passkeys and PassKit". Capacitor has push-provisioning plugins (`@matiasfic/push-provisioning-capacitor-plugin`), but Mera's published mobile adapter targets React Native. Stay on Expo.

---

## 2. Passkeys on each platform (one passkey everywhere)

**Principle:** Mera derives the account from `PRF(credential, rpId, salt)`. The same passkey plus the same rpId plus the same salt gives the **same address** on every device that syncs that passkey. "**The rpId is the account.**" Pick the final domain before onboarding and consider the parent domain. [mera.md](../02-monad/mera.md)

### 2.1 Choosing the rpId
- Use the apex, e.g. `example.com`. The web app may live at `app.example.com`, because WebAuthn allows an rpId that is a registrable suffix of the origin (W3C WebAuthn spec). Native apps link to that same host.
- Serve both files at `https://example.com/.well-known/…` with no redirects. A Vercel preview URL is a **different rpId** and so gives **different accounts**.

### 2.2 iOS (Face ID)
- Associated Domains entitlement `webcredentials:example.com`, plus AASA JSON `{"webcredentials":{"apps":["TEAMID.bundle.id"]}}`. "You must host the file using https:// with a valid certificate and with no redirects." Since iOS 14, devices fetch AASA through an **Apple-managed CDN**, not directly from your server, so changes can lag. [Apple: Supporting associated domains](https://developer.apple.com/documentation/xcode/supporting-associated-domains)
- Expo: `ios.associatedDomains: ["webcredentials:<rpId>"]` in app config, as in Mera's `demos/mobile/app.config.ts`.
- PRF on native iOS needs **iOS 18+** (`react-native-passkey` README: "As of version 3.3 the PRF extension will work for Android and iOS 18+"; Mera: iOS 18+). [react-native-passkey](https://github.com/f-23/react-native-passkey)
- Face ID is shown by the system passkey sheet. `NSFaceIDUsageDescription` is needed for **SecureStore/LocalAuthentication** unlocks (Mera's demo sets `faceIDPermission` through the `expo-secure-store` plugin). Whether the passkey sheet alone needs it: (unverified; no primary source found).
- Associated Domains needs a paid Apple Developer Program membership (unverified that free "Personal Team" signing lacks it; widely reported).

### 2.3 Android (fingerprint / screen lock)
- `react-native-passkey` uses **Credential Manager** (`GetCredentialRequest`), with native passkeys on **Android API 28+** (Android 9). [react-native-passkey](https://github.com/f-23/react-native-passkey), [Android: create passkeys](https://developer.android.com/identity/passkeys/create-passkeys)
- Digital Asset Links: `assetlinks.json` with `delegate_permission/common.get_login_creds`, `package_name`, `sha256_cert_fingerprints`. "Include all signing certificates (debug, release, Play App Signing)." [Android: create passkeys](https://developer.android.com/identity/passkeys/create-passkeys), [Mera RN recipe](https://github.com/category-labs/mera) (`docs/.../use-mera-with-react-native.md`)
- **In practice for us, list three fingerprints:** (1) the EAS-managed upload/APK keystore (`eas credentials`), (2) the **Play App Signing** key from Play Console (Play re-signs AAB installs), (3) a local debug keystore if you use one. A missing fingerprint gives a `BadConfiguration` error in `react-native-passkey`.
- PRF provider: Google Password Manager on Android ✓ (Mera authenticator table). Third-party providers vary.
- Native Android assertions carry origin `android:apk-key-hash:<b64url sha256>`, not `https://…`. Mera only uses the PRF output client-side, so this matters only if we add server-side WebAuthn verification.

### 2.4 Web (WebAuthn PRF)
MDN browser-compat-data 8.1.3 (2026-09-24), PRF extension:

| Browser | `create()` PRF | `get()` PRF | Notes |
|---|---|---|---|
| Chrome / Edge desktop | 116+ | 116+ | Only passkeys in **Google Password Manager** carry PRF. A local Chrome profile gives `PRF_UNAVAILABLE` (Mera's "#1 setup failure"). |
| Chrome Android | 116+ | 116+ | ✓ with GPM (Mera tested). |
| Safari macOS / iOS | 18+ | BCD says **not supported** ([webkit bug 259934](https://webkit.org/b/259934)) | **Conflict:** Mera reports a live ✓ create+get cycle with iCloud Keychain on Safari 18 / iOS 18 and macOS 15. Trust the tested result, but test on the judges' iOS versions. |
| Firefox desktop | 139+ | 139+ | Mera: ✓ Firefox 139+ macOS; Windows needs Win 11 25H2 + Firefox 148+. |
| Firefox Android | 149+ | **not supported** | Direct users to Chrome. |
| Android WebView | ✗ | ✗ | No PRF in WebViews, so no passkey flows inside in-app browsers or DOM components. |

Sources: [MDN WebAuthn extensions](https://developer.mozilla.org/en-US/docs/Web/API/Web_Authentication_API/WebAuthn_extensions), `@mdn/browser-compat-data` 8.1.3, [Mera authenticator support](https://mera.category.xyz/authenticator-support).

### 2.5 Libraries that work in Expo
| Library | Platforms | PRF | Use |
|---|---|---|---|
| `@category-labs/mera` 0.2.0 + `@category-labs/mera/react-native-webauthn-client` | web, Chrome ext, RN (iOS 18+/Android 9+) | ✓ (core feature) | **Use this.** Pass `webAuthnClient: reactNativeWebAuthnClient` on native and omit it on web. |
| `react-native-passkey` 3.6.2 (f-23) | iOS 15+, Android API 28+ | ✓ Android and iOS 18+ | Mera's native dependency; trusted code in Mera's security model. |
| `react-native-passkeys` 0.4.2 (peterferguson) | iOS 15+, Android (compileSdk 34+), **web**; an Expo module | PRF not documented | Not needed; Mera already covers web. |

Setup (from Mera): `npm i @category-labs/mera react-native-passkey viem @scure/bip32 @scure/bip39 && npx expo install expo-crypto`, polyfill `crypto.getRandomValues` from `expo-crypto` **before** importing Mera (Hermes lacks it), and cache the PRF output **only** in SecureStore with biometric protection. [Mera RN recipe](https://github.com/category-labs/mera)

**Code split:**
```ts
// passkey.native.ts
export { reactNativeWebAuthnClient as webAuthnClient } from "@category-labs/mera/react-native-webauthn-client";
// passkey.web.ts
export const webAuthnClient = undefined; // Mera uses navigator.credentials
```

---

## 3. Apple Pay / Google Pay card provisioning

### 3.1 Apple: in-app push provisioning
- API: `PKAddPaymentPassViewController` ("lets users add cards to Apple Pay from within your app"; `canAddPaymentPass()`, `PKAddPaymentPassRequestConfiguration`, delegate returns certificates + nonce + nonceSignature). [Apple docs](https://developer.apple.com/documentation/passkit/pkaddpaymentpassviewcontroller)
- Entitlement: `com.apple.developer.payment-pass-provisioning`. Per Apple's issuer guide:
  - Eligible: payment card **issuers** with signed Apple agreements and existing Apple Pay support.
  - Request via the "In-App Provisioning" submission form, <https://developer.apple.com/contact/request/apple-pay-in-app-provisioning/>. "Only Account Holders can access this form."
  - "Only a production Team ID and Adam ID can receive the entitlement… Apple doesn't grant entitlement to test Team IDs." Ad hoc profiles are not supported, so test "through TestFlight after the necessary approvals" or the App Store.
  - [Apple Pay demo: In-App Provisioning](https://applepaydemo.apple.com/in-app-provisioning)
- **What the issuer (Rain / its BIN sponsor / TSP) must provide:** a backend that takes Apple's certificates, nonce and nonceSignature, then returns `encryptedPassData`, `activationData` (a payment-network-defined OTP) and `ephemeralPublicKey` (65-byte uncompressed, `04…`). It must also have the card's BIN enabled for Apple Pay through the network token service (Visa VTS for a Visa card). [Apple Pay demo](https://applepaydemo.apple.com/in-app-provisioning), [codex-evaluation.md](../07-decision/codex-evaluation.md)
- Optional: **In-App Provisioning Extensions** let the card appear inside the Wallet app's add-card flow. They use the same issuer approval path. [Apple Pay demo: extensions](https://applepaydemo.apple.com/in-app-provisioning-extensions) (details not captured, (unverified)).

### 3.2 Google: Push Provisioning API
- Google's "Unified Android Push Provisioning API" docs are **access-gated** ("If you are an authorized partner who needs access, use the following button to request access"). [Google Pay issuers: push provisioning](https://developers.google.com/pay/issuers/apis/push-provisioning/android), [request access](https://developers.google.com/pay/issuers/request-access)
- The card is handed to Google as a **Google Opaque Payment Card (OPC)**: "an encrypted and signed (using PGP) payment card object for client-side push provisioning", created **server-side by the issuer**. [OPC spec](https://developers.google.com/pay/issuers/apis/push-provisioning/android/push-provisioning-google-opc)
- The app needs the private **TapAndPay SDK** and allow-listing of package name + SHA-256 (use the Play App Signing cert for Play builds). Android inputs: OPC, TSP (VISA/MASTERCARD), token reference ID. [Expensify react-native-wallet](https://github.com/Expensify/react-native-wallet)

### 3.3 React Native libraries for push provisioning
| Package | Status | Notes |
|---|---|---|
| **`@expensify/react-native-wallet`** 0.1.25 (2026-09-22) | Active, **MIT** | Apple + Google. `addCardToAppleWallet`, `addCardToGoogleWallet`, `checkWalletAvailability`, `getCardStatusBySuffix/ByIdentifier`, `listTokens` (Android), `<AddToWalletButton>`. **Has an Expo config plugin** (enables the entitlement and sets the TapAndPay SDK path). [GitHub](https://github.com/Expensify/react-native-wallet) |
| `@exodus/react-native-wallet` 0.1.19, `@dbracamonte/react-native-wallet` | Forks of the above | [npm](https://www.npmjs.com/package/@exodus/react-native-wallet) |
| `@weavr-io/push-provisioning-react-native` 4.1.2 | Tied to the Weavr issuer | [Weavr docs](https://docs.weavr.io/sdks/react-native/push-provisioning/implementation/) |
| `react-native-wallet` 1.0.8, `react-native-passkit-wallet` | Last updated 2022 | Avoid. |

### 3.4 What we need from Rain (open questions)
Rain publicly says its cards work with Apple Pay and Google Pay. Its Apple Pay article describes only the **manual** route: "open the Apple Wallet app, tap + to add your card… enter the card details or capture an image". No public Rain page documents push provisioning, an SDK, or the Apple entitlement path. Crossmint's Rain integration guide lists Rain issuing endpoints (`/issuing/users/{id}/cards` etc.) but no wallet provisioning. [Rain: Apple Pay](https://www.rain.xyz/resources/apple-pay-with-rain), [Rain cards](https://rain.xyz/cards), [Crossmint + Rain](https://docs.crossmint.com/wallets/guides/wallet-extensions/credit-cards)

Ask Rain:
1. Is our BIN/program tokenization-enabled for Apple Pay and Google Pay in our target countries?
2. Does Rain (or the BIN sponsor) expose Apple `encryptedPassData`/`activationData` and a Google OPC endpoint to partner apps?
3. Will Rain or the issuer sponsor our app for Apple's in-app provisioning allow-list (Adam ID + Team ID) and Google's TapAndPay allow-list?
4. What is the ID&V/activation flow for manual adds (OTP via SMS/email/app)?
5. Is there a sandbox?

### 3.5 Route
1. **Now:** card issued via the Rain sandbox. The in-app "Add to Apple Wallet / Google Wallet" screen shows step-by-step manual-add instructions (Wallet app → + → Debit or Credit Card) and a secure card-detail reveal, if Rain supports it.
2. **When Rain confirms provisioning:** add `@expensify/react-native-wallet` with its Expo plugin. The backend proxies Rain's provisioning endpoints. Request the Apple entitlement (Account Holder form) and Google access. Test on TestFlight (not ad hoc) and in a Play internal track.
3. **Web:** no Wallet provisioning. Show "Add to Wallet on your phone" with a deep link or QR code to the app.

---

## 4. App Store and Google Play policy, with routes

### 4.1 Apple App Review Guidelines (current page, retrieved 29 Sep 2026)
[Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- **3.1.5(i) Wallets:** "Apps may facilitate virtual currency storage, provided they are offered by developers enrolled as an organization."
- **3.1.5(iii) Exchanges:** allowed "only in countries or regions where the app has appropriate licensing and permissions to provide a cryptocurrency exchange."
- **3.1.5(iv):** "Apps facilitating Initial Coin Offerings ('ICOs'), **cryptocurrency futures trading**, and other crypto-securities or quasi-securities trading must come from established banks, securities firms, futures commission merchants ('FCM'), or other approved financial institutions and must comply with all applicable law."
- **3.2.1(viii):** "Apps used for financial trading, investing, or money management should be submitted by the financial institution performing such services and must have necessary licensing and permissions in the locations where you make them available."
- **3.2.2(viii):** binary options not permitted ("Consider a web app instead"). "Apps that facilitate trading in contracts for difference ('CFDs') or other derivatives (e.g. FOREX) must be properly licensed in all jurisdictions where the service is available."
- **5.1.1(ix):** highly regulated fields ("banking and financial services… crypto exchanges") "should be submitted by a legal entity that provides the services, and not by an individual developer."
- **2.3.1(a):** no "hidden, dormant, or undocumented features"; new functionality must be described in Review Notes. So **do not hide trading from review**.
- **2.1:** provide a demo account or fully featured demo mode.
- **3.2.2(v):** "Arbitrarily restricting who may use the app, such as by location" is unacceptable. Location restriction must therefore be **legally grounded** (licensing or sanctions), and the reason should be stated in Review Notes.
- **4.7 / 2.5.2:** code that changes features can't be downloaded. Web content inside the app falls under mini-app rules. Don't rely on a WebView to "sidestep" review.

**Organization enrollment:** legal entity (no DBAs), **D-U-N-S number**, binding authority, a domain email and a working public website; USD 99/yr. The organization name becomes the App Store seller name. [Apple enroll](https://developer.apple.com/programs/enroll/)

### 4.2 Google Play
- **Account type:** choose Organization if you provide "Financial products and services, including but not limited to banking, loans, stock trading, investment funds, cryptocurrency software wallets, and cryptocurrency exchanges." Organizations need a **D-U-N-S number**. [Play: account types](https://support.google.com/googleplay/android-developer/answer/13634885?hl=en)
- **Financial Services policy:** comply with local law in each target country; **any app with financial features must complete the Financial features declaration** in Play Console. Binary options are banned. Personal-loan rules (APR ≤ 36% in US, no ≤ 60-day loans, no contacts/photos permissions) apply to personal loans, and credit cards / revolving lines are listed as not included. Google "must be able to establish a connection between your developer account and any provided licenses". [Play: Financial Services](https://support.google.com/googleplay/android-developer/answer/9876821?hl=en)
  - Our card's borrow-to-spend design (see codex-evaluation) should be declared accurately. Whether Google classifies it as a "line of credit" for the declaration is (unverified); answer the form truthfully.
- **Blockchain-based Content policy:** "The purchase, holding, or exchange of cryptocurrencies should be conducted through certified services in regulated jurisdictions." Google may request licensing documents. Tokenized digital assets must be declared, and apps must not "promote or glamorize any potential earning from playing or trading activities". [Play: Blockchain-based content](https://support.google.com/googleplay/android-developer/answer/13607354?hl=en)
- **Country requirements for crypto exchanges and software wallets:** **non-custodial wallets are "out of scope"**. Exchanges need, for example: UK FCA registration; US FinCEN + state MTL (or bank charter); EU MiCA CASP (both exchanges **and** wallets; Liechtenstein/Iceland/Norway from July 2026); Japan FSA; South Korea FIU VASP; Canada FINTRAC; Hong Kong SFC types 1+7; Thailand SEC; UAE FSRA/VARA/DFSA; Bahrain CBB; Indonesia OJK; Israel CMISA; Philippines BSP; South Africa FSCA. The page does not mention derivatives. [Play: country requirements](https://support.google.com/googleplay/android-developer/answer/16329703?hl=en)
- **Enforcement is real:** Japan's FSA asked Apple and Google to remove unregistered exchanges (Bybit, KuCoin, Bitget, MEXC, Bitfinex); South Korea (Google notice 28 Jan 2026; Bybit removed); Philippines (Bybit missing from Play by Mar 2026); India (Bybit removed from the App Store). [The Block](https://www.theblock.co/post/339501/japan-apple-google-block-crypto-apps), [crypto.news](https://crypto.news/apple-removes-bybit-kucoin-bitget-from-japans-app-store/), [BitPinas](https://bitpinas.com/business/bybit-playstore-ph/), [Bloomingbit](https://en.bloomingbit.io/feed/news/115971), [CoinTurk](https://en.coin-turk.com/bybits-main-mobile-app-removed-from-apples-app-store-in-india/)
- **New personal accounts** (created after 13 Nov 2023) must run a closed test with **≥12 testers opted in for 14 continuous days** before production. The organization route avoids this personal-account gate. [Play: testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)

### 4.3 How comparable apps are listed (evidence and routes)
| App | What is public | Route it shows |
|---|---|---|
| **Dreamcash** (Hyperliquid front end; crypto + HIP-3 stock/commodity perps, up to 50x) | On the **US App Store**, seller "Supreme Liquid Labs", Finance, 18+; on Google Play (`xyz.dreamcash.app`, 100k+ installs per search snippet). [App Store](https://apps.apple.com/us/app/dreamcash-app/id6748916424), [Play](https://play.google.com/store/apps/details?id=xyz.dreamcash.app) | Organization seller, non-custodial front end, 18+ rating. **How it squares with 3.1.5(iv) is not public (unverified).** Presence in the store is not proof of compliance. |
| **Phantom Perps** (Hyperliquid) | Perps "aren't currently available in the US and UK due to regulatory restrictions"; initial rollout to EU users, geofenced, no KYC. [Phantom help](https://help.phantom.com/hc/en-us/articles/42292249388307-Trade-perps-in-Phantom), [The Block](https://www.theblock.co/post/361533/phantom-wallet-perp-trading-hyperliquid) | An established wallet app adds perps as a **feature**, with in-app geofencing. |
| **MetaMask Perps** (Hyperliquid) | Live in the mobile wallet; unavailable in the US, UK, Ontario, Belgium and sanctioned countries (secondary sources). [The Block](https://www.theblock.co/post/373302/metamask-rolls-out-perpetuals-trading-through-hyperliquid-integration), [Datawallet](https://www.datawallet.com/crypto/metamask-restricted-countries) | Same feature-in-wallet route plus a jurisdiction blocklist. |
| **Base App perps** (Hyperliquid) | Not available in the US, UK, Canada "or other jurisdictions that restrict leveraged crypto derivatives". [Yahoo Finance](https://finance.yahoo.com/markets/crypto/articles/app-unveils-hyperliquid-powered-perps-191158790.html) | Same. |
| **Robinhood** | EU perps (crypto, then commodities/ETFs/FX, up to 10x) under a MiCA + MiFID II-regulated EU setup. [Yahoo Finance](https://finance.yahoo.com/markets/crypto/articles/robinhood-launches-perpetual-futures-europe-155715388.html), [Bitstamp](https://blog.bitstamp.net/post/bitstamp-by-robinhood-announces-general-launch-for-crypto-perpetual-futures-for-institutional-and-retail-investors/) | The fully licensed route, which literally satisfies 3.1.5(iv) and 3.2.1(viii). |
| **Bybit** | Removed country by country where unregistered (see §4.2). | What happens when licensing is missing for a store region. |
| Hyperliquid restriction baseline | Hyperliquid restricts the US, Ontario and sanctioned regions; enforced by interface geofencing (secondary). [Datawallet](https://www.datawallet.com/crypto/hyperliquid-supported-and-restricted-countries) | Mirror the venue's own blocklist. |

### 4.4 Routes for our app (one per restriction)
1. **Organization account on both stores** (Apple 3.1.5(i)/5.1.1(ix); Play account-type rule): form the entity, obtain a D-U-N-S number, set up a domain email and public website, then enroll. The same entity should be the Rain program partner.
2. **Crypto/RWA perps (Apple 3.1.5(iv), 3.2.1(viii), 3.2.2(viii); Play Financial Services):**
   - (a) **Licensed partner as publisher or operator.** The venue or broker that holds the licence (for example a MiFID/MiCA-authorised entity, or an FCM in the US) submits or co-signs the app and supplies licence documents for Review Notes and the Play declaration.
   - (b) **Wallet-first listing with jurisdiction-gated trading.** List the app as a non-custodial passkey wallet + AUSD balance + card, with perps as a disclosed, **geofenced** feature (the Phantom/MetaMask pattern). Put the country list and legal basis in Review Notes, since 2.3.1 forbids hidden features.
   - (c) **Per-country store availability.** In App Store Connect, choose "Specific Countries or Regions" and deselect jurisdictions without permission; do the same in Play country targeting. Removal from a region removes the listing, but prior downloaders keep updates. [ASC availability](https://developer.apple.com/help/app-store-connect/manage-your-apps-availability/manage-availability-for-your-app-on-the-app-store)
   - (d) **Web as the full-feature channel.** Apple itself says "Consider a web app instead" for products it won't host. Expo web runs the same code, with no store gate and the same passkey rpId.
3. **Card (Apple 4.9 Apple Pay marketing / 3.2.1(iv) Wallet uses):** the issuer relationship lives with Rain and its BIN sponsor. Follow the Apple Pay marketing guidelines for "Add to Apple Wallet" artwork. [Apple Pay marketing](https://developer.apple.com/apple-pay/marketing/)
4. **Play declarations:** complete the Financial features declaration and the Data safety form, and declare tokenized digital assets if applicable. Keep licence documents linked to the developer account.
5. **Sanctions/geo:** block at signup (IP + store country + KYC country from Rain KYC) and state it in the Terms of Service.

### 4.5 Test and distribution channels (what judges can use)
| Channel | Review? | Limits | Passkeys work? | Notes |
|---|---|---|---|---|
| **Expo web** (static export on the rpId domain) | None | Any browser | ✓ Safari 18+/iOS 18+, Chrome + GPM, Firefox 139+ desktop | Lowest-friction judge path. No Wallet provisioning or haptics on iOS web. |
| **Android APK** (EAS `preview` profile, install link/QR) | None | Anyone with the link (optionally require Expo login) | ✓ if `assetlinks.json` lists the **EAS keystore** SHA-256 | Judges enable "install unknown apps". |
| Android **developer verification** | — | From **30 Sep 2026**, protections start for installs from participating stores (Google Play, HONOR, OPPO, Galaxy Store, etc.) in Brazil, Indonesia, Singapore and Thailand, on certified Android 7+ devices; **global in 2027**. ADB installs are exempt; power users get an "advanced flow". Full-distribution registration costs $25; a free **Limited Distribution** account covers ≤20 devices. | — | Register the package in Play Console / Android Developer Console now so sideloaded APKs keep working in 2027. [Android verification](https://developer.android.com/developer-verification), [FAQ](https://developer.android.com/developer-verification/guides/faq) |
| **Play internal testing** | Whether internal releases get a policy review: (unverified). New bundles reach testers "within seconds" (Play wording) | ≤100 testers by email list | ✓ (add the **Play App Signing** SHA-256) | Judges give a Google account email. [Play testing](https://support.google.com/googleplay/android-developer/answer/9845334?hl=en) |
| Play closed/open testing | Policy review | Closed: email lists/Google Groups; open: public | ✓ | Needed before production. |
| **TestFlight internal** | **No review** | ≤100 **App Store Connect users** (Account Holder/Admin/App Manager/Developer/Marketing roles) | ✓ | Add judges as ASC users, e.g. Marketing role. Builds last **90 days**. [TestFlight overview](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/) |
| **TestFlight external / public link** | **Beta App Review** against the App Review Guidelines on the first build of a version | ≤10,000 | ✓ | The public link is the easiest for strangers, but the perps policy (§4.1) applies at this review. |
| **EAS ad hoc (iOS)** | None | Registered UDIDs only (`eas device:create`) | ✓ (associated domains work with a distribution/ad hoc profile) | Apple Pay in-app provisioning **cannot** be tested ad hoc. |
| **PWA / home-screen web app** | None | — | ✓ (same as web) | Same export; add a manifest. |

---

## 5. Design system for a mobile trading UI (RN + web)

| Layer | Pick | Why / evidence |
|---|---|---|
| Navigation | **Expo Router** (`~57.0.24`) | File routes on native and web, `.web.tsx` splits. |
| Styling | **NativeWind 4.2.7** (Tailwind on RN + web) or **Unistyles 3.3.0** | Both universal; choose one. **Tamagui 2.7.7** is an all-in-one universal UI kit if you want prebuilt components. |
| Motion/gestures | **Reanimated 4.5.1** + **react-native-worklets 0.10.1** + **Gesture Handler ~2.32** | Required peers of the chart libs below; work on web. |
| Lists | **@shopify/flash-list** (SDK pin 2.0.2) | Order books and trade history. |
| Sheets | **@gorhom/bottom-sheet 5.2.x** | Order-entry sheet (web support (unverified)). |
| Native chrome | `expo-blur`, `expo-glass-effect`, `@expo/ui` (SwiftUI/Compose components, native only) | Native feel on iOS; provide web fallbacks. |
| **Candlestick chart** | **TradingView Lightweight Charts 5.2.1** | Canvas, small bundle. On web, render directly. On native, wrap in an **Expo DOM component** (`'use dom'`, which "re-exports a wrapped react-native-webview"). The license is Apache-2.0 and **requires the TradingView attribution notice and a link to tradingview.com**. [GitHub](https://github.com/tradingview/lightweight-charts), [Expo DOM components](https://docs.expo.dev/guides/dom-components) |
| Native candles alternative | **react-native-wagmi-charts 3.0.1** | Line + candlestick, Reanimated + Gesture Handler + SVG, haptics callbacks; web "currently experimental" (path flicker). [GitHub](https://github.com/coinjar/react-native-wagmi-charts) |
| Sparklines / equity curve | **Skia** (`@shopify/react-native-skia`) via **victory-native 42** (Victory Native XL: peers Reanimated, Gesture Handler, Skia) or **react-native-graph 1.4** | GPU-drawn. On web, Skia loads CanvasKit (2.9 MB gz); stay under 16 WebGL contexts per page. [Victory Native XL](https://github.com/FormidableLabs/victory-native-xl), [Skia web](https://shopify.github.io/react-native-skia/docs/getting-started/web). Victory Native's own web support: (unverified). |
| Haptics | **expo-haptics** `selectionAsync` (scrub), `impactAsync(Light/Medium)` (order ticket steps), `notificationAsync(Success/Error)` (fill/reject), `performAndroidHapticsAsync` (Android-specific) | No-op on iOS web. [expo-haptics](https://docs.expo.dev/versions/latest/sdk/haptics/) |
| Data | `@tanstack/react-query` 5 + WebSocket stream | Same code on all platforms. |

**Native-feel checklist:** 60/120 fps price ticks via Reanimated shared values (not React state); a haptic tick when scrubbing the chart; a sheet-based order ticket with a slider for leverage; a **session label** on RWA quotes (open/closed/stale, per codex-evaluation); Face ID before signing (SecureStore-gated PRF) with an "unlock" rather than a full passkey prompt on each trade (Mera demo pattern); safe-area aware layout; dark theme default.

---

## 6. Build order (platform layer)
1. Buy the final domain, choose the rpId (apex), and deploy the `.well-known` files first.
2. `create-expo-app` (SDK 57) + Expo Router + web output `static`; add Mera with the native/web client split; test create+get on iPhone iOS 18+, Android with GPM, Safari and Chrome desktop.
3. EAS: `development`, `preview` (APK / ad hoc), `production` (AAB / App Store). Put the EAS keystore SHA-256 in `assetlinks.json`.
4. Enroll organization accounts (D-U-N-S). Create the Play app (the Play App Signing SHA-256 goes into assetlinks) and the App Store Connect app (Team ID goes into AASA).
5. Judge channels: web URL + APK link + internal TestFlight (judges as ASC users) + Play internal track.
6. Card: Rain sandbox → manual Wallet add instructions → push provisioning with `@expensify/react-native-wallet` once Rain/Apple/Google approvals exist.
