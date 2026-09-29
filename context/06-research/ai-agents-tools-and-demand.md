# AI Agents: What They Call, What Users Want, Where It Breaks

> Researched 2026-09-29. Follows `README.md` (evidence standard + schema). Every number has a source and date. "(unverified)" = not directly confirmed by us. Raw pulls (npm/PyPI/GitHub/Smithery/x402scan/Monad RPC) are in the scratchpad `research/agents/`. Standards already covered elsewhere (ERC-8004, x402 mechanics, passkeys, C2PA) are linked, not repeated.

## TL;DR (data, not opinion)
1. **Agents mostly call developer tools, not money tools.** Browser automation, docs lookup and the filesystem dominate MCP downloads. Crypto MCP servers are 3 to 4 orders of magnitude smaller. Software engineering is ~50% of all agent tool calls on Anthropic's API (n = 998,481).
2. **Real agent payments exist but are tiny, and most headline numbers are inflated.** x402scan (30 days): 16.49M tx but only **$963K volume**, and one seller with **72 buyers** made **81%** of those tx. Monad's x402 facilitator has 3.88M lifetime tx but only **33 in the last ~24 h**.
3. **Consumers want help finding things; few want AI to decide.** 41% of US AI users have tried an agent (Menlo, n = 5,067), but only 11% would let AI make a purchase decision (Gartner) and 60% would quit an agent after one mistake (ACI/YouGov). ChatGPT in-chat checkout was scaled back after about 12 to 30 merchants went live.
4. **The top pain point is control:** security and access control (50% of MCP builders), spend limits that live in the prompt, and agents holding their own keys. There are documented losses: Grok/Bankr at about $150K and AIXBT at about $106K.
5. **What already has traction and maps to Track 04:** user-owned memory (Mem0: 186M API calls per quarter), pay-per-call data (x402 sellers such as StableEnrich), policy-bound agent wallets (MetaMask Agent Wallet Guard Mode, Coinbase Agentic Wallets), personhood/credentials (World 18.2M, Self 7M+, EAS 9.5M+ attestations) and expert-data licensing (Mercor: $2B gross run-rate).

---

## (A) Supply: the tools agents actually call most

