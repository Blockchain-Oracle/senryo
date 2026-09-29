# Alibaba Cloud — "Best Builds with Qwen 3.8 Max" ($5,000 in credits)

> Last researched: 2026-09-28. Largest AI-model bounty in Metropolis. Prize link: https://www.alibabacloud.com/.

## Overview

**Qwen3.8-Max** (announced Aug 3 2026) is Alibaba's flagship: ~2.4T-param sparse MoE (~95B active), 1M context, multimodal (vision), strong at coding, agentic/long-horizon tasks. Served via **Alibaba Cloud Model Studio** (a.k.a. DashScope / Bailian) and the newer **QwenCloud** front-end. Open weights were announced as following the launch (unverified whether released).

## Model IDs (verified from Model Studio docs)

| ID | Notes |
|---|---|
| **`qwen3.8-max`** | Stable alias — use this |
| `qwen3.8-max-0902` (alias `qwen3.8-max-2026-09-02`) | Upgraded snapshot; lower TPM limit (150k) outside CN/SG |

Specs: context **1,000,000**; max output **131,072**; thinking mode max input 983,616, max CoT **262,144**. Function calling + structured outputs: **supported**. Web search: varies by region. Previous: `qwen3.7-max`.

## Pricing (USD / 1M tokens, Model Studio)

| Region | Input | Output | Cached input | Cache create | Cache read |
|---|---|---|---|---|---|
| Singapore (International) | $2.00 | $6.00 | $0.25 | $2.50 | $0.17 |
| Global (US/Frankfurt/Tokyo/HK) | $1.65 | $4.951 | $0.206 | $2.063 | $0.137 |
| China (Beijing) | $1.65 | $4.951 | $0.206 | $2.063 | $0.137 |

Rate limits outside CN/SG: 30,000 RPM, 5M TPM (base alias).

## Endpoints (OpenAI-compatible)

Model Studio now uses **workspace-scoped** hosts:
- Singapore: `https://{WorkspaceId}.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1`
- US (Virginia): `https://dashscope-us.aliyuncs.com/compatible-mode/v1`
- Beijing: `https://{WorkspaceId}.cn-beijing.maas.aliyuncs.com/compatible-mode/v1`
- Hong Kong / Tokyo: `https://{WorkspaceId}.cn-hongkong|ap-northeast-1.maas.aliyuncs.com/compatible-mode/v1`
- Legacy international host `https://dashscope-intl.aliyuncs.com/compatible-mode/v1` still appears in guides (unverified whether still accepted for qwen3.8-max).
- **QwenCloud**: `https://maas.qwencloudapi.com/compatible-mode/v1` (same `qwen3.8-max`, $2/$6 pricing).

API key env var in docs: `DASHSCOPE_API_KEY`. **Keys are region-specific** — a Singapore key won't work on the Beijing host.

## Code

### Python (OpenAI SDK)

```python
from openai import OpenAI
import os
client = OpenAI(api_key=os.getenv("DASHSCOPE_API_KEY"),
                base_url="https://{WorkspaceId}.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1")

resp = client.chat.completions.create(
    model="qwen3.8-max",
    messages=[{"role": "user", "content": "Summarize this agent's ERC-8004 feedback"}],
    tools=[{"type": "function", "function": {
        "name": "read_feedback", "description": "Read ERC-8004 feedback on Monad",
        "parameters": {"type": "object", "properties": {"agentId": {"type": "integer"}}, "required": ["agentId"]}}}],
    extra_body={"enable_thinking": True, "thinking_budget": 4000},  # non-OpenAI params go in extra_body
    stream=True,  # thinking output is typically streamed
)
for chunk in resp:
    d = chunk.choices[0].delta
    if getattr(d, "reasoning_content", None): print(d.reasoning_content, end="")
    if d.content: print(d.content, end="")
```

Thinking controls (Model Studio "deep thinking" guide; per third-party summaries): `enable_thinking` (bool, via `extra_body`), `thinking_budget` (tokens), `preserve_thinking` (re-feed prior reasoning). Output arrives in `reasoning_content`. Some Qwen thinking modes require `stream=True` (verify for qwen3.8-max).

### TypeScript (Vercel AI SDK)

```ts
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText, tool, stepCountIs } from "ai";
import { z } from "zod";

const qwen = createOpenAICompatible({
  name: "qwen",
  baseURL: process.env.QWEN_BASE_URL!, // workspace-scoped compatible-mode/v1 URL
  apiKey: process.env.DASHSCOPE_API_KEY!,
});

const { text } = await generateText({
  model: qwen("qwen3.8-max"),
  tools: {
    balance: tool({ description: "MON balance on Monad", inputSchema: z.object({ address: z.string() }),
      execute: async ({ address }) => (await publicClient.getBalance({ address: address as `0x${string}` })).toString() }),
  },
  stopWhen: stepCountIs(5),
  prompt: "What's the balance of 0x…?",
});
```
There is also `@ai-sdk/alibaba` (v2.0.x) — check whether it supports workspace URLs.

Other: **Qwen-Agent** framework (`QwenLM/Qwen-Agent`) with MCP support; built-in tools on QwenCloud (code interpreter, web search, PDF parsing, web extraction, image search).

## Monad / hackathon fit

- Heavy agentic workloads (1M context, 262k CoT): autonomous trading/treasury agents, onchain auditors, long-horizon ERC-8004 agents.
- Vision: media provenance checks, receipts/ID docs (careful with PII).

### Project ideas
1. **Qwen 3.8 Max validator agent** for the ERC-8004 Validation Registry (re-executes/judges other agents' outputs, posts `validationResponse`).
2. **Contract-to-UX agent**: reads a Monad contract ABI+source, generates a passkey-enabled frontend.
3. **Provenance-stamped generation**: Qwen image/vision pipeline where every output is C2PA-signed + watermarked + registered on Monad.

## Gotchas

- Workspace ID in base URL (new) vs older `dashscope-intl` examples — mismatched region/key → 401.
- `enable_thinking` etc. must go in `extra_body` for the OpenAI SDK.
- Snapshot `-0902` has much lower TPM than the alias outside CN/SG.
- Credits: confirm which region/account (International vs China) the $5,000 applies to.
- Say "Qwen3.8-Max" / `qwen3.8-max` explicitly in the submission — the bounty is model-specific.

## Sources

- https://www.alibabacloud.com/help/en/model-studio/qwen3-8-max
- https://docs.modelstudio.console.alibabacloud.com/en/model-studio/qwen3-8-max
- https://www.alibabacloud.com/help/en/model-studio/compatibility-of-openai-with-dashscope
- https://www.alibabacloud.com/help/en/model-studio/deep-thinking
- https://www.alibabacloud.com/blog/alibaba-unveils-qwen3-8-max-its-largest-and-most-capable-flagship-model-to-date_603420
- https://www.qwencloud.com/models/qwen3.8-max , https://docs.qwencloud.com/developer-guides/text-generation/thinking
- https://github.com/QwenLM/Qwen-Agent
