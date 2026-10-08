# Native prediction oracle access

Checked 8 October 2026. [Pyth's current upgrade guide](https://docs.pyth.network/price-feeds/core/upgrade/preparing) requires an API key for Hermes. [Benchmarks](https://docs.pyth.network/price-feeds/core/use-historical-price-data) uses the same bearer authentication. Unauthenticated live and historical BTC/ETH requests returned 401 during the feasibility check.

Use an existing Pyth account or register at [Pyth Terminal](https://pythdata.app). The guide describes a free trial and paid ongoing plans; account/plan selection remains with the owner. Confirm access to signed live updates and historical boundary updates for both assets.

Keep `PYTH_API_KEY` in ignored server/keeper configuration. Do not put it in chat, source, a URL, or `EXPO_PUBLIC_*`. Native clients should consume Senryo's public price/proof service without receiving the provider credential.

Candidate Hermes origin: `https://pyth.dourolabs.app/hermes`. Send `Authorization: Bearer <server-held key>`. Obtain current and historical signed payloads, measure update fees, and simulate the unique-boundary parser on the [correct Monad receiver generation](https://docs.pyth.network/price-feeds/core/upgrade/contracts) before enabling settlement. Successful authentication alone does not prove that lifecycle.

Contracts, liquidity, native operations and deployed acceptance remain separately required; see [feasibility and implementation gates](../design/reviews/2026-10-08-native-prediction-feasibility.md).
