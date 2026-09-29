# Mera: Passkey-Derived Accounts (2 × $2,500 Monad Foundation bounties)

## Bounties
| Bounty | Prize | Sponsor |
|---|---|---|
| **Best Mera-Powered UX on Monad** | $2,500 | Monad Foundation |
| **Mera: One Passkey, Many Keys** | $2,500 | Monad Foundation |

The Metropolis page (https://monad.xyz/metropolis) lists only these **titles and amounts**. No judging criteria or detailed description were found publicly. Ask in the Monad dev Discord (https://discord.gg/monaddev) or the hackathon channels, and see `../00-hackathon/prizes-and-bounties.md`.

- **"Best Mera-Powered UX"** most likely rewards seedless onboarding, prompt-free signing sessions, and cross-device web↔native account reuse (these are the headline features in the Monad Foundation's announcement).
- **"One Passkey, Many Keys"** matches Mera's core idea: one passkey's PRF output (plus **custom salts as namespaces** and **HD derivation paths**) yields many independent keys. That includes multiple EVM accounts, Solana Ed25519 keys, encryption keys, and secret vaults. Our reading of the title is an inference (unverified).
- **Prior art / competitor:** MonFunded (monfunded.com, a Monad prop-trading app) already markets "one passkey, many keys." Its passkey yields a wallet key, a separate Perpl trading key, and a third key "from a namespace of its own" that never signs but encrypts the user's watchlist and notes. Differentiate from it.

## What Mera is
- A small (~1,600 LOC) **TypeScript library by Category Labs** (the core Monad client developers). It was announced on the Monad blog on 2026-07-30 and in a Category Labs blog on 2026-08-05.
- It uses the **WebAuthn PRF extension** to get **32 deterministic secret bytes** from a passkey. The app derives ordinary keys from those bytes (secp256k1 for EVM, Ed25519 for Solana).
- The resulting accounts are **plain EOAs**. There's no smart account, bundler, MPC, custody backend, or on-chain component, and no chain-specific integration. It works on any chain; Monad is the showcase.
- **This is NOT on-chain P256 verification.** Monad's `0x0100` P256 precompile is the *other* approach, where a smart account verifies passkey signatures on-chain. Mera sidesteps it. You *could* combine them, for example a Mera EOA plus an EIP-7702-delegated smart account with a P256 session signer (idea, unverified).
- Status: **preview, API may change before 1.0.** Category Labs completed an internal security review. Runtime deps are only `@noble/*` and `@scure/*`. Dual-licensed Apache-2.0 / MIT.
- npm: `@category-labs/mera` (latest **0.2.0**, published 2026-08-12; 0.1.0 was 2026-07-23). 0.2.0 added React Native.
- Platforms: web browsers, Chrome extensions, and React Native (iOS 18+, Android 9+).

## Links
- Docs: https://mera.category.xyz/ (getting-started, concepts, recipes, reference, authenticator-support)
- Demo: https://mera.category.xyz/demo/ (a fictional "Nad Computer" trading app). PRF model demo: https://mera.category.xyz/prf-demo/
- Repo: https://github.com/category-labs/mera (`library/`, `demos/{web,extension,mobile,prf,shared}`, `docs/`; has `AGENTS.md` and `CLAUDE.md`, so point your coding agent at the repo)
- Monad docs guides: https://docs.monad.xyz/guides/mera and https://docs.monad.xyz/guides/mera/react-native
- Blogs: https://monad.xyz/blog/introducing-mera and https://www.category.xyz/blogs/mera-crypto-onboarding-with-only-a-passkey-on-any-network

## How it works
```
passkey ceremony (Face ID / Touch ID / security key, user verification ALWAYS required)
  └─ PRF(credential, rpId, salt) → 32 bytes   (same bytes on every synced device)
       ├─ app-chosen derivation, e.g. BIP-39 entropy → seed → BIP-32 m/44'/60'/0'/0/i  → EVM keys
       │                                               SLIP-0010 m/44'/501'/0'/0'     → Solana key
       └─ or use as AES-256-GCM key (secret vault) to encrypt an existing seed/private key
signing session holds the private key in memory → signs with no further prompts until end()
```
- Default salt: `sha256("mera.prf.salt.v1")`. It is fixed forever, so other implementations can reproduce it. **Pass a custom 32-byte `prfSalt` for separate namespaces.** Each salt gives an unrelated 32-byte root from the *same* passkey ("salts are namespaces"). This is the most direct way to get "many keys."
- The derivation is BIP-39 compatible: the exported 24-word mnemonic imports into MetaMask or Rabby and yields the same address.

## API surface (v0.2.0)
| Function | Purpose |
|---|---|
| `createPasskeyWithPrfOutput({ rp:{id,name}, user:{name,displayName}, prfSalt?, timeout?, webAuthnClient? })` | Creates a discoverable, UV-required passkey (ES256/RS256) and returns `{ credentialId, transports, prfOutput }`. Some authenticators need a second prompt as a fallback assertion. **Every call creates a new passkey** (random 32-byte user handle), so it produces different accounts. |
| `getPasskeyPrfOutput({ rpId, credential?, prfSalt?, timeout?, webAuthnClient? })` | Sign-in. Returns `{ credentialId, prfOutput }`. Without `credential`, the user chooses any discoverable passkey for the rpId. |
| `createSecp256k1SigningSession({ privateKey })` / `createEd25519SigningSession` | Holds a copy of the key. `end()` zeroes it permanently. Supports `using`. |
| `toViemAccount(session)` (from `@category-labs/mera/viem`) | Returns a viem `LocalAccount` (sendTransaction, signMessage, signTypedData, and so on). |
| `getEvmAddress(pubKey)` / `getSolanaAddress(pubKey)` | Address helpers. |
| `createSecretVaultWithNewPasskey` / `createSecretVaultWithExistingPasskey` / `decryptSecretVaultWithPasskey` / `parseSecretVault` | Encrypt an existing secret under a passkey. Vault JSON v1: `{version, credential:{credentialId,transports}, prfSalt, nonce, ciphertext}`, with a fresh random salt per vault. |
| `reactNativeWebAuthnClient` (from `@category-labs/mera/react-native-webauthn-client`) | For RN. Uses `react-native-passkey`. |
| `isMeraError(e)` → `e.code` | `PRF_UNAVAILABLE`, `PASSKEY_OPERATION_FAILED`, `CRYPTO_UNAVAILABLE`, `SESSION_ENDED`, `DECRYPT_FAILED`, `INPUT_INVALID`, `VAULT_FORMAT_INVALID` |

## Copy-paste: web + Monad
```sh
npm install @category-labs/mera viem @scure/bip32 @scure/bip39
```
```ts
import { createPasskeyWithPrfOutput, getPasskeyPrfOutput, createSecp256k1SigningSession, isMeraError } from "@category-labs/mera";
import { toViemAccount } from "@category-labs/mera/viem";
import { HDKey } from "@scure/bip32";
import { entropyToMnemonic, mnemonicToSeedSync } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english";
import { createWalletClient, http, parseEther } from "viem";
import { monadTestnet } from "viem/chains";   // or `monad` (143)

function deriveEvmKey(prf: Uint8Array, index = 0) {
  const seed = mnemonicToSeedSync(entropyToMnemonic(prf, wordlist));
  const node = HDKey.fromMasterSeed(seed).derive(`m/44'/60'/0'/0/${index}`);
  if (!node.privateKey) throw new Error("no key");
  return node.privateKey;
}

// Onboarding (once): store only credential metadata. It is not secret.
const created = await createPasskeyWithPrfOutput({
  rp: { id: location.hostname, name: "My Monad App" },
  user: { name: "player@example.com", displayName: "Player One" },
});
localStorage.setItem("app.credential", JSON.stringify({ credentialId: created.credentialId, transports: created.transports }));

// Returning visit
const known = JSON.parse(localStorage.getItem("app.credential") ?? "null") ?? undefined;
const { prfOutput } = await getPasskeyPrfOutput({ rpId: location.hostname, credential: known });

const session = createSecp256k1SigningSession({ privateKey: deriveEvmKey(prfOutput) });
const client = createWalletClient({ account: toViemAccount(session), chain: monadTestnet, transport: http() });
await client.sendTransaction({ to: "0x…", value: parseEther("0.01"), gas: 21_000n }); // explicit gas: Monad bills the limit
// session.end() on sign-out / idle timeout
```

### "Many keys" patterns
```ts
// 1) Many EVM accounts from one root: HD index
const trading = deriveEvmKey(prfOutput, 0), savings = deriveEvmKey(prfOutput, 1);

// 2) Independent namespaces: custom salt → unrelated root (one ceremony per salt)
const salt = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode("myapp.agent-key.v1")));
const { prfOutput: agentRoot } = await getPasskeyPrfOutput({ rpId: location.hostname, credential: known, prfSalt: salt });

