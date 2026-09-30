# S4 — Indexer: Envio HyperIndex V3 on 10143 + 143, indexer-client (wave B)

**Goal:** one self-hosted Envio HyperIndex V3 indexer (`indexer/`, outside the pnpm workspace) that turns our testnet
contracts, the Chainlink XAU/XAG aggregators and Perpl Exchange into the entities the apps and `/stats` read —
positions, fills, activity, card holds, LP, oracle rounds + candles (no fabricated ticks), per-user and protocol
aggregates — plus a Coolify-ready compose, a HyperSync analytics script and `@senryo/indexer-client` (typed GraphQL
documents, zod-parsed results). Display only: the card path never reads the indexer (D-014).
- **Plan:** `00-plan.md` §1 (D-014, D-020, D-022, D-040), §2.3, §4 (S4 row), §5 (Envio + resources); D-102, D-103.
- **Open first:** `specs/services.md` → "Indexer" (binding), `specs/contracts.md` (events), `contracts/src/libraries/Events.sol`,
  `context/08-integrations/envio.md`, `context/09-product/deployment-coolify.md`, `references/envio-hyperindex`
  (V3 source + the 17 bundled skills), `references/envio-local-docker-example`, `references/envio-wsteth-monad-indexer-demo`,
  `references/perpl-dex-sdk/crates/sdk/abi/dex/Exchange.json`, `packages/contracts/src/{abis,addresses}`, `ids-and-txs.md`.
- **Docs read (Context7):** Envio `/websites/envio_dev` (effect API incl. `context.cache = false`, observability port
  9898 `/healthz`), HyperSync client `/enviodev/hypersync-client-node`.
**D-number range:** D-130…D-139.

## Steps
- [x] S4.1 Stage file
- [x] S4.2 Scaffold `indexer/` (own `package.json` + `pnpm-lock.yaml` + `pnpm-workspace.yaml` settings, envio 3.12.1,
      tsconfig); `config.yaml` for 10143 (every `indexed: true` address, start block 66856078) and 143 (Chainlink
      XAU/XAG aggregators + wildcard follow, Perpl Exchange from `APP_LAUNCH_BLOCK`); `address-drift` +
      `indexer-isolated` green
- [x] S4.3 Schema + handlers for our contracts: User (latest `AccountRiskUpdated` + cumulative stats), balances,
      moves, markets, positions, fills, funding/borrow, triggers, liquidations, card holds/debt/allowance, vouchers,
      starter claims, inboxes, intent orders, LP, oracle status; daily + protocol aggregates
- [x] S4.4 Oracle rounds + candles (OHLC from rounds + fills, no fabricated ticks); aggregator changes behind the
      mainnet proxies followed without a redeploy
- [x] S4.5 Perpl: accounts, markets, positions/fills for app users, `PerplCursor @internal` taker-fill pairing with
      the `unattributedFills` alarm, funding, liquidations; targeted pairing check on real mainnet logs
- [ ] S4.6 Compose adapted for Coolify (no ports/container_name/networks, mem limits, `${VAR:?}`, console off, health
      checks on the real ports) + Dockerfile; local compose run
- [x] S4.7 HyperSync analytics script ("creative HyperSync")
- [x] S4.8 `@senryo/indexer-client`: portfolio, positions, fills, activity, candles, protocol stats, `_meta`
- [ ] S4.9 Local sync at head (HyperSync with `ENVIO_API_TOKEN`, or the documented RPC data source) + a portfolio
      query through `@senryo/indexer-client` against testnet data
- [ ] S4.10 Gate evidence + handoff
- [x] **(user)** Envio account + HyperSync API token → `~/.config/senryo/envio.env` (lead, 2026-09-30; HyperSync 200 on both chains)
- [ ] **[OK?]** Coolify: indexer compose resource + `indexer.senryo.xyz` (S14 deploy train; DNS in S6)

## Gate
`cd indexer && pnpm envio codegen && pnpm tsc --noEmit` · `pnpm invariants` with `address-drift` + `indexer-isolated`
active and green · fast gate green · local sync at head (token permitting) · a portfolio query through
`@senryo/indexer-client` returns testnet data (when positions exist).

## Findings

## Handoff
