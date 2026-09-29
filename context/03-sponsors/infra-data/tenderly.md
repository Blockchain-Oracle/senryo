# Tenderly on Monad — Debugger, Simulations, Virtual Environments, Alerts, Node RPC

> Researched 2026-09-28 from docs.tenderly.co (llms.txt + .md pages), the public networks API (`api.tenderly.co/api/v1/public-networks`), tenderly.co/pricing and docs.monad.xyz. Naming: **"Virtual TestNets" are now "Virtual Environments"** (docs URLs are `/virtual-environments/...`). Some env vars still say `TENDERLY_VIRTUAL_TESTNET_RPC`.

## Overview
Tenderly is a full-stack EVM dev platform.

| Product | What it does |
|---|---|
| **Debugger** | Step-through debugging, call trace, gas profiler, readable errors, fund-flow graph. Free tier included. |
| **Simulator** | Single and bundled tx simulation in the UI, the Simulation API, or Node RPC `tenderly_simulateTransaction` / `tenderly_simulateBundle` |
| **Virtual Environments** | Private mainnet forks. Unlimited faucet, cheatcodes (`tenderly_setBalance`, storage overrides, time travel, `tenderly_setCode`), a public explorer for judges, state sync / network-mirror modes, and a GitHub Actions CI. **Paid feature.** |
| **Monitor** | Alerts on events, state, balances and function calls, routed to Email, Slack, Telegram, Discord or PagerDuty. **Web3 Actions** run serverless JS/TS on onchain events. |
| **Node RPC** | Production RPC plus the `tenderly_*` namespace (simulate, trace, decode, gas estimation) |
| **MCP server** | Tenderly inside AI tooling; the blog covers "validating agentic workflows" |

**Pricing (Sep 2026).** Two public tiers:
- **Tenderly Free**: debugger, explorer, single-tx UI simulation, public verification. **No API access.**
- **Tenderly Console**: custom-scoped. Includes Simulator/Virtual Environments, Monitor, Node RPC and private verification.

"Pro" is a **legacy** plan name. The Metropolis perk is "Pro access: a free license to simulate, debug and monitor your build".

