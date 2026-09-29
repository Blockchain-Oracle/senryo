# Nansen — onchain intelligence API / CLI / MCP

Bounty: **$5,000 "Best use of Nansen"**: "for the best build on Nansen API/MCP/CLI data." Prize split (Nansen X, 2026-09-01): **1st $2K, 2nd $1.5K, 3rd $1K, honorable mention $500**. Nansen ran a Metropolis workshop (Sep 8) on "building an onchain app with Nansen API and what actually helps win the $5K bounty" (recording not captured). Judge: **Alex Svanevik (Nansen CEO) is a main Metropolis judge**. Mentor: Hurcan Polat (Growth Lead, API & CLI).

## Overview
- Wallet labels (500M+ addresses, "Smart Money" cohorts), PnL, flows, holders, token screener, perps analytics (Hyperliquid), prediction markets (Polymarket), backtesting datasets, a research **Agent** endpoint, trading endpoints (Solana/Base only), Smart Alerts, Points API.
- **Monad is fully supported**: chain key `monad`, data from 14 May 2025. Smart Money (netflow, DEX trades, holdings, historical), Token God Mode (flows, transfers, holders, PnL) and Profiler (balance, txs, PnL, related wallets) all "Yes" for `monad`.
- Pay-per-call via **x402 with USDC on Monad** (also Base/Solana) — no API key needed; good for agent demos.

## Access & pricing
- API key: https://app.nansen.ai/auth/agent-setup. Header **`apikey: <key>`**. Base `https://api.nansen.ai`, all POST JSON under `/api/v1/...`.
- Free plan: 100 one-time credits, then top-up to 10/day; Pro $49/mo annual ($69 monthly) with 2,000 credits floor. Rate limits: Free 15 rps / 300 rpm; Pro 75 rps / 1,500 rpm. Some endpoints have extra per-minute caps (`profiler/perp-trades` 5/min).
- x402 V2 only (`PAYMENT-SIGNATURE` header): Basic $0.01 (screener, balances, txs, PnL, DEX trades, flows), Premium $0.05 (counterparties, holders, PnL leaderboard), Smart Money $0.05. Labels endpoint not available via x402. Promo: 50% off first 100 calls per wallet when advertised at `/.well-known/x402`.
- Credit costs per endpoint vary (premium labels 150 credits/call when `premium_labels=true`) — budget your demo.

## Quickstart
### REST
```bash
curl -X POST https://api.nansen.ai/api/v1/smart-money/netflow -H "apikey: $NANSEN_API_KEY" -H 'content-type: application/json' \
  -d '{"chains":["monad"],"pagination":{"page":1,"per_page":20},"order_by":[{"field":"net_flow_24h_usd","direction":"DESC"}]}'

curl -X POST https://api.nansen.ai/api/v1/profiler/address/pnl-summary -H "apikey: $NANSEN_API_KEY" -H 'content-type: application/json' \
  -d '{"wallet_address":"0x...","chain":"monad","date":{"from":"2026-06-01","to":"2026-09-28"}}'

curl -X POST https://api.nansen.ai/api/v1/profiler/address/labels -H "apikey: $NANSEN_API_KEY" -H 'content-type: application/json' \
  -d '{"address":"0x...","chain":"monad"}'

curl -X POST https://api.nansen.ai/api/v1/token-screener -H "apikey: $NANSEN_API_KEY" -H 'content-type: application/json' \
  -d '{"chains":["monad"],"timeframe":"24h"}'

# Research agent (SSE stream: delta / tool_call / finish{conversation_id} / error; ends with [DONE])
curl -N -X POST https://api.nansen.ai/api/v1/agent/fast -H "apikey: $NANSEN_API_KEY" -H 'content-type: application/json' \
  -d '{"text":"Which tokens are smart money accumulating on Monad this week?"}'
```
Key endpoints (paths from docs): `smart-money/{netflow,holdings,dex-trades,historical-holdings,perp-trades}`, `profiler/address/{pnl,pnl-summary,labels,premium-labels,...}` plus counterparties, related-wallets, first-funder, current/historical balances, transactions, perp positions; `token-screener`; TGM (token info, holders, flows, who-bought-sold, dex-trades, transfers, PnL leaderboard, flow intelligence, Nansen indicators); `agent/{fast,expert}`; backtesting-data (historical screener/holders/OHLCV/quant scores); prediction-market; `smart-alerts` (Telegram/Slack/Discord); Points API. `chains: ["all"]` allowed on many endpoints. OpenAPI embedded in each docs page; ask docs: `GET https://docs.nansen.ai/readme.md?ask=<question>`.

