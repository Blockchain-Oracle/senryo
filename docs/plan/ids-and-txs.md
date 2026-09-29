# Public IDs and transactions

Public values only. Secrets live in `~/.config/senryo/` or Coolify runtime env — never here.

## Chains
| Network | Chain id | RPC | Explorer |
|---|---|---|---|
| Monad mainnet | 143 | https://rpc.monad.xyz · wss://rpc.monad.xyz | https://monadscan.com · MonadVision |
| Monad testnet | 10143 | https://testnet-rpc.monad.xyz | https://testnet.monadscan.com |

## External contracts we use (mainnet 143)
| Name | Address | Source |
|---|---|---|
| AUSD | 0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a | agora-ausd-and-perpl.md §1.1 (onchain-verified) |
| USDC | 0x754704Bc059F8C67012fEd69BC8A327a5aafb603 | contracts-and-tokens.md |
| Perpl Exchange (deploy block 54773010) | 0x34B6552d57a35a1D042CcAe1951BD1C370112a6F | agora-ausd-and-perpl.md §2 |
| Chainlink XAU/USD | 0x61dD33A34E47a181EE02e42eE0546a3DA808f1B4 | chainlink-cre.md (read 2026-09-29) |
| Chainlink XAG/USD | 0x29bEb7e730f09D33417357dbed020B549fdF7db4 | contracts design (directory JSON) |
| Uniswap v4 PoolManager | 0x188d586ddcf52439676ca21a244753fa19f9ea8e | docs.uniswap.org (code verified) |
| Uniswap v4 Quoter | 0xa222dd357a9076d1091ed6aa2e16c9742dd26891 | idem |
| Uniswap v4 StateView | 0x77395f3b2e73ae90843717371294fa97cc419d64 | idem |
| Universal Router 2.1.2 | 0xa6CE4F10d83dBdDAc17E68e1837ca9cE6a1b596e | idem |
| Permit2 | 0x000000000022D473030F116dDEE9F6B43aC78BA3 | idem |
| Safe v1.4.1 | 0x41675C099F32341bf84BFc5382aF534df5C7461a | contracts-and-tokens.md |

## Testnet (10143)
| Name | Address | Source |
|---|---|---|
| Perpl Exchange | 0x1964C32f0bE608E7D29302AFF5E61268E72080cc | agora-ausd-and-perpl.md |
| Testnet USDC | 0x534b2f3A21130d7a60830c2Df862319e593943A3 | contracts-and-tokens.md |
| Immersve Universal EVM Funds Manager | 0x1754AE802dCcc5bd4fe2d2b42ac01e2AB3552086 | company-and-real-integrations.md |

## Our deployments
_(none yet — filled by S2 / S8 deploy scripts; must match `packages/contracts/addresses/*.json` and `indexer/config.yaml` — invariant `address-drift`)_

## Coolify / builds / domains
_(none yet)_
