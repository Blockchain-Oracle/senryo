# Monad DeFi primitives worth composing with

These protocols are live on Monad mainnet (chain 143). Addresses come from the Monad Foundation registry `github.com/monad-crypto/protocols/mainnet/*.jsonc`, which is community-maintained, so check on an explorer before you use one. None of them run a bounty, but composing with them makes a finance demo look real.

## Canonical / infra
| | Address |
|---|---|
| WMON | `0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A` |
| USDC (native Circle) | `0x754704Bc059F8C67012fEd69BC8A327a5aafb603` |
| USDT0 | `0xe7cd86e13ac4309349f30b3435a9d337750fc82d` |
| AUSD | `0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a` |
| Multicall3 | `0xcA11bde05977b3631167028862bE2a173976CA11` |
| Permit2 | `0x000000000022d473030f116ddee9f6b43ac78ba3` |
| CreateX | `0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed` |
| EntryPoint v0.7 / v0.8 | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` / `0x4337084d9e255fF0702461CF8895cE9E3b5Ff108` |
| Simple7702Account | `0xe6Cae83BdE06E4c305530e199D7217f42808555B` |
| Staking precompile | `0x0000000000000000000000000000000000001000` |
| x402 ExactPermit2Proxy / UptoPermit2Proxy / BatchSettlement | `0x402085c248EeA27D92E8b30b2C58ed07f9E20001` / `0x4020A4f3b7b90ccA423B9fabCc0CE57C6C240002` / `0x4020074e9dF2ce1deE5A9C1b5c3f541D02a10003` |
| x402 ERC3009DepositCollector / Permit2DepositCollector | `0x4020806089470a89826cB9fB1f4059150b550004` / `0x4020425FAf3B746C082C2f942b4E5159887B0005` |
RPC `https://rpc.monad.xyz` (testnet `https://testnet-rpc.monad.xyz`, chain 10143). Blocks are about 0.4s, per Perpl's funding math.

## Order books (CLOB) — competitors/complements to Kuru & Perpl
| Protocol | Notes | Key addresses |
|---|---|---|
| Kuru | CLOB+AMM+aggregator (bounty) | see kuru.md |
| Perpl | perps CLOB (bounty) | Exchange `0x34B6552d57a35a1D042CcAe1951BD1C370112a6F` |
| Clober | onchain CLOB (BookManager, ERC-6909 books, rebalancer vaults) | BookManager `0x6657d192273731C3cAc646cc82D5F28D0CBE8CCC`, Controller `0x19b68a2b909D96c05B623050C276FBD457De8e83`, Router `0x7B58A24C5628881a141D630f101Db433D419B372` |
| Crystal | CLOB + launchpad | Crystal `0x508254c838B2e936B0631440c5C6E3AB3a4a98BD`, MON/USDC `0x39fAE95717cfD4bdA22317F1c124660A166b6BEc` |
| Hanji | CLOB | MON/USDC market `0x1aed222dda944a87703c918745b11be13f8eef10` |
| Dexalot | CLOB + RFQ, cross-chain (LayerZero) | Exchange `0xC725229Aefeab5fAec9cc1667d79D9478e564a0C`, MainnetRFQ `0xA0421a4DB5bb7577f9bb9B577b5F600a642368be` |
| Monday Trade | spot (v3-style) + perps | SwapRouter `0xFE951b693A2FE54BE5148614B109E316B567632F` |
| LeverUp | perps (up to 1001x, LP-free) | `0xea1b8E4aB7f14F7dCA68c5B214303B13078FC5ec` |

## AMMs / aggregators
- **Uniswap**: V2 Router02 `0x4b2ab38dbf28d31d467aa8993f6c2585981d6804`; V3 Factory `0x204faca1764b154221e35c0d20abb3c525710498`, SwapRouter02 `0xfe31f71c1b106eac32f1a19239c9a9a72ddfb900`, QuoterV2 `0x661e93cca42afacb172121ef892830ca3b70f08d`; **V4 PoolManager `0x188d586ddcf52439676ca21a244753fa19f9ea8e`**, V4Quoter `0xa222dd357a9076d1091ed6aa2e16c9742dd26891`, UniversalRouter `0x0d97dc33264bfc1c226207428a79b26757fb9dc3`. V4 hooks let you try dynamic-fee or oracle-priced pools.
- PancakeSwap (V2 router `0xB1Bc24c34e88f7D43D5923034E3a14B24DaACfF9`, V3 SwapRouter `0x1b81D678ffb9C0263b24A97847620C99d213eB14`), Balancer v3 (Vault `0xbA1333333333a1BA1108E8412f11850A5C319bA9`), Curve (StableSwapFactory `0x8271e06E5887FE5ba05234f5315c19f3Ec90E8aD`).
- **Mento**: an onchain FX stablecoin platform using Fixed-Price Market Makers fed by Chainlink relayers (Router `0x4861840C2EfB2b98312B0aE34d86fD73E8f9B6f6`, FPMMFactory `0xa849b475FE5a4B5C9C3280152c7a1945b907613b`). Useful for the cross-border FX leg.
- Aggregators: Kuru Flow, Monorail (`0xa68a7f0601effdc65c64d9c47ca1b18d96b4352c`), 0x, 1inch, KyberSwap, OKX, OpenOcean, LI.FI, Relay.

