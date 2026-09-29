# Passkeys, P256 & WebAuthn on Monad

> Last researched: 2026-09-28. Track example: "Passkey-native accounts using P256 and WebAuthn, with no seed phrase".
> Related Monad Foundation bounties on the Metropolis page: **"Best Mera-Powered UX on Monad" ($2,500)** and **"Mera: One Passkey, Many Keys" ($2,500)**.

## Overview

A passkey is a WebAuthn credential: a **secp256r1 (P-256)** keypair held in Secure Enclave / Android Keystore / a password manager (iCloud Keychain, Google Password Manager, 1Password) and synced across devices. Two ways to turn a passkey into a Monad account:

| Approach | How | Onchain cost | Example |
|---|---|---|---|
| **A. Passkey *is* the signer** (smart account) | Store P-256 pubkey (x,y) in a smart account; verify WebAuthn assertion onchain via the **P256VERIFY precompile at `0x0100`** | ~6,900 gas precompile + WebAuthn parsing; needs 4337/7702 account | Coinbase Smart Wallet, ZeroDev Kernel, Safe passkey module, OZ `SignerWebAuthn` |
| **B. Passkey *derives* an EOA** (PRF) | WebAuthn **PRF extension** returns 32 secret bytes → BIP-39 entropy → secp256k1 key | None — it's a normal EOA | **Mera** (Category Labs, Monad's own) |

## P256VERIFY precompile on Monad (verified from Monad docs)

- Address **`0x0000000000000000000000000000000000000100`**, per **EIP-7951** (supersedes **RIP-7212**; same address & interface).
- Input exactly **160 bytes**: `hash(32) | r(32) | s(32) | qx(32) | qy(32)`, big-endian.
- Output: 32-byte `0x…01` if valid; **empty bytes** if invalid or malformed (does not revert).
- **Gas: 6,900.**
- Monad also has all Fusaka precompiles 0x01–0x11 (incl. BLS12-381), staking `0x1000`, reserve balance `0x1001`.

```solidity
address constant P256_VERIFY = address(0x0100);

function verifyP256(bytes32 h, uint256 r, uint256 s, uint256 qx, uint256 qy) internal view returns (bool) {
    (bool ok, bytes memory out) = P256_VERIFY.staticcall(abi.encodePacked(h, r, s, qx, qy));
    return ok && out.length == 32 && abi.decode(out, (uint256)) == 1;
}
```

Note: EIP-7951 does **not** enforce low-s (malleability). If you use signatures as unique IDs / nullifiers, normalize `s` (Solady `P256.normalized`) or use the non-malleable variant.

## WebAuthn verification in Solidity

A WebAuthn assertion signs `sha256(authenticatorData || sha256(clientDataJSON))`, where `clientDataJSON` contains `"type":"webauthn.get"` and `"challenge":"<base64url(challenge)>"`. Your contract must check type, challenge, flags (UP/UV), then P-256-verify.

### OpenZeppelin Contracts (v5.7.0 latest) — `contracts/utils/cryptography/`

Files: `P256.sol`, `WebAuthn.sol`, `signers/SignerP256.sol`, `signers/SignerWebAuthn.sol`, `signers/SignerEIP7702.sol`, `signers/MultiSignerERC7913*.sol`, plus `contracts/account/Account.sol` (ERC-4337 account base).

```solidity
import {WebAuthn} from "@openzeppelin/contracts/utils/cryptography/WebAuthn.sol";

// struct WebAuthn.WebAuthnAuth { bytes32 r; bytes32 s; uint256 challengeIndex; uint256 typeIndex;
//                                bytes authenticatorData; string clientDataJSON; }
function _isValid(bytes32 userOpHash, WebAuthn.WebAuthnAuth memory auth) internal view returns (bool) {
    return WebAuthn.verify(abi.encodePacked(userOpHash), auth, qx, qy);          // requires UV by default
    // WebAuthn.verify(challenge, auth, qx, qy, /*requireUV*/ false) to relax
}
```

OZ's `P256.verify` uses the precompile when present and falls back to a Solidity implementation. Checks: type `webauthn.get`, challenge, UP bit, optional UV bit, BE/BS consistency. Does not check signCount or attestation.

Minimal passkey account with OZ:

