# Native trading validation — 7 October 2026

Source baseline: `344f009` plus this continuation. No public write, deployment or push. Test contracts run on the disposable loopback Monad Testnet fork.

## Contract and data evidence

Commands run from the repository root:

```sh
pnpm dev:mobile
pnpm --filter @senryo/drive exec tsx src/mobile-dev-check.ts
pnpm --filter @senryo/drive exec tsx src/perpl-faucet-check.ts
pnpm --filter @senryo/drive exec tsx src/trade-data-check.ts
```

Actual lifecycle output:

```text
Development account derived; preparing fork
Fork prepared
Initial balance and empty positions verified
Reading long setup
long: checking
long: signing
long: signed
long: proposed
long: voted
long: finalized
PASS long → finalized position → controlled price change → finalized close
Reading short setup
short: checking
short: signing
short: signed
short: proposed
short: voted
short: finalized
PASS short → finalized position → controlled price change → finalized close
PASS native test-AUSD faucet encoding, simulation and explicit gas cap
Perpl long marks 1311918 → 1315197; PnL -16650 → 229275
PASS native Perpl Practice long: actual fill → controlled mark → contract PnL → actual close
Perpl short marks 1315197 → 1311909; PnL -255132 → -5244
PASS native Perpl Practice short: actual fill → controlled mark → contract PnL → actual close
PASS Perpl withdrawal and isolated reset
PASS reset balances/positions; public fixture account, local Anvil only
PASS native faucet request → capped simulation → signature → finalized Agora test-AUSD balance (local only)
PASS local OHLC truth, reset, relay freshness/active rounds, and stream validation
{"symbol":"ZEC","chainId":143,"observations":3,"price18":"1319860000000000000000","sourceAgeMs":887,"samples":3}
{"symbol":"ZEC","chainId":10143,"observations":3,"price18":"1320269000000000000000","sourceAgeMs":1299,"samples":3}
```

Public read-only Mainnet `perpl-check` also passed open-account, unfilled IOC, filled IOC, close and withdrawal simulations in this session. Its public simulation outcome is not a real Mainnet position or transaction.

## Build gates

- Mobile, drive, keeper TypeScript: passed.
- Focused Biome for changed source: passed.
- Repository invariants: 0 errors / 0 warnings.
- `node scripts/mobile-dev-boundary-check.mjs`: passed actual release/development opt-in isolation and loopback endpoints.
- iOS and Android production Hermes export: passed, `/tmp/senryo-native-trade-export`. Existing `@noble/hashes/crypto.js` package-export warning remains.
- `git diff --check`: passed.

## Native observation and limits

Observed the updated Markets list, ZEC native Practice ticket, amount/keypad/leverage and actual liquidation/fee/size review. Local source labels and no Mainnet-only lock were visible. A native held-position capture showed the entry line, PnL card, collateral, free funds and close slider. CUA subsequently returned ScreenCaptureKit capture errors; final populated-position visual checks after the precision/padding correction are unverified. Device audio/haptics, biometrics, long-run reconnect/performance and provider delivery remain open. Contract checks do not substitute for those gates.

The local controller explicitly keeps development sessions open, impersonates the fork’s Perpl owner for controlled marks and uses the real Agora faucet on the fork. Those fixture changes never reach public RPCs. The keeper relay policy is source-only and still needs deployment plus post-deployment source-age verification.
