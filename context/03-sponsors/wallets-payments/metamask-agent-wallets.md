# MetaMask — "Best Agent Wallet Plugin" ($2,500) + Smart Accounts Kit / Advanced Permissions

> **What the bounty actually is.** "Best Agent Wallet Plugin" refers to the **MetaMask Agent Wallet** (`mm` CLI, `@metamask/agent-wallet`) and its **plugin architecture**. The Susano Labs summary of the Monad Devs announcement describes it as "the best plugin that gives MetaMask Agent Wallet a **new trading capability** through its plugin architecture" (Monad Devs X post 2100962304481521813, MetaMaskDev post 2094856125376319745). A livestream titled "building an Agent Wallet Plugin for MetaMask" ran on 9 Sep 2026. Judge: Francesco Andreoli, MetaMask Director of DevRel.
> This bounty is **not** primarily about Snaps or the Delegation Toolkit. Those are covered below as supporting tech.

---

## 1. MetaMask Agent Wallet (the `mm` CLI)

### Overview
- Gives AI agents (Claude Code, Codex, Cursor, OpenClaw, Hermes, …) a **self-custody wallet** via a CLI and agent skills.
- Install with `npm install -g @metamask/agent-wallet@latest` (Node ≥ 22.18). Add skills with `npx skills add MetaMask/agent-skills` and choose `metamask-agent-wallet`.
- **Wallet modes**:
  - **Server wallet**: keys live in a TEE, and signing is asynchronous with a `pollingId`.
  - **BYOK**: your own mnemonic via `MM_MNEMONIC`, results return synchronously.
- **Trading modes** (server wallet only):
  - **Guard**: network, address and token-recipient allowlists, a rolling 24h outflow limit, and 2FA for anything outside policy.
  - **Beast**: fewer limits, but malicious or risky transactions still need approval.
- **Security stack**: pre-execution simulation, Blockaid threat scanning, and Transaction Protection (up to $10k/mo on "Covered" chains). Also a **gasless relay via EIP-7702** that pays gas in the ERC-20, **ERC-7821 batch execution** (approve + trade in one call), and Smart Transactions.
- **Built-in commands**:
  - `mm transfer`
  - `mm swap quote/execute` (with bridging)
  - `mm perps` (Hyperliquid)
  - `mm predict` (Polymarket)
  - `mm earn` (vaults)
  - `mm price`, `mm token`, `mm tx`, `mm decode`
  - `mm wallet sign-typed-data`
  - x402 via the skill's `scripts/x402_pay.py`.

### Monad support
`mm chains list` shows **Monad (143): Transaction Shield "Covered"** and **Monad Testnet (10143)**. Use `mm chains list --json` to check the `features` (swap/predict/perps) and `relaySupported` fields for Monad before relying on the gasless relay or native swap routing there.

### Plugins (what you build for the bounty)
- A plugin is an **npm package, built on oclif**, that adds native `mm` commands (e.g. `mm ens resolve`). Plugins are **beta and off by default**.
- Each command declares **capabilities**, which the user approves on an install-time consent screen:

| Capability | Grants on `this.ctx` |
|---|---|
| `wallet-read` | `accountService`, `authService`, `priceService`, `tokenService`, `walletStateManager`, `feesService`, `swapQuoteStore`, **`publicClient(chainId)`** (authenticated viem client) |
| `wallet-submit` | **`walletExecutor(io, commandId)`**: sign/submit, **still policy-gated by MetaMask** (Guard Mode, Blockaid, 2FA) |
| `network-manage` | `networkRegistry` (reserved) |

- `mnemonic-read` and `config-write` are reserved and rejected. The session, CLI token and SRP are never exposed to plugins.
- Plugins run **in-process and unsandboxed**. Lifecycle scripts (`postinstall`) never run, and packages that declare `oclif.hooks` or `oclif.plugins` are rejected.
- `PluginCommand` has a sealed lifecycle. You implement only `execute(io)`, plus optionally `afterExecute`, `successHint` and `analyticsOutcome`. Overriding `run`/`init`/etc. throws `PLUGIN_SEALED_OVERRIDE`.

