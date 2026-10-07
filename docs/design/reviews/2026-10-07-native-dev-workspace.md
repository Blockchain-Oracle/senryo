# Native workspace and pricing verification — 7 October 2026

Follow-up to the approved [UGLYCASH revamp](../../plan/uglycash-revamp-2026-10-07.md). The user explicitly requested development access to the actual app, fewer sign-in/build loops, functional long/short trading and pricing repair. This amendment preserves the complete approved roadmap.

## Implemented

- `pnpm dev:mobile`: one persistent local Anvil/controller/Metro loop, process-group cleanup on stop, local logs and clear occupied-port failures. Expo's IPv4 advertised URL / IPv6 listening mismatch is handled with an explicit `localhost` packager hostname.
- `__DEV__` plus explicit public opt-in; separate MMKV namespace, memory-only deterministic fixture credential, automatic native dashboard entry and foreground unlock in the workspace. Real account derivation/policy/signing remains in use on the local fork; no production account is adopted.
- Both Practice reads and signed broadcasts use the loopback RPC. Mainnet selection is disabled and Mainnet sender creation rejects. The controller verifies Anvil/chain before serialized local funding, reset and oracle changes.
- In-app development controls and native developer-menu entry: Money/Trade/Profile routes, Gold ±1%, pause/resume oracle updates, replay onboarding, retry and reset. Local profile edits persist through hot reload. Holdings are read at one finalized block from the fork's MON/AUSD/USDC fixture universe, not hardcoded balances.
- Home Mainnet selects the already-existing direct-feed row rather than querying absent engine contracts. Rows observe one feed each, with shared cache/stale time, positive/non-future round validation, source timestamps, failed-refresh retention and retry. Detail has an explicit failed-feed state. Non-open or expired socket ticks are not live.

## Evidence and bounds

- `mobile-dev-check.ts`: the same fixture credential opens `AccountClient`; preparation is idempotent, initial trading balance is 75 P$, real `sendTracked` long and short opens reach finalized, positions reflect their side, controlled price changes reach the oracle, real closes clear positions, and reset restores balance/positions. Local Anvil only; no public transactions.
- `mobile-dev-boundary-check.mjs`: evaluates the actual config in isolated globals. Release ignores opt-in, development without opt-in is disabled, disabled controls make no request, configured endpoints are loopback.
- Mobile and Drive TypeScript, focused Biome and repository invariants pass. Final iOS and Android Release Hermes exports also pass with the opt-in set; Release still disables the workspace. Native iOS Debug build succeeded and was installed; Metro served the development bundle. The earlier first-slice signed Release binary remains separate.
- Native dashboard was observed automatically signed in as `@senryo_dev`, with 100 P$ across wallet/trading. The Expo developer tutorial initially covered it; the workspace now registers its own native developer-menu entry and closes that menu when ready. Full touch-driven menu/ticket/onboarding replay checks are not claimed: the Mac locked during computer use. Contract lifecycle checks above are separate, completed evidence.
- Final dashboard capture confirms the restored P$100 and no generic holdings or starter-relay error. The production claim card is hidden only in dev because the controller already funds the account directly. Private capture: `/Users/abu/.codex/artifacts/senryo-uglycash-2026-10-07/development/dashboard.png`.
- Direct Monad Mainnet Chainlink reads: XAU age 92s, XAG 266s, EUR 252s, GBP 127s, JPY 137s, CHF 166s, CAD 150s; every answer positive. Prices were available independently of undeployed Mainnet SenryoCore. This is a point-in-time check, not a claim about continuous feed/provider uptime.
- Disk exhaustion stopped Metro once. About 3 GB of generated Release intermediates in this task's Senryo DerivedData were removed; source, installed app, Debug intermediates and build products were retained. Metro resumed.

## Remaining

The workspace initially targets host-local iOS Simulator, with Android reverse-port instructions. Physical-phone host access needs its own setup. Passkey/Face ID production behavior, provider funding/card, indexed local history/social standings, service-specific scenarios and native BTC/ETH prediction execution remain separate work. Unsupported API fixtures fail explicitly and never fall through to production writes. Controlled fork prices are labelled development data, not external live executions. Full UGLYCASH route/state parity is not complete.

Logs: `/tmp/senryo-dev-check-final.log`, `/tmp/senryo-dev-typecheck-final.log`, `/tmp/senryo-dev-drive-final.log`, `/tmp/senryo-dev-invariants-final.log`, `/tmp/senryo-dev-export-final.log`; running workspace logs `/tmp/senryo-mobile-dev/`. Private simulator captures remain outside Git.
