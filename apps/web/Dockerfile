# senryo-web image (D-011, runbook §3/§6): Next static export behind nginx on the rpId host.
# Build context = repo root:  docker build -f apps/web/Dockerfile -t ghcr.io/blockchain-oracle/senryo-web:sha-<short> .
# `.well-known` is copied explicitly — static pipelines can silently drop dot-folders (Mera PR #313).

FROM node:24-alpine AS build
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@11.24.0 --activate
COPY . .
RUN pnpm install --frozen-lockfile --filter "@senryo/web..." \
 && pnpm --filter @senryo/web well-known --check \
 && pnpm --filter @senryo/web build

FROM nginx:stable-alpine
COPY apps/web/deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/out/ /usr/share/nginx/html/
COPY --from=build /repo/apps/web/public/.well-known/ /usr/share/nginx/html/.well-known/
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD wget -qO- http://127.0.0.1/healthz >/dev/null || exit 1
