/**
 * Smoke check: run the app's documents through the client against an indexer and print what they return.
 *   node packages/indexer-client/scripts/smoke.ts <graphqlUrl> <chainId> <user>
 * e.g. node packages/indexer-client/scripts/smoke.ts http://localhost:8080/v1/graphql 10143 0xba0b…a061
 */
import {
  ActivityDocument,
  activityVars,
  CandlesDocument,
  candlesVars,
  createIndexerClient,
  EquityDocument,
  equityVars,
  FillsDocument,
  fillsVars,
  MetaDocument,
  OurMarketsDocument,
  PortfolioDocument,
  ProtocolStatsDocument,
  protocolStatsVars,
} from "../src/index.ts";

const [url = "http://localhost:8080/v1/graphql", chainArg = "10143", user = ""] = process.argv.slice(2);
const chainId = Number.parseInt(chainArg, 10);
const client = createIndexerClient({ url });
const account = { chainId, user };
const HOUR = 3_600;
const SAMPLE = 5;
const MS_PER_SECOND = 1_000;
const INDENT = 2;
const show = (label: string, value: unknown) =>
  console.log(
    label,
    JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? `${v}n` : v), INDENT),
  );

show("meta", await client.request(MetaDocument, {}));
if (user) {
  const portfolio = await client.request(PortfolioDocument, account);
  show("portfolio", portfolio);
  show("fills", await client.request(FillsDocument, fillsVars(account, { limit: SAMPLE })));
  show("activity", await client.request(ActivityDocument, activityVars(account, { limit: SAMPLE })));
  show("equity", await client.request(EquityDocument, equityVars(account, { limit: SAMPLE })));
}
show("markets", await client.request(OurMarketsDocument, { chainId }));
show("candles XAU 1h", await client.request(CandlesDocument, candlesVars(chainId, "XAU", HOUR, { limit: SAMPLE })));
const now = Math.floor(Date.now() / MS_PER_SECOND);
show("stats", await client.request(ProtocolStatsDocument, protocolStatsVars(chainId, now)));
