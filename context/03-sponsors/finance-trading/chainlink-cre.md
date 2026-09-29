# Chainlink — CRE (Chainlink Runtime Environment) + Data Feeds / Data Streams / CCIP on Monad

Bounty: **$3,000 "Best workflow with CRE"**. Mentor: Darb (Chainlink Labs DevRel, x.com/darbease). No public rubric; assume the workflow must be *meaningful* (offchain data/API + consensus + onchain write on Monad), simulated at minimum, deployed if access is granted.

## Overview
- **CRE** = run your own workflows (TypeScript or Go compiled to WASM) on Chainlink Decentralized Oracle Networks. A workflow = **trigger → callback** using **capabilities**: Cron, HTTP trigger, EVM Log trigger, HTTP client, Confidential HTTP, EVM read/write, randomness, secrets, consensus aggregation. Output = DON-signed **report** delivered onchain through a `KeystoneForwarder` to your consumer contract's `onReport`.
- **Monad is supported**: mainnet (CLI ≥ v1.29.0, TS SDK ≥ v1.18.0, Go SDK ≥ v1.17.0) and testnet (CLI ≥ v1.30.0, TS SDK ≥ v1.19.0). Chain selector names: `monad-mainnet`, `monad-testnet`. SDK constants `MonadTestnet` added.
- Also live on Monad: **Price Feeds** (push), **Data Streams** (pull, low latency — Perpl uses them for its spot index), **CCIP** (announced "live from Day 1", Chainlink X post), SVR feeds.

