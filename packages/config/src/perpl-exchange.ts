/**
 * Perpl's Exchange, traded directly onchain from the user's own wallet (D1, "path B" in
 * context/08-integrations/agora-ausd-and-perpl.md §2.6): AUSD `approve` → `createAccount` (first time) or
 * `depositCollateral` → IOC `execOrder` → `withdrawCollateral`. No API key; the account is `msg.sender`.
 *
 * Owner-adjustable values (minimums, max leverage, fees) are read live by `@senryo/chain` (`readPerplExchange`,
 * `readPerplMarketTerms`); the values here are either fixed by the contract or the app's own order policy.
 */
import { MAINNET_EXTERNAL } from "./markets.ts";
import { type ChainId, MAINNET_CHAIN_ID, TESTNET_CHAIN_ID } from "./networks.ts";

/** Exchange (UUPS proxy) per network — `getContractVersion()` 1.7.5 on mainnet (read 2 Oct 2026). */
export const PERPL_EXCHANGE: Readonly<Record<ChainId, `0x${string}`>> = {
  [MAINNET_CHAIN_ID]: MAINNET_EXTERNAL.perplExchange,
  [TESTNET_CHAIN_ID]: "0x1964C32f0bE608E7D29302AFF5E61268E72080cc",
};

/** Collateral per network (`getExchangeInfo().collateralToken`): AUSD, 6 decimals — Perpl's "CNS" units. */
export const PERPL_COLLATERAL: Readonly<Record<ChainId, `0x${string}`>> = {
  [MAINNET_CHAIN_ID]: MAINNET_EXTERNAL.ausd,
  [TESTNET_CHAIN_ID]: "0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC",
};
export const PERPL_COLLATERAL_DECIMALS = 6;

/**
 * First deposit (`createAccount(amountCNS)`) floor — `getMinAccountOpenCNS()`, reverts `InsufficentAmountToOpenAccount`
 * below it. Fallback only: read it live (owner-adjustable). 10 AUSD mainnet, 100 AUSD testnet (2 Oct 2026).
 */
export const PERPL_MIN_ACCOUNT_OPEN_CNS: Readonly<Record<ChainId, bigint>> = {
  [MAINNET_CHAIN_ID]: 10_000_000n,
  [TESTNET_CHAIN_ID]: 100_000_000n,
};
/** Later top-ups and withdrawals: `/v1/pub/context` `min_deposit_amount` 10 AUSD, `min_withdraw_amount` 0.01 AUSD. */
export const PERPL_MIN_DEPOSIT_CNS = 10_000_000n;
export const PERPL_MIN_WITHDRAW_CNS = 10_000n;

/**
 * `OrderDesc.orderType` onchain — 0-based (dex-sdk `types/request.rs` `impl From<u8> for RequestType`), one below the
 * REST/WS API's `t`. Close types are reduce-only.
 */
export const PERPL_ORDER_TYPE = {
  openLong: 0,
  openShort: 1,
  closeLong: 2,
  closeShort: 3,
  cancel: 4,
  increasePositionCollateral: 5,
  change: 6,
} as const;
export type PerplOrderType = (typeof PERPL_ORDER_TYPE)[keyof typeof PERPL_ORDER_TYPE];

/** `positionType` in `getPositionV2` and the position events (dex-sdk `state/position.rs`). */
export const PERPL_POSITION_TYPE = { long: 0, short: 1 } as const;

/** A "market" order is an IOC limit at mark ± this (bps). Perpl's own app allows up to `PERPL_MAX_SLIPPAGE_BPS`. */
export const PERPL_SLIPPAGE_BPS = 50n;
/** `/v1/pub/context` `order_max_market_slippage_bps` on every mainnet market (2 Oct 2026). */
export const PERPL_MAX_SLIPPAGE_BPS = 100n;

