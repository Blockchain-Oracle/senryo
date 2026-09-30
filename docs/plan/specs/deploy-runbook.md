# Spec: Coolify deploy runbook

Plan §5, D-016. Every resource creation, deploy, env sync, DNS change and rollback is **[OK?]** at that moment. Source research: `context/09-product/deployment-coolify.md`; pattern: akashi `docs/plan/specs/deploy-runbook.md`.

## §1 Access (read-only first)
`ssh -f -N -L 8001:localhost:8000 agari-box` → `coolify context use/verify` → baseline `free -h`, `df -h`, `docker stats --no-stream` → record in `ids-and-txs.md`.

## §2 Domain + DNS
[OK?] buy domain (apex = rpId, frozen before first sign-up) · [OK?] A records `@`, `api`, `indexer`, `docs` (TTL 300, DNS-only) · verify `dig +short`.

## §3 Images
GitHub Actions `images.yml` matrix `api` (also runs card/keeper entrypoints), `web`, `docs`, `indexer` → `ghcr.io/blockchain-oracle/senryo-<app>:sha-<short>` (linux/amd64). Never `latest` in Coolify. [OK?] GHCR package visibility or `docker login` on the server.

## §4 Resources
| Resource | Type | Port | Domain | Limit |
|---|---|---|---|---|
| senryo-web | Docker Image (nginx) | 80 | `https://<d>` | 64m |
| senryo-docs | Docker Image (nginx) | 80 | `docs.<d>` | 64m |
| senryo-api | Docker Image (single container → rolling updates) | 3000 | `api.<d>` | 384m |
| senryo-card | Docker Image | 3001 | `api.<d>/v1/card/*` route | 192m |
| senryo-keeper | Docker Image (`SERVICE=keeper`) | 3002 internal | — | 256m (D-124: idles at ~154 MiB; 160m left no headroom) |
| senryo-ledger | Coolify Postgres 17 | 5432 internal | — | 256m |
| senryo-indexer | Compose (indexer + postgres + hasura) | hasura 8080 | `indexer.<d>` | 800 + 512 + 384m |
Total ≈ 2.9 GiB (keeper raised to 256m, D-124). Capacity decision in **S3**: after akashi's full deploy ≈ 1.15 GiB free → expect [OK?] a second small VPS (4–8 GB) added as a second Coolify server for the indexer compose + keeper. Never rely on swap for the card path.

## §5 Env
`deploy/<app>.env.example` = names only; real values in gitignored `deploy/.env.<app>` or `~/.config/senryo/`; apply with `coolify app env sync <uuid> --file …` (creates/updates, never deletes); secrets runtime-only (Build off), Literal where they contain `$`; `NEXT_PUBLIC_*`/`EXPO_PUBLIC_*` non-secret only; runtime change → Restart, build change → new image. Never echo values.

## §6 `.well-known` (rpId host)
Files in `apps/web/public/.well-known/`; Dockerfile copies them explicitly (static pipelines can drop dot-folders); nginx `location =` blocks with `default_type application/json`, `absolute_redirect off`, no `$uri/` in `try_files`, `/healthz`. After every web deploy: curl both (200, application/json, no redirect), Apple CDN (`app-site-association.cdn-apple.com`), Google Digital Asset Links API. assetlinks lists EAS, Play App Signing and debug SHA-256s.

## §7 Health
Image `HEALTHCHECK` (overrides dashboard); liveness only: api/card `/health`, keeper `/health` (fails if last tick older than `KEEPER_STALE_SEC`), nginx `/healthz`; Compose per-service healthchecks (indexer port verified in S4).

## §8 Deploy order (each [OK?])
web (S6) → ledger → indexer → api → card → keeper → docs. Deploy-verify: `docker inspect` healthy → smoke request (api `/v1/markets`, indexer `_meta`, web `.well-known`) → `acceptance.md` row.

## §9 Rollback
Docker Image apps: previous `sha-` tag + redeploy [OK?] (rolling keeps old container if new is unhealthy) · Compose: previous tag (brief GraphQL downtime → app shows stale, not failed) · ledger: `pg_dump` before any migration · contracts: pause → redeploy → addresses JSON → indexer start block → migration notice (F46), each [OK?].

## §10 Monitoring
Daily: `free -h` + `docker stats`, keeper/sponsor/operator balances vs floors, ASA latency log, indexer head lag; keeper ops alerts (D-035).

## §11 Never
Delete volumes / tick "delete volumes" / `docker volume prune` · publish host `ports:` · custom `container_name` · Auto Deploy · `latest` tags · touch akashi resources.

## §12 Freeze
After 13 Oct 12:00Z: fix-only deploys, each [OK?], through judging.