## CRE quickstart (TypeScript)
Prereqs: Bun ≥ 1.2.21, CRE account (cre.chain.link), `cre login`.
```bash
curl -sSL https://app.chain.link/cre/install.sh | bash     # installs to ~/.cre ; then `cre version`; `cre update`
cre login
cre init                       # pick a template (Hello World built-in; Custom Data Feed, etc.) — prompts for RPC URL
cd my-project/my-workflow && bun install
cre workflow simulate my-workflow --target staging-settings            # local sim (real RPC reads)
cre workflow simulate my-workflow --broadcast --target staging-settings # actually sends writes via MockKeystoneForwarder
cre workflow supported-chains --output json                             # chains + forwarders enabled for your org
cre account access             # request deploy access (deployment needs approval)
cre workflow deploy ...        # deployment-registry: "private" (no gas/wallet) or "onchain:ethereum-mainnet"
```
Project files: `project.yaml` (RPC URLs per target — **required** or the EVM capability won't register in sim), `workflow.yaml` (paths, config, secrets, `deployment-registry`), `config.json`.

### Workflow: cron → fetch API with consensus → write to Monad
```ts
import { CronCapability, HTTPClient, EVMClient, handler, Runner, getNetwork, hexToBase64, bytesToHex,
  consensusMedianAggregation, TxStatus, type Runtime, type NodeRuntime } from "@chainlink/cre-sdk";
import { encodeAbiParameters, parseAbiParameters } from "viem";
import { z } from "zod";

const configSchema = z.object({ schedule: z.string(), chainSelectorName: z.string(), consumerAddress: z.string(), gasLimit: z.string(), apiUrl: z.string() });
type Config = z.infer<typeof configSchema>;

const fetchScore = (nr: NodeRuntime<Config>): bigint => {        // runs on each node
  const res = new HTTPClient().sendRequest(nr, { url: nr.config.apiUrl, method: "GET" }).result();
  return BigInt(JSON.parse(new TextDecoder().decode(res.body)).score);
};

const onCron = (runtime: Runtime<Config>): string => {
  const score = runtime.runInNodeMode(fetchScore, consensusMedianAggregation())().result(); // DON median
  const net = getNetwork({ chainFamily: "evm", chainSelectorName: runtime.config.chainSelectorName }); // "monad-testnet"
  if (!net) throw new Error("network not found");
  const evm = new EVMClient(net.chainSelector.selector);
  const payload = encodeAbiParameters(parseAbiParameters("address user, uint256 score, uint256 ts"),
    ["0xUser", score, BigInt(Math.floor(Date.now() / 1000))]);
  const report = runtime.report({ encodedPayload: hexToBase64(payload), encoderName: "evm", signingAlgo: "ecdsa", hashingAlgo: "keccak256" }).result();
  const w = evm.writeReport(runtime, { receiver: runtime.config.consumerAddress, report, gasConfig: { gasLimit: runtime.config.gasLimit } }).result();
  if (w.txStatus !== TxStatus.SUCCESS) throw new Error(`tx failed ${w.txStatus}`);
  return bytesToHex(w.txHash ?? new Uint8Array(32));
};

const initWorkflow = (config: Config) => [handler(new CronCapability().trigger({ schedule: config.schedule }), onCron)];
export async function main() { const runner = await Runner.newRunner<Config>(); await runner.run(initWorkflow); }
```
(`runtime.runInNodeMode(fn, consensusMedianAggregation<bigint>())().result()` and `httpClient.sendRequest(nodeRuntime, {url}).result()` match the official examples; cron → report → writeReport is copied from the official "writing data onchain" example. Response body decoding is our assumption; check the HTTP Client reference.)

Other triggers: `HTTPCapability` trigger (authorized keys when deployed), EVM Log trigger (react to Monad events, e.g. Kuru `Trade`, Perpl liquidations). EVM read: `evmClient.callContract(runtime, { call: { from, to, data }, blockNumber })`.

### Consumer contract (Monad)
Implement `IReceiver` (`onReport(bytes metadata, bytes report)`) + ERC-165; easiest: extend Chainlink's `ReceiverTemplate` and set the forwarder address. Validate forwarder address + workflow id/owner. `metadata` is **64 bytes** in production (62 packed + `bytes2 reportId`) — don't `require(len==62)`.
| Forwarder | Monad mainnet | Monad testnet |
|---|---|---|
| Production `KeystoneForwarder` | `0x76c9cf548b4179F8901cda1f8623568b58215E62` | `0xF8344CFd5c43616a4366C34E3EEE75af79a74482` |
| Simulation `MockKeystoneForwarder` (`--broadcast`) | `0x9eF6468C5f37b976E57d52054c693269479A784d` | `0xB9F79d863261869B234c481D1f9A7af84AeAd192` |
(From CRE docs forwarder tables; confirm with `cre workflow supported-chains` for your tenant.)

## Data Feeds / Streams on Monad (for reading prices)
Price Feed proxies (AggregatorV3 `latestRoundData()`), Monad mainnet — primary (8 dec, 1h heartbeat unless noted):
| Feed | Proxy |
|---|---|
| BTC/USD | `0xc1d4C3331635184fA4C3c22fb92211B2Ac9E0546` |
| ETH/USD | `0x1B1414782B859871781bA3E4B0979b9ca57A0A04` |
| MON/USD | `0xBcD78f76005B7515837af6b50c7C52BCf73822fb` |
| SOL/USD | `0x16F8008c3e89f62e5e2b909Ce70999370D38F4F2` |
| USDC/USD | `0xf5F15f188AbCB0d165D1Edb7f37F7d6fA2fCebec` |
| USDT/USD | `0x1a1Be4c184923a6BFF8c27cfDf6ac8bDE4DE00FC` |
| AUSD/USD | `0xE20751C7B5867bCBef815ffc1b284c3f412a9e13` |
| LINK/USD | `0x5c266b5c655664d6c99a13fF0d7F1F7eaF4Ac9ba` |
| XAU/USD | `0x61dD33A34E47a181EE02e42eE0546a3DA808f1B4` |
| EUR/USD (18 dec, 240s hb) | `0x00D7E359c8CE46168eFDD4D65b708fFb16c4b99a` |
| GBP/USD (18 dec) | `0x1ffC8B75a16FFfbd7879F042B580F7607Dcf5C30` |
| JPY/USD (18 dec) | `0xF64664Ea54cE47eCC7a1816C49d1Bc6deF828927` |
| shMON/MON rate | `0x54a1020D118B9BeF3F3A4ec8E24AeEc9DFdBe4c3` ; aprMON/MON `0xc744776cAF11982a4c632121E0f6E2543f42FA47` |
Also 18-dec "Shared SVR" variants (e.g. BTC/USD `0x187efD8ba8483105f2735740D956f7CD23723deC`, MON/USD `0xFB504aD06Ab5E6c63FE0A46FEa245214838E8015`) — SVR recaptures oracle-extractable MEV (liquidations) for the consuming protocol. Full list: 108 feeds in `feeds-monad-mainnet.json`.
Monad testnet (8 dec, 24h hb): BTC/USD `0x12C0F44368a02081ce58a936d1C1F606BB301715`, ETH/USD `0x5c8c8482f064049248F86D9F4aFa4B1f2F5b6d31`, USDC/USD `0x39820e7965e29DC86b94F20eD04e9c5cCf9aFf95`, USDT/USD `0xc8a72485e68af06308A8C888eB376AB322310Fa6`, LINK/USD `0x2A9FBFbf392594c4Dd7593C8a91cdEbc02e5b884`.
Data Streams Monad mainnet: Router `0x33566fE5976AAa420F3d5C64996641Fc3858CaDB`, VerifierProxy `0xEd813D895457907399E41D36Ec0bE103E32148c8` (stream access requires Chainlink credentials). CCIP router/chain selector: see docs.chain.link/ccip/directory (not captured here; unverified).

## Bounty & ideas
Judging angle (inferred): uses multiple CRE capabilities (trigger + HTTP + consensus + EVM write), solves something impossible/unsafe with a single server, and writes to Monad. Finance-flavored ideas that also feed other bounties:
1. **Onchain credit score oracle** (track example "undercollateralised lending priced on onchain credit history"): CRE cron/HTTP workflow pulls wallet history (Nansen PnL/labels API via Confidential HTTP so the API key stays secret) + Monad lending repayment events, DON-median consensus, writes a signed score to a Monad `CreditRegistry`; lending pool prices LTV off it. Also Nansen bounty.
2. **Oracle-driven market maker for new Kuru assets**: cron workflow reads Chainlink FX/XAU feeds + external API, computes flip-order ladders, writes a report to a vault contract that re-quotes on Kuru (bring RWA/FX markets). Also Kuru #2.
3. **Perp risk guardian**: EVM Log trigger on Perpl fills/positions + HTTP to CEX prices → if liquidation distance < X, write report that tops up collateral from a user-authorized vault or hedges; or per-block funding "shadow rate" published onchain for research.
4. **Cross-border payment reconciliation**: HTTP-trigger workflow fed by a bank/fintech webhook confirms fiat receipt with consensus, then releases AUSD escrow on Monad (Agora cross-border).

## Gotchas
- Deploying needs **approval** (`cre account access`) — simulate early; judges likely accept simulation + `--broadcast` tx hashes on Monad testnet (unverified).
- Workflows compile to WASM: no Node APIs (fs, net); use SDK HTTP client. Each HTTP call runs per node → wrap with consensus aggregation; non-deterministic responses break identical aggregation.
- Writes go through the forwarder, not directly — your contract must implement `IReceiver`/ERC-165 and trust only the forwarder. Sim uses a *different* (mock) forwarder address than production.
- Check service quotas (execution time, HTTP calls, report size) at docs.chain.link/cre/service-quotas.
- Monad requires recent CLI/SDK versions (≥1.29/1.18 mainnet, ≥1.30/1.19 testnet) — run `cre update`.

## Sources
- https://docs.chain.link/cre/llms.txt ; https://docs.chain.link/cre/ts/llms-full.txt
- https://docs.chain.link/cre/supported-networks-ts.md ; /cre/getting-started/cli-installation/macos-linux.md ; /cre/guides/operations/deploying-workflows.md
- https://docs.chain.link/cre/capabilities/evm-read-write.md ; /cre/reference/sdk/overview-ts.md
- https://reference-data-directory.vercel.app/feeds-monad-mainnet.json ; feeds-monad-testnet.json
- https://github.com/monad-crypto/protocols/blob/main/mainnet/chainlink.jsonc
- https://dev.chain.link/changelog/data-streams-expands-to-monad-mainnet ; https://x.com/chainlink/status/1992956859754709093