### Quickstart: build a plugin
```bash
git clone https://github.com/MetaMask/agent-wallet-plugin-template my-plugin && cd my-plugin && npm install
# edit package.json "mm" block + src/commands/<topic>/<cmd>.ts
npm run build                                  # tsc && oclif manifest
mm config set experimentalPlugins true
mm config set experimentalAllowUnverifiedInstalls true   # needed for file:/git installs (dev only)
mm plugins install "file:$PWD" --accept-permissions      # or: mm plugins link /path/to/plugin
mm <topic> <cmd> ...
npm publish                                    # users: mm plugins install <pkg>
```
Required `package.json` pieces: the `"keywords": ["oclif-plugin"]` keyword, `"oclif": {"bin":"mm","commands":"./dist/commands","topicSeparator":" "}`, a shipped `oclif.manifest.json`, `@metamask/agent-wallet` as a **peerDependency** (`^6.2.0`, currently 7.0.0 on npm), and the `mm` manifest:
```json
"mm": {
  "schemaVersion": 1,
  "minCliVersion": "^6.2.0",
  "capabilities": [],
  "commands": [
    { "id": "kuru:quote", "capabilities": ["wallet-read"],  "dataAccess": ["balances","prices"], "targetChains": [143, 10143] },
    { "id": "kuru:order", "capabilities": ["wallet-read","wallet-submit"], "dataAccess": ["balances"], "targetChains": [143, 10143] }
  ]
}
```

### Example: read command (pattern from the official examples repo)
```ts
// src/commands/monad/balance.ts  -> `mm monad balance`
import { type CommandIO, PluginCommand } from "@metamask/agent-wallet/plugin";

export default class MonadBalance extends PluginCommand<{ address: string; mon: string }> {
  static override description = "Show MON balance of the active wallet on Monad";
  static override requiresAuth = true;
  protected readonly pluginCommandId = "monad:balance";

  async execute(_io: CommandIO) {
    const s = this.ctx.walletStateManager.read();
    const address = [...s.byokWallets, ...s.remoteWallets][0]?.address ?? "";
    const client = this.ctx.publicClient(143);           // host has no chain def attached — pass addresses explicitly
    const wei = await client.getBalance({ address: address as `0x${string}` });
    return { address, mon: (Number(wei) / 1e18).toString() };
  }
}
```

