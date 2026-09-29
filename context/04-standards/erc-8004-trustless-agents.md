# ERC-8004: Trustless Agents

> Last researched: 2026-09-28. Status of the ERC is **Draft** (created 2025-08-13). Authors: Marco De Rossi (MetaMask), Davide Crapis (EF), Jordan Ellis (Google), Erik Reppel (Coinbase).
> Directly named in the Metropolis **Trust, Identity & AI Infrastructure** track: "Agent identity and reputation under ERC-8004".

## Overview

ERC-8004 gives AI agents (and agentic services such as MCP servers or APIs) a **portable onchain identity, a public reputation trail, and hooks for independent validation**, so agents can be discovered and trusted across organizational boundaries without prior relationships. It is three per-chain singleton registries:

| Registry | What it is | Monad status |
|---|---|---|
| **Identity Registry** | ERC-721 (+ URIStorage). `tokenId` = `agentId`, `tokenURI` = `agentURI` → agent registration JSON | **Deployed** (mainnet + testnet) |
| **Reputation Registry** | Standard feedback interface: signed fixed-point `value` + tags + optional off-chain file | **Deployed** (mainnet + testnet) |
| **Validation Registry** | Request/response hooks for validators (stake re-execution, zkML, TEE oracles, judges) | "Coming soon" per Monad docs; spec section still being revised with TEE community |

Payments are explicitly out of scope, but the spec shows how **x402** payment proofs enrich feedback (see `x402-and-agent-payments.md`). Communication protocols are pluggable: the registration file links to **A2A** agent cards, **MCP** endpoints, OASF manifests, ENS, DIDs, email.

## Deployed addresses on Monad (verified)

Verified 2026-09-28: `eth_getCode` returns ERC-1967 proxy bytecode for all four addresses on the respective RPCs. Same vanity CREATE2 addresses across chains (via Safe Singleton Factory, `0x8004` prefix).

| Network | Chain ID | IdentityRegistry | ReputationRegistry |
|---|---|---|---|
| Monad Mainnet | 143 | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` |
| Monad Testnet | 10143 | `0x8004A818BFB912233c491871b3d84c89A494BD9e` | `0x8004B663056A597Dffe9eCcC1965A193B7388713` |

- Mainnet addresses are listed in the official Monad guide (docs.monad.xyz/guides/erc-8004) and the `erc-8004/erc-8004-contracts` README.
- Testnet addresses come from the `erc-8004-contracts` README (they're the same "testnet" addresses used on Sepolia, Base Sepolia, etc.).
- ValidationRegistry: no Monad address published. Deploy your own from `contracts/ValidationRegistryUpgradeable.sol` if you need it (and note that in your submission).
- The `agentRegistry` string for Monad mainnet is `eip155:143:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`.

## How it works

### Identity Registry

Global agent ID = `agentRegistry` (`{namespace}:{chainId}:{identityRegistry}`) + `agentId` (ERC-721 tokenId, assigned incrementally).

```solidity
struct MetadataEntry { string metadataKey; bytes metadataValue; }

function register(string agentURI, MetadataEntry[] calldata metadata) external returns (uint256 agentId);
function register(string agentURI) external returns (uint256 agentId);
function register() external returns (uint256 agentId); // set URI later

function setAgentURI(uint256 agentId, string calldata newURI) external;

function getMetadata(uint256 agentId, string memory metadataKey) external view returns (bytes memory);
function setMetadata(uint256 agentId, string memory metadataKey, bytes memory metadataValue) external;

// Reserved key "agentWallet": payment address. Initially = owner. Changing requires
// EIP-712 sig (EOA) or ERC-1271 (smart wallet) from the NEW wallet. Cleared on NFT transfer.
function setAgentWallet(uint256 agentId, address newWallet, uint256 deadline, bytes calldata signature) external;
function getAgentWallet(uint256 agentId) external view returns (address);
function unsetAgentWallet(uint256 agentId) external;

