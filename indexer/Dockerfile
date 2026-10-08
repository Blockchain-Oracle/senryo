# Senryo indexer (Envio HyperIndex 3.14, S4). Build context = indexer/ (.github/workflows/images.yml); Coolify runs
# it as a Docker Image app on the shared Postgres (deploy/indexer.env.example): tables in its own `envio` schema,
# Hasura off — the api reads them over SQL. Codegen runs at build time; config.yaml is re-read at start.
FROM node:24-slim

# The system CA store: Envio's native RPC client verifies TLS against it (node:slim ships none; Node's own fetch
# bundles its roots, so only the realtime RPC failed — "certificate verify failed", D-279).
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable && corepack prepare pnpm@11.24.0 --activate

WORKDIR /envio-indexer
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod=false

COPY config.yaml schema.graphql tsconfig.json envio-env.d.ts start.mjs ./
RUN pnpm envio codegen
COPY src ./src
# `envio start` re-runs codegen into .envio/, so the runtime user owns the work dir.
RUN chown -R node:node /envio-indexer

ENV ENVIO_TUI=false NODE_ENV=production ENVIO_HASURA=false ENVIO_PG_SCHEMA=envio ENVIO_PG_SSL_MODE=false \
  ENVIO_INDEXER_HOST=0.0.0.0 ENVIO_INDEXER_PORT=9898
# NODE_ENV=production drops Envio's dev fallbacks, so everything it reads is set: its own throttles (Envio's
# defaults), and the Hasura settings it parses even when Hasura is off — inert, nothing calls them.
ENV ENVIO_THROTTLE_CHAIN_METADATA_INTERVAL_MILLIS=500 ENVIO_THROTTLE_PRUNE_STALE_DATA_INTERVAL_MILLIS=30000 \
  HASURA_GRAPHQL_ENDPOINT=http://hasura.off/v1/metadata HASURA_GRAPHQL_ROLE=admin HASURA_GRAPHQL_ADMIN_SECRET=off
EXPOSE 9898
# Liveness on the indexer's own observability server.
HEALTHCHECK --interval=15s --timeout=5s --start-period=120s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:9898/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
USER node
CMD ["node", "start.mjs"]
