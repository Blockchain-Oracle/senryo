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
| Chainlink XAU/USD aggregator (OCR2 1.0.0, proxy phase 1) | 0xFeccbf9C82Ff5231073580334DC605740309ebCe | `aggregator()` / `phaseAggregators(1)` on the proxy, 2026-09-30 (S4) |
| Chainlink XAG/USD aggregator (OCR2 1.0.0, proxy phase 1) | 0x8Aa871027BA54dc1a9c803456AD613668a643fB4 | idem |
| HyperSync | https://monad.hypersync.xyz (143) · https://monad-testnet.hypersync.xyz (10143) | token in `~/.config/senryo/envio.env` (S4) |
| Uniswap v4 PoolManager | 0x188d586ddcf52439676ca21a244753fa19f9ea8e | docs.uniswap.org (code verified) |
| Uniswap v4 Quoter | 0xa222dd357a9076d1091ed6aa2e16c9742dd26891 | idem |
| Uniswap v4 StateView | 0x77395f3b2e73ae90843717371294fa97cc419d64 | idem |
| Universal Router 2.1.2 | 0xa6CE4F10d83dBdDAc17E68e1837ca9cE6a1b596e | idem |
| Permit2 | 0x000000000022D473030F116dDEE9F6B43aC78BA3 | idem |
| Safe v1.4.1 | 0x41675C099F32341bf84BFc5382aF534df5C7461a | contracts-and-tokens.md |
| Uniswap v4 AUSD/USDC pool (fee 50, tickSpacing 1, hooks 0) | poolId 0x092b650478145f0aee73a1b400b342b9c6314db2e07aeb91faf7e75e8159ce72 | read onchain via StateView (S3.3, D-122) |

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
| Expo / EAS project | `@0xabu/senryo` · projectId `2d424d4b-644e-4231-a156-a8c63d802e9c` (2026-09-30) |
| Apple Developer team | Individual "Abubakr Jimoh" · Team ID `86C6ZFJ6V6` · bundle id `xyz.senryo.app` registered, Associated Domains enabled, distribution cert created via EAS (2026-09-30) |
| Android signing cert (EAS keystore "Build Credentials fNFoZPe6lZ (default)") | SHA-256 `E4:89:29:5E:DF:D5:56:E0:52:65:5C:16:AB:81:FE:FE:60:56:22:0E:2A:2A:D0:F4:24:24:B9:1F:D1:8E:B1:A5` — read from the dev APK v2 signing block (build e8d03e99, 2026-09-30); goes in assetlinks.json |
| DNS (Namecheap BasicDNS, 2026-09-30, user OK) | A `@`, `api`, `indexer`, `docs` → 84.46.247.92 (Coolify box) TTL 300; CNAME `www` → senryo.xyz; parking URL/CNAME records removed |
| Coolify project `senryo` | `ftodkhszfqnkkzzbxekzrhv6` (server `7otp4kskhbwzkzybsug3uqgx`, env production), created 2026-09-30 |
| senryo-ledger (Postgres 17-alpine, 256m) | `tey5siakdz1nau7wnzaytgcn` — internal only |
| senryo-api (ghcr.io/blockchain-oracle/senryo-api:sha-66679dd, 384m) | `lzumxcf5i0hvzv2k5gpzvfdr` → https://api.senryo.xyz (practice 10143) |
| senryo-web (ghcr.io/blockchain-oracle/senryo-web:sha-66679dd, 64m) | `2zeju5a5afmf7s0g4bzdgzjp` → https://senryo.xyz, https://www.senryo.xyz |
| GHCR images | public (inherited from the public repo; anonymous manifest pull 200); images run 36692273246 |
| Testnet sponsor (RELAYER_ROLE 60) | `0xb00A73D3C207f8764A4cAD83a9b12186D9d6DA99` — funded 0.35 MON (0x6c0e570b…df33), role granted (0xf97e0a29…6c06) |
| StarterDrip float | 0.3 MON (0x421a3133…db6a) = 6 drips of 0.05 |
| S6.12 live practice claim (virtual passkey, 30 Sep; sign → finalized 1.48 s, 1 prompt, 100 usd6) | user `0x9D14fcC0972c44E0Ab3D1b0c05ed1FFC332fE10D` · tx `0x303dd13844fac2a0fbe4542b4627b00b96049de895e1696268becace195e8b2b` (10143) |
| Testnet MON split (user faucet 5 MON → deployer, 30 Sep) | keeper +2 (0x9aaf7b06…c615) · sponsor +1 (0x3bf9c135…06e5) · StarterDrip +1 (0xf8034980…71b7); after: deployer 1.78 · keeper 2.21 · sponsor 1.26 · StarterDrip 1.20 |
| senryo-keeper (ghcr.io/blockchain-oracle/senryo-api:sha-66679dd, SERVICE=keeper, 256m, internal only) | `cskiutyjlluqkfupj4bixxs3` — jobs liquidate,observe,mirror,triggers,holds,alerts,wallets · mirror XAU,XAG |
| senryo-indexer (compose from git /indexer; ghcr.io/blockchain-oracle/senryo-indexer:sha-0b8a3dd; pg 512m · hasura 384m · envio 800m) | `gafyrh7f6esyaxbcubnogjwc` → https://indexer.senryo.xyz/v1/graphql (143 + 10143) · measured at start: envio 258 MiB, hasura 295 MiB, pg 79 MiB |
| 10143 core-set redeploy (D-164, 30 Sep) | 31 txs from block 66968976 (`contracts/broadcast/Deploy.s.sol/10143/run-latest.json`); old StarterDrip float → deployer `0xa3a879a2…9f75f`; new StarterDrip +0.4 tMON `0x89e7edf9…ab9`; live claim `0x4f9dc291…7902` |
| Coolify tags after D-164 | senryo-api, senryo-keeper, senryo-web `sha-66679dd`; senryo-indexer `INDEXER_IMAGE_TAG=sha-66679dd` (reset via `envio start -r`, then resumed) |
| Coolify tags after S8.15 (30 Sep) | senryo-api, senryo-keeper `sha-c1893e5` (DB-IP geo loaded 2026-09; /v1/geo live) · senryo-web `sha-66679dd` · senryo-indexer `sha-66679dd` |
| Coolify tags after S8.5b (30 Sep) | senryo-api, senryo-keeper `sha-c66f65d` (security fixes live; spoofed X-Forwarded-For / cf-ipcountry ignored — verified) |
| Coolify tags after the keeper pass (30 Sep) | senryo-api, senryo-keeper `sha-3c98d59` (keeper jobs + retention; KEEPER_JOBS env updated) |
| StarterDrip.setConfig on 10143 (2026-09-30, user OK) | tx `0x7ebb0dc2c032f837b0aa0f60ad2c0deccc97b256bd9a8fdc3ce6a3747e73c28a` (block 67095606, gas limit 90k charged) — drip 0.05 → **0.15 MON**, top-up cap 0.2 → **0.5 MON**/user/day; budget 2 MON/day and practice/voucher amounts unchanged; float 0.35 tMON (user faucet to `0xD112a9A3Faa3491e3a91b95c0924b3eEaB85b207`) |
| Coolify tags after S8.16 (30 Sep, user OK) | senryo-api `sha-e19168f` (top-up route, relay reconciler, migrations 0004 + 0005 applied, social handles/profiles/follows) · keeper unchanged `sha-3c98d59` |
| Testnet MON rebalance (1 Oct; user faucet 10 MON → StarterDrip) | StarterDrip.withdrawNative 2.5 → deployer `0x32b2a60e0ab1ad420cb2846684cc42c29d44ac1128aa3cd5dc68ac2953430064` · deployer → keeper 1.5 `0xfeeb938a91c578bef7de53b1a33c1280045ea10dbef2c5f6d59b20ebf0137fb7`; after: drip 7.85 · deployer 1.32 · keeper 2.17 · sponsor 1.21 |
| Coolify tags after S8.24/S12b (1 Oct) | senryo-api, senryo-keeper `sha-17fb8f0`: migrations 0006 (inbox watches + push chain_id) + 0007 (social feed) applied; `/v1/inbox/watch`, leaderboard, feed live; API_ADMIN_SECRET set (value in `~/.config/senryo/api-admin-secret`); KEEPER_JOBS += sweeps |
| AddMarkets run 1 (S8.23, 1 Oct, 10143) | 21 txs, 0.4835 MON (`contracts/broadcast/AddMarkets.s.sol/10143/run-latest.json`): MirrorEUR `0x43B8aBD44f7449440ad40D3D78F50410F78006e4` · MirrorGBP `0x1522c08A436b81fFCaB31C1D580977acE9288c6c` · MirrorJPY `0x05Eb5fa4Ad197DA61de2bfEdEAD4adf73111615a` · MirrorCHF `0xcBA9503f66FCc4FB94c48388D906438b3ca78c73` · MirrorCAD `0x12eA933c1BB0086bE750845a9B2590479C1A84Ec` (block 67186517); 11 PARAM_ADMIN ops scheduled, executable after 2026-10-01 12:32:08 UTC → run 2 |
| Coolify keeper env (1 Oct) | `sha-246a69b` (address book with the FX mirrors) · KEEPER_JOBS `…,retention,sweeps` · MIRROR_MARKETS `XAU,XAG,EUR,GBP,JPY,CHF,CAD` · OPS_WATCH_WALLETS now watches the live StarterDrip `0xD112…b207` (was the pre-D-164 drip `0x5C1a…2e81`, empty) |