```solidity
import {Account} from "@openzeppelin/contracts/account/Account.sol";
import {SignerWebAuthn} from "@openzeppelin/contracts/utils/cryptography/signers/SignerWebAuthn.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";

contract PasskeyAccount is Account, SignerWebAuthn, Initializable {
    function initialize(bytes32 qx, bytes32 qy) public initializer { _setSigner(qx, qy); }
}
```
(Check OZ docs for the exact ERC-7821/7739 mixins you want — the above is the core pattern; `SignerWebAuthn` extends `SignerP256`.)

### Solady — `src/utils/WebAuthn.sol`, `src/utils/P256.sol`

```solidity
import {WebAuthn} from "solady/utils/WebAuthn.sol";
// struct WebAuthnAuth { bytes authenticatorData; string clientDataJSON; uint256 challengeIndex; uint256 typeIndex; bytes32 r; bytes32 s; }
bool ok = WebAuthn.verify(challenge, /*requireUserVerification*/ true, auth, x, y);
// Compact encodings: WebAuthn.tryDecodeAuthCompact / tryDecodeAuthCompactCalldata (gas-efficient calldata)
```
Solady `P256`: `RIP_PRECOMPILE = 0x…0100`, fallback `VERIFIER = 0x000000000000D01eA45F9eFD5c54f037Fa57Ea1a` (Daimo-style verifier; its deployment on Monad is **unverified** — irrelevant since the precompile exists). Functions: `verifySignature`, `verifySignatureAllowMalleability`, `hasPrecompile`, `normalized`.

### Daimo `p256-verifier`
`daimo-eth/p256-verifier` — the original audited pure-Solidity P256 verifier + WebAuthn lib (last updated 2024). Historically deployed at `0xc2b78104907F722DABAc4C69f826a522B2754De4` on many chains (**unverified on Monad**). Mostly superseded by the precompile — use for reference only.

## Smart accounts with passkey signers (Monad availability)

Monad canonical contracts include ERC-4337 **EntryPoint v0.6 `0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789`, v0.7 `0x0000000071727De22E5E9d8BAf0edAc6f37da032`, v0.8 `0x4337084d9e255fF0702461CF8895cE9E3b5Ff108`, v0.9 `0x433709009B8330FDa32311DF1C2AFA402eD8D009`**, Safe v1.3.0 `0x69f4D1788e39c87893C980c06EdF4b7f686e2938`, SafeL2 `0xfb1bffC9d739B8D520DaF37dF666da4C687191EA`, `Simple7702Account` `0xe6Cae83BdE06E4c305530e199D7217f42808555B`, ERC-6492 UniversalSigValidator `0xdAcD51A54883eb67D95FAEb2BBfdC4a9a6BD2a3B`.

| Implementation | Passkey support | Monad notes |
|---|---|---|
| **Coinbase Smart Wallet** (`coinbase/smart-wallet`) | Owners can be P-256 WebAuthn keys; viem `toCoinbaseSmartAccount({ owners: [webauthnAccount] })` | Factory deployment on Monad **unverified** — may need to deploy yourself via CREATE2 |
| **ZeroDev Kernel** (`zerodevapp/kernel`) | WebAuthn validator plugin + passkey server | Listed by Monad docs as supported smart account provider |
| **Safe + passkey module** (`safe-fndn/safe-modules`, `modules/passkey`) | `SafeWebAuthnSignerFactory` / shared signer | Safe core is canonical on Monad; passkey module deployment **unverified** |
| **MetaMask Smart Accounts Kit** (`@metamask/smart-accounts-kit` v2.0.0) | Hybrid implementation supports EOA + passkey (P256) signers | Monad mainnet + testnet listed as supported (smart accounts + ERC-7715 Advanced Permissions) |
| **Alchemy / Biconomy / Pimlico / Crossmint / Dynamic** | Passkey signers / auth | Listed in Monad docs' smart account + embedded wallet pages |
| **Porto (Ithaca)** | Passkey-native 7702 account | **Repo `ithacaxyz/porto` archived (Aug 2026)** — avoid for new builds |
| **EIP-7702 + passkey** | Delegate your EOA to a contract that validates P-256/WebAuthn (e.g., OZ `Account` + `SignerWebAuthn`, or `Simple7702Account` fork) | Monad supports 7702 (Simple7702Account is canonical) |