// 3) Cross-chain: Solana key from the same root via SLIP-0010 m/44'/501'/0'/0' + createEd25519SigningSession

// 4) Non-signing key: use a namespace's PRF output as an AES key to encrypt user data (MonFunded's "key that never signs")
```
Hackathon ideas that fit "One Passkey, Many Keys" (our suggestions, unverified against the judges' intent):
- **Agent sub-keys:** a passkey-derived owner EOA plus separate derived keys for AI agents. Constrain the agent keys on-chain with an EIP-7702 delegation or a smart-account session-key module, register them with ERC-8004 (Identity Registry `0x8004A169…a432`), and pay per call through x402.
- **Per-app or per-venue trading keys** (a Kuru/Perpl key, a payments key) with one sign-in.
- **Encryption keys** for private notes and messages (social track), with **cross-device** restore on web and native.

## React Native (v0.2.0+)
- Requirements: Node 24+, an Expo **development build** (Expo Go won't work), iOS 18+ / Android 9+, and a PRF-capable provider.
- `npm i @category-labs/mera react-native-passkey viem @scure/bip32 @scure/bip39 && npx expo install expo-crypto`
- Polyfill `crypto.getRandomValues` from `expo-crypto`, because Hermes lacks it.
- **Same `rpId` as the web app** is needed to reuse passkeys. Serve `/.well-known/apple-app-site-association` (`webcredentials.apps: ["TEAMID.bundle"]`) and `/.well-known/assetlinks.json` (`get_login_creds` plus the SHA-256 cert fingerprint) over HTTPS **with no redirect**. Add `associatedDomains: ["webcredentials:<rpId>"]`.
- Pass `webAuthnClient: reactNativeWebAuthnClient` to every ceremony. Store the PRF output only in SecureStore with biometric protection, never in AsyncStorage. See `demos/mobile/src/storage.ts`.

## Chrome extensions
Use an rpId equal to the **extension ID** (extension-only) or a **website host** (shared with web and mobile; needs Chrome 122+ and `host_permissions`). Running the ceremony on an extension page limits you to Chrome's password manager or Apple Passwords. Running it on the website and passing results by `postMessage` supports 1Password, but you must pin the origin and source window.

## Authenticator support (PRF), tested
- ✓ 1Password (any browser); iCloud Keychain (Safari iOS 18+/macOS 15+, Chrome 132+ macOS, Firefox 139+ macOS); Google Password Manager (Chrome Android, Chrome desktop signed-in 132+, Edge Android); Windows Password Manager (Win 11 25H2+ in Edge, Chrome 147+, Firefox 148+); YubiKey 5 (hmac-secret, Chrome 116+); Proton Pass.
- ✗ **Chrome local profile** (the #1 setup failure: the passkey is created but `PRF_UNAVAILABLE` is thrown. The user must save to Google Password Manager, or a password-manager extension intercepted the request); Bitwarden; Dashlane (as of 2026-06-01).
- Requires HTTPS or `localhost`.

## Security model and gotchas (tell the judges you handled these)
- Keys are **software keys in page memory.** Any script on the page (XSS, a malicious dependency) can capture the PRF output or sign with a live session. Weigh session length (UX) against exposure: hold the session for trading, prompt per transaction for rare actions, and `end()` on idle.
- **The rpId is the account.** Changing domains (for example, from a Vercel preview URL to a custom domain) means **different accounts**, and old ones become unrecoverable without an exported mnemonic. **Pick the final domain before users onboard,** and consider `rpId` = the parent domain.
- Losing the passkey (deleted, not synced, provider account lost, or overwritten by the same user handle) means losing the accounts. Offer a mnemonic export while the passkey still works.
- Vaults that share a salt share a key. Mera generates a fresh salt per vault.
- Monad specifics: set **explicit `gas`** (gas limit is billed), and remember the 10 MON reserve-balance rule if you also use EIP-7702 delegation on the derived EOA.

## Where to ask
Monad dev Discord (https://discord.gg/monaddev), GitHub issues on category-labs/mera, or @monad_dev on X. Category Labs says it's "actively looking for teams to try mera and provide feedback," so feedback or PRs may count in your favor.

## Sources
- https://docs.monad.xyz/guides/mera.md, https://docs.monad.xyz/guides/mera/react-native.md
- https://mera.category.xyz/ (+ /getting-started, /concepts/*, /authenticator-support, /recipes/use-mera-with-chrome-extensions)
- https://github.com/category-labs/mera (README, docs/src/content/docs/**)
- https://registry.npmjs.org/@category-labs/mera
- https://monad.xyz/blog/introducing-mera
- https://www.category.xyz/blogs/mera-crypto-onboarding-with-only-a-passkey-on-any-network
- https://monad.xyz/metropolis (bounty titles)
- https://monfunded.com/built-with/ (prior-art usage)
