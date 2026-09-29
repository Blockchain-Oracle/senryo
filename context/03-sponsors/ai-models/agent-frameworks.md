# Agent Frameworks for Onchain Agents on Monad (brief)

> Last researched: 2026-09-28. Monad is fully EVM-compatible and `viem/chains` exports `monad` (143) and `monadTestnet` (10143), so any viem-based agent framework works with a custom RPC.

## Summary

| Framework | Status | Monad | Use for |
|---|---|---|---|
| **Vercel AI SDK** (`ai` v7.0.x) | Active | Chain-agnostic (you write viem tools) | Tool-calling loops with Kimi/Qwen/Hunyuan via OpenAI-compatible provider |
| **MCP** (`@modelcontextprotocol/sdk` v1.31.x) | Active; governed by Linux Foundation's Agentic AI Foundation | Official Monad tutorial (`monad-developers/monad-mcp-tutorial`) | Expose Monad actions to any MCP client; advertise in ERC-8004 `services` |
| **Coinbase AgentKit** (`@coinbase/agentkit` v0.10.x) | Active | Any EVM via `ViemWalletProvider` (CDP-managed wallets may not list Monad — unverified) | Batteries-included action providers (ERC-20, x402, etc.) |
| **MetaMask Smart Accounts Kit** (`@metamask/smart-accounts-kit` v2.0.0) | Active; ships agent skills | **Monad mainnet + testnet supported** | Delegated, caveat-limited agent wallets (ERC-7715) — "Best Agent Wallet Plugin" bounty |
| **agent0-sdk** (v1.7.x) | Active | Needs `registryOverrides` for 143/10143 | ERC-8004 registration/feedback/search |
| **x402** (`@x402/*` v2.27.0) | Active | Monad facilitator | Agents paying per call |
| **Mera** (`@category-labs/mera` v0.2.0) | Active | Monad-native | Passkey-derived human-owner accounts |
| **GOAT SDK** | **Archived** ("read-only historical snapshot") | — | Avoid for new builds |
| **Qwen-Agent** | Active | Chain-agnostic | Qwen-native agent loop w/ MCP |

## Vercel AI SDK + viem tools (works with all three sponsor models)

```ts
import { generateText, tool, stepCountIs } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createPublicClient, http, parseAbi, formatEther } from "viem";
import { monad } from "viem/chains";
import { z } from "zod";

const providers = {
  kimi:  createOpenAICompatible({ name: "kimi",  baseURL: "https://api.moonshot.ai/v1", apiKey: process.env.MOONSHOT_API_KEY! }),
  qwen:  createOpenAICompatible({ name: "qwen",  baseURL: process.env.QWEN_BASE_URL!, apiKey: process.env.DASHSCOPE_API_KEY! }),
  hy:    createOpenAICompatible({ name: "hy",    baseURL: "https://tokenhub-intl.tencentcloudmaas.com/v1", apiKey: process.env.TOKENHUB_API_KEY! }),
};
const pc = createPublicClient({ chain: monad, transport: http("https://rpc.monad.xyz") });
const REP = "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63";

const { text, steps } = await generateText({
  model: providers.kimi("kimi-k3"),          // or providers.qwen("qwen3.8-max") / providers.hy("hy3")
  stopWhen: stepCountIs(6),
  tools: {
    getBalance: tool({
      description: "Get MON balance on Monad mainnet",
      inputSchema: z.object({ address: z.string() }),
      execute: async ({ address }) => formatEther(await pc.getBalance({ address: address as `0x${string}` })),
    }),
    getReputation: tool({
      description: "ERC-8004 reputation summary from trusted reviewers",
      inputSchema: z.object({ agentId: z.string(), reviewers: z.array(z.string()) }),
      execute: async ({ agentId, reviewers }) => {
        const [count, value, dec] = await pc.readContract({ address: REP,
          abi: parseAbi(["function getSummary(uint256,address[],string,string) view returns (uint64,int128,uint8)"]),
          functionName: "getSummary", args: [BigInt(agentId), reviewers as `0x${string}`[], "", ""] });
        return { count: Number(count), value: Number(value) / 10 ** dec };
      },
    }),
  },
  prompt: "Check agent 12's reputation and my balance at 0x…; should I hire it?",
});
```
(AI SDK v5+ uses `inputSchema` and `stopWhen`; older examples use `parameters`/`maxSteps`. Dedicated providers also exist: `@ai-sdk/moonshotai`, `@ai-sdk/alibaba`.)

