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
| Firebase / FCM (1 Oct, D-233) | GCP + Firebase project `senryo-app-xyz` (number 932514385020, owner abubakrclouds@gmail.com); Android app appId `1:932514385020:android:cb7573832fa35ab0304df9`; FCM v1 sender `expo-push@senryo-app-xyz.iam.gserviceaccount.com` → EAS Android app credentials `7377b4dd-0198-46cd-b7da-04155e87f979`; EAS env `GOOGLE_SERVICES_JSON` (file, secret; development/preview/production) |
| Google Play (1 Oct, D-233) | release service account `play-release@senryo-app-xyz.iam.gserviceaccount.com` (androidpublisher API on) → EAS submissions key; the user created the app and invited that account with release rights (1 Oct); verified: the account opens an edit on `xyz.senryo.app` |
| iOS push (1 Oct) | EAS ad hoc profile AWA29Y7G73 regenerated with Push Notifications; APNs key created and assigned to xyz.senryo.app; dev build `f9b17239-56d0-4e12-af27-49466ec5ad90` FINISHED |
| Android dev build (1 Oct, D-233) | `3bd03486-92b4-4bff-8ee8-f352571b2e1b` FINISHED — APK with FCM (google-services from the EAS file variable), expo-notifications and local auth; same keystore as e8d03e99 (assetlinks fingerprint unchanged) |
| Play internal testing (1 Oct, D-233) | production build `f7ec3a56-4e57-4f95-98c3-a4cca9fff24d` (AAB, 0.1.0, versionCode 2) submitted by `eas submit` (submission 41574d37-4cf3-440f-adba-7a2688b853bd) — no manual first upload was needed; the Play API shows internal: draft, versionCodes [2], "0.1.0 (2)". Rolling it out to testers is a Play Console step (user) |
| Play App Signing certificate (2 Oct, D-233) | SHA-256 `8E:E1:96:5B:E6:FC:72:7C:66:3B:7A:49:B0:8E:80:50:DD:78:1C:65:5B:A4:D6:95:62:43:DE:5F:2E:F8:5D:D4` (Play Developer API generatedApks, versionCode 2) — in `ANDROID_CERT_SHA256S` and live in senryo.xyz assetlinks (web sha-ddfdce2, 2 fingerprints) |
| Play internal rollout (2 Oct, D-233) | internal track release "0.1.0 (2)" set to completed through the Play Developer API (edit 18305389564185735753 committed); the Play API now reads internal: completed, versionCodes [2]. Standalone APK (preview profile, embedded JS) build `ddf13930-ba65-452f-9c7b-2e63810ec428` FINISHED |
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
| Keeper top-up (7 Oct 16:05 UTC, 10143) | Keeper ran dry (0.0084 MON); every mirror feed stale since 4 Oct 14:11 UTC and every market showed "Price paused". StarterDrip.withdrawNative 2.5 → keeper `0xb564870e20e0e234e48d514781ebb5ef5ab60988ccb4eef4987244dd885e3722` (block 69013312, deployer keystore); after: keeper 2.51 · drip 2.41. XAU feed updated again 16:06:32 UTC |
| Keeper top-up (8 Oct ~09:45 UTC, 10143) | Keeper burning ≈2 MON/day (2.51 → 1.02 in ~17.5 h). StarterDrip.withdrawNative 1.2 → keeper `0xf668af900e13e06d5f145082bf73d4c92768c45a34c36c797f49a3ebf61e2673` (block 69220611, deployer keystore); after: keeper 2.22 · drip 1.21 · sponsor 0.25 · deployer 0.08. Runway ≈1 day — see `docs/development/practice-mon-runbook.md` |
| iOS OTA (8 Oct, production, runtime 0.3.0) | Group `06cc0818-5758-423d-909c-3135ee307d85`, iOS update `01a11b13-d902-7767-8c3f-9aee58e6c937`, source `6316f36` (D-255 Face ID step-up + foreground wait, named card states, single-flight API sign-in) on top of everything committed since `7714c36`. Codex's uncommitted prediction/card/binary files were stashed out of the export and restored. Device application not yet observed |
| senryo-api `sha-35e3257` (8 Oct, real venues Stage 1) | COPY-only layer over `sha-fde67c6` (bundle of committed `35e3257`; Codex's uncommitted binary-history files stashed out), digest `sha256:7a24ca3e6b729ef0ced4ee0fd250f70f1dc895e4633cd3b8b978a5b5b7773863`, Coolify deployment `4eygpb9qv3ytvvu0tgi5sepw`; migration 0014 (`perpl-funds` relay kind); new `POST /v1/practice/perpl-funds`; Test AUSD · Perpl listed on 10143. Card/keeper unchanged (`sha-34b2af3`). Rollback: `sha-fde67c6` |
| iOS OTA (8 Oct, Stage 1, production, runtime 0.3.0) | Group `1736175c-5d78-4b8b-b186-f48fa48ed359`, iOS update `01a11b47-d191-7983-a1bc-64acb365573d`, source `283ec60`: Get test money (Perpl test AUSD, gas-free), Practice MON top-ups before Perpl sends, per-network risk explainer, guest drafts kept, Perpl fills read on their own network. Codex's uncommitted files stashed out and restored |
| Coolify tags after S8.24/S12b (1 Oct) | senryo-api, senryo-keeper `sha-17fb8f0`: migrations 0006 (inbox watches + push chain_id) + 0007 (social feed) applied; `/v1/inbox/watch`, leaderboard, feed live; API_ADMIN_SECRET set (value in `~/.config/senryo/api-admin-secret`); KEEPER_JOBS += sweeps |
| AddMarkets run 1 (S8.23, 1 Oct, 10143) | 21 txs, 0.4835 MON (`contracts/broadcast/AddMarkets.s.sol/10143/run-latest.json`): MirrorEUR `0x43B8aBD44f7449440ad40D3D78F50410F78006e4` · MirrorGBP `0x1522c08A436b81fFCaB31C1D580977acE9288c6c` · MirrorJPY `0x05Eb5fa4Ad197DA61de2bfEdEAD4adf73111615a` · MirrorCHF `0xcBA9503f66FCc4FB94c48388D906438b3ca78c73` · MirrorCAD `0x12eA933c1BB0086bE750845a9B2590479C1A84Ec` (block 67186517); 11 PARAM_ADMIN ops scheduled, executable after 2026-10-01 12:32:08 UTC → run 2 |
| AddMarkets run 2 (S8.23, 1 Oct 12:33 UTC, 10143) | 11 txs, all status 1, 2,577,143 gas, 0.2629 MON (`contracts/broadcast/AddMarkets.s.sol/10143/run-latest.json`): first `0x70a9bcec1c7b84448b6f6ae4ec994062dafda1a2f6b5857ba497572b038f679d` (block 67258533) … last `0x5b208a25359c5e7d1dfb141d22e143298dcbda05cd154c6989fbcdae8d69ad52` (block 67258605); calendar → 5 FeedInits → 5 MarketParams executed; `SenryoCore.allMarketsOpen()` = true; deployer 0.5725 tMON after |
| Coolify keeper env (1 Oct) | `sha-246a69b` (address book with the FX mirrors) · KEEPER_JOBS `…,retention,sweeps` · MIRROR_MARKETS `XAU,XAG,EUR,GBP,JPY,CHF,CAD` · OPS_WATCH_WALLETS now watches the live StarterDrip `0xD112…b207` (was the pre-D-164 drip `0x5C1a…2e81`, empty) |
| Coolify tags after S8.23 run 2 (1 Oct 13:00 UTC) | senryo-web, senryo-api, senryo-keeper `sha-e91d5dd`; senryo-indexer `INDEXER_IMAGE_TAG=sha-e91d5dd` — the new image refused the old storage (FX feed contracts added since `sha-66679dd`), so it was reset with a one-off `envio start -r` on the same env and network, then the normal container resumed (both chains re-fetched from HyperSync); `/v1/markets?chainId=10143` lists 7 engine markets OPEN |
| Coolify tags after push delivery (1 Oct 13:45 UTC) | senryo-api, senryo-keeper `sha-37f3473` (keeper delivers user pushes through Expo, migration 0008 `push_tickets` applied, `PUSH_DELIVERY` default on, no `EXPO_ACCESS_TOKEN`) · KEEPER_JOBS += `receipts` (Coolify env and `~/.config/senryo/deploy/keeper.env`) · a server-side send to the simulator's registered token returned `InvalidCredentials` — the EAS project has no APNs key yet (user step: Apple login) |
| Coolify api after Holders (1 Oct 14:50 UTC) | senryo-api `sha-08262bf` (`GET /v1/markets/:marketId/holders`, optional session); keeper stays `sha-37f3473` |
| Coolify tags after S1b.9a discovery (1 Oct 18:02 UTC) | senryo-indexer `INDEXER_IMAGE_TAG=sha-ba4b5e2` — the six Chainlink calculated equity feeds (FeedWSPYX…FeedWEWYX, plus their aggregator successors) on 143; the image refused the old storage, so it was reset with a one-off `envio start -r` on the same env and network, then the normal container resumed (both chains re-fetching from HyperSync); web/api/keeper unchanged |
| Coolify tags after S11b slice 1 (1 Oct 19:15 UTC) | senryo-web `sha-0027eb9` — the desk reads real markets, candles, positions and portfolio (review S04); api `sha-f9cd161`, keeper `sha-d426a89`, indexer `sha-ba4b5e2` unchanged |
| Coolify tags after the legal pages (1 Oct 21:45 UTC) | senryo-web `sha-c44e675` — senryo.xyz/terms and /privacy (200) render the app's own text from @senryo/config; the Play listing's privacy-policy URL is https://senryo.xyz/privacy |
| Practice scale run 1 (1 Oct 20:21 UTC, testnet 10143) | `contracts/script/PracticeScale.s.sol` scheduled 8 PARAM_ADMIN ops (LpVault.setTvlCap 4,000,000 AUSD; SenryoCore.setMarketParams 0–6 with absolute OI caps ×4000), all status 1: 0xb1bb38e3…f39c, 0x6573e280…8303, 0x63cd7747…d7f399, 0x49a04f5b…70dc, 0xe511a1a4…560b, 0x6e35cb0c…0ace, 0x464a42cb…b0b4, 0xd25ec089…8b6c (blocks 67351285–67351307); executable after 02:21 UTC 2 Oct. Same evening the pool was filled to the existing 1,000 AUSD cap: mint 0x9cd4afe0…13d5, approve 0xfce212c9…458d, deposit 0x9a8603ee…5d05 (pool 276.49 → 999.64 AUSD) |
| Practice scale run 2 (2 Oct 04:26 UTC, testnet 10143) | 11 receipts, all status 1 (blocks 67447630–67447663): setTvlCap executed 0xc20c18d3…0d4f; setMarketParams 0–6 0xbca39972…e62b, 0x55e39a4a…2bc3, 0x0c6274e6…6e99, 0xb6a61f35…ff13, 0x2b314bba…c28c, 0xf90dbc9b…cf0d, 0x0290a735…71ad; mint/approve/deposit 0xab30dfc5…512c, 0x54072582…8320, 0xc016f471…f757 (deposited 999,000.424526 AUSD). Onchain after: LpVault totalAssets 1,000,000 AUSD, tvlCap 4,000,000; oiCapAbsUsd6 gold/silver 600,000, EUR 150,000, GBP/JPY 100,000, CHF/CAD 75,000 (pool bps unchanged; Σ FX abs = 50 % of the seed). Keeper top-up from the sponsor 0.4 tMON 0x3bd06128…bd10 (keeper 0.947) |
| Coolify after the pivot cleanup (S1, 8 Oct, context `agari-new`) | **senryo-card `bw3mwbxy5muoflqpumyq2btk` deleted** (stopped first; its env stays in `~/.config/senryo/deploy/card.env`, outside the repo) · **senryo-indexer `gafyrh7f6esyaxbcubnogjwc` stopped** (trading schema; S4 redeploys it with the markets schema) · **senryo-keeper `cskiutyjlluqkfupj4bixxs3` KEEPER_JOBS = `retention,receipts,pushes`** and restarted healthy, so the old liquidate/observe/mirror/sweeps jobs stop spending testnet MON before S3 · senryo-api `lzumxcf5…` and senryo-web `2zeju5a5…` unchanged (old images serve the 0.3.0 app until S3 / S6) |
| Markets deploy (S2, 8 Oct, Monad testnet 10143) | `contracts/script/DeployMarkets.s.sol` from `contracts/script/catalog/10143.json`, deployer `0x52d205731E97C90aAB738AE66371449F585C0E6A` (keystore `senryo-deployer`); 97 txs, all status 1, 3.148 MON; first `0xc46b8019cf3698a33f22c6f85c18083ba5fab9535778e52105ec5d2af42d51ea` (block 69306333) … last `0xecefa82303836c7bb7bc9403a7f72a465df82acdd57a7ae8e3be9c2c6a2cc7ef` (block 69306645); `contracts/broadcast/DeployMarkets.s.sol/10143/run-latest.json`. AccessManager `0x4b860aC358C9030b6B608ab484c4BF2728643A5D` · MarketCalendar `0x068ddE517bb332C089aBde3028D5714eC45E2A4c` · PythPrintVerifier `0x06C766c57c88124db9D302cD2050bEbAD9c1b5Df` (grace 5 s, 25 bps, admission 300 s, receiver `0xFC6bd9F9…d379`) · Windows `0x6f4Cc798951f889b9f2a7029C1D8D7749860dF69` · TestUSD `0xeA23d6884b7861d2b9324C6A542020e8995cd3D3` (MINTER: sponsor `0xb00A73D3…DA99` + deployer) · BandReserve `0xbcf5E007DBFd1BF579fFD17CbA0e3885906230D4` (Practice caps $1,000 / $10,000 / 60 min). 12 series (BTC, ETH, SOL × 1m/5m/15m/1h), 5 bands each, configVersion 13; pool funded 10,000,000 tUSD, liquid = liabilities |
| MON for the deploy (8 Oct) | old StarterDrip `0xD112a9A3…b207` `withdrawNative` 1.060041777 MON → deployer `0x0ff3a5f1726bdfbea73c15626ca0e51c72663ca1083a4b67e05a489a777c73e7`; keeper → deployer 3 MON `0x08cb0245a7130c67fe3ba0a716c929d4e84787ee6af96b416c0f75a78143b2dd`; after the deploy: deployer 0.978 · keeper ≈ 3.8 · sponsor 5.17 |
| First live print (S2 smoke, 8 Oct) | BTC 1m window `0xe3981a5c27b6f02f9bbe40211491410204aacb1c79542ef896ec154176da0ad6` (start 1791478140) opened permissionlessly; its open print recorded from a keyed Hermes proof through the deployed verifier: `0x085f52b5a9c391ae08106521dbfc111fa3c74541ed9307e522c32db84b96165e` → priceE8 8106000563143 ($81,060.01), conf $17.44, publish = T |
| Native build 0.4.0 (S1b, 8 Oct, EAS production) | iOS `b58f4e7d-e55f-4763-9ac2-9f34e6809041` (build 11, source `e43559e`) · Android `eeea91ec-dcf0-420c-bb5f-24e3bb8c25f1` (versionCode 5, source `724773a`) — both FINISHED; runtime 0.4.0 (appVersion policy). Earlier attempts: iOS `b4cfb4bf…` ERRORED (the first `.easignore` dropped `packages/contracts`, fixed in `724773a`), Android `b497320e…` cancelled (same archive) |
| Store submissions (S1b, 8 Oct) | TestFlight: EAS submission `35757f21-0049-4a1e-9f83-a3d6f3deb051` (iOS build 11, ascAppId 6818426846) · Play internal track: EAS submission `3181e36a-07d7-4fd0-bd57-ac065e955162` (versionCode 5, draft) |
| Services deploy (S3, 8 Oct) | senryo-api + senryo-keeper `sha-9e77aaf` (run 37817451154) → `sha-cdcc70a` (run 37819092556) → `sha-9de6f09` (run 37821234393). Production migrations 0015 (trading tables dropped) + 0016 (markets) applied; relay lane sponsor `0xb00A73D3…DA99`; keeper jobs sync,settle,fills,retention,receipts,pushes; stale env removed (card, mirror, indexer GraphQL) |
| S3 journey on production (8 Oct, `scripts/drive/src/markets-public-check.ts`) | owner `0xe1545913701304f502C17430AC073bbD48816955`: practice grant `0x164f981b98e7440e1b8de387c1bbf685ffca12e9665796e3110e1e2a994b5cdd` · Up + permit commit `0x76c2b96f3704a2b9b55d172204df891031201b5cde1fde8883c8959e7007f267` · fill `0xc0d213e441c1eceff0bada1627497c0cdb7ea2efc0895f9f734cdef4950be021` (tap → fill 2,177 ms) · half cash-out `0x0073d62aef084a709b612688e762888e8e0910aaa00ca790647ad4036e9c1c96` · tickets 8 (Up, won, $7.60 back) and 9 (Down, lost) settled by the keeper. The run's Down status timed out because a second rollout restarted the api mid-call (fixed in `9de6f09`) |
| Indexer deploy (S4, 8 Oct) | Coolify **senryo-indexer `ujtx47ow956nd8dw3atpreke`** (Docker Image `ghcr.io/blockchain-oracle/senryo-indexer`, port 9898, no domain, 512m; env from `~/.config/senryo/deploy/indexer.env`): `sha-43254dd` (run 37826168518) crash-looped — Envio drops its dev fallbacks under `NODE_ENV=production` → `sha-f3d1580` (run 37827236053) healthy, fully indexed 3 s after start → `sha-36f882e` (run 37828718114) realtime RPC within Monad's 100-block `eth_getLogs` cap → **`sha-4348fd4`** (run 37830094010) with the system CA store, so the realtime RPC verifies TLS (0 source switches; head on the RPC). Ledger Postgres `tey5siakdz1nau7wnzaytgcn` db `senryo`: role **`senryo_indexer`** (CONNECT + CREATE on the database, nothing on `public`), schema `envio` owned by it. senryo-api + senryo-keeper `sha-43254dd` (history routes). **Old compose indexer `gafyrh7f6esyaxbcubnogjwc` deleted** with its `envio-pg-data` volume (186 MB, the pre-pivot trading index). Address book: Windows and BandReserve `indexed: true`. |
| S4 journey on production (8 Oct, indexer live) | owner `0x833f21D60ef0C83676CcF592671ed66dc110A5ae`: practice grant `0xba958d80059653ae04541b9ce20d988b176c76953f3ec14b10c4a330e8a646b3` · Up + permit commit `0x8f4d639a98882a8efb3d232143cac4f7b62bdbd6e0f9476509d094ce6b0d5342` · fill `0xfc6eb36799f6a3d1fda63e912d66e5ceaddb7dceb7a1746426aec439ccf79383` (tap → fill 2,553 ms) · cash out half `0xaae890d845f9943c50561903d35b15221213b4636e74890491d452741264d642` · Down commit + fill `0xeda3ce5b1c3872280aac5ff2a3870031d44c6ef8b94055c96e9be00ceaa0dbff` (2,019 ms) · settled + paid automatically · session grant `0xccf5520f18d9dc2e85c3724ade60a8bd7f360bde554ba623764bf3077f0895de` · session-key call + fill `0x50d6ce4be09b7fe76d6520f21a8ce774f4914b2e03cd860cafa1da677506306b` (4,548 ms). Indexed 2 s, 48 s and 1 s after their blocks on `sha-f3d1580` (the realtime RPC was failing TLS, fixed in `sha-4348fd4`). An earlier attempt stopped at a laptop-side `fetch failed` after its practice grant `0x1c27aea28a2d26ac3a23570a3eee630023cd33a8ccf23b7c3cf50e61a8f62a03`. |
| S4 journey on production after the indexer fixes (8 Oct, `sha-4348fd4`) | owner `0x4749bdC2Ec5E6e0aD6fB43be1fCfe21F1fff851f`: practice grant `0x9f57d15be262cd43ca375267b5f79d5acf8a721370dbb40a0c234a111aa4bf5a` · Up + permit commit `0x9870f0f85a6531a1189616366d7c46be5fb387a4697cd54e2d770602c34c29b8` (ticket 21, from the indexed timeline) · fill `0x4f4afcdbadb3e428fa107ffbee44de102d977d9dd4231d8d148a36764607251e` (3,979 ms) · cash out half `0xaf01d381918171685c55c48894da3ac22c91fa94053e0475437b8d3c5319efa5` · Down commit + fill `0x5cf150e489b2f90f441f717cd8080b183418da92649554732e5dea9a861a501a` (3,307 ms) · settled + paid automatically · session grant `0x1e0e668df17c650c9b8189ff8c520384db8bdcebc8d0d68b7ecd55dcb047e397` · session-key call + fill `0x7fd74f970a59813260d7764b2ef6693fbeb94576996f5136b99361f0ca5daf32` (2,471 ms). Every ticket event indexed 0–2 s after its block. Parity gate on production: 23 tickets, 9 owners, 15 windows — exit 0. |