### Example: trading command that submits a Monad tx
The request shape below is taken from the published `@metamask/agent-sdk` 7.0.0 types (`EvmWalletRequest` / `EvmWalletExecutor`) and `@metamask/fox-sdk`'s `EVMTransaction`. It has not been run by us, so treat it as **(unverified)** and test locally.
```ts
// src/commands/kuru/order.ts  -> `mm kuru order --market 0x.. --side buy --size 10 --price 1.23`
import { CommandError, type CommandIO, InputFieldType, type InputSchema,
         PluginCommand, schemaToArgs, schemaToFlags } from "@metamask/agent-wallet/plugin";
import { encodeFunctionData } from "viem";
import { KURU_ORDERBOOK_ABI } from "../../abi.js";   // your ABI for the target Monad protocol

const inputs = {
  market: { type: InputFieldType.Text, flag: "market", message: "Market (orderbook) address", required: true, index: 0 },
  price:  { type: InputFieldType.Text, flag: "price",  message: "Limit price", required: true },
  size:   { type: InputFieldType.Text, flag: "size",   message: "Size", required: true },
} satisfies InputSchema;

export default class KuruOrder extends PluginCommand<{ hash: string; status: string }> {
  static override description = "Place a limit order on a Monad CLOB via Agent Wallet";
  static override flags = schemaToFlags(inputs);
  static override args = schemaToArgs(inputs);
  protected readonly pluginCommandId = "kuru:order";

  async execute(io: CommandIO) {
    const { market, price, size } = await io.resolveInputs(inputs);
    const data = encodeFunctionData({ abi: KURU_ORDERBOOK_ABI, functionName: "addBuyOrder", args: [/* price, size, postOnly */] });
    const exec = await this.ctx.walletExecutor(io, this.pluginCommandId);
    const res = await exec(
      { kind: "transaction", chainId: 143,
        transaction: { to: market, data, value: 0n },
        intent: { summary: `Kuru limit buy ${size} @ ${price}`, action: "swap" } },   // intent.action is an enum in the SDK
      { waitForReceipt: true },
    );
    if (res.kind !== "transaction") throw new CommandError("UNEXPECTED", "Expected tx result", "");
    return { hash: res.hash, status: res.status };
  }
  override successHint(d: { hash: string }) { return `Order submitted: https://monadvision.com/tx/${d.hash}`; }
}
```
Other request kinds: `{kind:"message", chainId, message}` and `{kind:"typed-data", chainId, typedData}`. Results have the shape `{kind:"transaction", hash, status, pendingJob?}` or `{kind:"signature", signature, …}`. In server-wallet mode a transaction can pause in `AWAITING_MFA` until the user approves. The CLI adapter prints that prompt.

### Bounty angle and winning ideas
Judges will likely weigh: **a genuinely new trading capability** (per the bounty text), **Monad-native protocols**, **correct capability scoping** (least privilege, `targetChains:[143]`), **working Guard-Mode flows** (the plugin respects allowlists and 2FA instead of bypassing them), agent-friendliness (`--json` output, clear `CommandError` codes and hints), and a published npm package plus demo video of an agent driving it.
1. **`mm kuru`**: limit orders, cancels and orderbook depth on Kuru (Monad CLOB, also a $5k sponsor) through `walletExecutor`. Lets the agent place maker orders, which the built-in `mm swap` cannot. Can stack with the Kuru bounties.
2. **`mm stream`**: per-second DCA or payroll via Sablier Flow on Monad (`0x95004df5abe86a246664d8f5fb2683f24df768d1`). The agent opens, tops up, pauses and withdraws streams, for example "stream 50 USDC/day into MON buys".
3. **`mm guard-sim`**: a read-only risk plugin. Before any trade it pulls the Zerion positions/PnL API and simulates with `publicClient(143).call`, refusing trades over the user's risk budget. It pairs with Guard Mode to demonstrate safety.
4. **`mm perpl` / `mm lend`**: wrap another Monad-native venue (e.g. Perpl perps, a lending market) that the built-in `mm perps` (Hyperliquid-only) doesn't cover.

### Gotchas
- Plugins are beta. Installing and running both fail with `PLUGIN_BETA_DISABLED` until `experimentalPlugins` is `true`. Local or git installs need `experimentalAllowUnverifiedInstalls`, otherwise you get `PLUGIN_UNVERIFIED_SOURCE`.
- The command id must equal `pluginCommandId` and the manifest `commands[].id`. The file path defines the command (`src/commands/hello/ping.ts` becomes `hello:ping`).
- Keep the plugin-wide `capabilities` array empty, because it merges into every command. Using a gated member without the capability throws `PERMISSION_DENIED`.
- `ctx.publicClient(chainId)` has **no chain definition attached**, so pass explicit contract addresses (see the ENS example).
- Different sign-in methods (Google vs email vs Mobile QR) create **different wallet addresses**.
- The x402 helper supports **only `exact` + EIP-3009** on EVM. Permit2/`upto` offers are unsupported. The Monad facilitator offers both, so use `exact` with USDC.
- Gasless relay covers **ERC-20 transfers/swaps only**, not native MON sends, and only where `relaySupported` is true.
- Monad-specific: the gas **limit** is charged, and delegated (7702) EOAs can't let MON drop below the 10 MON reserve. The relay uses 7702, so keep MON-outflow flows in mind.

---

## 2. MetaMask Smart Accounts Kit (formerly Delegation Toolkit): ERC-7710 / ERC-7715

### Overview
- `@metamask/smart-accounts-kit` (v2.0.0). Supports MetaMask Smart Accounts (Hybrid EOA+passkey, Multisig, Stateless 7702), **delegations (ERC-7710)** with caveat enforcers, and **Advanced Permissions (ERC-7715)**, where the MetaMask extension user grants a dapp or agent fine-grained permissions in one prompt.
- Permission types include `erc20-token-periodic`, `erc20-token-stream`, `native-token-periodic`, `native-token-stream`, and others.
- **Monad**: the Smart Accounts environment (v1.5 through v2.0) **and** Advanced Permissions are ✅ on Monad mainnet and testnet per the docs' supported-networks tables.
- **x402 + ERC-7710**: MetaMask runs a facilitator for Monad at `eip155:143` → `https://tx-sentinel-monad-mainnet.dev-api.cx.metamask.io/platform/v2/x402` (package `@metamask/x402`).

