# Senryo indexer (Envio HyperIndex 3.14, S4). Build context = indexer/ (.github/workflows/images.yml); Coolify runs
# it as a Docker Image app on the shared Postgres (deploy/indexer.env.example): tables in its own `envio` schema,
# Hasura off — the api reads them over SQL. Codegen runs at build time; config.yaml is re-read at start.
FROM node:24-slim

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

ENV ENVIO_TUI=false NODE_ENV=production ENVIO_HASURA=false ENVIO_PG_SCHEMA=envio \
  ENVIO_INDEXER_HOST=0.0.0.0 ENVIO_INDEXER_PORT=9898
EXPOSE 9898
# Liveness on the indexer's own observability server.
HEALTHCHECK --interval=15s --timeout=5s --start-period=120s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:9898/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
USER node
CMD ["node", "start.mjs"]