## Lending / credit
| Protocol | Key addresses |
|---|---|
| Aave V3 | Pool `0x69a5F9AD4f96ebf0a0C792dD42a01cC5C0102fef`, PoolAddressesProvider `0x34793Fb9935F7bB5E5aE920fb963F39063E7A615`, UiPoolDataProvider `0xa7D38785be3422c25677A8aa4a44D3a0853A3a17` |
| Morpho | Morpho `0xD5D960E8C380B724a48AC59E2DfF1b2CB4a1eAee`, AdaptiveCurveIrm `0x09475a3D6eA8c314c592b1a3799bDE044E2F400F`, Bundler3 `0x82b684483e844422FD339df0b67b3B111F02c66E`, MetaMorphoV1_1Factory `0x33f20973275B2F574488b18929cd7DCBf1AbF275`, ChainlinkOracleV2Factory `0xC8659Bcd5279DB664Be973aEFd752a5326653739` |
| Euler v2 | accountLens `0x960d481229f70c3c1cbcd3fa2d223f55db9f36ee` (+ many; euler.jsonc) |
| Neverland (Aave-v3 fork) | Pool proxy `0x80F00661b13CC5F6ccd3885bE7b4C9c67545D585` |
| Curvance | CentralRegistry `0x1310f352f1389969Ece6741671c4B919523912fF` |
| Folks Finance (cross-chain via Wormhole/CCIP) | spokeCommon `0xc7bc4A43384f84B8FC937Ab58173Edab23a4c3cD` |
| Gearbox (prime brokerage) | Address_Provider `0xF7f0a609BfAb9a0A98786951ef10e5FE26cC1E38` |
| Timeswap (oracleless, fixed-maturity) | PoolFactory `0xBf90d2d8E629cA48CF001F1CA6aDb47f120Fb91a` |
| Sumer (CDP/synthetics) | Comptroller `0x2d9b96648C784906253c7FA94817437EF59Cf226` |
Morpho's permissionless markets are the fastest way to prototype **undercollateralised / credit-scored lending** (the track example): create a market with a custom oracle/IRM, or gate borrowing through a wrapper that reads a credit-score contract fed by CRE and Nansen.

## Liquid staking / yield / MEV
- LSTs: **shMON** (Fastlane) `0x1B68626dCa36c7fE922fD2d55E4f631d962dE19c`, **gMON** (Magma) `0x8498312A6B3CbD158bf0c93AbdCF29E6e4F55081`, **sMON** (Kintsu) `0xA3227C5969757783154C60bF0bC1944180ed81B9`, aprMON (aPriori). Chainlink and Pyth publish exchange-rate feeds for several of them.
- Fastlane **Atlas** (app-level MEV capture / order-flow auctions) `0x2DA28fedc4643c787CB5c5e84fa6AaDb596875E8`. Relevant for fair onchain order books and liquidations.
- Pendle (yield tokenization): Router `0x888888888889758F76e7103c6CbF23ABbF58F946`. Beefy, Upshift, Mellow, Lagoon, Velvet vaults.

## Bridges / interop
Circle CCTP V2 (TokenMessengerV2 `0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d`), LayerZero (endpointV2 `0x6F475642a6e85809B1c36Fa62763669b1b48DD5B`), Wormhole, Axelar, Hyperlane, deBridge, Across, Relay, Mayan, NEAR Intents / Aurora (see aurora-intents.md), Chainlink CCIP.

## Composition patterns that fit the track examples
- **Fully onchain CLOB with no offchain matching**: build on the Kuru/Clober primitives, or a Uniswap V4 hook that runs a batch auction per block. Monad's 0.4s blocks make per-block auctions practical.
- **Perps with per-block funding**: a continuous funding index updated lazily on every interaction (Perpl's virtual accumulator pattern with a per-block rate), priced by a Pyth or Data Streams pull update in the same tx. A Perpl risk tool can simulate this against Perpl's hourly funding.
- **Credit-history lending**: onchain repayment history from Aave/Morpho/Euler events plus Nansen labels and PnL, a CRE-signed score, and a Morpho market or custom pool.

## Gotchas
- Registry addresses are community-maintained, so verify bytecode on an explorer (monvision.io / monadscan) first.
- Monad's high throughput means event volume is large. Use an indexer (Envio has a $1K bounty; Kuru and Perpl publish their own data feeds) instead of naive `eth_getLogs` over wide ranges.

## Sources
- https://github.com/monad-crypto/protocols/tree/main/mainnet (CANONICAL, uniswap, morpho, aave_v3, euler, clober, crystal, hanji, dexalot, mento, fastlane, magma, kintsu, pendle, circle_cctp, layerzero, leverup, monday_trade, curvance, neverland, timeswap, sumer_money, gearbox_protocol, folks_finance, near_intents)
- https://docs.monad.xyz/tooling-and-infra/oracles.md
