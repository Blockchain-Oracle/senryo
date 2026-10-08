# Senryo

**Senryo is a mobile app for pair trading on Monad, predictions, money flows and the Kinpaku card. Start with paper funds in Practice.**

The [current product brief](docs/product/current-product.md) records what is implemented, what is accepted and what remains open. The [reference follow-through plan](docs/plan/reference-followthrough-2026-10-04.md) retains the complete feature scope and the approved Slush, Fomo and Phantom direction. The website introduces the mobile app; its browser companion is secondary. Meme coins are not the product's positioning.

Monad Metropolis · Track 01 *Onchain Finance & Trading* · bounties: Agora Mobile Trading (Mera + AUSD + Perpl), Mera-Powered UX, Aurora Intents, Envio.

| Try it | |
|---|---|
| iOS | TestFlight beta: release record 0.3.0 (7). Invitation required; a public join link has not been verified. |
| Browser companion | https://senryo.xyz (passkeys need a PRF-capable authenticator: iCloud Keychain, Google Password Manager, 1Password) |
| Android | Older preview APK (runtime 0.2.0; current mobile parity is not confirmed): https://expo.dev/artifacts/eas/QT0s9Zj8MY0RFhJeKx3zPn8m6709ABJLrXj0oNvcNvo.apk |
| Judge guide | [`docs/judges.md`](docs/judges.md) (also at https://senryo.xyz/judges/): the fastest path through every feature, voucher codes, watch mode for geo-blocked regions |
| Live stats | https://senryo.xyz/stats/: accounts, trades, traded notional, pool value and a daily chart per network, read live from the public indexer and the pool contract |
| Demo video | *(added before submission)* |

## The problem and the first user

Someone in an emerging market who holds a little crypto and wants gold exposure, and to spend day to day without selling, has
to juggle a seed phrase, a bridge, a DEX, a perps venue and a card program, each with its own balance and its own way to
lose money. Senryo is one account (a passkey, no seed phrase) and one risk-accounted balance: the same dollars back a
leveraged gold trade, a pool deposit and a card payment, and the contracts guarantee the same dollar is never spendable
twice.

## What a user can do

- **Account:** create with one passkey ceremony (Mera 0.2.0, PRF → BIP-39 → EOA; no custody backend), sign in statelessly
  on any device, scoped prompt-free trading sessions with a passkey step-up above the session's caps.
- **Practice mode** (Monad testnet): P$100 to start and paper trading on Senryo's engine. Mainnet browsing remains available; the current public configuration enables Senryo money operations only on Practice. Provider setup and acceptance are separate from a screen being implemented.
- **Hold any asset:** every token at the address is discovered (Envio HyperSync, Alchemy fallback), verified against
  Monad's token list by address, priced, and can be received, sent, swapped (Monorail + KyberSwap, best of both, routers
  pinned, price-impact rule) or withdrawn: to a Monad address, to another chain (Relay, Circle CCTP v2, Across, LI.FI),
  or bought with a card via Ramp.
- **Trade:** gold (XAU), silver (XAG), EUR, GBP, JPY, CHF and CAD on Senryo's Practice engine (Chainlink feeds, market-hours
  calendar, TP/SL, liquidation keeper). **Perpl** markets can be discovered; enrollment, funding and live execution still require their acceptance gates. The composed swap → move → open journey remains in scope and uses one durable operation; it does not bypass those gates.
- **Predict:** Bitcoin/Ethereum binary price markets from Polymarket (settled on Polygon), plus numerical price contests from Castora (on Monad). Discovery, details, history and saved markets are implemented. Orders, entries, positions, settlement and claims remain in scope and are not enabled by the browsing UI.
- **Earn:** the trading pool (ERC-4626 on AUSD, delayed redeem).
- **Card:** Kinpaku's Lithic sandbox is connected in Practice, with recorded card issuance, limits, freeze/unfreeze and hold acceptance. Production spending and Apple/Google Wallet provisioning remain open. Every authorization uses an onchain hold against the same balance.
- **Social:** profiles, follow, a trade feed with "Trade this", leaderboards, watch any public account by link.

## How Senryo uses Monad

- **One contract, one balance.** `SenryoCore` keeps collateral, positions, pool liquidity and card holds in one storage
  space with one lock, so double-spending across features is a single-contract invariant, enforced in Solidity.
- **Finality-aware sends.** Every transaction goes through `packages/chain`, which follows each one to the finalized block
  and records it in a per-operation journal. A failure never re-sends; an unknown outcome stays pending until the chain
  settles it. Composed operations wait the 3 blocks Monad needs before a newly received balance can be spent.
- **Fast enough to wait for finality.** Blocks are ~0.3 s (measured 29 Sep 2026), so the outcome screen shows the
  finalized result instead of an optimistic guess, and the card service can answer an authorization with an onchain
  hold inside the card network's window.
- **MON reserve rules.** Mainnet operations keep a MON fee reserve and add a "swap ~$0.50 to MON" step when it runs low,
  instead of failing (the UI never says "gas").
- **Envio HyperIndex** (self-hosted, chains 143 and 10143) indexes every Senryo event; **HyperSync** discovers any token a
  user holds.

### Contracts

Practice (Monad testnet, chain 10143). The source of truth is
[`packages/contracts/src/addresses/10143.json`](packages/contracts/src/addresses/10143.json).

