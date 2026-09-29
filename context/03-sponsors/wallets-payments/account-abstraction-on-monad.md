# Account Abstraction on Monad — ERC-4337, EIP-7702, paymasters, passkeys

## TL;DR
- Monad supports **ERC-4337** (EntryPoints v0.6, v0.7, v0.8 and v0.9 are all deployed at the canonical addresses) and **EIP-7702** (tx type `0x04`), with two Monad-specific rules for delegated EOAs.
- Bundlers and paymasters that are ✅ on **mainnet**: **Alchemy, Biconomy, Pimlico, Sequence, thirdweb, ZeroDev**. FastLane (shMonad bundler) shows ❓ on mainnet and ✅ on testnet. Gelato and Openfort are ✅ on testnet.
- Smart-account SDKs listed on Monad: **MetaMask Smart Accounts Kit** (4337 + 7702, ERC-7710), **Pimlico permissionless.js**, **ZeroDev Kernel** (session keys), **Biconomy Nexus**.
- Built-in gasless options that need no bundler setup: **Privy `sponsor:true`** (Monad listed) and the **MetaMask Agent Wallet** 7702 relay. **Dynamic native sponsorship does not include Monad**, so use its ZeroDev extension. The **Monad x402 facilitator** also pays gas for USDC payments.

## Canonical contracts (Monad mainnet, docs.monad.xyz network-information)
| Contract | Address |
|---|---|
| EntryPoint v0.6 | `0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789` |
| EntryPoint v0.7 | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` |
| EntryPoint v0.8 | `0x4337084d9e255fF0702461CF8895cE9E3b5Ff108` |
| EntryPoint v0.9 | `0x433709009B8330FDa32311DF1C2AFA402eD8D009` |
| Multicall3 | `0xcA11bde05977b3631167028862bE2a173976CA11` |
| Permit2 | `0x000000000022d473030f116ddee9f6b43ac78ba3` |
| Safe v1.3 / SafeL2 | `0x69f4D1788e39c87893C980c06EdF4b7f686e2938` / `0xfb1bffC9d739B8D520DaF37dF666da4C687191EA` |
| MultiSendCallOnly | `0xA1dabEF33b3B82c7814B6D82A79e50F4AC44102B` |
| WMON | `0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A` |
| x402 Exact/Upto Permit2 proxies | `0x402085c248EeA27D92E8b30b2C58ed07f9E20001` / `0x4020A4f3b7b90ccA423B9fabCc0CE57C6C240002` |

UserOp explorer: Jiffyscan (`?network=monad`).

## Providers (from docs.monad.xyz/tooling-and-infra/wallet-infra/account-abstraction)
| Provider | Mainnet | Testnet | Offers |
|---|---|---|---|
| Alchemy | ✅ | ✅ | Gas Manager (paymaster) + bundler; Account Kit embedded wallets (4337/7702/6900). Also a $1k-credit Metropolis bounty |
| Biconomy | ✅ | ✅ | MEE/Supertransactions, Nexus account, smart sessions, 7702 with embedded wallets (Privy/Turnkey) |
| Pimlico | ✅ | ✅ | Bundler + verifying/ERC-20 paymaster; permissionless.js |
| ZeroDev | ✅ | ✅ | Kernel accounts, session keys (ECDSA/passkey/multisig), meta-infra |
| Sequence | ✅ | ✅ | Transaction API relayer (gasless, batched, parallel) |
| thirdweb | ✅ | ✅ | Paymaster + bundler, sponsorship policies |
| FastLane | ❓ | ✅ | shMonad 4337 bundler + paymaster (example repo FastLane-Labs/4337-bundler-paymaster-script) |
| Gelato / Openfort | — | ✅ | Paymaster + bundler |

## Quickstart — Pimlico + permissionless.js, sponsored userOp on Monad
```bash
npm i permissionless viem
```
```ts
import { createPublicClient, http, encodeFunctionData, erc20Abi, parseUnits } from "viem";
import { monad } from "viem/chains";                          // monadTestnet for 10143
import { entryPoint07Address } from "viem/account-abstraction";
import { privateKeyToAccount } from "viem/accounts";
import { createSmartAccountClient } from "permissionless";
import { toSimpleSmartAccount } from "permissionless/accounts";
import { createPimlicoClient } from "permissionless/clients/pimlico";

const PIMLICO = `https://api.pimlico.io/v2/${monad.id}/rpc?apikey=${process.env.PIMLICO_KEY}`; // chain-id or slug form (verify in dashboard)
const publicClient = createPublicClient({ chain: monad, transport: http(process.env.MONAD_RPC) });
const pimlico = createPimlicoClient({ transport: http(PIMLICO), entryPoint: { address: entryPoint07Address, version: "0.7" } });

const account = await toSimpleSmartAccount({
  client: publicClient,
  owner: privateKeyToAccount(process.env.OWNER_KEY as `0x${string}`), // or Privy/Dynamic/Mera signer
  entryPoint: { address: entryPoint07Address, version: "0.7" },
});

const sac = createSmartAccountClient({
  account, chain: monad, bundlerTransport: http(PIMLICO),
  paymaster: pimlico,                                             // sponsor via Pimlico verifying paymaster (policy in dashboard)
  userOperation: { estimateFeesPerGas: async () => (await pimlico.getUserOperationGasPrice()).fast },
});

