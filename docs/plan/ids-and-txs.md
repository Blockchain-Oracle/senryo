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
Must match `packages/contracts/src/addresses/*.json` and `indexer/config.yaml` (invariant `address-drift`).

### Monad testnet (10143) — deployed 2026-09-30, start block 66856078, deployer 0x52d205731E97C90aAB738AE66371449F585C0E6A
| Contract | Address | Verification |
|---|---|---|
| AccessManager | 0xed8A87E2823D65600d2F57Fd6D1A2A5F09F296Da | Sourcify exact_match |
| InboxFactory | 0x815D0669C708b72447d58Ac4170214A585759Bf3 | Sourcify exact_match |
| IntentRouter | 0xc9dfaBAf49ea7AA1a6d57F82f816198448F190B1 | Sourcify exact_match |
| LpVault | 0x297877FCFEb4c077F68D11E07654c676c0883408 | Sourcify exact_match |
| MarketCalendar | 0x739238AD0EE7482e12f9D35a58d760Ac3e8BcDEB | Sourcify exact_match |
| MirrorXAG | 0x44C5397b710DCE7f666EFdAb9417DD1D9E13e360 | Sourcify exact_match |
| MirrorXAU | 0x91ef95EC56a88786CDd41C23Ca2616Ffdfa4dc13 | Sourcify exact_match |
| MockAUSD | 0xA56060259F6c5EF2b18257caEe1F51782e069E23 | Sourcify exact_match |
| MockUSDC | 0x68225DA6Df9d1Bd54f26D308Fb453333dC2a69A1 | Sourcify exact_match |
| SenryoCore | 0x36cF64452f64eB0e99AAC4Eb103C7838C1918cAA | Sourcify exact_match |
| SessionOracle | 0x343A75a1d271937042D8688dD5d4D2F8c320BAd3 | Sourcify exact_match |
| StarterDrip | 0x5C1ab87DA4b02670723c6633278A5A45Cdf12e81 | Sourcify exact_match |

Broadcast: `contracts/broadcast/Deploy.s.sol/10143/run-latest.json`. Mainnet: none yet (S8).

### Testnet operational keys (S3, D-115) — keys in `~/.config/senryo/testnet-<name>.key`, never committed
| Role | Address | Roles granted |
|---|---|---|
| keeper | 0xf6a36dC37104e200B277Eedc60Af060440D33b10 | MIRROR_ROLE (70) |
| trader (drive script user) | 0xBa0bE5c8DF7f7c8A452dD78b208b0aE71454A061 | — |
| sponsor | 0xb00A73D3C207f8764A4cAD83a9b12186D9d6DA99 | — (RELAYER_ROLE pending; unfunded) |
| operator1 | 0xbB1868EF38D70864657F09bCf6caCAcF26B9bAF6 | — (CARD_OPERATOR pending; unfunded) |
| operator2 | 0xbfD5B98F36660c58FD58Fd54671B4b2db7529138 | — (CARD_OPERATOR pending; unfunded) |

## Coolify / builds / domains
| Item | Value |
|---|---|
| Domain | **senryo.xyz** — registered 2026-09-30 via namecheap-cli (order 215459963), $2.20 charged; renews $21.48/yr; WhoisGuard on; Namecheap BasicDNS (records added in S6 with [OK?]) |