### Quickstart: request a periodic USDC permission for an agent (ERC-7715)
```bash
npm i @metamask/smart-accounts-kit viem
```
```ts
import { createWalletClient, custom, http, parseUnits, encodeFunctionData, erc20Abi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { monad } from "viem/chains";
import { erc7715ProviderActions, erc7710WalletActions } from "@metamask/smart-accounts-kit/actions";

const USDC = "0x754704Bc059F8C67012fEd69BC8A327a5aafb603";
const walletClient = createWalletClient({ transport: custom(window.ethereum) }).extend(erc7715ProviderActions());
const agent = privateKeyToAccount(process.env.AGENT_KEY as `0x${string}`);        // session account (agent)

const granted = await walletClient.requestExecutionPermissions([{
  chainId: monad.id,
  expiry: Math.floor(Date.now() / 1000) + 7 * 86400,
  to: agent.address,
  permission: {
    type: "erc20-token-periodic",
    data: { tokenAddress: USDC, periodAmount: parseUnits("10", 6), periodDuration: 86400,
            justification: "Agent may spend 10 USDC/day on your subscriptions" },
    isAdjustmentAllowed: true,
  },
}]);

// Agent redeems (EOA session account):
const agentClient = createWalletClient({ account: agent, chain: monad, transport: http() }).extend(erc7710WalletActions());
await agentClient.sendTransactionWithDelegation({
  to: USDC,
  data: encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [merchant, parseUnits("1", 6)] }),
  permissionContext: granted[0].context,
  delegationManager: granted[0].delegationManager,
});
```
The user needs **MetaMask extension ≥ 13.23.0**. A smart-account session account uses `bundlerClient.sendUserOperationWithDelegation({ publicClient, account, calls:[{to,data,permissionContext,delegationManager}], … })`. To sub-delegate to a narrower agent, use `sessionAccount.redelegatePermissionContext({ to, environment: getSmartAccountsEnvironment(chainId), permissionContext, caveats:[{type: CaveatType.Erc20TransferAmount, tokenAddress, maxAmount}] })`.

Smart account creation: `toMetaMaskSmartAccount({ client, implementation: Implementation.Hybrid, deployParams:[owner,[],[],[]], deploySalt:'0x', signer:{account} })`, then submit with viem's `createBundlerClient(...).sendUserOperation`. That needs a Monad bundler (Pimlico etc.; see account-abstraction-on-monad.md).

### Why this matters for the Agent Wallet bounty
ERC-7715 is the "human wallet → agent" permission rail, while the Agent Wallet plugin is the "agent's own wallet → new capability" rail. A strong combined submission is a plugin whose agent **also** redeems a user-granted periodic permission. One example: `mm allowance pull` spends from the user's MetaMask under a 7715 daily cap and executes a Monad trade. **(unverified that the plugin SDK exposes anything 7715-specific; you'd bundle smart-accounts-kit + viem inside the plugin and sign via walletExecutor typed-data or a separate session key)**.

---

## 3. Other MetaMask surfaces (brief)
- **MetaMask Connect** (formerly the SDK): dapp↔wallet connection across desktop, mobile and native, multichain (EVM + Solana). Docs: `llms-metamask-connect.txt`.
- **MetaMask Embedded Wallets** (ex-Web3Auth): social/passkey/email/SMS login with an MPC-SSS/TSS wallet. There is a Monad quickstart: https://docs.metamask.io/embedded-wallets/connect-blockchain/evm/monad.
- **Snaps**: extension plugins. They are not the target of this bounty.

## Sources
- https://docs.metamask.io/llms.txt · https://docs.metamask.io/llms-agent-wallet.txt
- https://docs.metamask.io/agent-wallet/plugins · …/plugins/build-a-plugin · …/plugins/install-a-plugin · …/reference/plugins
- https://docs.metamask.io/agent-wallet/reference/supported-chains · …/reference/architecture · …/reference/trading-modes · …/guides/pay-for-apis-x402 · …/reference/commands
- https://github.com/MetaMask/agent-wallet-plugin-template · https://github.com/MetaMask/agent-wallet-plugin-examples (ens, sample)
- npm: `@metamask/agent-wallet@7.0.0`, `@metamask/agent-sdk@7.0.0` (EvmWalletRequest types), `@metamask/fox-sdk@2.9.0` (EVMTransaction)
- https://docs.metamask.io/llms-smart-accounts-kit-full.txt (supported networks, request permissions, redeem, x402 facilitator URLs)
- https://metamask.io/news/introducing-advanced-permissions
- https://x.com/MetaMaskDev/status/2094856125376319745 · https://news.susanolabs.com/monad/en/opportunities
- https://docs.monad.xyz/tooling-and-infra/wallet-infra/smart-accounts
