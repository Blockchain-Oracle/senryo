# Tencent Kepler Plan — "Build with Hunyuan" ($2,000 in credits)

> Last researched: 2026-09-28. Prize link: https://www.tencentcloud.com/products/tokenhub. "Kepler Plan" is Tencent's global developer program (previously associated with EdgeOne Pages hosting credits and a DoraHacks competition) — the Metropolis bounty is credits for building with **Hunyuan (Hy)** models via **TokenHub**.

## Overview

**TokenHub** = Tencent Cloud's LLM gateway: one API key, one bill, OpenAI-compatible Chat Completions (+ Responses for some models) and Anthropic-compatible Messages, routing to Hunyuan plus DeepSeek, GLM, Kimi, MiniMax, etc. New users get up to 1M free tokens (per product page). Plans: pay-as-you-go or subscription ("TokenPlan").

## Hunyuan models on TokenHub (from Tencent's Hy API Guide)

| Model ID | Notes | Context | Max in / out |
|---|---|---|---|
| **`hy4-preview`** | New-gen "productivity" model, upgraded agent & complex-task execution; **Preview** (Tencent warns not production-ready) | 1M | 960k / 64k |
| **`hy3`** | Hybrid fast/slow thinking MoE (295B total / 21B active), business-tuned, cost-efficient | 256k | 192k / 128k |

Also seen via gateways: `hy-mt2-plus` (translation, via LiteLLM listing — unverified).

### Pricing (per 1M tokens)
- `hy4-preview` (Singapore, as of Aug 28 2026): input **$0.834**, output **$2.501**, cache hit **$0.042**.
- `hy3`: "from $0.132 / 1M tokens" per Tencent techpedia headline (unverified breakdown).

## Endpoints

| Region | OpenAI-compatible base URL |
|---|---|
| Singapore (international) | **`https://tokenhub-intl.tencentcloudmaas.com/v1`** |
| Silicon Valley | `https://tokenhub-us.tencentcloudmaas.com/v1` |
| Quick-start / China (per some docs) | `https://tokenhub.tencentmaas.com/v1` (unverified which region) |

Auth: `Authorization: Bearer <TokenHub API key>` (from TokenHub console). Backup `.tech` domains exist. Gateways use env vars like `TENCENT_API_KEY` (LiteLLM, model prefix `tencent/`) or `TOKENHUB_API_KEY` (OpenClaw).

## Features

- **Deep reasoning**: `thinking: {"type": "enabled"}` or `reasoning_effort: "high" | "low"`; output in `reasoning_content`. hy4-preview has **Preserved Thinking**.
- **Streaming**: `stream: true`, `stream_options: {"include_usage": true}`.
- **Tool calling**: standard OpenAI `tools` → `tool_calls` → reply with `role: "tool"` messages.
- Structured output, caching.
- Messages order must be: system (optional) → user → assistant → user …, ending with user.

## Code

```ts
import OpenAI from "openai";
const hy = new OpenAI({ apiKey: process.env.TOKENHUB_API_KEY, baseURL: "https://tokenhub-intl.tencentcloudmaas.com/v1" });

const res = await hy.chat.completions.create({
  model: "hy3",
  messages: [{ role: "user", content: "Draft an ERC-8004 registration file for a price-oracle agent on Monad" }],
  tools: [{ type: "function", function: { name: "register_agent", description: "Register agent on Monad IdentityRegistry",
    parameters: { type: "object", properties: { agentURI: { type: "string" } }, required: ["agentURI"] } } }],
  // @ts-expect-error provider-specific
  thinking: { type: "enabled" },
});
```

```python
from openai import OpenAI
client = OpenAI(api_key=os.environ["TOKENHUB_API_KEY"], base_url="https://tokenhub-intl.tencentcloudmaas.com/v1")
r = client.chat.completions.create(model="hy4-preview", messages=[{"role":"user","content":"hi"}],
                                   extra_body={"reasoning_effort": "high"})
```

Vercel AI SDK: use `@ai-sdk/openai-compatible` with the TokenHub base URL. Tencent also has a native `tencentcloud-sdk-*` Hunyuan API (older, signature-v3 auth) — prefer TokenHub.

## Monad / hackathon fit

- Cheap reasoning (hy3) for high-frequency agent loops (e.g., per-block decisions on Monad's 300 ms blocks — batch, don't call per block).
- hy4-preview 1M context for long-horizon agents; keep human approval gates (Tencent's own recommendation).
- TokenHub also exposes Kimi/DeepSeek/GLM → one key for multi-model agents; but to qualify, make **Hunyuan** central.

### Project ideas
1. **Hunyuan-driven x402 merchant agent**: sells data/tools on Monad, uses hy3 for pricing/negotiation, reputation via ERC-8004.
2. **Multilingual onboarding agent** with Mera passkeys (hy3 / hy-mt translation) for non-crypto users.
3. **Hunyuan 3D / image** generation + provenance registration on Monad (Hunyuan 3D is a separate product — unverified API availability via TokenHub).

## Gotchas

- Multiple base-URL variants in the wild (`tencentcloudmaas.com` vs `tencentmaas.com`); use the console-shown one for your key's region.
- `hy4-preview` is explicitly an early preview — expect behavior changes.
- Model IDs are lowercase `hy3` / `hy4-preview` (not "hunyuan-*" legacy IDs like `hunyuan-turbos` — those are older native-API names, unverified on TokenHub).
- Confirm the $2,000 credit redemption path with the Kepler Plan / Tencent contact at Metropolis.

## Sources

- https://www.tencentcloud.com/products/tokenhub , https://www.tencentcloud.com/act/pro/tokenhub
- https://www.tencentcloud.com/document/product/1300/80695 (Hy API Guide)
- https://www.tencentcloud.com/techpedia/148044?lang=en (Hy4 Preview FAQ: specs, pricing, regions)
- https://www.tencentcloud.com/techpedia/148043?lang=en , https://www.tencentcloud.com/techpedia/145748?lang=en
- https://www.tencent.com/en-us/articles/2202386.html (Hy3 release)
- https://docs.litellm.ai/docs/providers/tencent , https://docs.openclaw.ai/providers/tencent
- https://dorahacks.io/hackathon/tencentkeplerplan , https://edgeone.ai/blog/details/kepler-plan-s3
