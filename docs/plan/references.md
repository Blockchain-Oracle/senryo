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
| Agari mobile kit | `/Users/abu/dev/hackathon/agari-wt/mobile-takeover/mobile/src` | record SHA when porting (S5) | haptics, states, BottomDrawer, toast, audio pool, onboarding, push, Live Activity/widget patterns, polyfills |
| Agari invariants | `/Users/abu/dev/hackathon/agari-wt/mobile-takeover/scripts/invariants` | record SHA (S0) | invariant runner + rules |
| Agari money units | `agari-wt/*/packages/core/src/units/format.ts` | record SHA | bigint formatting |
| Design preview (this repo) | `design/preview` | this repo | D2 Desk 21st components (re-tokenize on adoption) |
