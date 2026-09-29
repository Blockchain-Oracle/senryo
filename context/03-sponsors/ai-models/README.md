# AI Model Sponsors (Metropolis)

> ⚠️ **Bounty details here were researched before the portal was captured.** For official bounty requirements, eligible tracks, prize splits and judging criteria, use [prizes-and-bounties.md](../../00-hackathon/prizes-and-bounties.md) and the full texts in `_portal/bounties/`. Where they differ, **the portal wins**. Known corrections: Agora Mobile requires **Mera + AUSD + Perpl** and is **Track 01 only**; Agora Cross-Border requires **Mera + AUSD, mobile**, and is **Track 02 only**; Kuru ×2, Perpl Analytics and MetaMask Agent Wallet are **Track 01 only**; Hunyuan is **Track 03 only**; Cleanverse and Qwen are **Track 04 only** (Qwen credits go to the top 3 Track 4 winners).


Last researched: 2026-09-28. All three providers are **OpenAI-compatible**, so one agent codebase can swap models via `baseURL` + `model`.

| Sponsor | Bounty | Model to feature | Base URL (intl) | Key env (docs) | File |
|---|---|---|---|---|---|
| **Alibaba Cloud** | **$5,000 credits** — "Best Builds with Qwen 3.8 Max" | `qwen3.8-max` (1M ctx, $2/$6 per 1M in SG) | `https://{WorkspaceId}.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1` (or QwenCloud `https://maas.qwencloudapi.com/compatible-mode/v1`) | `DASHSCOPE_API_KEY` | [qwen-alibaba.md](qwen-alibaba.md) |
| **Kimi (Moonshot AI)** | **$3,000 credits** — "Best Builds Powered by KIMI" | `kimi-k3` (1M ctx, always-thinking) / `kimi-k2.6` / `kimi-k2.7-code(-highspeed)` | `https://api.moonshot.ai/v1` | `MOONSHOT_API_KEY` | [kimi.md](kimi.md) |
| **Tencent Kepler Plan** | **$2,000 credits** — "Build with Hunyuan" | `hy3` (256k) / `hy4-preview` (1M, preview) via TokenHub | `https://tokenhub-intl.tencentcloudmaas.com/v1` | TokenHub key (Bearer) | [hunyuan-tencent.md](hunyuan-tencent.md) |
| — | Frameworks | Vercel AI SDK, MCP, AgentKit, MetaMask Smart Accounts Kit, agent0 | — | — | [agent-frameworks.md](agent-frameworks.md) |

## Key takeaways

- **Model IDs changed a lot in 2026**: `kimi-k2.5`, `moonshot-v1-*`, `kimi-k2-*` are retired (404). Use `kimi-k3` / `kimi-k2.6`. Qwen is `qwen3.8-max` (snapshot `qwen3.8-max-0902`). Hunyuan on TokenHub is `hy3` / `hy4-preview`.
- **Thinking params differ**: Kimi K3 `reasoning_effort` (low/high/max); Kimi K2.x `thinking: {type, keep}`; Qwen `extra_body: {enable_thinking, thinking_budget}`; Hunyuan `thinking: {type:"enabled"}` or `reasoning_effort`. All return `reasoning_content` — preserve it across tool-call turns.
- **All support function/tool calling** in OpenAI format → the same viem tool set (Monad reads/writes, ERC-8004, x402) works across them.
- **Stacking bounties**: a Trust/Identity track project (e.g., ERC-8004 agent w/ passkey owner + x402) can feature one sponsor model centrally. Bounties are model-specific — pick one primary model per submission rather than a generic "multi-model" claim (judging criteria unpublished; unverified whether multiple AI bounties can be won by one project).
- Credit redemption/regions are unclear — ask sponsors in the Metropolis Discord early.

## Minimal multi-provider client

```ts
import OpenAI from "openai";
export const llm = {
  qwen: new OpenAI({ apiKey: process.env.DASHSCOPE_API_KEY, baseURL: process.env.QWEN_BASE_URL }),   // model "qwen3.8-max"
  kimi: new OpenAI({ apiKey: process.env.MOONSHOT_API_KEY, baseURL: "https://api.moonshot.ai/v1" }), // model "kimi-k3"
  hy:   new OpenAI({ apiKey: process.env.TOKENHUB_API_KEY, baseURL: "https://tokenhub-intl.tencentcloudmaas.com/v1" }), // model "hy3"
};
```

Related standards: `../../04-standards/` (ERC-8004, x402, passkeys, provenance).
