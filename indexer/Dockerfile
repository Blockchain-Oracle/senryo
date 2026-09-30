# Senryo indexer (Envio HyperIndex V3). Build context = indexer/ (Coolify base dir /indexer), adapted from
# enviodev/local-docker-example. Codegen runs at build time; config.yaml is re-read at start, so ENVIO_* runtime env
# (start blocks, RPC mode, launch block) applies without a rebuild.
FROM node:24-slim

# psql restores the effect cache on first start (Envio self-hosting docs).
RUN apt-get update \
  && apt-get install -y --no-install-recommends postgresql-client \
  && rm -rf /var/lib/apt/lists/*

ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable && corepack prepare pnpm@11.24.0 --activate

WORKDIR /envio-indexer
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY config.yaml schema.graphql tsconfig.json envio-env.d.ts ./
COPY abis ./abis
RUN pnpm envio codegen
COPY src ./src

ENV ENVIO_TUI=false NODE_ENV=production ENVIO_INDEXER_HOST=0.0.0.0 ENVIO_INDEXER_PORT=9898
EXPOSE 9898
# Liveness on the indexer's own observability server (not Hasura's 8080).
HEALTHCHECK --interval=15s --timeout=5s --start-period=120s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:9898/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["pnpm", "envio", "start"]
