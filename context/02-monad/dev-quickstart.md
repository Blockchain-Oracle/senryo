# Monad Dev Quickstart (copy-paste)

Minimum versions: **Foundry ≥ 1.8.0**, **viem ≥ 2.40.0**, **Hardhat 3.1+** (Node ≥ 22.13) or Hardhat 2 (Node ≥ 20), and Solidity `evmVersion: "osaka"`.

## 0. Get testnet MON
- Faucet: https://faucet.monad.xyz (the app hub at https://testnet.monad.xyz also links to it)
- For mainnet MON, bridge in (see contracts-and-tokens.md) or buy on a DEX. Keep **>10 MON** in any wallet you script with, to stay clear of reserve-balance reverts.

## 1. Foundry (recommended)
```sh
curl -L https://foundry.paradigm.xyz | bash && foundryup
forge --version   # must be >= 1.8.0
forge init --template monad-developers/foundry-monad my-app && cd my-app
```
`foundry.toml`:
```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
network = "monad"              # Monad gas model, 128KB size limit, precompiles, MIP-8 page gas
# hardfork = "monad:MonadTen"  # default is latest; forks auto-detect
metadata = true
metadata_hash = "none"
use_literal_content = true
eth-rpc-url = "https://testnet-rpc.monad.xyz"   # mainnet: https://rpc.monad.xyz
chain_id = 10143                                # mainnet: 143

[rpc_endpoints]
monad = "https://rpc.monad.xyz"
monad_testnet = "https://testnet-rpc.monad.xyz"
```
Test, run a local node, fork:
```sh
forge test --network monad -vvv
anvil --network monad                                  # local Monad-EVM chain
anvil --fork-url https://testnet-rpc.monad.xyz         # auto-detects Monad hardfork
```
Deploy with a keystore:
```sh
cast wallet import monad-deployer --private-key $(cast wallet new | grep 'Private key:' | awk '{print $3}')
cast wallet address --account monad-deployer
forge create src/Counter.sol:Counter --account monad-deployer --broadcast
# script: forge script script/Deploy.s.sol --rpc-url monad_testnet --account monad-deployer --broadcast
```
Verify on **MonadVision** (Sourcify, no API key needed):
```sh
forge verify-contract <ADDR> <ContractName> --chain 10143 \
  --verifier sourcify --verifier-url https://sourcify-api-monad.blockvision.org/
```
Verify on **Monadscan** (Etherscan v2 API key):
```sh
forge verify-contract <ADDR> <ContractName> --chain 10143 \
  --verifier etherscan --etherscan-api-key $ETHERSCAN_API_KEY --watch
```
Use `--chain 143` for mainnet. You can also verify in the browser at https://monadvision.com/verify-contract.

CI:
```yaml
- uses: foundry-rs/foundry-toolchain@v1
  with: { version: v1.8.0 }
- run: forge test --network monad -vvv
```
Local full-node network (real consensus/staking timing, not just the EVM): https://github.com/monad-crypto/monad-solonet

## 2. Hardhat 3
```sh
git clone https://github.com/monad-developers/hardhat3-monad.git && cd hardhat3-monad
npm install && npx hardhat test
```
`hardhat.config.ts` (deploy and dual verification):
```ts
import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import { configVariable, defineConfig } from "hardhat/config";

export default defineConfig({
  plugins: [hardhatToolboxViemPlugin],
  solidity: { version: "0.8.31", settings: { evmVersion: "osaka", optimizer: { enabled: true, runs: 200 } } },
  networks: {
    hardhat: { type: "edr-simulated" },
    monadTestnet: { type: "http", url: "https://testnet-rpc.monad.xyz", accounts: [configVariable("PRIVATE_KEY")], chainId: 10143 },
    monadMainnet: { type: "http", url: "https://rpc.monad.xyz", accounts: [configVariable("PRIVATE_KEY")], chainId: 143 },
  },
  verify: {
    blockscout: { enabled: false },
    etherscan: { enabled: true, apiKey: configVariable("ETHERSCAN_API_KEY") },
    sourcify: { enabled: true, apiUrl: "https://sourcify-api-monad.blockvision.org" },
  },
  chainDescriptors: {
    10143: { name: "MonadTestnet", blockExplorers: { etherscan: { name: "Monadscan", url: "https://testnet.monadscan.com", apiUrl: "https://api.etherscan.io/v2/api" } } },
    143:   { name: "MonadMainnet", blockExplorers: { etherscan: { name: "Monadscan", url: "https://monadscan.com", apiUrl: "https://api.etherscan.io/v2/api" } } },
  },
});
```
```sh
npx hardhat ignition deploy ignition/modules/Counter.ts --network monadTestnet
npx hardhat verify <ADDR> --network monadTestnet   # may print a misleading error; check the explorer
```
Hardhat 2 template: `monad-developers/hardhat-monad`. It needs `metadata.bytecodeHash: "ipfs"` for Sourcify, plus Etherscan `customChains` with `apiURL: https://api.etherscan.io/v2/api?chainid=143`.

