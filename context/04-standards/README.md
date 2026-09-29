# 04-standards — Trust, Identity & AI Infrastructure

> ⚠️ **Bounty details here were researched before the portal was captured.** For official bounty requirements, eligible tracks, prize splits and judging criteria, use [prizes-and-bounties.md](../00-hackathon/prizes-and-bounties.md) and the full texts in `_portal/bounties/`. Where they differ, **the portal wins**. Known corrections: Agora Mobile requires **Mera + AUSD + Perpl** and is **Track 01 only**; Agora Cross-Border requires **Mera + AUSD, mobile**, and is **Track 02 only**; Kuru ×2, Perpl Analytics and MetaMask Agent Wallet are **Track 01 only**; Hunyuan is **Track 03 only**; Cleanverse and Qwen are **Track 04 only** (Qwen credits go to the top 3 Track 4 winners).


Knowledge base for the Metropolis **Trust, Identity & AI Infrastructure** track ($30,000, split evenly between 3 teams; "best fit: teams comfortable with cryptography, protocol design, or agent frameworks"). Official examples:
- Passkey-native accounts using P256 and WebAuthn, with no seed phrase
- Agent identity and reputation under ERC-8004
- Provenance for generated media that survives re-encoding

Related bounties: Monad Foundation **"Best Mera-Powered UX on Monad" ($2,500)**, **"Mera: One Passkey, Many Keys" ($2,500)**; MetaMask **"Best Agent Wallet Plugin" ($2,500)**; AI model credits (see `../03-sponsors/ai-models/`).

Last researched: 2026-09-28.

| File | Covers |
|---|---|
| [erc-8004-trustless-agents.md](erc-8004-trustless-agents.md) | Full ERC-8004 spec (Identity/Reputation/Validation interfaces, events, registration file), **Monad addresses**, agent0 SDK, A2A/MCP |
| [passkeys-p256-webauthn.md](passkeys-p256-webauthn.md) | P256VERIFY precompile `0x0100` (EIP-7951, 6,900 gas), OZ/Solady WebAuthn, smart accounts with passkeys, **Mera** passkey-derived EOAs, browser WebAuthn |
| [x402-and-agent-payments.md](x402-and-agent-payments.md) | x402 v2, **Monad facilitator**, USDC addresses, exact/upto schemes, MPP, MetaMask delegation for agents |
| [media-provenance.md](media-provenance.md) | C2PA, TrustMark watermarks, PDQ/pHash, onchain provenance registry design |
| [other-identity-primitives.md](other-identity-primitives.md) | EAS, .nad names (NNS), Self/zkPassport/World ID/Reclaim/Semaphore, VCs/DIDs, TEEs — with Monad availability |

## Verified Monad facts at a glance

| Thing | Value |
|---|---|
| Chain IDs | Mainnet `143` (`https://rpc.monad.xyz`), Testnet `10143` (`https://testnet-rpc.monad.xyz`) |
| Block time / finality | 300 ms / 600 ms; per-tx gas limit 30M; **gas LIMIT is charged** |
| P256VERIFY precompile | `0x0000000000000000000000000000000000000100`, 6,900 gas |
| ERC-8004 Identity (mainnet / testnet) | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` / `0x8004A818BFB912233c491871b3d84c89A494BD9e` |
| ERC-8004 Reputation (mainnet / testnet) | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` / `0x8004B663056A597Dffe9eCcC1965A193B7388713` |
| ERC-8004 Validation | not deployed on Monad ("coming soon") |
| x402 facilitator | `https://x402-facilitator.molandak.org` (v2; exact, upto, batch-settlement on 143 & 10143) |
| USDC mainnet / testnet | `0x754704Bc059F8C67012fEd69BC8A327a5aafb603` / `0x534b2f3A21130d7a60830c2Df862319e593943A3` (EIP-712 name `"USDC"`, version `"2"`) |
| x402 Exact / Upto Permit2 proxies | `0x402085c248EeA27D92E8b30b2C58ed07f9E20001` / `0x4020A4f3b7b90ccA423B9fabCc0CE57C6C240002` |
| EntryPoint v0.7 / v0.8 / v0.9 | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` / `0x4337084d9e255fF0702461CF8895cE9E3b5Ff108` / `0x433709009B8330FDa32311DF1C2AFA402eD8D009` |
| NNS NadNameService (mainnet) | `0xCc7a1bfF8845573dbF0B3b96e25B9b549d4a2eC7` |
| Mera | `@category-labs/mera` v0.2.0 (passkey PRF → EOA) |

## Strongest combos for this track

1. **Passkey-owned, reputation-gated agents**: Mera/P256 human owner → ERC-8004 agent → x402-paid services → feedback w/ payment proof.
2. **Provenance for AI media**: ERC-8004 generator agents + TrustMark/PDQ + C2PA + Monad registry.
3. **Sybil-resistant reputation**: 8004 feedback filtered by ZK-proof-of-human or paid-client sets.
4. **Infra gaps you can fill** (not yet on Monad): ValidationRegistry, EAS, Monad 8004 subgraph/explorer, TEE (DCAP) verifier, ZK-ID verifiers.