| Contract | Address |
|---|---|
| SenryoCore | `0xA7EE451ACeaC1ccDDb5c486B9e72D3EdE457D8aD` |
| SessionOracle | `0x251172dB8F38D204ff6b911c0365dF74e3efc21E` |
| MarketCalendar | `0x739238AD0EE7482e12f9D35a58d760Ac3e8BcDEB` |
| LpVault | `0x0EB85EaAeDe329ca55D72B05De8d9A190a4E6fF6` |
| StarterDrip | `0xD112a9A3Faa3491e3a91b95c0924b3eEaB85b207` |
| IntentRouter | `0x2eDaf2D629aDD04dfa7DB2Ad7b57e1d38FfCfC32` |
| InboxFactory | `0x49D821CF92A76F41d7A878515230d2aBE9bBb8f5` |
| AccessManager | `0xed8A87E2823D65600d2F57Fd6D1A2A5F09F296Da` |
| MockAUSD / MockUSDC | `0xA56060259F6c5EF2b18257caEe1F51782e069E23` / `0x68225DA6Df9d1Bd54f26D308Fb453333dC2a69A1` |
| Mirror feeds (XAU, XAG, EUR, GBP, JPY, CHF, CAD) | see the JSON |

Mainnet (chain 143): Perpl (`packages/config/src/perpl.ts`), AUSD, XAUt0 and the swap/bridge routers are external and
pinned in `packages/config`. Senryo's own mainnet deployment is listed here once it lands.

Example Practice trades (indexed fills):
[`0x2e93…be65`](https://testnet.monadvision.com/tx/0x2e93a919d5888a37114de652db90bd2f17cfd5406192c0759a3f17418cb1be65),
[`0x6b3e…c29b`](https://testnet.monadvision.com/tx/0x6b3eea4b1bc10bb3313086fc1c5e7ccca04e0fbc35d4402c3048d3570c46c29b).

Indexer GraphQL (public, read-only): `https://indexer.senryo.xyz/v1/graphql`

## Architecture

```
apps/mobile (Expo SDK 57, native)  ┐                          ┌─ Monad: SenryoCore · SessionOracle · LpVault · StarterDrip
apps/web    (Next.js static)       ┴─ packages/account (Mera) ┤        · IntentRouter · InboxFactory
                                      packages/chain (viem) ──┘  + Perpl Exchange · AUSD/USDC · XAUt0 · routers · bridges
            │ REST / WS
services/api    Fastify: markets, holdings (HyperSync), swap and bridge quotes, starter relay, social, notifications
services/card   Fastify: Lithic authorization → onchain hold within the user's allowance → approve/decline
services/keeper liquidations, TP/SL triggers, oracle pokes, pushes, sponsored network fees (Practice)
indexer         Envio HyperIndex V3 (self-hosted, Postgres + Hasura)
```

- `packages/account` signs, never sends; `packages/chain` is the only sender. Money is `bigint` end to end.
- `packages/core` holds the risk maths shared by the contracts' tests, the apps' previews and the keeper.
- Product spec: the flow book in [`docs/product/`](docs/product/README.md) (every object × verb, with its how-ladder).
  Build history and decisions: [`docs/plan/`](docs/plan/STATUS.md).

Tech: TypeScript, React Native 0.86 (Reanimated 4, Gesture Handler, Skia, FlashList), Next.js, Fastify, Postgres,
Foundry (solc 0.8.31), viem, Envio, EAS, Coolify.

## Run it locally

Requirements: Node 25, pnpm 11, Foundry, Docker (for Postgres).

```bash
pnpm install
pnpm typecheck                         # every package
node scripts/invariants/run.mjs        # repo rules (no secrets, money as bigint, provenance, …)

# Web against the public Practice deployment (no env needed: it defaults to api/indexer.senryo.xyz)
pnpm --filter @senryo/web dev

# Mobile (development build; passkeys need the associated domain, so use a dev client build)
pnpm --filter @senryo/mobile start

# Contracts
cd contracts && forge build && forge test
```

Services (`services/api`, `services/card`, `services/keeper`) read their configuration from environment variables listed
in each `src/env.ts`; secrets are never committed. A mainnet-fork run of the composed operations (fee reserve, pay with
any asset) is in `scripts/drive` (`pnpm --filter @senryo/drive compose-fork-check`, needs `anvil`).

## Pre-existing code

Senryo was built during the hackathon (first commit `d80a701`, 29 Sep 2026). These pieces were reused from the author's
earlier project, Agari, and adapted:
- mobile kit utilities: haptics, loading/empty/error states, bottom drawer, toasts, audio helper, onboarding and alert
  scaffolding, the Metro/EAS configuration;
- the repo-invariants runner (`scripts/invariants/run.mjs`, `rules.mjs`, `lib/`);
- money formatting (`formatBaseUnits`, `parseDecimalToBaseUnits`);
- the plan-document templates and the deploy runbook structure.

Everything else (contracts, services, indexer, both apps, the account layer) is new.

## AI disclosure

AI coding tools were used throughout, as permitted by the rules:
- **Claude Code** (Anthropic) wrote most of the code and documentation from 2 Oct 2026, as the lead, with parallel agents
  per feature area, every change reviewed against the flow book and gated by typecheck, lint and the repo invariants.
- **Codex** (OpenAI) built the earlier stages and was consulted for design and review.
- **ElevenLabs** generated the app's sound cues from Senryo's own prompts (`apps/mobile/assets/sounds/README.md`).
- UI components were ported from **21st.dev** community components and recorded per component
  (`apps/mobile/.21st/design.json`, `apps/web/.21st/design.json`, `docs/product/provenance/`).

The product decisions, scope and acceptance were the author's.

## Licence and attribution

MIT ([`LICENSE`](LICENSE)). Third-party marks, fonts, icons, sounds and ported components, with their sources and
licences: [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
