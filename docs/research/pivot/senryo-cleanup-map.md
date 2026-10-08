# Senryo cleanup map for S1 (inventory taken 8 Oct 2026 at HEAD `ad8a46a`)

**Rule:** cut the import edges first, then delete in the same stage. Never leave a parallel path behind. Migrations are append-only: add a drop migration, don't edit old ones.

## Workspace

| Path | What it is | Size |
|---|---|---|
| `apps/mobile` | Expo ~57.0.26, RN 0.86.3, expo-router 57, React 19.2.3, Skia, MMKV | 602 src files |
| `apps/web` | Next 16.3.6 static export (nginx), Tailwind 4 | 27 routes, 134 components |
| `services/api` | Fastify, zod, Postgres | 103 files |
| `services/card` | Lithic card | 30 files |
| `services/keeper` | 11 jobs | 22 files |
| `services/common` | db, sessions, notifications, push, migrations 0001–0014 | 32 files |
| `packages/*` | account, chain, query (60 modules), api-client, config, contracts, core, identity, indexer-client, tokens | — |
| `contracts/` | Foundry, solc 0.8.31, osaka, via_ir | 39 src files |
| `indexer/` | Envio 3.12.1, outside the pnpm workspace | 12 handlers |
| `scripts/` | invariants, env-check, contracts-export, mobile-dev, drive (54) | — |

## Keep, and the edges that break when trading code goes

- **Mera passkeys and sessions** (`packages/account`):
  - `derive.ts` (PRF → BIP-39 → EOA), `client.ts`, `ceremony.ts`, `platform/passkey.{native,web}.ts`, `session/{manager,signer,queue,chip}.ts`.
  - **Edges:** `policy/decode.ts` imports `senryoCoreAbi`, `lpVaultAbi`, `perplExchangeAbi`, `practiceSwapAbi` and `PERPL_*`. `policy/targets.ts` reads the address book. `typed-data.ts` imports `TRIGGER_DOMAIN`. Rewrite all three.
  - **Mobile side:** `apps/mobile/src/lib/account/*` (18 files), `lib/biometrics.ts`, `features/auth/*`.
- **Passkey domains:** `apps/web/public/.well-known/{apple-app-site-association,assetlinks.json}` on `senryo.xyz` (`RP_ID` in `packages/config/src/hosts.ts`). Keep the web deploy alive.
- **Onboarding:**
  - Keep `app/welcome.tsx` and `features/onboarding/*`, with new copy and art.
  - Setup steps `["handle","follow","money","terms","face-id","notifications","done"]`:
    - drop `follow`;
    - `money` currently calls StarterDrip → replace with the Test USD grant;
    - `handle` imports `features/profile/{handle-copy,ShowTrades,VisibilitySettings}`.
- **Shell:**
  - Keep `app/(tabs)/_layout.tsx` and `components/shell/*`.
  - `TABS`/`FAN_ACTIONS` in `components/shell/constants.ts` change.
  - **Edges:** `app/_layout.tsx` imports `features/markets/WatchlistSync` and `MarketDataProvider` (`lib/market-data.tsx` imports `devPerplSnapshot`). The `SHEETS` list names card, compose-thesis and risk sheets.
- **Design kit:**
  - Keep `packages/tokens`, `apps/mobile/src/theme/*`, `components/{kit,sheet,identity,toast}`, `feedback/*` (sounds `assets/sounds/*.wav`), and `components/trade/{SlideToConfirm,HoldToConfirm,Keypad}.tsx`.
  - Delete `LeverageRuler.tsx`.
  - `components/charts/HistoryChart.tsx` imports `features/markets/{PeriodChips,periods,QuietLine}`, `features/tokens/format` and `features/trade/candle-style`. **Move these into `components/` first.**
- **Wallet:**
  - `packages/query/src/{wallet,account,money-assets}.ts`. `money-assets.ts` imports `PERPL_COLLATERAL`.
  - `packages/chain/src/{send,journal,fees,recovery,confirm,nonce,heads,token-reads,siwe,clients,chains}.ts`.
  - `receipt-facts.ts` imports `perpl/fills.ts`: trim it.
- **Network switch:**
  - Keep `apps/mobile/src/lib/network.ts`, `features/network/*`, `packages/config/src/networks.ts`.
  - `mainnetTradingLive()` and `packages/query/src/capabilities.ts` key off `isDeployed(143,"SenryoCore")`. Re-key them to the new contracts.
- **Notifications:**
  - Keep `services/common/src/{notifications,push-delivery,expo}.ts`, the keeper's `pushes`/`receipts`/`retention`, `lib/notifications/*`, `features/notifications/*`.
  - **Edges:** `NotificationsScreen` imports `markets/{AlertsScreen,PageHeader,QuietLine}`; `SubjectMark` imports `portfolio/market-id`.
