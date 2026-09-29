# Kimi (Moonshot AI) — "Best Builds Powered by KIMI" ($3,000 in credits)

> Last researched: 2026-09-28. Prize link on Metropolis page points to https://www.kimi.com/. Judging criteria beyond the title were not published on the Metropolis page (check the Rise In / Monad listing).

## Overview

Moonshot AI's Kimi models via the **Kimi API Platform** (docs moved to **platform.kimi.ai**; API host still **`api.moonshot.ai`**). OpenAI-compatible (Chat Completions + Responses) and Anthropic-Messages-compatible. Strong at agentic tool use, coding, long context.

## Models (current, from platform.kimi.ai/docs/models)

| Model ID | Notes | Context |
|---|---|---|
| **`kimi-k3`** | Flagship (launched ~Sep 2026): 2.8T params, native vision, **always thinks**; `reasoning_effort` = `low`/`high`/`max` (default `max`) | 1M tokens |
| **`kimi-k2.6`** | Vision + text, thinking & non-thinking, dialogue + agent tasks | 256k |
| **`kimi-k2.7-code`** | Dedicated coding model; thinking always on, preserved thinking fixed `"all"` | 256k |
| **`kimi-k2.7-code-highspeed`** | ~180 tok/s (up to 260 in short ctx) | 256k |

**Retired (return 404):** `kimi-k2.5` and all `moonshot-v1-*` (Aug 31 2026); `kimi-k2-*` series incl. `kimi-k2-0905-preview`, `kimi-k2-turbo-preview`, `kimi-k2-thinking` (May 25 2026); `kimi-latest` (Jan 2026). Older tutorials using these will break.

## Pricing (per 1M tokens) — from third-party trackers, verify on platform.kimi.ai/docs/pricing/chat

| Model | Input | Output | Cache hit |
|---|---|---|---|
| kimi-k3 | $3.00 | $15.00 | $0.30 |
| kimi-k2.6, kimi-k2.7-code | $0.95 | $4.00 | — |
| kimi-k2.7-code-highspeed | $1.90 | $8.00 | — |

(unverified — official pricing table is JS-rendered; figures from morphllm.com / benchlm.ai, Sep 2026.) Batch API = 60% of standard rate. K3 cache writes billed by TTL (5 min default / 1 h). Account needs ≥ $1 recharge to start; $5 cumulative recharge → $5 voucher; rate-limit tiers by cumulative recharge.

## API

- Base URL (OpenAI): **`https://api.moonshot.ai/v1`**; env var used in docs: `MOONSHOT_API_KEY`.
- Anthropic Messages endpoint: `https://api.moonshot.ai/anthropic` (per third-party; docs confirm Anthropic compatibility — exact path unverified).
- Also: built-in web search tools (`/v1/tools/search`, `/v1/tools/search_pro`), JSON mode, partial mode, context caching, file Q&A, Batch API, "Dynamic Tool Loading", official MCP server.
- China mainland endpoint historically `api.moonshot.cn` (unverified whether still separate).

### Tool calling (OpenAI-compatible)

`tool_choice`: `auto` (default) | `none` | `required` | `{type:"function", function:{name}}`.

```ts
import OpenAI from "openai";
const kimi = new OpenAI({ apiKey: process.env.MOONSHOT_API_KEY, baseURL: "https://api.moonshot.ai/v1" });

const tools = [{
  type: "function" as const,
  function: {
    name: "get_agent_reputation",
    description: "Read ERC-8004 reputation summary for an agent on Monad",
    parameters: { type: "object", properties: { agentId: { type: "string" } }, required: ["agentId"] },
  },
}];

const messages: any[] = [{ role: "user", content: "Is agent 42 trustworthy enough to pay?" }];
const r1 = await kimi.chat.completions.create({ model: "kimi-k3", messages, tools, reasoning_effort: "low" } as any);
const msg = r1.choices[0].message;
messages.push(msg); // keep reasoning_content on assistant turns!
for (const call of msg.tool_calls ?? []) {
  const result = await getSummary(JSON.parse(call.function.arguments).agentId); // your viem call
  messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
}
const r2 = await kimi.chat.completions.create({ model: "kimi-k3", messages, tools } as any);
```

### Thinking params

- **K3:** top-level `reasoning_effort: "low" | "high" | "max"`. Thinking cannot be disabled; preserved thinking always on.
- **K2.6 / K2.7-code:** `thinking: { type: "enabled" | "disabled", keep: null | "all" }` (K2.7-code: always enabled, keep fixed `"all"`).
- Response has `reasoning_content` + `content`. **Always send back `reasoning_content`** of prior assistant messages in multi-turn/tool loops or quality degrades.

### Vercel AI SDK

`@ai-sdk/moonshotai` (v3.0.x) exists; or `@ai-sdk/openai-compatible` with `baseURL: "https://api.moonshot.ai/v1"`.

```ts
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
const kimi = createOpenAICompatible({ name: "kimi", baseURL: "https://api.moonshot.ai/v1", apiKey: process.env.MOONSHOT_API_KEY });
// generateText({ model: kimi("kimi-k2.6"), tools, stopWhen: stepCountIs(5), ... })
```

## Monad / hackathon fit

- Tool-heavy onchain agents: K3 for planning/reasoning over 8004 reputation + x402 payments; `kimi-k2.7-code-highspeed` for fast contract/code generation agents.
- 1M context: ingest whole contract repos / event logs for audit or analytics agents.
- Vision (K3, K2.6): verify screenshots / media provenance (pair with `04-standards/media-provenance.md`).

### Project ideas
1. **Kimi-powered ERC-8004 agent** with MCP tools for Monad (read balances, pay via x402, post feedback).
2. **Onchain security copilot**: K3 reads verified Monad contracts + tx traces, flags risk before a passkey-signed tx.
3. **Metered Kimi proxy** paid per token via x402 `upto` on Monad.

## Gotchas

- Many blog posts still reference `moonshot-v1-*` / `kimi-k2-0905-preview` / `kimi-k2.5` — all retired.
- K3 ignores `thinking` toggles; K2.x ignores `reasoning_effort` (don't mix).
- Drop `reasoning_content` → degraded multi-turn behavior.
- Rate limits are low at Tier 0/1 — top up early; 429s return `X-RateLimit-*` headers.
- Confirm which account/region the $3,000 credits apply to (platform.kimi.ai vs China platform).

## Sources

- https://platform.kimi.ai/docs/models
- https://platform.kimi.ai/docs/guide/start-using-kimi-api (Quickstart)
- https://platform.kimi.ai/docs/api/chat (tool_choice, reasoning_effort, thinking)
- https://platform.kimi.ai/docs/pricing/chat , https://platform.kimi.ai/docs/pricing/limits
- https://www.morphllm.com/kimi-api , https://benchlm.ai/moonshot/api-pricing (third-party pricing)
- https://www.npmjs.com/package/@ai-sdk/moonshotai