## Monad support
- Monad **mainnet (143)** and **testnet (10143)** are in Tenderly's public network registry (`ecosystem: "monad"`, `chain_config.type: "monad"`).
- **Node RPC:** `https://monad.gateway.tenderly.co/<ACCESS_KEY>` and `https://monad-testnet.gateway.tenderly.co/<ACCESS_KEY>` (use `wss://` for WebSockets). Without a key, requests go to the rate-limited public Tenderly endpoint.
- The Monad docs list the **Tenderly Explorer** (https://dashboard.tenderly.co/explorer) as a supported Monad explorer for detailed traces: call stack, balance changes, gas.
- `tenderly_*` methods listed on the Node RPC reference include `tenderly_simulateTransaction`, `tenderly_simulateBundle`, `tenderly_traceTransaction`, `tenderly_estimateGas(Bundle)`, `tenderly_decodeInput/Event/Error`, `tenderly_getStorageChanges`, `tenderly_suggestGasFee`, plus `trace_*` and `debug_*`. The reference page is shared across networks, so **per-method availability on Monad is unverified**. Test with your key.
- **Virtual Environments on Monad:** Tenderly says VEs work on "100+ EVM networks", but the per-network matrix is rendered client-side and was not readable. **Check that "Monad" appears as a parent network in the dashboard** (unverified).
  - Caveat: Monad has a custom execution model (Monad gas model, 128 KB contract size, page-based storage pricing in MonadTen/MIP-8). Whether VE simulation reproduces Monad-specific gas is unverified. Treat VE gas numbers as approximate and confirm on testnet or with Foundry `--network monad`.

## Quickstart code

### 1. Simulate before sending (a wallet or dapp "preview" feature)
```bash
curl https://monad.gateway.tenderly.co/$TENDERLY_NODE_ACCESS_KEY \
  -X POST -H "Content-Type: application/json" \
  -d '{
    "id": 0, "jsonrpc": "2.0",
    "method": "tenderly_simulateTransaction",
    "params": [
      { "from": "0xUser", "to": "0xYourContract", "gas": "0x7a1200", "value": "0x0", "data": "0x..." },
      "latest"
    ]
  }'
# The result includes status, gasUsed, decoded logs, asset/balance changes and a trace
```
```typescript
// viem: custom method via client.request
const sim = await client.request({
  method: "tenderly_simulateTransaction" as any,
  params: [{ from, to, data, value: "0x0" }, "latest"] as any,
});
```

### 2. Virtual Environment: create, fund, deploy and verify with Foundry
In the dashboard:
1. Virtual Environments > Create.
2. Parent network: **Monad** (if listed).
3. Set a custom chain ID (for example 73571) to avoid replay.
4. Optionally enable Public Explorer so judges can inspect txs, and State sync.

```bash
export TENDERLY_VIRTUAL_TESTNET_RPC=https://virtual.<...>.rpc.tenderly.co/<id>   # copy from dashboard
export TENDERLY_VERIFIER_URL=$TENDERLY_VIRTUAL_TESTNET_RPC/verify
export PRIVATE_KEY=0x...

# Unlimited faucet (amount in wei, hex)
curl $TENDERLY_VIRTUAL_TESTNET_RPC -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tenderly_setBalance","params":[["0xYourDeployer"],"0xDE0B6B3A7640000"],"id":1}'

# Deploy and verify (keep cbor_metadata = true, bytecode_hash = "ipfs" in foundry.toml)
forge script script/Deploy.s.sol:Deploy \
  --rpc-url $TENDERLY_VIRTUAL_TESTNET_RPC --private-key $PRIVATE_KEY \
  --broadcast --slow --verify --verifier custom --verifier-url $TENDERLY_VERIFIER_URL
```
- Hardhat: `@tenderly/hardhat-tenderly` is compatible **only up to Hardhat 2.22.0**. Monad's template is **Hardhat 3**, so use Foundry for Tenderly verification.
- Hand testers and judges the **Public RPC**, never the Admin RPC. Admin RPC can mutate balances, storage and time.

### 3. Alerts and Web3 Actions (monitoring for the demo)
- Dashboard > Alerts: trigger on an event or function call on your Monad contract and route to Telegram or Discord. This is a cheap way to show "production-grade monitoring".
- Web3 Actions: serverless TS on each event (keeper-like automation, notifications). Monad support is unverified.

## Features to show judges
- A **public VE explorer link** with the full demo flow replayed on a fork, which is judge-friendly.
- A **"Simulate before you sign"** panel in the UI (asset changes, revert reason) via `tenderly_simulateTransaction`.
- **Gas profiler screenshots** that justify Monad-specific optimizations.
- **Alerts** wired to a Discord channel.

## Perk / bounty
- **Perk:** a free Tenderly **Pro** license for participants ("simulate, debug and monitor your build"). It is presumably the gate to Virtual Environments, the Simulation API and alerts, which are Console/paid features.
- **How to claim.** Not published. Look on the Metropolis platform or Monad Dev Discord, or contact Tenderly with your team email. **Claim early**, because VEs require a paid plan ("contact our sales team") and activation may take time. (unverified)
- There is no Tenderly cash bounty in Metropolis.

## Gotchas
1. **Free tier has no API access.** Simulation-via-API, VEs and alerts need the perk license.
2. **Hardhat 3 incompatibility.** The Tenderly Hardhat plugin supports Hardhat ≤ 2.22.0. Use Foundry `--verifier custom`.
3. **Verification needs matching metadata.** Don't set `bytecode_hash = "none"`, pin `solc_version`, and use explicit `remappings.txt`. Put `--constructor-args` last in `forge create`.
4. **VE sync mode is fixed at creation** (Static, State Only Sync, Network Mirror). Recreate the VE to change it.
5. **Monad trace semantics.** Standard Monad RPC has only `callTracer`, not struct logs. Tenderly's debugger uses its own re-execution; its fidelity for Monad-specific precompiles and gas is unverified.
6. **Use a unique VE chain ID** so wallets don't confuse it with real Monad (143) and no transactions get replayed.

## Sources
- https://docs.tenderly.co/llms.txt
- https://docs.tenderly.co/node/rpc-reference/monad.md
- https://docs.tenderly.co/virtual-environments/quickstart.md
- https://docs.tenderly.co/virtual-environments/pricing.md (VE overview: "available on the paid plan")
- https://docs.tenderly.co/virtual-environments/develop/deploy-contracts.md
- https://docs.tenderly.co/simulations/single-simulations.md
- https://docs.tenderly.co/virtual-environments/admin-rpc.md
- https://api.tenderly.co/api/v1/public-networks
- https://tenderly.co/pricing
- https://docs.monad.xyz/tooling-and-infra/block-explorers.md
- https://docs.monad.xyz/tooling-and-infra/toolkits/foundry.md
- https://monad.xyz/developers/metropolis (perk line)
