# syntax=docker/dockerfile:1.7
# One image, two entrypoints (D-013): SERVICE=api|keeper selects the process. Build context = repo root:
#   docker build --platform linux/amd64 -f services/Dockerfile -t senryo-services .
# Built in GitHub Actions (.github/workflows/images.yml) and pulled by Coolify — nothing builds on the server (D-016).

FROM node:24-alpine AS build
WORKDIR /repo
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true
RUN corepack enable && corepack prepare pnpm@11.24.0 --activate
# The context is already trimmed by Dockerfile.dockerignore (sources of packages/ + services/, other members'
# manifests only). A filtered install downloads just the services' dependency graph — `pnpm fetch` would pull the
# whole lockfile (Expo/React Native included), which is what made the first amd64 build crawl.
COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir /pnpm/store \
      --filter "@senryo/api..." --filter "@senryo/keeper..."
RUN node services/common/scripts/bundle.mjs /out

# Debian slim (glibc), not Alpine: musl's getaddrinfo fails the whole lookup when a name's AAAA query answers SERVFAIL,
# which Docker's embedded DNS does for HyperSync's CNAME chain (143.hypersync.xyz → EAI_AGAIN, 3 Oct 2026) while the
# A records resolve. glibc returns the A records. The bundle is plain JS, so only the libc changes.
FROM node:24-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Fully bundled: no node_modules in the runtime image.
COPY --from=build --chown=node:node /out ./dist
USER node
EXPOSE 3000 3002
# Liveness only (/health) — never /ready, which depends on upstreams (deploy-runbook §7). Overrides Coolify's check.
HEALTHCHECK --interval=15s --timeout=4s --start-period=30s --retries=3 CMD ["node", "dist/health.mjs"]
CMD ["node", "--enable-source-maps", "dist/run.mjs"]