## 3. Remix
Use Injected Provider (MetaMask on Monad) and set the compiler EVM version to `osaka`. Guide: https://docs.monad.xyz/guides/deploy-smart-contract/remix

## 4. viem
```ts
import { createPublicClient, createWalletClient, http, webSocket, parseEther } from "viem";
import { monad, monadTestnet } from "viem/chains";           // viem >= 2.40.0
import { privateKeyToAccount } from "viem/accounts";

const publicClient = createPublicClient({ chain: monadTestnet, transport: http("https://testnet-rpc.monad.xyz") });
const wallet = createWalletClient({ account: privateKeyToAccount(process.env.PK as `0x${string}`), chain: monadTestnet, transport: http() });

// ALWAYS set gas explicitly when you know it: you pay the LIMIT
const hash = await wallet.sendTransaction({ to: "0x…", value: parseEther("0.01"), gas: 21_000n });
const receipt = await publicClient.waitForTransactionReceipt({ hash, pollingInterval: 250 });

// Settlement-grade read
const bal = await publicClient.getBalance({ address: "0x…", blockTag: "finalized" });
```
Fix the stale chain defaults (viem ships `blockTime: 400`, and the testnet explorer points to the old monadexplorer):
```ts
import { defineChain } from "viem";
export const monadTestnetFixed = defineChain({
  ...monadTestnet,
  blockTime: 300,
  blockExplorers: { default: { name: "MonadVision", url: "https://testnet.monadvision.com" } },
});
```
Multicall3 is at `0xcA11bde05977b3631167028862bE2a173976CA11` on both networks, and `publicClient.multicall` works out of the box. `Promise.all` of reads is sent as a JSON-RPC batch when `http(url, { batch: true })` is set; mind the provider batch limits (QuickNode 100).

Monad extras: `npm i @monad-crypto/viem`, then `publicClient.extend(monadActions())` gives `.staking.*` and `.wmon.*`.

## 5. wagmi
```ts
import { createConfig, http, webSocket } from "wagmi";
import { monad, monadTestnet } from "wagmi/chains";   // re-exported from viem

export const config = createConfig({
  chains: [monadTestnet, monad],
  transports: {
    [monadTestnet.id]: http("https://testnet-rpc.monad.xyz"),
    [monad.id]: http("https://rpc.monad.xyz"),       // prefer a paid RPC in prod (public = 25 rps)
  },
  pollingInterval: 300,
});
// useSendTransaction({ gas: 21_000n, ... }) and useWriteContract({ gas: <known>n, ... })
// useWaitForTransactionReceipt → the receipt arrives at Proposed; use blockTag 'finalized' reads for settlement
```
Starters: `monad-developers/scaffold-eth-monad` (plus foundry/hardhat editions), `monad-developers/monad-miniapp-template` (Farcaster), Next.js PWA templates with Privy/thirdweb/0x, React Native Privy/Pimlico templates, Reown AppKit guide, and `monad-developers/uniswap-v4-hooks-example`.

## 6. Nonce and throughput tips
- Track nonces locally when sending bursts, and submit concurrently with `Promise.all` using explicit `nonce: base + i`.
- Hardcode gas for fixed-cost calls. That skips an `eth_estimateGas` round trip and the wallet's high-limit fallback.

## Sources
- https://docs.monad.xyz/tooling-and-infra/toolkits/foundry.md
- https://docs.monad.xyz/tooling-and-infra/toolkits/hardhat.md
- https://docs.monad.xyz/guides/deploy-smart-contract/foundry.md
- https://docs.monad.xyz/guides/deploy-smart-contract/hardhat.md
- https://docs.monad.xyz/guides/verify-smart-contract/foundry.md
- https://docs.monad.xyz/guides/verify-smart-contract/hardhat.md
- https://docs.monad.xyz/developer-essentials/best-practices.md
- https://docs.monad.xyz/tooling-and-infra/toolkits/monad-solonet.md
- https://github.com/wevm/viem/tree/main/src/chains/definitions (monad.ts, monadTestnet.ts)
- https://github.com/monad-crypto/monad-ts