event Registered(uint256 indexed agentId, string agentURI, address indexed owner);
event URIUpdated(uint256 indexed agentId, string newURI, address indexed updatedBy);
event MetadataSet(uint256 indexed agentId, string indexed indexedMetadataKey, string metadataKey, bytes metadataValue);
// plus standard ERC-721 Transfer
```

`agentURI` may be `ipfs://`, `https://`, or a fully onchain `data:application/json;base64,...` URI.

### Agent registration file (the "agent card")

```jsonc
{
  "type": "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
  "name": "myAgentName",
  "description": "What it does, how it works, pricing, interaction methods",
  "image": "https://example.com/agentimage.png",
  "services": [
    { "name": "web",   "endpoint": "https://web.agentxyz.com/" },
    { "name": "A2A",   "endpoint": "https://agent.example/.well-known/agent-card.json", "version": "0.3.0" },
    { "name": "MCP",   "endpoint": "https://mcp.agent.eth/", "version": "2025-06-18" },
    { "name": "OASF",  "endpoint": "ipfs://{cid}", "version": "0.8", "skills": [], "domains": [] },
    { "name": "ENS",   "endpoint": "vitalik.eth", "version": "v1" },
    { "name": "DID",   "endpoint": "did:method:foobar", "version": "v1" },
    { "name": "email", "endpoint": "mail@myagent.com" }
  ],
  "x402Support": false,
  "active": true,
  "registrations": [
    { "agentId": 22, "agentRegistry": "eip155:143:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" }
  ],
  "supportedTrust": ["reputation", "crypto-economic", "tee-attestation"]
}
```

- `supportedTrust` optional; if empty the ERC is used for discovery only.
- **Endpoint domain verification (optional):** host `https://{endpoint-domain}/.well-known/agent-registration.json` containing a matching `registrations` entry to prove you control that domain.

### Reputation Registry

```solidity
function initialize(address identityRegistry_) external;           // set at deploy
function getIdentityRegistry() external view returns (address);

function giveFeedback(
  uint256 agentId, int128 value, uint8 valueDecimals,  // valueDecimals 0..18
  string calldata tag1, string calldata tag2,
  string calldata endpoint, string calldata feedbackURI, bytes32 feedbackHash
) external;
// Submitter MUST NOT be the agent owner/operator (no self-feedback).
// Stored: value, valueDecimals, tag1, tag2, isRevoked, feedbackIndex (1-indexed per client).
// Emitted only (not stored): endpoint, feedbackURI, feedbackHash.

function revokeFeedback(uint256 agentId, uint64 feedbackIndex) external;
function appendResponse(uint256 agentId, address clientAddress, uint64 feedbackIndex,
                        string calldata responseURI, bytes32 responseHash) external; // anyone

function getSummary(uint256 agentId, address[] calldata clientAddresses, string tag1, string tag2)
  external view returns (uint64 count, int128 summaryValue, uint8 summaryValueDecimals); // clientAddresses MUST be non-empty
function readFeedback(uint256 agentId, address clientAddress, uint64 feedbackIndex)
  external view returns (int128 value, uint8 valueDecimals, string tag1, string tag2, bool isRevoked);
function readAllFeedback(uint256 agentId, address[] calldata clientAddresses, string tag1, string tag2, bool includeRevoked)
  external view returns (address[] memory, uint64[] memory, int128[] memory, uint8[] memory, string[] memory, string[] memory, bool[] memory);
function getResponseCount(uint256 agentId, address clientAddress, uint64 feedbackIndex, address[] responders) external view returns (uint64);
function getClients(uint256 agentId) external view returns (address[] memory);
function getLastIndex(uint256 agentId, address clientAddress) external view returns (uint64);

event NewFeedback(uint256 indexed agentId, address indexed clientAddress, uint64 feedbackIndex,
  int128 value, uint8 valueDecimals, string indexed indexedTag1, string tag1, string tag2,
  string endpoint, string feedbackURI, bytes32 feedbackHash);
event FeedbackRevoked(uint256 indexed agentId, address indexed clientAddress, uint64 indexed feedbackIndex);
event ResponseAppended(uint256 indexed agentId, address indexed clientAddress, uint64 feedbackIndex,
  address indexed responder, string responseURI, bytes32 responseHash);
```

