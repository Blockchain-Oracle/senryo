# Pyth and other oracles on Monad

No Pyth bounty. This page is here because every finance build needs prices, and oracle choice matters to Perpl, Kuru, lending and CRE judges. Chainlink feed addresses are in `chainlink-cre.md`.

## Provider summary (Monad docs, tooling-and-infra/oracles)
| Provider | Model on Monad | Addresses |
|---|---|---|
| Chainlink | Push Price Feeds (+ SVR variants), pull Data Streams, CCIP | chainlink-cre.md; registry `monad-crypto/protocols/mainnet/chainlink.jsonc` |
| **Pyth** | Pull (Hermes → `updatePriceFeeds`) + ~60 **sponsored push feeds** updated against the same contract; Entropy VRF | PriceFeed `0x2880aB155794e7179c9eE2e38200202908C17B43`, Entropy `0xD458261E832415CFd3BAE5E416FdF3230ce6F134` (mainnet, registry) |
| RedStone | Push + pull | e.g. ETH/USD `0xc44be6D00307c3565FDf753e852Fc003036cBc13`, BTC/USD `0xED2B1ca5D7E246f615c2291De309643D41FeC97e`, MON/USD `0x1C9582E87eD6E99bc23EC0e6Eb52eE9d7C0D6bcd`, USDC/USD `0x7A9b672fc20b5C89D6774514052b3e0899E5E263` |
| Chronicle | Push; custom oracles | chronicle.jsonc |
| Stork | Push + pull | docs.stork.network/resources/contract-addresses/evm |
| Supra, eOracle, Band, Switchboard-like others | see registry | monad-crypto/protocols |

## Pyth quickstart
Products: **Core** (pull, 400ms, 500+ feeds; Hermes API **requires an API key since 2026-08-26**, get one at pythdata.app), **Pro/Lazer** (1ms–1s WS streaming, enterprise key, `@pythnetwork/pyth-lazer-sdk`; has an MCP server), **Entropy** (randomness).
```bash
npm install @pythnetwork/pyth-sdk-solidity @pythnetwork/hermes-client
```
```solidity
import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";
contract UsesPyth {
  IPyth constant pyth = IPyth(0x2880aB155794e7179c9eE2e38200202908C17B43); // Monad mainnet
  bytes32 constant MON_USD = 0x31491744e2dbf6df7fcf4ac0820d18a609b49076d45066d3568424e62f686cd1;
  function act(bytes[] calldata upd) external payable {
    uint fee = pyth.getUpdateFee(upd);
    pyth.updatePriceFeeds{value: fee}(upd);
    PythStructs.Price memory p = pyth.getPriceNoOlderThan(MON_USD, 10); // price * 10^expo, use p.conf
  }
}
```
```ts
import { HermesClient } from "@pythnetwork/hermes-client";
const hermes = new HermesClient("https://hermes.pyth.network", { accessToken: process.env.PYTH_API_KEY });
const u = await hermes.getLatestPriceUpdates(["0x31491744e2dbf6df7fcf4ac0820d18a609b49076d45066d3568424e62f686cd1"]);
const updateData = u.binary.data.map((d) => `0x${d}`); // pass to contract
```
Tests: `MockPyth.sol`; Hermes beta `https://hermes-beta.pyth.network`. Agent playbook: https://docs.pyth.network/SKILL.md.

### Monad Pyth feed IDs (sponsored push; from registry, canonical list at docs.pyth.network/price-feeds/core/push-feeds/evm)
Premium (1h heartbeat, 0.02% deviation): BTC `0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43`, ETH `0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace`, MON `0x31491744e2dbf6df7fcf4ac0820d18a609b49076d45066d3568424e62f686cd1`, SOL `0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d`.
Standard (1h, 0.05%): AUSD `0xd9912df360b5b7f21a122f15bdd5e27f62ce5e72bd316c291f7c86620e07fb2a`, USDC `0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a`, USDT `0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b`, HYPE `0x4279e31cc369bbcc2faf022b382b080e32a8e689ff20fbc530d2a603eb6cd98b`, XAU `0x765d2ba906dbc32ca17cc11f5310a89e9ee1f6420508c63861f2f8ba4ee34bb2`, XAG `0xf2fb02c32b055c805e7238d628e5e9dadef274376114eb1f012337cabe93871e`, sMON/MON RR `0x7fbf66b9b4e8b0e5723fc7001b00848c7d25225982ab33f6a5d111fdbf528001`, USDY `0xe393449f6aff8a4b6d3e1165a7c9ebec103685f3b41e60db4277b5b6d10e7326`, LINK `0x8ac0c70fff57e9aefdf5edf44b51d62c2d433653cbb2cf5cc06bb115af04d221` (… 60 total, see registry pyth.jsonc).
Push feeds can be read with `getPriceNoOlderThan` without paying an update if fresh; for sub-second freshness do a pull update in the same tx.
Monad testnet Pyth address: not captured (check docs.pyth.network/price-feeds/core/contract-addresses; unverified).

## Choosing (finance builds)
- **Perps / per-block funding / liquidations**: pull oracles (Pyth Core/Lazer or Chainlink Data Streams) so the price is updated in the same block as the action. This is how Perpl works (Chainlink Data Streams spot index + staleness guard).
- **Lending / collateral valuation**: Chainlink push (+ SVR to recapture liquidation MEV) or RedStone for LST/LRT exchange rates (shMON, aprMON, gMON, sMON, EarnAUSD rate feeds exist).
- **FX / cross-border payments**: Chainlink EUR/GBP/JPY/USD on Monad (4-min heartbeat), Pyth FX via Hermes.
- **Randomness**: Pyth Entropy (`0xD458…F134`).
- Monad blocks are ~0.4s: a 1h-heartbeat push feed can be many thousands of blocks stale inside its deviation band. Always check `updatedAt` / `publishTime` against your own tolerance.

## Gotchas
- Pyth price = `price * 10^expo`; check `conf`. Pay `getUpdateFee` in MON.
- Hermes needs an API key now; older code without `accessToken` fails.
- Chainlink Monad feeds come in 8-dec primary and 18-dec SVR/"shared" variants for the same pair. Don't mix decimals.
- Registry file comments say Pyth sponsored feeds are "sometimes branded Pyth Lazer / Bolt" (unverified branding).

## Sources
- https://docs.monad.xyz/tooling-and-infra/oracles.md
- https://github.com/monad-crypto/protocols/tree/main/mainnet (pyth.jsonc, chainlink.jsonc, redstone.jsonc, chronicle.jsonc, stork.jsonc)
- https://docs.pyth.network/llms.txt ; https://docs.pyth.network/SKILL.md