## MCP server for Monad (TypeScript)

```ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createPublicClient, http, formatEther } from "viem";
import { monadTestnet } from "viem/chains";

const pc = createPublicClient({ chain: monadTestnet, transport: http() });
const server = new McpServer({ name: "monad-tools", version: "0.1.0" });

server.tool("get-mon-balance", "Get MON balance on Monad testnet", { address: z.string() },
  async ({ address }) => ({ content: [{ type: "text", text: formatEther(await pc.getBalance({ address: address as `0x${string}` })) }] }));

await server.connect(new StdioServerTransport());
```
Go further: serve over Streamable HTTP, gate tools with x402 (`PAYMENT-SIGNATURE`), and list the MCP endpoint in your ERC-8004 registration file (`{ "name": "MCP", "endpoint": "https://…", "version": "2025-06-18" }`). Kimi also publishes an official MCP server; ModelScope MCP integration is listed in Kimi docs.

## Coinbase AgentKit (any EVM via viem)

```ts
import { AgentKit, ViemWalletProvider, erc20ActionProvider, walletActionProvider } from "@coinbase/agentkit";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { monadTestnet } from "viem/chains";

const walletClient = createWalletClient({ account: privateKeyToAccount(process.env.PK as `0x${string}`), chain: monadTestnet, transport: http() });
const agentkit = await AgentKit.from({
  walletProvider: new ViemWalletProvider(walletClient),
  actionProviders: [walletActionProvider(), erc20ActionProvider()],
});
// then: getVercelAITools(agentkit) from @coinbase/agentkit-vercel-ai-sdk, or LangChain adapter
```
(Export names per AgentKit docs; some action providers are network-gated to Base/Ethereum — check `supportsNetwork`. Unverified on Monad end-to-end.)

## MetaMask Smart Accounts Kit (agent delegation)

- Create a MetaMask smart account for the user (EOA / passkey signer), create a **delegation** to the agent's key with **caveats** (ERC-20 period transfer limits, allowed targets/methods, timestamps), agent redeems through the DelegationManager. Supports ERC-7715 "Advanced Permissions" requests to MetaMask users.
- Monad mainnet + testnet supported. Repo includes **agent skills** to help AI coding assistants use the kit.
- Docs: https://docs.metamask.io/smart-accounts-kit/

## Other notes

- **Monad agent tooling**: Monad docs provide the MCP tutorial, x402 facilitator guide, ERC-8004 guide, and "For AI Agents" docs indexes (`docs.monad.xyz/ai/*.md`, `llms.txt`) — feed these to your coding agent.
- **Gas**: Monad charges gas *limit*; agents that rely on `estimateGas` with big buffers waste money — set tight explicit limits.
- **Nonce/throughput**: 300 ms blocks mean agents can fire many txs quickly; manage nonces locally.
- **Key safety**: prefer delegations/session keys/TEE wallets over raw PKs in agent env vars.

## Sources

- https://ai-sdk.dev/docs (Vercel AI SDK) , https://www.npmjs.com/package/ai , https://www.npmjs.com/package/@ai-sdk/openai-compatible
- https://modelcontextprotocol.io , https://github.com/modelcontextprotocol/typescript-sdk
- https://docs.monad.xyz/guides/monad-mcp , https://github.com/monad-developers/monad-mcp-tutorial
- https://github.com/coinbase/agentkit , https://docs.cdp.coinbase.com/agentkit/docs/welcome
- https://github.com/MetaMask/smart-accounts-kit , https://docs.metamask.io/smart-accounts-kit/development/get-started/supported-networks/
- https://github.com/goat-sdk/goat (archived)
- https://github.com/QwenLM/Qwen-Agent
- https://docs.monad.xyz/llms.txt