Naming change (2026-09-24 changelog): wallet input field is `wallet_address` (old `address` deprecated alias).

### Python / TS (plain HTTP)
```python
import os, httpx
r = httpx.post("https://api.nansen.ai/api/v1/smart-money/holdings",
               headers={"apikey": os.environ["NANSEN_API_KEY"]}, json={"chains": ["monad"]})
print(r.json())
```
x402 (Python, pays automatically on 402):
```python
from eth_account import Account
from x402 import x402ClientSync
from x402.http.clients import x402_requests
from x402.mechanisms.evm import EthAccountSigner
from x402.mechanisms.evm.exact.register import register_exact_evm_client
client = x402ClientSync(); register_exact_evm_client(client, EthAccountSigner(Account.from_key(PK)))
session = x402_requests(client)
session.post("https://api.nansen.ai/api/v1/smart-money/holdings", json={"chains": ["monad"]})
```

### CLI
```bash
npm install -g nansen-cli          # or npx nansen-cli help ; source github.com/nansen-ai/nansen-cli
nansen login                       # browser login (CLI ≥2.0, macOS Apple silicon) ; or export NANSEN_API_KEY=...
nansen research smart-money netflow --chain monad
nansen research token screener --chain monad --timeframe 24h
nansen research profiler balance --address 0x... --chain monad
nansen schema                      # machine-readable command/field reference (no key needed)
nansen mcp install cursor
```

### MCP
```bash
claude mcp add --transport http nansen https://mcp.nansen.ai/ra/mcp --header "NANSEN-API-KEY: $NANSEN_API_KEY"
```
Full tool catalog + per-call credit costs: docs.nansen.ai/mcp/connecting/tools. OAuth connectors (12 curated read-only tools) for Claude/ChatGPT/Grok.

## Bounty & ideas
Judging angle (inferred): novel *product* built on Nansen data (not a dashboard clone of nansen.ai), Monad-native, ideally agentic (API/MCP/CLI all named), shows data driving an onchain action. CEO-as-judge → polish and a clear "why Nansen data" story matter.
1. **Onchain credit score for undercollateralised lending** (official track example): Nansen labels + PnL summary + counterparties + first-funder → risk score → written onchain via Chainlink CRE (Confidential HTTP keeps the key secret) → a Monad lending pool sets per-borrower LTV. Hits Nansen + CRE + track.
2. **Smart-money copy-trading on Kuru/Perpl**: `smart-money/dex-trades` + netflow on `monad` → signals → auto-place Kuru limit orders / Perpl perps with risk caps; agent explains each trade via `agent/fast`. Hits Nansen + Kuru #1 / Perpl API.
3. **x402-paid research agent on Monad**: an autonomous agent with its own Monad USDC wallet that pays Nansen per call via x402, produces token due-diligence reports, and gates trading on "smart money exits" alerts. Show wallet spending onchain.
4. **Token-listing due diligence for Kuru markets**: before deploying a new Kuru market, pull holders concentration, related wallets, smart money flows → publish a listing risk card; ties to Kuru #2.

## Gotchas
- Free credits run out fast — use Pro trial / x402 for the demo and cache responses.
- Smart Money coverage on a young chain like Monad may be thin (few labeled SM wallets); verify data density early and fall back to `chains:["all"]` or cross-chain wallets.
- Trading endpoints (quote/prepare/execute) support **Solana & Base only**, not Monad. Perp endpoints are Hyperliquid-centric.
- Redistribution rules: displaying raw Nansen data publicly is restricted (see Data Redistribution Guidelines) — show derived signals, attribute Nansen.
- CLI browser login only qualified on macOS Apple silicon; use `NANSEN_API_KEY` in CI/agents.

## Sources
- https://docs.nansen.ai/llms.txt ; /getting-started/authentication.md ; /getting-started/credits.md ; /getting-started/rate-limits.md
- https://docs.nansen.ai/reference/chains.md ; /api/data-coverage.md ; /api/smart-money/netflows.md ; /api/profiler/address-pnl-and-trade-performance.md ; /api/agent.md
- https://docs.nansen.ai/getting-started/agentic-payments/x402-payments.md ; /cli.md ; /mcp/connecting.md
- https://x.com/nansen_ai/status/2094849155940413828 (prize split, workshop)