// Batched: approve + pay in one userOp
const USDC = "0x754704Bc059F8C67012fEd69BC8A327a5aafb603";
const hash = await sac.sendTransaction({
  calls: [
    { to: USDC, data: encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [SPENDER, parseUnits("10", 6)] }) },
    { to: SPENDER, data: "0x..." },
  ],
});
```
Pay gas in USDC instead: add `prepareUserOperation: prepareUserOperationForErc20Paymaster(pimlico)` from `permissionless/experimental/pimlico`, **if Pimlico's ERC-20 paymaster supports Monad USDC (unverified)**. The official Monad template `monad-developers/next-serwist-privy-smart-wallet` wires **Privy + Kernel + EntryPoint v0.7 + Pimlico** on testnet: `useSmartWallet()` → `smartAccountClient.sendTransaction({calls:[…]})`.

## EIP-7702 on Monad
```ts
import { createWalletClient, http } from "viem";
import { monadTestnet } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
const account = privateKeyToAccount("0x...");
const wc = createWalletClient({ account, chain: monadTestnet, transport: http() });
const authorization = await wc.signAuthorization({ account, contractAddress: "0xFBA3912Ca04dd458c843e2EE08967fC04f3579c2" }); // example impl from Monad docs
await wc.sendTransaction({ authorizationList: [authorization], data: "0xdeadbeef", to: wc.account.address });
```
**Monad-specific rules (important):**
1. **Delegated EOAs can't dip below 10 MON.** Any transaction that *decreases* a 7702-delegated account's MON balance *and* leaves it under 10 MON **reverts unconditionally**. This follows from Monad's reserve-balance rule for async execution. A delegated account holding less than 10 MON is fine as long as the tx doesn't reduce its MON balance (e.g. a gas-sponsored USDC transfer). To empty an account, **undelegate first** (delegate to `0x0`), then wait `k=3` blocks.
2. **Delegated code can't `CREATE`/`CREATE2`.** When code runs in the context of a delegated EOA, those opcodes revert the frame. Plain contract-creation txs *sent from* the EOA still work.
3. Calls to Monad precompiles on a delegated EOA revert as if the code began with an invalid opcode.

Which products use 7702 on Monad: Privy native sponsorship, the MetaMask Agent Wallet gasless relay, MetaMask Stateless7702 smart accounts, Biconomy Nexus 7702, and permissionless `toSimpleSmartAccount({eip7702:true})`.

## Passkeys (the Trust track's "Passkey-native accounts using P256 and WebAuthn")
- **Mera** (`@category-labs/mera`, by Category Labs/Monad) derives regular **BIP-44 EOAs from a passkey's WebAuthn PRF output**, so there is no seed phrase, no server, and no bundler. Two Monad Foundation bounties apply: **"Best Mera-Powered UX on Monad" ($2,500)** and **"Mera: One Passkey, Many Keys" ($2,500)**. It pairs with any AA stack in this file by acting as the EOA owner/signer of a smart account.
  ```ts
  import { createPasskeyWithPrfOutput, getPasskeyPrfOutput, createSecp256k1SigningSession } from "@category-labs/mera";
  import { toViemAccount } from "@category-labs/mera/viem";
  // prfOutput -> BIP-39 entropy -> m/44'/60'/0'/0/i -> session -> viem LocalAccount
  ```
  Desktop Chrome returns PRF only for passkeys saved in Google Password Manager; otherwise you get `PRF_UNAVAILABLE`.
- Onchain P256 alternatives: MetaMask Hybrid smart account (passkey signers), ZeroDev passkey validator, Coinbase Smart Wallet, and Privy/Dynamic/Turnkey passkey auth (auth only, key custody stays with the provider).

## Gotchas
- **Gas is charged on the gas *limit*.** 4337 userOps carry generous `verificationGasLimit`/`callGasLimit`/`preVerificationGas`, and on Monad you (or the paymaster) pay for all of it. Watch paymaster spend and keep estimates tight. Monad's wallet guide suggests about a 7.5% buffer over `eth_estimateGas` for normal txs.
- `eth_maxPriorityFeePerGas` returns a **hardcoded 2 gwei**. Use the bundler's `getUserOperationGasPrice`.
- There is **no global mempool**. Track your own nonces and receipts, and use `txpool_statusByHash` for node-level status.
- After receiving MON, wait **k=3 blocks** (~1.2 s) before spending it.
- `debug_trace*` returns no opcode-level struct logs, so simulate with call/prestate tracers.
- Pick an EntryPoint version your SDK and provider agree on. v0.7 is the safest default, and v0.8 is needed for some 7702 flows.

## Sources
- https://docs.monad.xyz/tooling-and-infra/wallet-infra/account-abstraction · …/smart-accounts · …/embedded-wallets
- https://docs.monad.xyz/developer-essentials/eip-7702 · https://docs.monad.xyz/developer-essentials/wallet-developers
- https://docs.monad.xyz/developer-essentials/network-information (canonical contracts)
- https://docs.monad.xyz/templates/next-serwist-privy-smart-wallet · https://docs.monad.xyz/guides/mera
- https://docs.pimlico.io/ · context7 `/pimlicolabs/permissionless.js` (toSimpleSmartAccount, createPimlicoClient, ERC-20 paymaster)
- https://docs.zerodev.app/ · https://docs.biconomy.io/ · https://www.alchemy.com/docs/wallets
