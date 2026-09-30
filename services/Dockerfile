# syntax=docker/dockerfile:1.7
# One image, three entrypoints (D-013): SERVICE=api|card|keeper selects the process. Build context = repo root:
#   docker build --platform linux/amd64 -f services/Dockerfile -t senryo-services .
# Built in GitHub Actions (.github/workflows/images.yml) and pulled by Coolify — nothing builds on the server (D-016).

FROM node:24-alpine AS build
WORKDIR /repo
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true
RUN corepack enable && corepack prepare pnpm@11.24.0 --activate
# Lockfile first so the dependency layer caches across source changes.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
RUN pnpm fetch --frozen-lockfile
COPY . .
RUN pnpm install --frozen-lockfile --offline \
      --filter "@senryo/api..." --filter "@senryo/card..." --filter "@senryo/keeper..."
RUN node services/common/scripts/bundle.mjs /out

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Fully bundled: no node_modules in the runtime image.
COPY --from=build --chown=node:node /out ./dist
USER node
EXPOSE 3000 3001 3002
# Liveness only (/health) — never /ready, which depends on upstreams (deploy-runbook §7). Overrides Coolify's check.
HEALTHCHECK --interval=15s --timeout=4s --start-period=30s --retries=3 CMD ["node", "dist/health.mjs"]
CMD ["node", "--enable-source-maps", "dist/run.mjs"]