## Mera (Monad / Category Labs) — passkey-derived EOAs

- Package: **`@category-labs/mera` v0.2.0** (repo `category-labs/mera`, docs https://mera.category.xyz, demo https://mera.category.xyz/demo/).
- Uses the **WebAuthn PRF extension**: same passkey → same 32 bytes → same accounts on every device. Accounts are plain EOAs: **no contract deploy, no bundler, no MPC**. Exportable as a 24-word mnemonic (imports into MetaMask/Rabby). Also derives Solana (Ed25519) accounts. v0.2.0 adds React Native.

```bash
npm install @category-labs/mera viem @scure/bip32 @scure/bip39
```

```ts
import { createPasskeyWithPrfOutput, getPasskeyPrfOutput, createSecp256k1SigningSession, isMeraError } from "@category-labs/mera";
import { toViemAccount } from "@category-labs/mera/viem";
import { HDKey } from "@scure/bip32";
import { entropyToMnemonic, mnemonicToSeedSync } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english";
import { createWalletClient, http, parseEther } from "viem";
import { monadTestnet } from "viem/chains"; // `monad` for 143

// Onboarding (once): creates passkey + returns PRF output
const created = await createPasskeyWithPrfOutput({
  rp: { id: location.hostname, name: "My Monad App" },
  user: { name: "player@example.com", displayName: "Player One" },
});
localStorage.setItem("app.credential", JSON.stringify({ credentialId: created.credentialId, transports: created.transports }));

// Returning: const { prfOutput } = await getPasskeyPrfOutput({ rpId: location.hostname, credential: stored });

function deriveEvmKey(prf: Uint8Array, index = 0) {
  const seed = mnemonicToSeedSync(entropyToMnemonic(prf, wordlist));
  const node = HDKey.fromMasterSeed(seed).derive(`m/44'/60'/0'/0/${index}`);
  if (!node.privateKey) throw new Error("no key");
  return node.privateKey;
}

const session = createSecp256k1SigningSession({ privateKey: deriveEvmKey(created.prfOutput) });
const client = createWalletClient({ account: toViemAccount(session), chain: monadTestnet, transport: http() });
await client.sendTransaction({ to: "0x7099…79C8", value: parseEther("0.01"), gas: 21_000n });
session.end(); // zeroes key
```

Error codes: `PRF_UNAVAILABLE`, `PASSKEY_OPERATION_FAILED`, `CRYPTO_UNAVAILABLE`, `SESSION_ENDED`. Also "secret vaults" (encrypt an existing key with the passkey). Two UX modes: hold session (trading) vs prompt per tx.

**Mera tradeoffs vs. P256 smart accounts:** Mera = zero onchain cost & works with every dapp (EOA), but the key exists in page memory while a session is open, and it requires PRF support. P256 accounts = key never leaves the authenticator, but need account deployment + bundler/relayer. A strong "One Passkey, Many Keys" entry could combine both: Mera-derived per-app EOAs + a P256-validated smart account as root/recovery.

## Browser WebAuthn code (no library)

```ts
// Registration: get P-256 public key
const cred = await navigator.credentials.create({
  publicKey: {
    challenge: crypto.getRandomValues(new Uint8Array(32)),
    rp: { id: location.hostname, name: "My Monad App" },
    user: { id: crypto.getRandomValues(new Uint8Array(16)), name: "alice", displayName: "Alice" },
    pubKeyCredParams: [{ type: "public-key", alg: -7 }],           // -7 = ES256 (P-256)
    authenticatorSelection: { residentKey: "required", userVerification: "required" },
    // extensions: { prf: { eval: { first: new Uint8Array(32) } } } // PRF (what Mera uses)
  },
}) as PublicKeyCredential;
const resp = cred.response as AuthenticatorAttestationResponse;
const spki = resp.getPublicKey()!; // SPKI DER; last 64 bytes = x||y for P-256 uncompressed
const raw = new Uint8Array(spki).slice(-64);
const qx = raw.slice(0, 32), qy = raw.slice(32);