Suggested `tag1` conventions from the spec: `starred` (0-100), `reachable` (0/1), `ownerVerified`, `uptime` (9977 / 2 decimals = 99.77%), `successRate`, `responseTime` (ms), `blocktimeFreshness`, `revenues`, `tradingYield` (tag2 = day/week/month/year).

Off-chain feedback file (optional) — required fields `agentRegistry, agentId, clientAddress, createdAt, value, valueDecimals`; optional `tag1/tag2/endpoint`, `mcp: {tool|prompt|resource}`, `a2a: {skills, contextId, taskId}`, `oasf`, and **`proofOfPayment: {fromAddress, toAddress, chainId, txHash}`** (x402 receipt).

### Validation Registry (spec; not yet deployed on Monad)

```solidity
function validationRequest(address validatorAddress, uint256 agentId, string requestURI, bytes32 requestHash) external; // owner/operator only
function validationResponse(bytes32 requestHash, uint8 response /*0..100*/, string responseURI, bytes32 responseHash, string tag) external; // validator only, callable repeatedly
function getValidationStatus(bytes32 requestHash) external view returns (address validatorAddress, uint256 agentId, uint8 response, bytes32 responseHash, string tag, uint256 lastUpdate);
function getSummary(uint256 agentId, address[] calldata validatorAddresses, string tag) external view returns (uint64 count, uint8 averageResponse);
function getAgentValidations(uint256 agentId) external view returns (bytes32[] memory);
function getValidatorRequests(address validatorAddress) external view returns (bytes32[] memory);

event ValidationRequest(address indexed validatorAddress, uint256 indexed agentId, string requestURI, bytes32 indexed requestHash);
event ValidationResponse(address indexed validatorAddress, uint256 indexed agentId, bytes32 indexed requestHash, uint8 response, string responseURI, bytes32 responseHash, string tag);
```

### Interaction flow

1. Service agent registers identity (mint NFT, publish registration file).
2. Client discovers agents (subgraph / explorer / onchain enumeration).
3. Client checks reputation (`getSummary` filtered by trusted reviewers).
4. Client calls service + pays with x402.
5. Client submits `giveFeedback` (with `proofOfPayment` in feedback file).
6. (High-stakes) validator re-executes / verifies TEE/zk proof → `validationResponse`.

## Code

### TypeScript: raw viem against Monad

```ts
import { createPublicClient, createWalletClient, http, parseAbi, toHex } from "viem";
import { monad } from "viem/chains"; // monadTestnet for 10143
import { privateKeyToAccount } from "viem/accounts";

const IDENTITY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";
const REPUTATION = "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63";

const identityAbi = parseAbi([
  "function register(string agentURI) returns (uint256 agentId)",
  "function setAgentURI(uint256 agentId, string newURI)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function getAgentWallet(uint256 agentId) view returns (address)",
  "event Registered(uint256 indexed agentId, string agentURI, address indexed owner)",
]);
const reputationAbi = parseAbi([
  "function giveFeedback(uint256 agentId, int128 value, uint8 valueDecimals, string tag1, string tag2, string endpoint, string feedbackURI, bytes32 feedbackHash)",
  "function getSummary(uint256 agentId, address[] clientAddresses, string tag1, string tag2) view returns (uint64 count, int128 summaryValue, uint8 summaryValueDecimals)",
]);

const account = privateKeyToAccount(process.env.PK as `0x${string}`);
const pub = createPublicClient({ chain: monad, transport: http() });
const wallet = createWalletClient({ account, chain: monad, transport: http() });

// Fully on-chain registration file
const card = { type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1", name: "PriceBot",
  description: "MON/USDC quotes via MCP", image: "", services: [{ name: "MCP", endpoint: "https://mcp.example.xyz/" }],
  x402Support: true, active: true, registrations: [], supportedTrust: ["reputation"] };
const uri = "data:application/json;base64," + Buffer.from(JSON.stringify(card)).toString("base64");

const { request } = await pub.simulateContract({ account, address: IDENTITY, abi: identityAbi, functionName: "register", args: [uri] });
const hash = await wallet.writeContract({ ...request, gas: 600_000n }); // Monad charges gas LIMIT - set it deliberately
```

