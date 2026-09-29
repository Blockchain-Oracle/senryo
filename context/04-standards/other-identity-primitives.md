# Other Identity & Trust Primitives (Monad availability)

> Last researched: 2026-09-28. Brief survey. "Monad status" = what we could verify; anything else is marked (unverified). When a protocol isn't deployed, most are open-source and deployable to Monad yourself — say so in your submission.

## Quick matrix

| Primitive | What | Monad status | Use in Metropolis |
|---|---|---|---|
| **ERC-8004** | Agent identity/reputation | **Deployed** mainnet+testnet (see `erc-8004-trustless-agents.md`) | Core track item |
| **P256 precompile / passkeys / Mera** | Seedless accounts | **Live** at `0x0100` (6,900 gas); Mera SDK | Core track item |
| **EAS** (Ethereum Attestation Service) | Generic signed attestations (schemas) | **Not in official `eas-contracts/deployments`** (no Monad folder as of today) → self-deploy | Reviews, KYC-lite claims, provenance claims |
| **Nad Name Service (NNS)** | `.nad` names | **Deployed** mainnet (code verified) | Human-readable agent/user names |
| **Self** (passport NFC ZK) | Proof of humanity/age/nationality | Contracts on Celo; no Monad (unverified); product pivoting to "Self Enterprise" | Sybil resistance via offchain verify + onchain attestation |
| **zkPassport** | Passport/eID ZK proofs | Onchain verifier on Ethereum/Base; Monad not listed (unverified) | Same; or deploy verifier |
| **World ID** | Iris-based proof of personhood | Native on World Chain / bridged roots on a few chains; Monad not supported (unverified) | Verify offchain via Developer Portal API |
| **Reclaim / zkTLS** | Prove web2 data (bank, GitHub, X) | Deployed on many EVM chains; Monad not listed (unverified) | Agent/user credentials from web2 |
| **Semaphore** | Anonymous group membership | Self-deploy (open source) | Anonymous feedback on agents |
| **Verifiable Credentials (W3C VC 2.0 / DIDs)** | Off-chain signed credentials | Chain-agnostic | 8004 `DID` service entry |
| **TEEs** (Phala, Oasis ROFL, Marlin, AWS Nitro) | Attested agent execution | Offchain; onchain DCAP verification needs deployment (unverified on Monad) | 8004 `tee-attestation` trust model |

## EAS

- Contracts: `EAS.sol` + `SchemaRegistry.sol` (`ethereum-attestation-service/eas-contracts`); SDK `@ethereum-attestation-service/eas-sdk` v2.10.0.
- Deployments folder covers mainnet, OP, Base, Arbitrum, Polygon, Scroll, Linea, zkSync, Celo, Ink, Unichain, Soneium, Telos, etc. — **no Monad**. Explorer easscan.org won't index your Monad deploy.
- Self-deploy: `SchemaRegistry` then `EAS(schemaRegistry)`. Use CreateX (`0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed`, canonical on Monad) for deterministic addresses.

```ts
import { EAS, SchemaEncoder } from "@ethereum-attestation-service/eas-sdk";
const eas = new EAS(MY_MONAD_EAS_ADDRESS); eas.connect(ethersSigner);
const enc = new SchemaEncoder("uint256 agentId, uint8 score, string comment");
const tx = await eas.attest({ schema: SCHEMA_UID, data: { recipient: agentWallet, expirationTime: 0n, revocable: true,
  data: enc.encodeData([{ name: "agentId", value: 12n, type: "uint256" }, { name: "score", value: 90, type: "uint8" }, { name: "comment", value: "fast", type: "string" }]) } });
const uid = await tx.wait();
```
Also consider **offchain EAS attestations** (EIP-712 signed, no deploy needed) with onchain timestamping.

## Naming: Nad Name Service (.nad)

Verified from docs.nad.domains (mainnet `NadNameService` bytecode confirmed via RPC):

| Contract | Mainnet (143) | Testnet (10143) |
|---|---|---|
| NadNameService | `0xCc7a1bfF8845573dbF0B3b96e25B9b549d4a2eC7` | `0x3019BF1dfB84E5b46Ca9D0eEC37dE08a59A41308` |
| NNSRegistryAdapter | `0x67785260512139Ee22C7fBbd62b5706c16AA4050` | `0x6A1c3156F66a276f39751cAd4146ea4Ca463EcC7` |
| NNSUniversalResolverAdapter | `0x6ED8Ca3E2fEF58A82fc69B4037062445a3a32DfC` | `0xE451F2AB9E5d009b7384cD3B8d0B90c71CD4d0F7` |

SDKs (use **v2.0.0+ for mainnet**): `@nadnameservice/nns-viem-sdk`, `@nadnameservice/nns-ethers-sdk`, `@nadnameservice/nns-wagmi-hooks`. Features: forward resolution, primary name (reverse), custom attributes. Idea: give each ERC-8004 agent a `.nad` name and put it in the registration file's services (8004 has an `ENS` service type; NNS isn't ENS — add a custom `{ "name": "NNS", "endpoint": "mybot.nad" }` entry).

## ZK identity

