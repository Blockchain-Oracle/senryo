# Canonical Contracts & Tokens

Every address below was copied from docs.monad.xyz on 2026-09-28. Nothing was invented. WMON's mainnet bytecode was also confirmed live with `eth_getCode`. For ecosystem protocol addresses (DEXs, lending, and so on), see https://github.com/monad-crypto/protocols. For tokens, see https://github.com/monad-crypto/token-list ([raw mainnet json](https://raw.githubusercontent.com/monad-crypto/token-list/refs/heads/main/tokenlist-mainnet.json), `tokenlist-testnet.json`).

## Precompiles (both networks)
| Address | What |
|---|---|
| `0x01`–`0x11` | Ethereum precompiles as of Fusaka (ecRecover … BLS12-381) |
| `0x0000000000000000000000000000000000000100` | **P256VERIFY** (EIP-7951 / RIP-7212 interface), 6,900 gas |
| `0x0000000000000000000000000000000000001000` | **Staking** precompile (CALL only) |
| `0x0000000000000000000000000000000000001001` | **Reserve balance**: `dippedIntoReserve()` (CALL only) |

## Mainnet (chain 143) canonical contracts
| Name | Address |
|---|---|
| **WMON** | `0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A` |
| **Multicall3** | `0xcA11bde05977b3631167028862bE2a173976CA11` |
| **Permit2** | `0x000000000022d473030f116ddee9f6b43ac78ba3` |
| **CreateX** | `0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed` |
| Create2Deployer (pcaversaccio) | `0x13b0D85CcB8bf860b6b79AF3029fCA081AE9beF2` |
| EIP-7997 Deterministic Factory (Foundry/Arachnid `0x4e59…`) | `0x4e59b44847b379578588920ca78fbf26c0b4956c` |
| ERC-2470 Singleton Factory | `0xce0042b868300000d44a59004da54a005ffdcf9f` |
| Zoltu Deterministic Deployment Proxy | `0x7A0D94F55792C434d74a40883C6ed8545E406D12` |
| SafeSingletonFactory | `0x914d7Fec6aaC8cd542e72Bca78B30650d45643d7` |
| **ERC-4337 EntryPoint v0.6** | `0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789` |
| SenderCreator v0.6 | `0x7fc98430eAEdbb6070B35B39D798725049088348` |
| **EntryPoint v0.7** | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` |
| SenderCreator v0.7 | `0xEFC2c1444eBCC4Db75e7613d20C6a62fF67A167C` |
| **EntryPoint v0.8** | `0x4337084d9e255fF0702461CF8895cE9E3b5Ff108` |
| SenderCreator v0.8 | `0x449ED7C3e6Fee6a97311d4b55475DF59C44AdD33` |
| **EntryPoint v0.9** | `0x433709009B8330FDa32311DF1C2AFA402eD8D009` |
| SenderCreator v0.9 | `0x0A630a99Df908A81115A3022927Be82f9299987e` |
| SimpleAccount (eth-infinitism) | `0x68641DE71cfEa5a5d0D29712449Ee254bb1400C2` |
| **Simple7702Account** | `0xe6Cae83BdE06E4c305530e199D7217f42808555B` |
| ERC-6492 UniversalSigValidator | `0xdAcD51A54883eb67D95FAEb2BBfdC4a9a6BD2a3B` |
| Safe (v1.3.0) | `0x69f4D1788e39c87893C980c06EdF4b7f686e2938` |
| SafeL2 (v1.3.0) | `0xfb1bffC9d739B8D520DaF37dF666da4C687191EA` |
| MultiSend (v1.3.0) | `0x998739BFdAAdde7C933B942a68053933098f9EDa` |
| MultiSendCallOnly (v1.3.0) | `0xA1dabEF33b3B82c7814B6D82A79e50F4AC44102B` |
| Sub Zero VanityMarket | `0x000000000000b361194cfe6312EE3210d53C15AA` |
| x402 ExactPermit2Proxy | `0x402085c248EeA27D92E8b30b2C58ed07f9E20001` |
| x402 UptoPermit2Proxy | `0x4020A4f3b7b90ccA423B9fabCc0CE57C6C240002` |
| **ERC-8004 Identity Registry** | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` (from the ERC-8004 guide) |
| **ERC-8004 Reputation Registry** | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` (from the ERC-8004 guide) |
| ERC-8004 Validation Registry | "coming soon" per the docs |

## Testnet (chain 10143) canonical contracts
The testnet was reset on 2025-12-16.

| Name | Address |
|---|---|
| **WMON (testnet)** | `0xFb8bf4c1CC7a94c73D209a149eA2AbEa852BC541` (**different from mainnet**) |
| Multicall3 | `0xcA11bde05977b3631167028862bE2a173976CA11` |
| Permit2 | `0x000000000022d473030f116ddee9f6b43ac78ba3` |
| CreateX | `0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed` |
| Foundry Deterministic Deployer | `0x4e59b44847b379578588920ca78fbf26c0b4956c` |
| ERC-6492 UniversalSigValidator | `0xdAcD51A54883eb67D95FAEb2BBfdC4a9a6BD2a3B` |
| EntryPoint v0.6 / v0.7 / v0.8 / v0.9 | same addresses as mainnet (above) |
| SafeSingletonFactory | `0x914d7Fec6aaC8cd542e72Bca78B30650d45643d7` |
| x402 ExactPermit2Proxy / UptoPermit2Proxy | same as mainnet |
| Safe v1.4.1 | `0x41675C099F32341bf84BFc5382aF534df5C7461a` |
| SafeL2 v1.4.1 | `0x29fcB43b46531BcA003ddC8FCB67FFE91900C762` |
| SafeProxyFactory v1.4.1 | `0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67` |
| MultiSend / MultiSendCallOnly v1.4.1 | `0x38869bf66a61cF6bDB996A6aE40D5853Fd43B526` / `0x9641d764fc13c8B624c04430C7356C1C7C8102e2` |
| CompatibilityFallbackHandler | `0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99` |
| SignMessageLib / CreateCall / SimulateTxAccessor | `0xd53cd0aB83D845Ac265BE939c57F53AD838012c9` / `0x9b35Af71d77eaf8d7e40252370304687390A1A52` / `0x3d4BA2E0884aa488718476ca2FB8Efc291A46199` |
| **USDC (testnet)** | `0x534b2f3A21130d7a60830c2Df862319e593943A3` (from the x402 guide) |

## Mainnet tokens (from Tokens & Bridges, generated from token-list)
### Stablecoins / dollar
| Symbol | Address | Bridge |
|---|---|---|
| **USDC** | `0x754704Bc059F8C67012fEd69BC8A327a5aafb603` | Circle CCTP (monadbridge.com), 17 chains |
| **AUSD** (Agora) | `0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a` | LayerZero OFT (Stargate) |
| **USDT0** | `0xe7cd86e13AC4309349F30B3435a9d337750fC82D` | LayerZero OFT (Stargate) |
| mUSD (MetaMask USD) | `0xacA92E438df0B2401fF60dA7E4337B687a2435DA` | Hyperlane |
| USD1 | `0x111111d2bf19e43C34263401e0CAd979eD1cdb61` | Chainlink CCIP |
| GHO | `0xfc421aD3C883Bf9E7C4f42dE845C4e4405799e73` | CCIP |
| USDe | `0x5d3a1Ff2b6BAb83b63cd9AD0787074081a52ef34` | LZ OFT |
| sUSDe | `0x211Cc4DD073734dA055fbF44a2b4667d5E5fE5d2` | LZ OFT |
| syrupUSDC | `0xaB6e5a0C3799d020c790D34F7B2C02639e238AF7` | CCIP |
| wsrUSD | `0x4809010926aec940b550D34a46A52739f996D75D` | LZ OFT |
| syzUSD | `0x484be0540aD49f351eaa04eeB35dF0f937D4E73f` | LZ OFT |

### ETH
| Symbol | Address |
|---|---|
| **WETH** | `0xEE8c0E9f1BFFb4Eb878d8f15f368A02a35481242` (NTT 2/2, monadbridge) |
| wstETH | `0x10Aeaf63194db8d453d4D85a06E5eFE1dd0b5417` |
| weETH | `0xA3D68b74bF0528fdD07263c60d6488749044914b` |
| ezETH | `0x2416092f143378750bb29b79eD961ab195CcEea5` |
| rETH | `0xC50f2e735eDd9dCD8Ccd41EcFE9894E679e3195f` |

### BTC
| Symbol | Address |
|---|---|
| cbBTC | `0xd18B7EC58Cdf4876f6AFebd3Ed1730e4Ce10414b` |
| WBTC | `0x0555E30da8f98308EdB960aa94C0Db47230d2B9c` |
| LBTC | `0xecAc9C5F704e954931349Da37F60E39f515c11c1` |
| BTC.b | `0xB0F70C0bD6FD87dbEb7C10dC692a2a6106817072` |
| SolvBTC | `0xaE4EFbc7736f963982aACb17EFA37fCBAb924cB3` |
| xSolvBTC | `0xc99F5c922DAE05B6e2ff83463ce705eF7C91F077` |

### Other
| Symbol | Address |
|---|---|
| SOL (Wormhole) | `0xea17E5a9efEBf1477dB45082d67010E2245217f1` |
| XAUt0 (Tether Gold) | `0x01bFF41798a0BcF287b996046Ca68b395DbC1071` |

Before hardcoding a token, check its decimals on-chain. USDC/AUSD/USDT0 are *typically* 6 decimals, but that is unverified here.

## Bridges
- LayerZero OFT via **Stargate**; Chainlink CCIP via **Transporter**; Hyperlane via **Nexus**; 2/2 NTT and CCTP via **MonadBridge** (monadbridge.com).
- Aggregator: **Jumper** (LI.FI), chain id 143.
- Market data: Defined, GeckoTerminal (`/monad/pools`), MonadVision tokens, DeFiLlama.

## Agentic payment endpoints
- x402 facilitator: `https://x402-facilitator.molandak.org` (mainnet `eip155:143` and testnet `eip155:10143`, USDC). Endpoints: `GET /supported`, `POST /verify`, `POST /settle`.
- MPP: `npm i @monad-crypto/mpp mppx viem`. It uses ERC-3009 pull payments and defaults to mainnet (`testnet: true` switches).

## Sources
- https://docs.monad.xyz/developer-essentials/network-information/index.md
- https://docs.monad.xyz/developer-essentials/testnet.md
- https://docs.monad.xyz/developer-essentials/network-information/tokens-and-bridges.md
- https://docs.monad.xyz/developer-essentials/precompiles.md
- https://docs.monad.xyz/guides/erc-8004.md
- https://docs.monad.xyz/guides/x402.md
- https://docs.monad.xyz/tooling-and-infra/agentic-payments.md
- https://github.com/monad-crypto/protocols, https://github.com/monad-crypto/token-list
