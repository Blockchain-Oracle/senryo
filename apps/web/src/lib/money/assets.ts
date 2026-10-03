/**
 * The any-asset model (flow book B0.1, B1) lives in `@senryo/query` (`money-assets.ts`), shared with the phone; this
 * module keeps the web's import path. The hook that reads it is `use-money-assets.ts`.
 */
export {
  assetOf,
  bridgeAssetOf,
  byValue,
  collateralOf,
  isNativeAddress,
  MON_FEE_ALLOWANCE_WEI,
  MON_RESERVE_WEI,
  type MoneyAsset,
  matchesQuery,
  spendableOf,
  type TradingPart,
  tradingOnlyAsset,
  unitsOfValue,
  valueOfUnits,
} from "@senryo/query";