- **Self** (self.xyz) — scan passport/ID NFC chip in app, generate ZK proof of attributes (age, nationality, OFAC non-match, uniqueness). Onchain verifier contracts historically on Celo. Docs now lead with **Self Enterprise** (API keys/webhooks); permissionless "Self Pass" path labeled legacy (per third-party summary). For Monad: verify offchain / via their backend, then write an attestation (EAS-on-Monad or custom) keyed by nullifier.
- **zkPassport** (zkpassport.id) — Noir circuits; SDK `@zkpassport/sdk` (v0.16.x per third-party); permissionless onchain verifier on Ethereum/Base. Monad: deploy the verifier (Noir/UltraHonk verifiers are large — check the 30M per-tx gas limit) or verify offchain.
- **World ID** — `@worldcoin/idkit` for frontend; proofs verifiable via Developer Portal API or onchain on supported chains. Monad onchain verification not available (unverified) → offchain verify + attest.
- **Reclaim Protocol** (zkTLS) — proves HTTPS responses from web2 sites; Solidity SDK verifies witness signatures (cheap ECDSA, **no pairing**) → easy to deploy on Monad yourself. Alternatives: **Opacity**, **Pluto**, **TLSNotary** (unverified Monad status for all).
- **Semaphore** (v4) — anonymous signalling with nullifiers; Groth16 verification uses bn254 pairing.

### Monad gas note for ZK verifiers (important)

Monad reprices several precompiles (from Monad docs): **`ecPairing` 0x08 listed as 225,000 gas** (Monad precompiles table; see the opcode-pricing page for the exact per-pair formula — unverified whether it scales per pair), `ecMul` 0x07 = 30,000, `ecAdd` 0x06 = 300, `ecRecover` = 6,000. A Groth16 verify (1 pairing check of 4 pairs + a few ecMul) will cost noticeably more than on Ethereum. Budget for it, and remember Monad charges the **gas limit** you set. BLS12-381 precompiles (0x0b–0x11) are available too.

## Verifiable Credentials & DIDs

- W3C **VC Data Model 2.0** + DIDs (`did:pkh:eip155:143:0x…` works for any Monad address; `did:web` for services).
- Libraries: Veramo, `@digitalbazaar/vc`, SpruceID `ssi`/`didkit` (check maintenance before use — unverified).
- Pattern: issue VC offchain, anchor `keccak256(vc)` or a revocation bitmap onchain on Monad; reference DID in ERC-8004 `services`.

## TEEs for agents

| Provider | What | Onchain proof |
|---|---|---|
| **Phala Cloud** (dstack, Intel TDX + NVIDIA H100/H200 GPU TEEs) | Run agent/LLM in a confidential VM; remote attestation report | `Phala-Network/erc-8004-tee-agent` = ERC-8004-compliant TEE agent with a TEE registry extension (reference to port to Monad) |
| **Automata DCAP Attestation** | Solidity verifier for Intel SGX/TDX quotes (with SNARK-compressed path) | Deployment on Monad **unverified** — could deploy |
| **Oasis ROFL**, **Marlin Oyster**, **AWS Nitro Enclaves** | Attested offchain compute | Various; Monad unverified |
| **Embedded wallets using TEEs** (Privy, Turnkey, CDP) | Key custody in enclaves | Listed in Monad embedded-wallet docs |

Pattern for Monad: agent runs in TEE → produces attestation quote binding its signing key → validator verifies quote (onchain via DCAP or offchain) → posts ERC-8004 `validationResponse` (deploy the ValidationRegistry yourself) or sets metadata key `teeAttestation` on the Identity Registry.

## Hackathon project ideas

1. **Proof-of-human reviewer set for ERC-8004** — reviewers must hold a Self/zkPassport/World ID attestation on Monad; `getSummary` over that set = Sybil-resistant reputation.
2. **EAS-on-Monad deployment + schema registry for agents** — "first EAS on Monad" + explorer.
3. **zkTLS-backed agent credentials** — agent owner proves e.g. GitHub org membership or bank balance via Reclaim; attestation linked to agentId.
4. **TEE-validated agents** — port Phala's erc-8004-tee-agent to Monad with a self-deployed ValidationRegistry.
5. **.nad identity hub** — resolve `alice.nad` → passkey account, agents owned, reputation, provenance records.
6. **Anonymous agent feedback** — Semaphore group of verified paying clients gives feedback without doxxing.

## Gotchas

- Most ZK-ID protocols are **not deployed on Monad** — plan for offchain verification + your own attestation contract, or budget time to deploy verifiers.
- Pairing-heavy verifiers are pricier on Monad (225k gas `ecPairing`).
- Nullifier scoping: make nullifiers app-specific to avoid cross-app tracking.
- NNS is ENS-like but **not ENS** — ENS resolvers/`viem.getEnsName` won't resolve `.nad`; use NNS SDK.
- Passport-based proofs have country coverage gaps; demo with test passports/mocks where the SDK supports it.

## Sources

- https://github.com/ethereum-attestation-service/eas-contracts (deployments/) , https://docs.attest.org , https://github.com/ethereum-attestation-service/eas-sdk
- https://docs.nad.domains/developers/contracts/contract-addresses , https://docs.nad.domains/developers/integrating-into-your-dapps/using-nns-sdks , https://nad.domains
- https://self.xyz , https://docs.self.xyz
- https://zkpassport.id , https://ethereum.org/developers/tools/zkpassport/
- https://docs.world.org/world-id
- https://docs.reclaimprotocol.org/onchain/solidity/quickstart
- https://semaphore.pse.dev
- https://www.w3.org/TR/vc-data-model-2.0/
- https://docs.phala.network , https://github.com/Phala-Network/erc-8004-tee-agent
- https://github.com/automata-network/automata-dcap-attestation , https://blog.ata.network
- https://docs.monad.xyz/developer-essentials/precompiles (gas repricing)
- https://docs.monad.xyz/tooling-and-infra/wallet-infra/embedded-wallets