Feedback (from a *different* address than the agent owner):

```ts
await wallet.writeContract({
  address: REPUTATION, abi: reputationAbi, functionName: "giveFeedback",
  args: [agentId, 87n, 0, "starred", "defi", "https://mcp.example.xyz/", "ipfs://bafy...", "0x" + "00".repeat(32)],
});
const [count, value, decimals] = await pub.readContract({
  address: REPUTATION, abi: reputationAbi, functionName: "getSummary",
  args: [agentId, [trustedReviewer1, trustedReviewer2], "starred", ""],
});
```

### TypeScript: agent0 SDK (`agent0-sdk`, v1.7.1)

Official-ish SDK from the ERC-8004 team (TS: `agent0lab/agent0-ts`, Python: `agent0lab/agent0-py`, docs sdk.ag0.xyz). **Built-in defaults cover chains 1, 8453, 137, 11155111, 84532 only — Monad is NOT a default**, so pass `registryOverrides` (and there is no default Monad subgraph, so `searchAgents` won't work unless you supply `subgraphOverrides`).

```ts
import { SDK } from "agent0-sdk";

const sdk = new SDK({
  chainId: 143,
  rpcUrl: "https://rpc.monad.xyz",
  privateKey: process.env.PK,
  ipfs: "pinata", pinataJwt: process.env.PINATA_JWT,
  registryOverrides: { 143: {
    IDENTITY: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
    REPUTATION: "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63",
  } },
  // subgraphOverrides: { 143: "<your subgraph/indexer URL>" },
});

const agent = sdk.createAgent("My AI Agent", "Skills: data analysis", "https://example.com/a.png");
await agent.setMCP("https://mcp.example.com/");                 // crawls tools/prompts/resources
await agent.setA2A("https://a2a.example.com/agent-card.json");  // crawls skills
agent.addSkill("natural_language_processing/natural_language_generation/summarization", true);
agent.setTrust(true, false, false); // reputation, cryptoEconomic, teeAttestation
agent.setActive(true);
const reg = await agent.registerIPFS();          // or agent.registerOnChain() for data: URI
console.log(reg.agentId, reg.agentURI);          // "143:<id>", "ipfs://..."

const tx = await sdk.giveFeedback("143:123", 85, "data_analyst", "finance", "https://api.example.com");
await tx.waitConfirmed();
```

(Monad-specific `registryOverrides` usage is derived from the SDK source — `src/core/sdk.ts` accepts `registryOverrides`/`subgraphOverrides`; not tested end-to-end on Monad.)

### Solidity: gate a contract on reputation

```solidity
interface IReputationRegistry {
  function getSummary(uint256 agentId, address[] calldata clients, string calldata tag1, string calldata tag2)
    external view returns (uint64 count, int128 summaryValue, uint8 summaryValueDecimals);
}
interface IIdentityRegistry { function getAgentWallet(uint256 agentId) external view returns (address); }

contract AgentGatedVault {
  IReputationRegistry constant REP = IReputationRegistry(0x8004BAa17C55a88189AE136b182e5fdA19dE9b63);
  IIdentityRegistry  constant ID  = IIdentityRegistry(0x8004A169FB4a3325136EB29fA0ceB6D2e539a432);
  address[] public reviewers; // curated reviewer set = your Sybil defense

  function act(uint256 agentId) external {
    require(ID.getAgentWallet(agentId) == msg.sender, "not agent wallet");
    (uint64 n, int128 v, ) = REP.getSummary(agentId, reviewers, "starred", "");
    require(n >= 3 && v >= 80, "low reputation");
    // ...
  }
}
```

## Monad specifics

- Registries live on Monad mainnet + testnet at the vanity addresses above; Monad docs have an official guide.
- **Cheap, fast feedback:** 300 ms blocks / 600 ms finality make per-interaction `giveFeedback` realistic (e.g., after every x402 call).
- **Gas limit is charged, not gas used** on Monad — set explicit `gas` on writes; `register` with a large `data:` URI is expensive (string storage).
- Monad x402 facilitator (`https://x402-facilitator.molandak.org`) pairs naturally: put the settlement `txHash` in `proofOfPayment`.
- Explorers that index 8004 agents: 8004scan.io, agentscan.info, 8004agents.ai (check Monad coverage before relying on them — unverified).
- No official Monad subgraph for agent0 search yet (unverified) → building an **indexer / explorer / search for Monad 8004 agents** is itself a valid project.

## Hackathon project ideas

1. **Monad 8004 Explorer + reputation oracle** — index `Registered`/`NewFeedback` events (Envio/Goldsky/custom), expose a trust score API + onchain `ReputationOracle` contract that other dapps read.
2. **Pay-then-rate agent marketplace** — x402-paid MCP tools; feedback only accepted with a verified x402 `proofOfPayment` (anti-Sybil: reviewers must have paid).
3. **Validation Registry deployment + TEE/zkML validator** — deploy ValidationRegistry on Monad, build a validator that re-runs inference (or checks a Phala/TEE attestation) and posts `validationResponse`.
4. **Reputation-gated DeFi vault** — trading agents can only manage capital if `getSummary` over curated reviewers ≥ threshold; slash/penalize via negative feedback.
5. **Passkey-owned agents** — agent NFT owned by a passkey smart account (P256 at 0x100); human approves `setAgentWallet` rotations with Face ID.
6. **Agent routing** — router agent that picks providers by latency/price/reputation and writes feedback automatically.

## Gotchas

- **Sybil:** anyone can post feedback. `getSummary` *requires* a non-empty `clientAddresses` filter by design; you must choose whose opinions count (paid clients, staked reviewers, ERC-8004-registered agents with their own rep).
- Owner/operators **cannot** rate their own agent (enforced).
- `endpoint`, `feedbackURI`, `feedbackHash` are **event-only**, not stored — you need an indexer to read them.
- `agentWallet` resets to zero on NFT transfer; new owner must re-verify.
- Validation Registry spec is still in flux (README warns of a follow-up update) and not deployed on Monad.
- The registries are **upgradeable proxies** controlled by the 8004 team.
- ERC status is **Draft** — function signatures have changed across revisions (older tutorials use `newAgent`, `agentDomain`, `score uint8` etc.). Use the ABIs in `erc-8004/erc-8004-contracts/abis`.
- Monad docs' "Advanced Features" snippets (CCIP bridging, TEE validation) are pseudocode placeholders.

## Related standards

- **A2A (Agent2Agent)** — `a2aproject/A2A` (Linux Foundation). Agent cards at `/.well-known/agent-card.json`; referenced from 8004 `services`.
- **MCP** — Model Context Protocol; 8004 `services` entry with MCP version string; see `03-sponsors/ai-models/agent-frameworks.md`.
- **OASF** — Open Agentic Schema Framework (agntcy/oasf) skills/domains taxonomy used by agent0 `addSkill/addDomain`.
- **x402** — payments; `x402Support` flag + `proofOfPayment`.
- **ERC-1271 / EIP-712 / EIP-7702** — wallet verification and gas-sponsored feedback.

## Sources

- https://eips.ethereum.org/EIPS/eip-8004 (raw: https://raw.githubusercontent.com/ethereum/ERCs/master/ERCS/erc-8004.md)
- https://docs.monad.xyz/guides/erc-8004
- https://github.com/erc-8004/erc-8004-contracts (README with all chain addresses; `abis/`)
- https://github.com/erc-8004/best-practices
- https://www.8004.org
- https://github.com/agent0lab/agent0-ts , https://github.com/agent0lab/agent0-py , https://sdk.ag0.xyz
- https://github.com/Phala-Network/erc-8004-tee-agent (TEE agent example)
- https://github.com/sudeepb02/awesome-erc8004
- https://8004scan.io
- https://ethereum-magicians.org/t/erc-8004-trustless-agents/25098