/**
 * `lastExecutionBlock` = head + this, or 0 (no deadline); the API's `order_ttl_blocks` is 20 on every market. A block
 * the transaction doesn't execute by reverts `ExceedsLastExecutionBlock` — at ~0.4 s blocks, head + 2…5 is already
 * past by the time an `eth_call` a second later lands (cast, 2 Oct 2026); head + 20 (~8 s) executes (perpl-check).
 */
export const PERPL_ORDER_TTL_BLOCKS = 20n;

/**
 * Extra collateral (bps of notional) a fill may draw to cover the position's negative PnL at the fill price —
 * `order_max_neg_pnl_collat_bps` 300 on every mainnet market (the dex-sdk default of 1000 is looser).
 */
export const PERPL_MAX_NEG_PNL_COLLAT_BPS = 300n;

/**
 * Resting orders one IOC may match. Each maker matched costs gas (mainnet simulation 2 Oct 2026: 1 maker ≈ 0.28–0.31M,
 * 2 ≈ 0.42–0.49M, 4–5 ≈ 0.99M), and Monad charges the limit — so the walk is bounded and `GAS_LIMITS.perplOrder`
 * covers this many. A bigger order that needs more makers comes back partially filled (decoded, never assumed).
 */
export const PERPL_ORDER_MAX_MATCHES = 8n;

/**
 * Order prices are 24-bit offsets from the market's `basePricePNS` (0 on every mainnet market): `execOrder` with
 * price 0 reverts `PriceOutOfRange(0, 1, 16777215)` on BTC, MON, ETH and PUMP (eth_call, 2 Oct 2026).
 */
export const PERPL_PRICE_PNS_MIN = 1n;
export const PERPL_PRICE_PNS_MAX = 16_777_215n;

/** `leverageHdths`: leverage in hundredths (500 = 5x). 0 means "the market's maximum" onchain — never sent. */
export const PERPL_LEVERAGE_DECIMALS = 2;
/** Fees are millionths of notional since contract 1.7.5 (`getTakerFee(1)` = 345 → 0.0345 %, dex-sdk `PPM_FEE_UNIT`). */
export const PERPL_FEE_DENOMINATOR = 1_000_000n;

/**
 * Price and lot decimals per market — fixed when a market is listed (`addContract`; no setter exists), so the session
 * policy can value an order from calldata alone. Mainnet, read from `getPerpetualInfo` 2 Oct 2026 (the check script
 * re-asserts every row against the chain).
 */
export const PERPL_MARKET_SCALES: Readonly<
  Record<number, Readonly<Record<number, { priceDecimals: number; lotDecimals: number }>>>
> = {
  [TESTNET_CHAIN_ID]: {
    16: { priceDecimals: 1, lotDecimals: 5 },
    32: { priceDecimals: 2, lotDecimals: 3 },
    48: { priceDecimals: 2, lotDecimals: 3 },
    64: { priceDecimals: 5, lotDecimals: 0 },
    256: { priceDecimals: 3, lotDecimals: 3 },
    272: { priceDecimals: 5, lotDecimals: 1 },
    320: { priceDecimals: 6, lotDecimals: 0 },
    336: { priceDecimals: 4, lotDecimals: 2 },
  },
  [MAINNET_CHAIN_ID]: {
    1: { priceDecimals: 1, lotDecimals: 5 },
    10: { priceDecimals: 6, lotDecimals: 0 },
    20: { priceDecimals: 2, lotDecimals: 3 },
    31: { priceDecimals: 3, lotDecimals: 3 },
    40: { priceDecimals: 4, lotDecimals: 2 },
    50: { priceDecimals: 2, lotDecimals: 4 },
    60: { priceDecimals: 5, lotDecimals: 1 },
    70: { priceDecimals: 4, lotDecimals: 2 },
    90: { priceDecimals: 6, lotDecimals: 0 },
    100: { priceDecimals: 4, lotDecimals: 2 },
  },
};

/** Agora's test AUSD faucet. Only chain 10143; native Practice never routes this collateral to MockAUSD. */
export const PERPL_TESTNET_FAUCET = "0xd236c18D274E54FAccC3dd9DDA4b27965a73ee6C" as const;
