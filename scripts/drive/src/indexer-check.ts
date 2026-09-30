/**
 * S3.12 check: the api's indexer bridge and the keeper's candidate queries against a real (local) S4 indexer.
 *   indexer: docker compose -f indexer/docker-compose.yaml -f indexer/docker-compose.local.yaml --env-file <env> up
 *   api:     services/api with INDEXER_GRAPHQL_URL=<hasura>/v1/graphql against testnet
 *   INDEXER_GRAPHQL_URL=… API_URL=… ACCOUNT=0x… pnpm --filter @senryo/drive indexer-check
 */
import { accountRoute, createApiClient, statusRoute } from "@senryo/api-client";
import { TESTNET_CHAIN_ID } from "@senryo/config";
import { createIndexerClient, MetaDocument } from "@senryo/indexer-client";
import { requireSecret } from "@senryo/service-common";
import { OpenPositionUsersDocument, PlacedTriggersDocument } from "../../../services/keeper/src/indexer-documents.ts";

const SCAN_LIMIT = 50;
const url = requireSecret("INDEXER_GRAPHQL_URL");
const api = createApiClient({ origin: process.env.API_URL ?? "http://127.0.0.1:3620" });
const account = requireSecret("ACCOUNT") as `0x${string}`;
const chainId = TESTNET_CHAIN_ID;
const indexer = createIndexerClient({ url });

const meta = await indexer.request(MetaDocument, {});
const openUsers = await indexer.request(OpenPositionUsersDocument, { chainId, limit: SCAN_LIMIT });
const triggers = await indexer.request(PlacedTriggersDocument, { chainId, limit: SCAN_LIMIT });
const accountView = await api.call(accountRoute, { params: { address: account }, query: { chainId } });
const status = await api.call(statusRoute, {});
const history = accountView.history;
const checks = {
  indexerReady: meta.some((m) => m.chainId === chainId && m.isReady),
  keeperQueriesParse: Array.isArray(openUsers) && Array.isArray(triggers),
  apiHistoryPresent: history !== null,
  historyHasActivity: (history?.recent.length ?? 0) > 0,
  statusShowsIndexerLag: status.chains.some((c) => c.chainId === chainId && c.indexerLagBlocks !== null),
};
console.log(
  JSON.stringify(
    {
      pass: Object.values(checks).every(Boolean),
      checks,
      meta,
      keeper: { openPositionUsers: openUsers.length, placedTriggers: triggers.length },
      history: history && {
        indexedBlock: history.indexedBlock.toString(),
        stats: history.stats && {
          tradeCount: history.stats.tradeCount,
          liquidationCount: history.stats.liquidationCount,
          openPositions: history.stats.openPositions,
          deposited: history.stats.deposited.toString(),
          realizedPnl: history.stats.realizedPnl.toString(),
        },
        recentKinds: history.recent.map((r) => r.kind),
      },
      statusLag: status.chains.map((c) => ({ chainId: c.chainId, indexerLagBlocks: c.indexerLagBlocks })),
    },
    null,
    2,
  ),
);
process.exit(Object.values(checks).every(Boolean) ? 0 : 1);