- **Receive:** keep `(sheets)/receive.tsx` and `fund/{ReceiveCard,DottedQr,address-actions}`. Move them out of `fund/` before deleting it.
- **Contracts kept:** `predictions/PythBoundaryOracle.sol`, `oracle/MarketCalendar.sol`.

## Delete

- **Mobile features:** `perpl/`, `trade/`, `card/`, `swap/`, `lp/`, `positions/`, `portfolio/`, `tokens/`, `asset/`, `social/` (except profiles), `fund/` (after moving Receive), `money/ramp*`, `predictions/` (replaced).
  - Components: `components/trade/{LeverageRuler,MarginGauge,ExecutionTrace,OperationSummary,Preset}`.
  - Routes: `app/(tabs)/{card,social}/**`, `markets/[market]/**`, `markets/tokens/**`, `markets/predict/**`, `app/{lp,orders,perpl/withdraw,positions/[id],fund/**,watch/**,asset/**}`.
  - Sheets: `card-*`, `compose-thesis`, `social-actions`, `leaderboard-info`, `risk-explainer`, `eligibility`, `transfer`.
  - **Edges:** `app/(tabs)/home/index.tsx` imports `CardFace`, `TopTrades` and `RiskBanner`. `features/home/*`, `profile/ProfileTabs.tsx`, `activity/*` and `search/SearchScreen.tsx` import portfolio, perpl and social.
- **Contracts:**
  - `src/core/*` (12 files), `lp/LpVault`, `oracle/SessionOracle`, `periphery/{CollateralSwapper,DepositInbox,InboxFactory,IntentRouter,StarterDrip}`, `testnet/{MirrorAggregator,PracticeSwap,MockAUSD}`, `interfaces/ISenryoCore`, `libraries/PerpMath`, `predictions/{SenryoBinaryV1,BinaryMath}`.
  - Every script except new ones; tests `test/{fork,fuzz,invariant,money,oracle,testnet}`.
  - `MockStable` needs `libraries/{Constants,Errors}`; TestUSD replaces it.
- **Packages:**
  - `chain/src/{perpl/*,spot*,aggregator-swap,uniswap,practice-swap,lp-reads,market-reads,keeper-reads,discovery-reads,portfolio,bridge-steps,binary-*}`.
  - About 35 `query` modules (`perpl-*`, `lp*`, `card`, `orders`, `triggers`, `spot*`, `pay-with`, `ticket-pay`, `social*`, `discovery*`, `compose`, `pool-deposit`, `practice-swap`, …).
  - `config/src/{perpl,perpl-exchange,spot,markets,discovery,inbox,anyasset,bridges (keep the Aurora parts),prediction-execution}`.
  - `core/src/risk/*` (also drop the `risk-mirror-constants` invariant).
  - `api-client/routes/{card,trade,swap,bridge,holders,posts,feed,leaderboard,follow,predictions}`.
- **Services:**
  - `services/card`, plus its Coolify app and `deploy/card.env.example`.
  - API: `anyasset/` (keep only Aurora → `deposit/`), `social/` feed/posts (keep profiles), `routes/{practice,inbox,holders,posts,leaderboard,follow,anyasset,predictions,binary-predictions}`, `predictions/*`, `ws.ts` (WsHub) and `@fastify/websocket`.
  - Keeper jobs: `liquidate`, `observe`, `mirror`, `triggers`, `holds`, `alerts`, `sweeps`.
  - `starter.ts` and `topup.ts` are rewritten in S3.
- **Indexer:** handlers `card`, `ledger`, `lp`, `oracle`, `periphery`, `perpl-*`, `positions`, `risk`, `feeds`, `binary-*`. Rewritten in S4.
- **Web:** all 22 `(desk)` routes and most of `components/` and `lib/`. Keep `page.tsx` (the landing revamp), `judges`, `terms`, `privacy` and `.well-known`.
- **Ramp:** `features/money/{ramp,useRampBuy}.ts`, `@ramp-network/react-native-sdk` and its patch, and `extraPods` Ramp in `app.config.ts`. This needs the native build (S1b).
- **Env to drop:** `CARD_URL`, `LITHIC_*`, `MIRROR_*`, `OBSERVE_*`, `LIQUIDATE_MS`, `SWEEPS_MS`, `RELAY_API_KEY`. **Keep `AURORA_API_KEY` and `ALCHEMY_API_KEY`** (services RPC).

## Testnet money today (replaced in S2/S3)

- `MockUSDC` `0x68225DA6Df9d1Bd54f26D308Fb453333dC2a69A1` (no permit).
- `MockAUSD` `0xA56060…9E23`.
- `StarterDrip` `0xD112a9A3…b207`, relayed by sponsor `0xb00A73…DA99`.
- `POST /v1/practice/perpl-funds` (commit `35e3257`).
- There is no paymaster: "sponsored" means MON top-ups. The keeper burns about 2 MON/day (`docs/development/practice-mon-runbook.md`).