// Assertion: sign an onchain challenge (e.g., userOpHash)
const a = await navigator.credentials.get({
  publicKey: { challenge: hexToBytes(userOpHash), rpId: location.hostname, userVerification: "required",
               allowCredentials: [{ type: "public-key", id: cred.rawId }] },
}) as PublicKeyCredential;
const ar = a.response as AuthenticatorAssertionResponse;
// ar.authenticatorData, ar.clientDataJSON, ar.signature (DER!) → parse DER to (r,s), normalize s, find
// indices of "challenge" and "type" in clientDataJSON, then ABI-encode WebAuthnAuth for the contract.
```

Helpers so you don't hand-roll DER/COSE parsing:
- **viem** (`viem/account-abstraction`): `createWebAuthnCredential`, `toWebAuthnAccount` → pass as owner to `toCoinbaseSmartAccount` etc. (viem v2.56.x).
- **ox** (`ox` v1.8.x): `WebAuthnP256.createCredential`, `WebAuthnP256.sign`, `WebAuthnP256.verify`, `P256`.
- **@simplewebauthn/browser** v14 / `@simplewebauthn/server` — server-side verification for hybrid flows.

## Hackathon project ideas

1. **Mera-powered consumer app** (targets both Mera bounties): Face ID onboarding → instant EOA on Monad, per-app derived accounts ("one passkey, many keys"), session keys for gameplay/trading, mnemonic export as recovery.
2. **Passkey multisig / social recovery**: Safe/OZ `MultiSignerERC7913Weighted` with P-256 signers across family devices; 600 ms finality makes approvals feel instant.
3. **EIP-7702 passkey upgrade**: users with Mera EOAs delegate to a WebAuthn-validating contract → get batching, sponsorship, passkey-gated spending limits.
4. **Hardware-attested agent owners**: 8004 agent NFTs owned by passkey accounts; high-value agent actions require a human WebAuthn assertion (UV bit).
5. **Onchain WebAuthn gas benchmark / library** for Monad (compact calldata encoding, precompile vs fallback).

## Gotchas

- **PRF support is uneven**: desktop Chrome only returns PRF for passkeys stored in Google Password Manager; local-profile passkeys → `PRF_UNAVAILABLE`. Test on the Mera authenticator-support page.
- **rpId binding**: passkey is tied to the domain. Moving domains = can't derive keys anymore (users need the mnemonic). Pick your production domain up front; for hackathon demos on Vercel preview URLs this bites.
- WebAuthn signatures are **DER-encoded** and s may be high — convert and normalize.
- `clientDataJSON` challenge is **base64url without padding**.
- Precompile returns empty bytes on failure — check `out.length == 32`, not just `success`.
- Monad charges **gas limit**, so over-estimated WebAuthn validation gas costs real money; set tight limits.
- iOS requires iOS 18+ (RN) and Associated Domains / `assetlinks.json` for native apps (see Monad Mera RN guide).
- Porto is archived; Daimo verifier is legacy.

## Sources

- https://docs.monad.xyz/developer-essentials/precompiles
- https://eips.ethereum.org/EIPS/eip-7951 , https://github.com/ethereum/RIPs/blob/master/RIPS/rip-7212.md
- https://docs.monad.xyz/guides/mera , https://docs.monad.xyz/guides/mera/react-native
- https://mera.category.xyz , https://github.com/category-labs/mera
- https://docs.monad.xyz/developer-essentials/network-information (canonical contracts)
- https://docs.monad.xyz/tooling-and-infra/wallet-infra/smart-accounts , https://docs.monad.xyz/tooling-and-infra/wallet-infra/embedded-wallets
- https://github.com/OpenZeppelin/openzeppelin-contracts/tree/master/contracts/utils/cryptography
- https://github.com/Vectorized/solady/blob/main/src/utils/WebAuthn.sol , https://github.com/Vectorized/solady/blob/main/src/utils/P256.sol
- https://github.com/daimo-eth/p256-verifier
- https://github.com/coinbase/smart-wallet , https://github.com/zerodevapp/kernel , https://github.com/safe-fndn/safe-modules
- https://docs.metamask.io/smart-accounts-kit/development/get-started/supported-networks/
- https://developer.mozilla.org/en-US/docs/Web/API/Web_Authentication_API
- https://viem.sh/account-abstraction , https://oxlib.sh
