# References (cloned sources)

`references/` is gitignored. Each clone is pinned here. **Allowed use:** read and learn; copying code requires a licence check + an entry in `THIRD_PARTY_NOTICES.md` + README "pre-existing components" (rules §4.1).

| Dir | Upstream | SHA | Licence | Allowed use |
|---|---|---|---|---|
| mera | https://github.com/category-labs/mera | a3102f4 | Apache-2.0 | depend on `@category-labs/mera@0.2.0`; demo derivation (`demos/shared/src/hd.ts`) is the reference for our frozen path |
| react-native-passkey | https://github.com/f-23/react-native-passkey | de644ad | MIT | dependency (3.6.1 exact, Mera peer) |
| perpl-dex-sdk | https://github.com/PerplFoundation/dex-sdk | 01b9910 | MIT | enum/ABI reference (Rust); port to viem |
| perpl-api-docs | https://github.com/PerplFoundation/api-docs | 25ab6e2 | (none found — read only) | API reference, TS examples |
| perpl-dex-sdk-examples | https://github.com/PerplFoundation/dex-sdk-examples | c2a3098 | (none found — read only) | read only |
| perpl-delegated-account | https://github.com/PerplFoundation/delegated-account | 88ab0ea | (none found — read only) | read only |
| perpl-docs | https://github.com/PerplFoundation/perpl-docs | 3173c42 | (none found — read only) | read only (withdrawal limits, security) |
| intents-swap-widget | https://github.com/aurora-is-near/intents-swap-widget | 357e944 | MIT | Intents Connect SDK + Aave-on-Monad recipe reference |
| one-click-sdk-typescript | https://github.com/defuse-protocol/one-click-sdk-typescript | ae8b24e | ISC | 1Click API client reference |
| envio-hyperindex | https://github.com/enviodev/hyperindex | fb886a8 | see repo `licenses/` | V3 docs/reference |
| envio-local-docker-example | https://github.com/enviodev/local-docker-example | e158013 | (check) | compose reference (adapt for Coolify) |
| envio-wsteth-monad-indexer-demo | https://github.com/enviodev/wsteth-monad-indexer-demo | 3c7bbd4 | (check) | Monad config reference |

## Prior own work (pre-existing, disclosed)
| Source | Path | Pinned at | Use |
|---|---|---|---|
| Agari mobile kit | `/Users/abu/dev/hackathon/agari-wt/mobile-takeover/mobile/src` | `661a24eec7ff92a685758d62764d4e8ea851592d` (S5) | ported in S5 → `apps/mobile/src`: `theme/` structure, `kit/haptics.ts` → `feedback/{haptics,sound,fire}.ts`, `kit/states.tsx`, `drawer/BottomDrawer.tsx` → `sheet/Sheet.tsx`, `kit/PullRefresh.tsx`, `kit/Button.tsx`/`Screen.tsx` (rewritten D2), `polyfills.ts` (quick-crypto + AbortSignal only), `metro.config.js` singleton pinning, `app/_layout.tsx` headless hosts, `eas.json` profiles. Later stages: audio pool files, onboarding, push/AlertsHost, Live Activity/widget, CreditWelcome, WriteRecovery |

## Context7 library ids (S5)
| Library | Id | Used for |
|---|---|---|
| Expo docs | `/websites/expo_dev` | monorepos (pnpm isolated, auto Metro), NativeTabs, expo-glass-effect |
| Victory Native XL | `/formidablelabs/victory-native-xl` | CartesianChart, Area/Line, Candlestick, useChartPressState, axes with useFont |
| Agari invariants | `/Users/abu/dev/hackathon/agari-wt/mobile-takeover/scripts/invariants` | record SHA (S0) | invariant runner + rules |
| Agari money units | `agari-wt/*/packages/core/src/units/format.ts` | record SHA | bigint formatting |
| Design preview (this repo) | `design/preview` | this repo | D2 Desk 21st components (re-tokenize on adoption) |

## Context7 library ids and sources (S4)
| Library | Id / source | Used for |
|---|---|---|
| Envio HyperIndex docs | `/websites/envio_dev` | effect API (`createEffect`, `context.cache = false` on failure), observability port 9898 `/healthz`, preload-phase error semantics |
| Envio HyperIndex source | `references/envio-hyperindex` @ fb886a8 (bundled skills `packages/cli/templates/static/shared/.claude/skills/*`, `envio/src/Env.res`, `cli/src/config_parsing/{system_config,env_interpolation}.rs`) | V3 config/handler/schema API, RPC `for: sync` source selection, text-level env interpolation, prod env requirements |
| envio (npm) | `envio@3.12.1` (`node_modules/envio/{evm.schema.json,index.d.ts}`) | config schema + handler/effect/contractRegister typings (identical to the reference HEAD schema) |
| HyperSync client | `@envio-dev/hypersync-client@1.4.1` (`index.d.ts`, `examples/all-erc20`) | `HypersyncClient.stream`, `Decoder.fromSignatures` in `indexer/scripts/hypersync/` |
| Envio self-host example | `references/envio-local-docker-example` @ e158013 (no licence file) | compose/Dockerfile **structure** adapted for Coolify in `indexer/{docker-compose.yaml,Dockerfile}` (no code copied verbatim beyond standard boilerplate) |
| Perpl Exchange ABI | `references/perpl-dex-sdk/crates/sdk/abi/dex/Exchange.json` @ 01b9910 (MIT, REVISION `rc_v1.1.7-203-g0e5902dd`) | **copied subset** (15 events) → `indexer/abis/PerplExchange.json` — needs a THIRD_PARTY_NOTICES.md entry (S17) |
