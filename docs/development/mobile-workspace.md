# Native mobile development workspace

The approved UGLYCASH revamp remains the product direction. This workspace makes actual native dashboard, long/short, positions, close and receipt work repeatable without OS sign-in ceremonies.

From the repository root:

```sh
pnpm dev:mobile
```

Requires the installed Monad-capable Anvil and a Senryo **development client**. The command starts a loopback Anvil fork of Practice, a local fork controller, and Metro with the explicit development opt-in. Logs are in `/tmp/senryo-mobile-dev/`. Stop the previous session before restarting; Ctrl+C stops all three children. Normal TypeScript/React changes use Fast Refresh; native dependencies/config changes require a new development binary. Never use repeated Release builds for screen iteration.

The development client opens Metro at `http://localhost:8081` (Expo `--localhost` can bind IPv6, so don't substitute `127.0.0.1` for Metro). For the booted iOS Simulator:

```sh
xcrun simctl openurl booted 'senryo://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081'
```

The dashboard opens automatically. Tap **DEV · Local fork** for Dashboard, Markets, Profile, Gold ±1%, oracle pause/resume, onboarding replay, workspace retry and reset. Reset restores 75 P$ in trading, 25 P$ in the wallet, test MON for gas, and no positions. Native risk disclosures still apply to the actual ticket. Prices are controlled fork observations, not a claim of real-time external market execution.

The local controller funds this account directly, so the production starter-relay claim card is hidden in this workspace. It remains unchanged in normal builds.

The workspace is **iOS Simulator / host-local** initially. Android requires `adb reverse tcp:18765 tcp:18765` and `adb reverse tcp:18766 tcp:18766` plus the normal Metro reverse. Physical phones need a separately designed authenticated host connection; loopback on a physical phone is not the Mac. Do not point the public fixture account at a public RPC.

## Isolation

- Both `__DEV__` and `EXPO_PUBLIC_DEV_WORKSPACE=1` are required. A Release bundle ignores the opt-in.
- MMKV uses `senryo-dev-workspace-v1`; production choices, accounts and journals stay separate. The fixture account uses memory only, with no Keychain/passkey adoption.
- Mainnet selection is disabled. Both read and broadcast clients for Practice use the loopback fork; Mainnet signing is rejected before sender creation.
- The host controller verifies Anvil's client identity and chain ID before cheats, and binds only `127.0.0.1`. Funding/reset/price controls are serialized.
- The API adapter validates against real route schemas and handles local profile/username, counts, geo and empty-feed fixtures. Unsupported provider/service actions fail explicitly; there is no fallback to production writes. Production socket subscription and encrypted preference pull are disabled here.
- Passkey and Face ID are bypassed explicitly in this workspace. Their genuine production flows still require separate simulator/device acceptance. This is not a production-auth test.

## Checks

With the local workspace running:

```sh
pnpm --filter @senryo/drive exec tsx src/mobile-dev-check.ts
pnpm --filter @senryo/mobile typecheck
pnpm --filter @senryo/drive typecheck
node scripts/mobile-dev-boundary-check.mjs
node scripts/invariants/run.mjs
```

The local contract check verifies idempotent preparation, 75 P$ initial trading funds, real long and short opens through `AccountClient`/policy/`sendTracked`, finalized positions, controlled price movements, real closes, and reset. It makes no public-chain transactions. Indexed social/activity, provider funding/card and BTC/ETH prediction execution are not fabricated by this workspace and remain in the approved product roadmap.
