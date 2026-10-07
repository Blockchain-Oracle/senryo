import { createReadClient, readPerplExchange, readPerplMarketTerms } from "@senryo/chain";
import { PERPL_MARKETS, TESTNET_CHAIN_ID } from "@senryo/config";

const read = createReadClient(TESTNET_CHAIN_ID);
console.log("exchange", await readPerplExchange(read, TESTNET_CHAIN_ID));
for (const [symbol, id] of Object.entries(PERPL_MARKETS[TESTNET_CHAIN_ID] ?? {})) {
  const t = await readPerplMarketTerms(read, TESTNET_CHAIN_ID, id);
  console.log(
    JSON.stringify({
      symbol,
      id,
      priceDecimals: t.priceDecimals,
      lotDecimals: t.lotDecimals,
      paused: t.paused,
      mark: t.markPNS.toString(),
    }),
  );
}