### A1. MCP servers by downloads (npm, last 30 days: 2026-08-29 → 2026-09-27; `api.npmjs.org/downloads/point/last-month/<pkg>`)
| Package | Monthly downloads | What it is |
|---|---:|---|
| `@modelcontextprotocol/sdk` | 202,740,901 | MCP SDK (baseline) |
| `@playwright/mcp` | **24,380,072** | Browser automation |
| `chrome-devtools-mcp` | **7,704,955** | Browser/devtools |
| `mcp-remote` | 5,145,267 | Proxy to connect to *remote* (auth'd) MCP servers |
| `@upstash/context7-mcp` | 3,053,336 | Library docs for coding agents |
| `@modelcontextprotocol/server-filesystem` | 2,870,588 | Local files |
| `@notionhq/notion-mcp-server` | 641,781 | Notion |
| `@modelcontextprotocol/server-sequential-thinking` | 580,175 | Reasoning scaffold |
| `@modelcontextprotocol/server-memory` | **563,034** | Knowledge-graph memory |
| `@sentry/mcp-server` | 442,170 | Error tracking |
| `@modelcontextprotocol/server-github` | 439,780 | GitHub |
| `@supabase/mcp-server-supabase` | 393,210 | DB |
| `firecrawl-mcp` / `exa-mcp-server` / `tavily-mcp` | 283,044 / 237,674 / 81,036 | Web search/scrape |
| `@stripe/agent-toolkit` / `@stripe/mcp` | 79,677 / 54,226 | Payments (Stripe) |
| `@coinbase/agentkit` | 33,931 | Crypto agent toolkit |
| `@x402/mcp` | 17,036 | x402-paid MCP |
| `@metamask/agent-wallet` | 3,028 | MetaMask `mm` CLI (renamed from `@metamask/agentic-cli` in v6.0.0, 2026-08-06) |
| `@alchemy/mcp-server` | 2,280 | Crypto data |
| `@coingecko/coingecko-mcp` | 2,095 | Crypto prices (note: CoinGecko also runs a *remote* server, so npm undercounts it) |
| `solana-agent-kit` | 4,361 | Solana agent toolkit |

PyPI (last month, `pypistats.org`, 2026-09-29): `mcp` 219.0M, `fastmcp` 50.1M, `mcp-server-time` 491K, `mcp-server-fetch` 465K, `mcp-server-git` 148K, `mem0ai` **2.0M**, `graphiti-core` 609K, `cdp-sdk` 92.9K, `x402` 179K, `coinbase-agentkit` 5,973.

GitHub stars (GitHub API, 2026-09-29): modelcontextprotocol/servers 90,651 · mem0ai/mem0 **66,257** · upstash/context7 62,510 · ChromeDevTools/chrome-devtools-mcp 52,712 · microsoft/playwright-mcp 37,675 · github/github-mcp-server 33,266 · getzep/graphiti 31,287 · letta-ai/letta 24,962 · elizaOS/eliza 19,515 · x402-foundation/x402 6,661 · BlockRunAI/ClawRouter 6,614 · basic-memory 4,057 · google-agentic-commerce/AP2 3,198 · stripe/ai 1,845 · sendaifun/solana-agent-kit 1,715 · agentic-commerce-protocol 1,551 · coinbase/agentkit 1,320 · goat-sdk/goat 1,008 · erc-8004/erc-8004-contracts 237.

**Reading:** agents are coding and browsing tools first. Memory is the one "personal context" category with mass developer adoption (MCP memory server 563K/mo, Mem0 66K stars, 2.0M PyPI/mo). Crypto-specific agent tooling is small: AgentKit 34K/mo against Playwright MCP's 24M.

### A2. Wallet and key infrastructure agents depend on (npm, same window)
`viem` 22.2M · `@coinbase/cdp-sdk` **3.68M** · `@turnkey/sdk-server` **1.05M** · `@privy-io/server-auth` 557K · `@metamask/smart-accounts-kit` 66K (+ `@metamask/delegation-toolkit` 26K) · `@simplewebauthn/browser` 18.1M / `/server` 16.9M (passkeys are mainstream web infra) · `@category-labs/mera` 1,997.
x402 SDKs: `x402` 1.52M, `@x402/core` 1.11M, `@x402/evm` 729K, `@x402/fetch` 439K, `@x402/svm` 297K, `@coinbase/x402` 218K, `@x402/express` 118K.

### A3. Registries (noisy; use only directionally)
- **Smithery** (`registry.smithery.ai/servers`, `useCount`, 2026-09-29): 17,685 servers listed. Top by useCount: pipeworx gateway 419,019, SparkForge 219,896, Brave Search 87,579, UK due-diligence 60,881, Paper Search 59,106, Gmail 57,738, Google Sheets 56,138, PubMed 42,137, Polymarket data 39,483. **Money/crypto servers are long-tail:** top "payment" hit 8,540; top "x402" hit 2,409; top "memory" hit 6,038. Caveat: the listing returns duplicate rows and useCount is self-reported by the platform, so it is gameable. See (E).
- **PulseMCP** lists 21,800+ servers; its "Trending" set is Figma, Notion, GitHub, Supabase, Jira, Slack, Confluence, Google, Obsidian, Perplexity, **Memory**, Postgres, Git, YouTube, Calendar, Playwright (https://www.pulsemcp.com/servers, 2026-09-29). Its v0beta API was sunset in Sep 2026.
- **Zuplo State of MCP survey** (~100 technical professionals, https://zuplo.com/mcp-report/, accessed 2026-09-29): 70% of MCP consumers have 2–7 servers configured; the most-used servers connect to docs/knowledge bases; 72% expect their MCP use to increase.

### A4. Published first-party data on tool use
- **Anthropic, "Measuring AI agent autonomy in practice"** (2026-02-18, https://www.anthropic.com/research/measuring-agent-autonomy): software engineering is **~50% of tool calls** on the public API (n = 998,481; 95% CI < 0.5%). Business intelligence, customer service, sales, finance and e-commerce each account for "no more than a few percentage points". **0.8%** of actions appear irreversible. 80% of tool calls come from agents with at least one safeguard, and 73% have a human in the loop. In Claude Code, **12%** of Claude's self-initiated stops are "to request missing credentials, tokens, or access". "Autonomously execute cryptocurrency trades" appears as a high-autonomy cluster, and Anthropic says many of these may be simulations or evaluations.
- **Anthropic Economic Index** (Jan/Mar/Jun 2026 reports, https://www.anthropic.com/economic-index): coding work is migrating from Claude.ai to API/Claude Code. Claude Code sessions are "on average more automated" than chat.
- **OpenRouter / a16z "State of AI"** (100T-token study, window to Nov 2025, https://openrouter.ai/state-of-ai): reasoning models now serve about half of all tokens. Tool-call share of tokens is "rising consistently", but the page gives it only as a chart with no quotable number (unverified figure). Programming and roleplay dominate token categories (roleplay is about 52% of open-source-model tokens).

### A5. x402: the money tool agents call (x402scan.com, scraped 2026-09-29)
| Window | Tx | Volume | Buyers | Sellers |
|---|---:|---:|---:|---:|
| Past 30 days (all chains) | 16.49M | **$963.16K** | 23.26K | 38K |
| Past 24 h | 98.87K | $92.59K | 5.17K | 1K |

- **Concentration:** `sol.blockrun.ai` = 13.43M tx / $175.89K / **72 buyers** in 30 d, which is **81% of all tx**. Next by volume: Cluster Protocol $54.42K (722 buyers), dTelecom STT/TTS gateway $35.02K (26 buyers), BlockRun on Base $5.91K (329 buyers), StableEnrich (pay-per-call Exa/Firecrawl/Google Maps/Serper/enrichment) $1.91K (327 buyers), claw402 $1.45K.
- **Facilitators (24 h):** Coinbase 94,146 tx / $34.85K / 4,061 buyers / 714 sellers. FluxA 2,114 tx / $51.04K. PayAI 1,241 tx. Virtuals 799 tx / $7.99. **Networks (24 h):** Base 69,605 tx / $64.68K. Solana 5,751 tx / $1.05K. **Monad is not tracked by x402scan.**
- **What gets bought:** LLM inference routing (BlockRun/ClawRouter), web search/scrape/enrichment (StableEnrich), speech (dTelecom), crypto-trader data (SniperX, OneSource), and media generation (Stability via Locus). This matches A1: agents pay for the same data and tools they already call for free.
- **Monad x402 facilitator** (`0x7f6a…Db86`, nonce via `rpc.monad.xyz`, chainId 143, 2026-09-29): 3,879,764 lifetime tx. Only **33 tx in the last ~286K blocks (~24 h)**. ~213K tx landed in one burst about 4–5 days earlier. Activity is bursty, which looks like load tests or campaigns rather than organic demand (our inference).
- **Chainalysis** (2026-06-03, https://www.chainalysis.com/blog/x402-agentic-payments-adoption/): 100M+ cumulative x402 tx on Base through Q1 2026, "much of the growth driven by meme coin farming" (the PING pay-to-mint). Tx of $1+ are now 95% of value transferred.

---

## (B) Demand: what users want agents to do (especially with money)

### B1. Consumer surveys
| Source (date, n) | Finding |
|---|---|
| Menlo Ventures, *2026 State of Consumer AI* (Sep 2026, 5,067 US adults) https://menlovc.com/perspective/2026-the-state-of-consumer-ai/ | **41%** of AI users have tried an agent; **24%** use one regularly; **32%** have let AI act without final sign-off. Access granted to agents: email 36%, browser 33%, messaging 31%, cloud storage 29%, calendar 27%, health apps 23%, **financial accounts 20%**. Agent share among agent users: Codex 35%, Claude Code/Cowork 32%, Perplexity 24%. Selection criteria: accuracy 45%, trustworthiness 40%, **security & privacy 36%** now rank ahead of ease of use (32%). Users run **3.0** assistants on average (up from 2.2), so context is fragmented across apps. |
| Gartner (press 2026-05-27; n = 322, Jan 2026; n = 846, Nov–Dec 2025) https://www.gartner.com/en/newsroom/press-releases/2026-05-27-gartner-survey-finds-consumers-want-ai-shopping-help-but-not-ai-purchase-decisions | Willingness to let AI **make purchase decisions tops out at 11%** (low-stakes categories). 31% will let AI *narrow choices* (household). 54% had to double-check all AI shopping info. |
| ACI Worldwide / YouGov (fieldwork 19–22 Jun 2026, 2,080 UK adults) https://investor.aciworldwide.com/node/26576/pdf | 19% trust AI to follow rules for everyday purchases. **60% would stop after one mistake.** 50% trust AI to find the best price; **43% trust it to follow spending limits**; 17% trust it to keep payment data secure; 15% trust it to handle problems. 44% wouldn't trust an AI shopping agent regardless of savings. |
| Global Payments / The Lantern (press 2026-09-23; 8,000 consumers wave 1) https://investors.globalpayments.com/news-events/press-releases/detail/516/ | Consumers expect agents to make 15% of purchases within 5 years (up from 9%). **69% would let an agent spend up to $100** on groceries/clothing. **33% want to approve every transaction.** 26% want proof the AI can't be hacked or manipulated. 50% are concerned about payment-data security. |
| Forrester (2026 blog) https://www.forrester.com/blogs/consumers-arent-ready-to-delegate-payments-to-ai-agents/ | Consumers say they need spending limits, purchase approval and transparency. Most "aren't willing to hand over the keys" (percentages paywalled). |

**Pattern:** demand is for *bounded delegation*: research and compare freely, spend within a small cap, human approval above it, and proof the agent can't be hijacked. This is a spec for a policy/limits primitive, not for a smarter shopping bot.

### B2. Agent commerce programs: announcements vs real usage
| Program | Announced | Real usage found |
|---|---|---|
| OpenAI Instant Checkout / ACP (launched 2025-09-29) | "over a million Shopify merchants" coming | **~12** (Rye, citing Shopify) to **~30** (Forrester, Feb 2026) merchants ever went live. Walmart reported in-chat checkout converting at about **1/3** the rate of click-through to walmart.com. OpenAI: "Instant Checkout is moving to Apps" (Mar 2026). Sources: https://rye.com/blog/openai-chatgpt-checkout-agentic-commerce, https://www.digitalapplied.com/blog/ai-agentic-commerce-discover-in-ai-buy-on-site-2026 |
| Google AP2 (2025-09-16; 60+ partners; donated to FIDO Alliance with v0.2 "Human Not Present") | Protocol + reference impl (3,198 GitHub stars) | No transaction volume published (unverified) |
| Visa Intelligent Commerce | "Mainstream in 2026" | "**Hundreds** of agent-initiated transactions" completed (Visa press release) |
| Mastercard Agent Pay (Apr 2025), Agent Pay for Machines (Jun 2026) | Agentic tokens, "Know Your Agent" registration | LatAm "live transactions… in **controlled environments**" (Mar 2026). No volume. |
| Stripe (Sessions 2026: 288 launches) | Agentic Commerce Suite; **Link (250M+ users) can now pay on an agent's behalf via one-time-use cards** | Adoption numbers not published |
| Coinbase Agentic Wallets (2026-02-11) | MPC wallet, session caps, spend limits | Package-level adoption in A2. No wallet counts published (unverified) |

### B3. Crypto agents with money: real vs claimed
| Product | Hard metric | Source |
|---|---|---|
| Olas Mech Marketplace (agent-to-agent) | 14.7M A2A tx all-time; **364 daily active agents** (7-day avg) | olas.network, as of 2026-09-28 |
| Virtuals ACP | DefiLlama fees: 30 d **$593.7K**, all-time $74.2M. "aGDP $470M+" is a self-defined metric | api.llama.fi, 2026-09-29; PR Newswire |
| Bankr | DefiLlama fees 30 d $2.04M, but methodology says these are **creator/token-launch fees**, not agent trading. Last 4 days near zero (possible data lag) | api.llama.fi/summary/fees/bankr |
| Giza ARMA | ARMA and Pulse agents **sunset** (migration deadline 2026-03-26). DefiLlama 30 d fees $0 | kucoin.com news; api.llama.fi |
| ERC-8004 registrations | 591,734 agents across 24 chains (registrations, not usage) | agenteconomy.to, 2026-09-29 |

---

## (C) Developer pain points (with sources)

| # | Pain point | Evidence | Track 04 / MetaMask link |
|---|---|---|---|
| C1 | **Security and access control of tools** | 50% of MCP builders cite security/access control as the top challenge; 38% are blocked by security/compliance; **24% run MCP servers with no auth** (Zuplo, ~100 respondents). `mcp-remote` (remote-auth proxy) at 5.1M/mo shows the demand to connect to authenticated remote servers. | Idea 01 (personhood) / 06 (credentials); ERC-8004 agent identity |
| C2 | **Spend limits in prompts don't work** | OpenAI forum thread (2026-08-16): "'don't spend more than $X' in the system prompt is not a limit". The asks are a per-agent budget, a server-side cumulative cap, an out-of-band kill switch and an immutable log. Several sibling threads ask the same ("runaway agent costs"). https://community.openai.com/t/…/1390772 | MetaMask Agent Wallet policy (outflow caps); ERC-7715 permissions |
| C3 | **Agents holding their own keys → losses** | Grok/Bankr (2026-05-04): an NFT granted "Executive" permissions and a Morse-encoded prompt moved ~3B DRB (**~$150–174K**). AIXBT (2025-03-18): 55.5 ETH (~$106K). Freysa: 13.19 ETH. Owockibot (2026-02-08) leaked its own hot-wallet key (~$2.1K held). Sources: zelcore.io academy; metamask.io/news/agentic-wallet-security (2026-07-16) | MetaMask Agent Wallet: server wallet in TEE, **Guard Mode** (allowlists + rolling 24 h outflow limit + 2FA) vs Beast Mode |
| C4 | **Credentials/access interrupt agents** | 12% of Claude Code self-stops are to request credentials/tokens (Anthropic, 2026-02-18) | Idea 04 (cross-app context) + scoped delegation |
| C5 | **Consumer trust gap** | Only 43% trust AI to follow spending limits; 60% quit after one error (ACI). 33% want to approve every payment (Global Payments) | Passkey approval above threshold (P256 precompile) |
| C6 | **Fake/looped payment volume, no reputation signal** | Artemis/CoinDesk (Mar 2026): a large share of x402 tx flagged as self-dealing/wash (article now 404; cited via Forkast, unverified). x402scan: 81% of 30 d tx from one seller with 72 buyers | ERC-8004 reputation with `proofOfPayment`; idea 06 |
| C7 | **Context/memory is fragmented and platform-owned** | Users run 3.0 assistants (Menlo). MCP memory server 563K/mo; Mem0 API calls grew 35M (Q1 2025) → 186M (Q3 2025) | **Idea 04** directly; Mera "Many Keys" bounty (memory encrypted to passkey) |
| C8 | **Data provenance for AI inputs** | Gartner: 54% of AI shoppers must double-check all info. C2PA SDKs: `@contentauth/c2pa-node` 158K/mo + `c2pa-node` 72K/mo | Idea 02 (content passports); see `../04-standards/media-provenance.md` |
| C9 | **Paying humans for expert/sensor data at global scale** | Mercor pays out "over $2 million a day" (Mercor blog). Physical-AI robots train on "under 5,000 hours of real-world data" (Forbes, 2026-06-29) | Ideas 05, 07 |

**MetaMask Agent Wallet plugin architecture** (inspected from `@metamask/agent-wallet@7.0.0` tarball, 2026-09-29): a plugin declares a manifest in `package.json#mm`. It sets `capabilities` ∈ {`wallet-read`, `wallet-submit`, `network-manage`}, per-command `dataAccess` ∈ {accounts, balances, prices, tokens, network, fees, swap-quotes, session, mnemonic}, and `targetChains` (chain IDs or `any`). `mnemonic-read` and `config-write` are *reserved/rejected*. Built-in commands: wallet, transfer, swap, bridge, perps, predict, earn, token, price, registry. The chain table includes **143 → `monad-mainnet`**. The license is source-available only; MetaMask is "still working through licensing". The bounty (Track 01 only) requires that every tx route through the Agent Wallet with no bypass of policy/MFA.

---

## (D) Candidate products (real traction → adaptable to Monad, Track 04 first)

### 1. Mem0: memory layer for agents (Web2 API + OSS)
- What it does: a drop-in API/SDK that extracts, stores and retrieves long-term user/agent memories across sessions.
- Traction: API calls = 35M (Q1 2025) → **186M (Q3 2025)**; $24M Seed+A led by Basis Set (Series A) and Kindred (Seed) (https://mem0.ai/series-a, TechCrunch 2025-10-28). GitHub 66,257 stars. `mem0ai` PyPI **2.0M/mo**, npm 471K/mo (2026-09-29).
- Why it's working: every agent app has the same "amnesia" problem, and memory is a small, self-contained API that is quick to integrate.
- Open source?: https://github.com/mem0ai/mem0 (Apache-2.0)
- On Monad already?: no (unverified)
- Metropolis fit: Track 04, idea 04 *"Cross-application AI memory: a user-owned context layer that persists across products"*. Also the Mera "Many Keys" bounty (memory encrypted to passkey).
- Monad angle: Mem0's memory is owned by the *app*. The adaptation is user-owned memory: blobs encrypted to a Mera passkey-derived key, with an onchain grant registry that says which app/agent can read which scope, until when. That registry is cheap per-grant on Monad. Reads can be paid per call via x402 (links to idea 03).
- Risks: storage must be offchain (IPFS/Walrus/own server). Retrieval quality is where Mem0 differentiates, and we can't match that in two weeks. Keep the scope to "portable, permissioned memory store + SDK", not better recall.

### 2. Official MCP memory server / Graphiti / basic-memory: the open-source memory primitive
- What it does: knowledge-graph memory for any MCP client (the reference server); Graphiti = temporal knowledge graph; basic-memory = local Markdown memory.
- Traction: `@modelcontextprotocol/server-memory` **563,034 npm/mo**; graphiti 31,287 stars / `graphiti-core` 609K PyPI/mo; basic-memory 4,057 stars (2026-09-29).
- Why it's working: MCP made memory a *tool* any client can mount, and PulseMCP lists "Memory" among its trending categories.
- Open source?: modelcontextprotocol/servers; getzep/graphiti (Apache-2.0); basicmachines-co/basic-memory (AGPL-3.0)
- On Monad already?: no
- Metropolis fit: Track 04 idea 04. Ship the product as an **MCP server** so every Claude/Cursor/Codex user can mount it (that shape is the proven one).
- Monad angle: same as #1. The MCP server enforces onchain read-grants and logs access receipts (idea 04 + provenance).
- Risks: "user-owned" must mean encryption keys the platform can't access. Otherwise judges will say it "centralizes the problem differently" (criterion text).

### 3. x402 pay-per-call data sellers (StableEnrich / AgentCash by Merit Systems; BlockRun)
- What it does: wraps existing paid APIs (Exa, Firecrawl, Serper, Google Maps, enrichment; LLM routing) so agents pay per request in USDC with no API key.
- Traction: StableEnrich 77.48K tx / $1.91K / 327 buyers (30 d). BlockRun (Base) 209.27K tx / $5.91K / 329 buyers. ClawRouter 6,614 stars. Ecosystem 30 d = $963K (x402scan, 2026-09-29).
- Why it's working: it removes signup and API keys for agents, and it sells what agents already call (search/scrape; see A1).
- Open source?: x402scan https://github.com/Merit-Systems/x402scan (no license file); ClawRouter MIT
- On Monad already?: Monad facilitator exists (`x402-facilitator.molandak.org`), but x402scan doesn't index Monad and the facilitator saw 33 tx in ~24 h.
- Metropolis fit: Track 04 idea 03 *"A personal data locker that earns revenue when AI companies query your interaction history — you set the price, they pay per call"*. Swap "resold API" for "user's own data".
- Monad angle: sub-cent settlement and ~300 ms blocks make per-query pricing viable. `upto` scheme for metered reads. An 8004 identity for the data locker as a seller.
- Risks: real buyer demand for *personal* data per call is unproven (no seller of personal data found on x402scan). Volume on x402 overall is small and concentrated.

### 4. MetaMask Agent Wallet (Guard Mode) and Coinbase Agentic Wallets: policy-bound agent wallets
- What it does: server wallet with keys in a TEE. The agent can only *propose* transactions. Policy (allowlists, rolling 24 h outflow limit) plus 2FA/MFA for out-of-policy actions.
- Traction: `@metamask/agent-wallet` 3,028 npm/mo (new, v7.0.0). Wallet backends: `@coinbase/cdp-sdk` 3.68M/mo, `@turnkey/sdk-server` 1.05M/mo, `@privy-io/server-auth` 557K/mo, `@metamask/smart-accounts-kit` 66K/mo (npm, 2026-09-29).
- Why it's working: it answers C2/C3 directly, because the limit is enforced outside the model.
- Open source?: MetaMask source-available (license TBD); CDP SDK open.
- On Monad already?: partial. `mm` chain table includes 143/monad-mainnet; Smart Accounts Kit supports Monad (see `../04-standards/x402-and-agent-payments.md`).
- Metropolis fit: Track 04 as a primitive, e.g. an **onchain agent spending-policy contract with passkey (P256) override**. Also Track 01 MetaMask bounty (plugin: "copy trading with size/risk limits and outflow caps").
- Monad angle: P256 precompile (6,900 gas) lets a phone passkey approve above-cap spends *onchain*, not through a vendor's 2FA server. That is the "not capturable by a single platform" point in the rubric.
- Risks: crowded; MetaMask/Coinbase/Crossmint already ship this offchain. Our edge must be verifiable onchain policy + passkey.

### 5. EAS: generic attestations
- What it does: schema registry + signed onchain/offchain attestations anyone can verify.
- Traction: **9.5M+ attestations** (https://attest.org, 2026-09-29); `eas-sdk` 37,494 npm/mo.
- Why it's working: one neutral primitive that many apps reuse instead of each building its own (named integrators not verified here).
- Open source?: ethereum-attestation-service/eas-contracts (MIT)
- On Monad already?: **no.** Not in official deployments; self-deploy needed (`../04-standards/other-identity-primitives.md`).
- Metropolis fit: Track 04 idea 06 *"Onchain credential attestations for real-world skills that any application can verify without a centralised middleman"*.
- Monad angle: deploying and indexing EAS on Monad is itself missing infrastructure. Combine with a zkTLS source (#6) for skills.
- Risks: "deploy EAS" alone is not original. It needs a specific credential flow and at least one integrating team.

### 6. Reclaim Protocol: zkTLS proofs of web2 data
- What it does: users prove facts from websites (employer, university, income, airline tier) without sharing credentials.
- Traction: `@reclaimprotocol/js-sdk` **55,032 npm/mo** (2026-09-29). Pricing "from $0.10" per verification (reclaimprotocol.org).
- Why it's working: it turns existing web2 records into portable credentials without partner integrations.
- Open source?: SDK repo (no license listed); 37 stars on the JS SDK.
- On Monad already?: Monad not listed (unverified).
- Metropolis fit: Track 04 idea 06 (skills credentials) and idea 03 (prove "interaction history" facts to buyers without revealing raw data).
- Monad angle: onchain verification of proofs → EAS-style attestation on Monad.
- Risks: dependency on Reclaim's attestor network; verifier gas and cost on Monad unverified.

### 7. Self (passport NFC ZK) and World ID: proof of personhood
- What it does: Self proves humanity/age/nationality from a passport chip with an on-device ZK proof. World ID proves uniqueness via Orb iris scan.
- Traction: Self "over **7M** activated users" (self.xyz launch PR), app stores say "15M+ users", $9M seed. World **18,167,033** verified humans (world.org, 2026-09-29). Human Passport "2M+ users". `@worldcoin/idkit` 123K/mo, `minikit-js` 116K/mo.
- Why it's working: bots and agents are now indistinguishable from humans. Apps integrate for uniqueness: Tinder and Zoom with World (Axios, 2026-04-17) and a Google stablecoin giveaway gated by Self (self.xyz/blog/google-self).
- Open source?: selfxyz/self (open); worldcoin/idkit-js MIT
- On Monad already?: no (Self on Celo; World on World Chain; unverified).
- Metropolis fit: Track 04 idea 01 *"Mobile-native proof of personhood using WebAuthn/P256 — no invasive biometrics, no centralised issuer"*.
- Monad angle: P256 precompile verifies passkey signatures onchain cheaply.
- Risks (important): **a passkey proves a device/key, not a unique human.** One person can create many passkeys. Idea 01 needs an extra uniqueness source (device attestation, social vouching, or Self-style passport ZK), or judges will spot the gap.

### 8. Olas Mech Marketplace: agents hiring agents
- What it does: agents post requests; "mechs" (tool-serving agents) fulfil them and are paid onchain.
- Traction: **14.7M** agent-to-agent tx all-time; **364 daily active agents** (7-day avg) (olas.network, 2026-09-28).
- Why it's working: prediction-market trader agents (Omen/Polymarket) buy AI predictions per request, so there is a concrete repeat buyer.
- Open source?: valory-xyz/autonolas-marketplace (open; license unverified)
- On Monad already?: no. Its 7 chains are Ethereum, Gnosis, Arbitrum, Optimism, Base, Polygon and Robinhood.
- Metropolis fit: Track 04 infra (ERC-8004 discovery + reputation → paid tool calls). Not an official idea; reputation is listed as crowded in `../01-tracks/trust-identity-ai.md`.
- Monad angle: per-request settlement at ~300 ms makes synchronous agent-to-agent calls feasible.
- Risks: small real user base (364 DAA). Crowded ERC-8004 space on Monad.

### 9. Mercor / Surge: expert-data marketplaces (Web2)
- What it does: AI labs pay vetted domain experts (~$95/h) for reasoning traces, evaluations and RLHF data.
- Traction: Mercor **$2B gross annualized revenue (June 2026)**, up from $760M at end of 2025 (Sacra; dealroom.co, "person with direct knowledge"); pays out "over $2 million a day" (mercor.com blog); 30,000+ experts. Surge $1.4B run-rate (late 2025, valueaddvc, unverified).
- Why it's working: frontier labs' marginal gains now come from expert judgment, and labs pay a ~35% take rate for vetting (valueaddvc, unverified).
- Open source?: closed
- On Monad already?: no
- Metropolis fit: Track 04 idea 05 *"A marketplace where domain experts license their decision-making patterns… compensated per training run, not per data upload"*.
- Monad angle: onchain license + usage receipts → per-training-run royalty streams. Stablecoin payouts to 100+ countries.
- Risks: the buyers (labs) won't adopt a hackathon marketplace. Traction proof needs a mock lab. "Per training run" metering is not verifiable onchain without trusted reporting (a TEE or attestation is needed).

### 10. FrodoBots / BitRobot: crowdsourced robotics data
- What it does: people remotely drive sidewalk robots as a game, generating navigation datasets.
- Traction: $6M seed for BitRobot (Blockworks/Dealroom; Protocol VC, Solana Ventures). FrodoBots-2K dataset (~2,000 h) used by DeepMind, Meta and UC Berkeley (solana.com news; huggingface.co/datasets/BitRobot/FrodoBots-2K).
- Why it's working: real-world robot data is scarce ("under 5,000 hours", Forbes 2026-06-29), and gamified crowd collection gets it cheaply.
- Open source?: dataset public; code unverified
- On Monad already?: no (Solana)
- Metropolis fit: Track 04 idea 07 *"Decentralised data labelling networks for physical AI… stablecoin rewards… onchain micropayments"*.
- Monad angle: per-label micropayments with sub-cent fees; label-quality attestations.
- Risks: traction is funding + dataset citations, not contributor earnings (no public payout data found). Hardware makes a demo hard, so a labelling-of-existing-sensor-data flow is more feasible.

### 11. Vana: user-owned data DAOs
- What it does: users upload/export platform data (Reddit etc.) into DataDAOs that sell access to AI builders.
- Traction: "over 1 million" contributors and 20+ live DataDAOs (MIT News, 2025-04-03); Reddit DataDAO 140K users (vana.org blog). Paradigm-backed (The Block, 2024-04-03).
- Why it's working: users are paid, or promised payment, for data that platforms already sell (Reddit–Google $200M/yr cited by Vana).
- Open source?: yes (vana-com repos; license unverified)
- On Monad already?: no (own L1)
- Metropolis fit: Track 04 idea 03 (data locker) and idea 04.
- Risks: **no public revenue-to-users data found.** User counts may be token-incentive driven (unverified). Treat as a design reference, not proof of demand.

### 12. C2PA Content Credentials: content passports
- What it does: a signed manifest embedded in media, recording origin and edits.
- Traction: `@contentauth/c2pa-node` 158,424 + `c2pa-node` 71,766 npm/mo; contentauth/c2pa-rs 424 stars (2026-09-29). Full technical research in `../04-standards/media-provenance.md`.
- Why it's working: standards-body backing and platform adoption. Mechanism covered in the standards file.
- Open source?: yes (c2pa-rs; license in repo)
- On Monad already?: no Monad project found (per standards file)
- Metropolis fit: Track 04 idea 02 *"Content passports… survives platform migration"*.
- Monad angle: an onchain anchor (hash + perceptual fingerprint) so provenance survives metadata stripping.
- Risks: see standards file (metadata stripping, watermark robustness).

### 13. Skyfire KYAPay / Crossmint agentic cards: Know-Your-Agent + pay
- What it does: verified agent identity token + funded wallet/virtual card with per-agent limits (e.g. "$50/day, $2/tx").
- Traction: Skyfire $9.5M total funding incl. a16z CSX and Coinbase Ventures (BusinessWire 2024-10-24; Tracxn). Crossmint Agentic Cards API on Visa Intelligent Commerce (crossmint.com). **No transaction volume published.**
- Why it's working: funded and partnered, but usage is unproven. It is included because it names the exact primitive merchants ask for (KYA).
- Open source?: KYAPay spec public (kyapay.org); implementations closed
- On Monad already?: no
- Metropolis fit: Track 04 idea 06 (agent credentials) + ERC-8004 identity.
- Monad angle: KYA as an onchain credential bound to an 8004 agent ID and a spend-policy contract (#4).
- Risks: announcement-heavy (B2). Card networks will own KYA for card rails.

---

## (E) Rejected / slop, with reasons
| Item | Why rejected or discounted |
|---|---|
| **x402 headline tx counts** ("100M", "200M tx", "$600M annualized" via BlockEden/Nevermined) | Chainalysis attributes much of the growth to PING memecoin farming. x402scan's own 30 d volume is $963K, and 81% of tx come from one seller with 72 buyers. The "$600M annualized" figure is contradicted by the ~$1M/30 d on x402scan. |
| **Monad x402 facilitator "3.88M tx"** | Lifetime nonce; only 33 tx in the last ~24 h, and bursty. Not evidence of organic demand. |
| **Virtuals "aGDP $470M"** | Self-defined metric. DefiLlama fees are $594K/30 d. AgentPMT (a vendor) reports x402 daily tx fell from 731K to 57K (Dec→Feb). |
| **Giza "$3.96B agentic volume"** | Sourced to exchange blogs (KuCoin/Binance Square). The ARMA/Pulse agents were sunset in Mar 2026; DefiLlama 30 d fees are $0. |
| **"250K daily active onchain agents" / DeFAI market caps** (BlockEden, rpcfast) | Secondary aggregators with no method, and market cap is not usage. |
| **ERC-8004 "591K agents"** | Registrations, not activity; registration is nearly free. |
| **Bankr as "AI trading agent traction"** | DefiLlama fees are token-launch creator fees, not agent trading. Also the Grok/Bankr exploit (C3). |
| **ChatGPT Instant Checkout "1M merchants"** | ~12–30 went live; scaled back Mar 2026 (B2). |
| **Visa/Mastercard agent payment "milestones"** | "Hundreds" of transactions / "controlled environments"; no volume. |
| **Smithery `useCount` as ground truth** | Duplicate rows; top entries are unknown gateways (pipeworx 419K, SparkForge 220K). Gameable. Used only directionally. |
| **Forkast "minds" articles** | The outlet runs AI personas ("12 minds reporting"). Only claims traceable to primary sources were used. The cited CoinDesk/Artemis x402 wash-trade article now returns 404, so that figure is unverified. |
| **AgentPMT, Nevermined, Coinrule, eco.com "best X" posts** | Vendor content marketing; used only when they cite a primary source. |
| **Generic "AI agent that trades for you"** | No product found with verifiable, sustained user PnL/volume. Anthropic notes crypto-trading tool calls may be simulations. Already flagged as crowded in `../01-tracks/onchain-finance.md`. |

## Implications for our pick (analysis, not data)
- The strongest data-backed Track 04 lane is **user-owned, permissioned agent memory/data (ideas 03 + 04)**. It is the only "personal context" tool category with mass developer pull (memory MCP 563K/mo, Mem0 186M calls/quarter). Pair it with pay-per-read (x402) and passkey-held keys (Mera bounty). Ship it as an MCP server + SDK, because that is how agents consume tools today (A1).
- The second lane is an **onchain spend-policy + passkey-approval primitive**. The demand is quantified (69% OK with ≤$100 caps; 33% want approval; 43% trust limits), the pain is documented (C2/C3), and MetaMask's Guard Mode shows the pattern works offchain. It is crowded, so the originality has to come from onchain enforcement + P256.
- Avoid pitching payment *volume* as traction. Every volume number in this space is either tiny or inflated.
