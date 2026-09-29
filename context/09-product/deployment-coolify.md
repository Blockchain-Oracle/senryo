# Deploying the server side on the user's Coolify

> Researched 2026-09-29. **Read-only:** nothing was changed on the server. The only commands run there were `nproc`, `free -h`, `df -h`, `docker stats --no-stream`, `docker inspect` and `docker ps`, all over `ssh agari-box`, plus `coolify context list` locally.
> Sources:
> - Coolify docs (https://coolify.io/docs, pages fetched 2026-09-29; Context7 `/coollabsio/coolify-docs`)
> - the `coolify` skill (CLI + REST API)
> - the akashi plan: `/Users/abu/dev/hackathon/portnetwork/akashi/docs/plan/00-plan.md` §2 "Hosting" and `docs/plan/specs/deploy-runbook.md` §5
> - Envio docs (`self-hosting.md`, `performance.md`, `environment-variables.md`) and `references/envio-local-docker-example/`
> - `../08-integrations/{envio,mera,agora-ausd-and-perpl,platforms-and-stores}.md`
>
> **Markers:** **[OK?]** = changes the server, DNS, GitHub or spends money; get the user's explicit OK at that moment. **(unverified)** = not confirmed in the docs or in a live check.

## 0. TL;DR

- **Server.** The user's Coolify **4.3.23** runs on Contabo x86_64: 4 vCPU, 7.8 GiB RAM, Traefik **v3.6** with Let's Encrypt.
  - Live on 2026-09-29: **4.0 GiB available, swap 8 GiB (1.8 GiB used), disk 39 GB free (74 % used).** This differs from akashi's earlier note ("2.7 GiB available, no swap").
  - Existing containers use about **3.3 GiB**. Akashi is **not deployed yet** (its STATUS is at S0.4), but its plan reserves about **2.85 GiB** of hard limits.
- **Fit.** Our stack (API + Expo web + self-hosted Envio) needs about **1.9–2.4 GiB** of limits. **It fits today on its own, but not alongside a fully deployed akashi without relying on swap.** §2 has the fallbacks. The cheapest fallback is to put the **Envio indexer on Envio Cloud (our contracts only)** or on a second small VPS.
- **Deploy pattern: copy akashi.**
  - Build images in **GitHub Actions → GHCR**, deployed as Coolify **Docker Image** apps (no builds on the tight server).
  - Envio runs as a **Docker Compose** app from git (deploy key, base dir `/indexer`).
  - The API runs as a Docker Image (or Dockerfile) app.
  - Auto Deploy is off; deploy with `coolify deploy uuid`.
- **Passkey files.** Traefik cannot serve files, so the **container on the rpId host** must serve `/.well-known/*` with `200`, `Content-Type: application/json` and no `Location` header. For nginx that means `default_type application/json` on the extensionless AASA file. In Next.js, use a route handler.

---

## 1. How Coolify works for this stack

### 1.1 Resource types (Build Packs)

Coolify's docs say "every application container starts from a Docker image". The **Build Pack** decides how that image is made ([builds overview](https://coolify.io/docs/applications/builds/overview)).

| Build Pack | What it does | Use for us |
|---|---|---|
| **Nixpacks / Railpack (Beta)** | Auto-detects the language and builds one image. Configure with `nixpacks.toml` / `railpack.json`. Has an "Is it a static site?" option with a Publish Directory ([static](https://coolify.io/docs/applications/builds/static)) | Not recommended: it builds on the server, which is short of RAM |
| **Static** | Packages files **already committed** to the repo into an Nginx image. Runs no build command. You can generate and edit a custom Nginx config under Configuration > General; it is baked in at build time ([static](https://coolify.io/docs/applications/builds/static)) | Only if we commit the Expo export (no) |
| **Dockerfile** | Builds one image from Base Directory + Dockerfile Location. Set **Ports Exposes**. The process must listen on `0.0.0.0` ([dockerfile](https://coolify.io/docs/applications/builds/dockerfile)) | Possible for the API, but it builds on the server |
| **Docker Compose** | Uses a compose file from git (Base Directory + Docker Compose Location, "combined when locating the file"), or pasted in as "Docker Compose Empty" (a Service with no git) ([docker-compose](https://coolify.io/docs/applications/builds/docker-compose)) | **Envio stack** (postgres + hasura + indexer) |
| **Docker Image** | Pulls `image:tag` or a digest; no git, no build. Set Ports Exposes (default 80). Private registries need `docker login` on the server ([docker-image](https://coolify.io/docs/applications/deployments/docker-image)) | **API, web, docs** (built in GH Actions) |

**Databases** are standalone resources: PostgreSQL, MySQL, MariaDB, MongoDB, Redis, KeyDB, Dragonfly and ClickHouse. Apps on the same destination network use the DB's **Internal URL**, which contains the credentials, the container name and the port ([how databases work](https://coolify.io/docs/databases/how-databases-work)). Backups need S3-compatible storage (skill). A database is not reachable by domain; it gets a public port only if you enable one.

### 1.2 Environment variables and secrets

Source: [environment variables](https://coolify.io/docs/applications/configuration/environment-variables).

- **Scope.** Each variable has **Build Variable** and **Runtime Variable** toggles; both are on by default. **Turn Build off for every secret** (sponsor key, webhook secret, Perpl key, Hasura admin secret). Docker build args can leak into image metadata; "Use Docker Build Secrets" needs BuildKit.
- **Multiline** is for PEM keys. **Literal** keeps `$` characters unexpanded.
- **Developer view** (`.env` paste) creates, updates **and removes** entries to match what you paste. `coolify app env sync <uuid> --file <gitignored>` only creates and updates; it never deletes (skill). Prefer the CLI sync, as akashi does.
- **Shared variables:** `{{environment.KEY}}` / `{{project.KEY}}` / `{{team.KEY}}`.
- **Predefined variables:** `COOLIFY_FQDN`, `COOLIFY_URL`, `COOLIFY_RESOURCE_UUID`, `COOLIFY_CONTAINER_NAME`, `SOURCE_COMMIT` (excluded from builds by default), `PORT`, `HOST=0.0.0.0`.
- **Compose variables** ([docker-compose](https://coolify.io/docs/applications/builds/docker-compose)):
  - `${VAR}` creates an editable empty variable.
  - `${VAR:-default}` sets an initial value.
  - **`${VAR:?}` marks it required: Coolify blocks the deploy while it is empty.**
  - Magic variables generate values: `SERVICE_PASSWORD_64_<ID>`, `SERVICE_USER_<ID>`, `SERVICE_URL_<ID>_<port>` and others. The generated values persist between deploys.
- **When changes apply.** Changing a runtime variable needs a **Restart**; changing a build variable needs a **Redeploy**.

### 1.3 Domains, HTTPS, proxy

Sources: [domains](https://coolify.io/docs/core/networking/domains), [Traefik overview](https://coolify.io/docs/core/networking/proxy/traefik/overview), [networking](https://coolify.io/docs/core/networking-in-coolify).

- **Setting a domain.** Enter the full URL in **Domains**. `https://` makes Traefik obtain a Let's Encrypt certificate (resolver `letsencrypt`, **HTTP challenge**). DNS must point at the server and ports 80 and 443 must be open. Redeploy after changing a domain.
- **Target port.** `https://api.example.com:3000` means "route to container port 3000". It does **not** publish a host port. With no port, the target is **port 80**.
- **Compose apps** get one "Domains for `<service>`" field per non-database service.
- **Paths.** `https://example.com/api` is a path route. The prefix is **stripped by default**; to keep it, turn off "Strip Prefixes".
- **www redirects.** The "Direction" setting (Allow / Redirect to www / Redirect to non-www) exists for non-Compose apps. **Keep it on "Allow" for the rpId host** (§3).
- **Noindex.** A per-domain `X-Robots-Tag` toggle.
- **Traefik config files.**
  - Main config: `/data/coolify/proxy/docker-compose.yml`. Changes need a proxy restart.
  - Dynamic files: `/data/coolify/proxy/dynamic/`. They are watched and apply without a restart. Edit them in the UI under Servers > Proxy > Dynamic Configurations ([dynamic config](https://coolify.io/docs/core/networking/proxy/traefik/dynamic-config)).
- **Middlewares** such as rate limits and headers: define them in a dynamic file and reference them as `name@file`. For Compose services, add the label `coolify.traefik.middlewares=<name>`. For standard apps, disable "Readonly labels" and append to the router label ([custom middlewares](https://coolify.io/docs/core/networking/proxy/traefik/custom-middlewares)).
- **Host ports.** Do **not** publish `ports:`. The docs say it "bypasses domain-based proxy routing and can expose an internal service", and on apps it also disables rolling updates.

### 1.4 Networking between resources

- **Standalone apps and DBs** join the shared `coolify` network.
- **Compose apps** get a **private per-resource network**. Their services talk to each other **by service name** (`envio-postgres:5432`).
- **Reaching other resources from a Compose app.** To reach the API or a standalone DB, or to be reached by them, enable **Connect To Predefined Network**. The docs warn that "service DNS names can change after joining it", so they may become `<service>-<uuid>` ([compose networking](https://coolify.io/docs/applications/builds/docker-compose), [service networking](https://coolify.io/docs/services/configuration/networking)).
- **Akashi's fallback** applies here too: call the other resource through its public HTTPS domain instead.

### 1.5 Health checks

Source: [health checks](https://coolify.io/docs/applications/configuration/health-checks).

- **Where to define them.** For Dockerfile / Docker Image / Static apps: under Configuration > Healthcheck (HTTP or CMD), or with a Dockerfile `HEALTHCHECK`. **If the image has a `HEALTHCHECK`, it wins over the dashboard.**
- **HTTP checks run inside the container.** The final image must contain `curl` or `wget`. Only the exit code counts; the "Return Code" and "Response Text" fields are not compared.
- **Compose apps don't use the Healthcheck page.** Define `healthcheck:` per service; `exclude_from_hc: true` exempts one-shot services.
- **Traefik drops unhealthy containers** from routing, which gives a 404 or "No available server". Akashi's lesson: point the container health check at a liveness `/health`, not a readiness `/ready` that depends on upstreams.

### 1.6 Deploy triggers and rolling updates

- **Git sources:**
  - public repo;
  - **Private Repository (with Deploy Key)**, a read-only SSH key per repo, which akashi uses ([deploy key](https://coolify.io/docs/applications/sources/github/deploy-key));
  - a GitHub App.
- **Automatic deploys** ([automatic deployments](https://coolify.io/docs/applications/deployments/automatic-deployments), [manual webhooks](https://coolify.io/docs/applications/deployments/manual-webhooks)):
  - A GitHub App delivers push events directly; enable Auto Deploy.
  - With a deploy key: add a **manual GitHub webhook** (URL and secret from Configuration > Webhooks) and enable Auto Deploy.
  - **Watch Paths** (e.g. `indexer/**`) filter "Git provider webhook events that include changed-file information". Whether this works for a manual webhook is **(unverified)**; akashi assumed it doesn't.
- **CI → GHCR → Coolify** ([GitHub Actions](https://coolify.io/docs/applications/sources/github/actions)):
  1. Actions builds and pushes the image.
  2. It then calls the app's **"Deploy Webhook (auth required)"** with `Authorization: Bearer <API token>`. This needs **API Access enabled** in Settings > Advanced and a token with deploy permission.
  3. Private GHCR images need `docker login ghcr.io` **on the server**; otherwise make the packages public.
  4. Alternatively, `POST /api/v1/deploy {"uuid":…}` (skill), or `coolify deploy uuid <uuid>` from the Mac, as akashi does.
- **Tags vs digests.** Prefer a `sha-…` tag or a digest; `latest` is mutable, and a Restart re-pulls it.
- **Rolling updates** ([rolling updates](https://coolify.io/docs/applications/deployments/rolling-updates)):
  - They work for Nixpacks / Railpack / Static / Dockerfile / Docker Image apps.
  - They **do not work for Compose**, nor with host port mappings, a custom container name, or a custom IP (those fall back to stop-then-start).
  - With a health check, Coolify keeps the old container if the new one is unhealthy.
  - **This matters for the card-authorization webhook: run the API as a single-container app, not inside a Compose file.**
- **Deploy commands.** A pre-deploy command runs in the old container and is skipped on the first deploy. A post-deploy command runs in the new container; if it fails, the deploy still counts as successful. Use pre-deploy for idempotent migrations ([dockerfile](https://coolify.io/docs/applications/builds/dockerfile)).

### 1.7 Logs and metrics

- **Coolify's own views:**
  - Deployment logs: each deployment in the Deployments tab, or `coolify app deployments logs <deployment-uuid>`.
  - Container logs: the Logs tab, or `coolify app logs <uuid>`, which can follow, limit lines, filter by service and show timestamps (Context7, CLI reference).
- **Metrics** come from the Sentinel agent. They cover **non-Compose app containers and standalone DBs only**, so Compose containers such as Envio are not charted ([metrics](https://coolify.io/docs/core/observability/monitoring/metrics)). Use `ssh agari-box docker stats --no-stream` for those.
- **Log drains:** Axiom, New Relic or custom Fluent Bit, turned on per resource. Deployment/build logs are not forwarded ([log drains](https://coolify.io/docs/core/observability/log-drains/overview)).

### 1.8 Resource limits

- **Apps.** Configuration > Resource Limits: Number of CPUs, CPU sets, CPU weight, **Soft Memory Limit** (reservation), **Maximum Memory Limit** (hard), swappiness and max swap. `0` means unlimited. After changing them, restart or redeploy ([resource limits](https://coolify.io/docs/applications/configuration/resource-limits)). Databases have the same page.
- **Compose apps.** Put the limits in the compose file: `mem_limit`, `cpus`, `mem_reservation`. Coolify's own install docs use these attributes (Context7, `start-with-self-hosted.mdx`), and akashi's runbook §5.4 does too. The Envio example uses `deploy.resources.limits`, which Compose v2 also honours outside Swarm.

### 1.9 Monorepo conventions

- **One repo, many resources.** Each resource points at the same repo with its own **Base Directory** plus **Dockerfile Location** or **Docker Compose Location**. Coolify joins the two paths.
- **Build context.** For a Dockerfile, Base Directory **is** the build context. For a monorepo whose Dockerfile needs shared `packages/`, set Base Directory `/` and Dockerfile Location `/apps/api/Dockerfile`, as akashi's resource table does.
- **Compose limits.** Compose paths are relative to Base Directory. Bind-mounted files from the repo need **Preserve Repository During Deployment** ON.
- **No builds on the server.** Build servers exist (images are pushed to a registry), but a build server cannot run resources ([build servers](https://coolify.io/docs/core/infrastructure/servers/build-servers)). GitHub Actions is the free equivalent for us.

---

## 2. Server capacity

### 2.1 What is on the box (live, 2026-09-29)

| | Value |
|---|---|
| CPU / arch | 4 vCPU, x86_64 |
| RAM | 7.8 GiB total, 3.8 used, **4.0 GiB available** |
| Swap | **8.0 GiB, 1.8 GiB in use** (akashi's plan says "no swap"; it has changed since) |
| Disk | 145 GB, **39 GB free** (74 %) |
| Coolify / proxy | `coollabsio/coolify:4.3.23`, `traefik:v3.6` |
| Running containers | ~30. Largest: 559, 531, 289, 253, 240 and 223 MiB. Five other Postgres instances (16/17). Sum ≈ **3.3 GiB** |
| akashi | **Not deployed** (STATUS: S0.4 waiting for OK). Planned hard limits: app-redis 160m + ts-introspect 256m + api 768m + worker 384m + pocket (3 × 256m) + web 320m + docs 192m ≈ **2.85 GiB** |

### 2.2 Envio's resource guidance

- **Envio gives no numbers.** [Self-hosting](https://docs.envio.dev/docs/HyperIndex/self-hosting.md) asks for "sufficient storage for blockchain data and the indexer database" and "adequate CPU and memory resources (requirements vary based on chains and indexing complexity)". It says to set "resource limits based on your workload requirements", calls itself "a starting point … not a full production level solution", and recommends Envio Cloud for most production use.
- **The official example compose** (`references/envio-local-docker-example/docker-compose.yaml`) caps **only the indexer**, at `cpus: "0.8"`, `memory: 800M`. Postgres 17.5 and Hasura v2.43 are uncapped.
- **Load.** Perpl produces ~300–500k events/day, but we filter to our users inside handlers (`../08-integrations/envio.md` §0.4), so few rows are written. HyperSync does the heavy lifting remotely. CPU and disk needs should be modest **(unverified until measured)**.
- **Envio Cloud's Development plan** has a 5 GB storage soft limit, which hints at the expected scale.

### 2.3 Our budget (hard limits)

| Resource | Limit | Basis |
|---|---|---|
| envio-indexer | 800m, 0.8 CPU | official example |
| envio-postgres | 512m | Postgres default `shared_buffers` is 128 MB; headroom **(unverified; measure)** |
| hasura (graphql-engine) | 384m | **(unverified; measure)** |
| api (Node) | 384m | akashi-style estimate |
| ledger DB | 256m standalone Postgres, **or 0** with SQLite on a volume | – |
| web (Expo export in nginx) | 64m | static files |
| docs (optional, static) | 64m | – |
| **Total** | **≈ 2.4 GiB** (≈ 2.2 GiB without the ledger Postgres) | |

### 2.4 Verdict and fallbacks

- **Our stack alone:** 2.4 GiB against 4.0 GiB available. **It fits**, with ~1.6 GiB of headroom.
- **Our stack plus akashi at its full limits:** 2.4 + 2.85 = 5.25 GiB against 4.0 GiB. **It does not fit in RAM.** It would lean on the 8 GiB swap, which is slow and risky for the card-auth latency.
  - Limits are ceilings, not usage, and real use is usually lower, so this may still run **(unverified)**.
  - Measure with `docker stats` after each deploy and decide then.
- **Fallbacks, cheapest first:**
  1. **Build nothing on the server.** Build every image in GitHub Actions and push to GHCR. Next/Expo builds can take 1–2 GB of RAM **(unverified)**.
  2. **Move the Envio indexer to Envio Cloud (Development, free) for our own low-volume contracts** (vault, card holds, our engine). Get Perpl history from HyperSync scripts instead of the self-hosted indexer (`envio.md` §9 route 2). This frees ~1.7 GiB. Cloud has no `_aggregate`, uses a per-deployment URL, and re-indexes on every push. The Dev plan lasts at most 30 days, which covers the deadline of 13 Oct 2026.
  3. **Trim Perpl to `_gte: APP_LAUNCH_BLOCK`** and turn `raw_events` off, so Postgres stays small.
  4. **Tighten the limits:** indexer 512m, Hasura 256m, and **SQLite for the ledger** (single API replica; a Docker volume). Set `mem_reservation` so Docker favours the API under pressure.
  5. **Add a second small VPS as another Coolify server** (Coolify supports multiple servers; the resource picks its server) and run only the Envio Compose stack there. The API calls Hasura over its public HTTPS domain. **[OK?] costs money.**
  6. **Stagger the hackathons.** If akashi's judging ends first, stop its resources then.

---

## 3. Serving the passkey `.well-known` files

**Requirements** (`../08-integrations/mera.md` §3, `platforms-and-stores.md` §2):

- **Where:** `https://<rpId>/.well-known/apple-app-site-association` (no extension) and `https://<rpId>/.well-known/assetlinks.json`.
- **How:** "must be public over HTTPS and return JSON without a redirect".
- **Content-Type:** recommend `application/json` for both. Whether Apple strictly requires it is **(unverified)**; it is the safe choice.
- **Where the files live.** Traefik (as Coolify runs it) is a router and cannot serve files, so **the container behind the rpId host must serve them**.

### 3.1 Option A (recommended): Expo web export in an nginx image at the rpId host

`apps/mobile/public/.well-known/` holds both files, and `npx expo export -p web` copies `public/` into `dist/`.

- **Check that `dist/.well-known/` really exists after the export.** Mera PR #313 shows that static pipelines can drop dot-folders.
- If it is missing, have the Dockerfile `COPY` the files explicitly, as below.

```dockerfile
# apps/mobile/Dockerfile.web  (built in GitHub Actions, pushed to GHCR)
FROM node:24-slim AS build
WORKDIR /repo
COPY . .
RUN corepack enable && pnpm install --frozen-lockfile && pnpm --filter mobile exec expo export -p web
FROM nginx:1.29-alpine
COPY apps/mobile/deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/mobile/dist /usr/share/nginx/html
COPY apps/mobile/public/.well-known /usr/share/nginx/html/.well-known
HEALTHCHECK CMD wget -qO- http://127.0.0.1/healthz || exit 1
```

```nginx
# apps/mobile/deploy/nginx.conf
server {
  listen 80;
  root /usr/share/nginx/html;
  absolute_redirect off;                                   # never emit absolute Location headers
  location = /healthz { return 200 "ok"; }
  location = /.well-known/apple-app-site-association { default_type application/json; try_files $uri =404; }
  location = /.well-known/assetlinks.json            { default_type application/json; try_files $uri =404; }
  location / { try_files $uri $uri.html /index.html; }    # SPA / static-route fallback, no dir redirects
}
```

- `default_type` applies because nginx's `mime.types` has no entry for an extensionless file.
- **Don't use `$uri/`** in `try_files`. That avoids nginx's directory trailing-slash `301`.
- **Coolify resource:** a Docker Image app with Domains `https://<rpId>` (port 80). Direction **"Allow www & non-www"**, or only the apex. Don't add a www→apex redirect that could catch the rpId host.
- **HTTP→HTTPS redirect.** Coolify/Traefik may redirect `http://`, but Apple and Google fetch `https://` directly, so this is harmless **(unverified that the Apple CDN never tries http)**.

### 3.2 Option B: Next.js site at the rpId host

- **Use route handlers:** `app/.well-known/apple-app-site-association/route.ts` and `…/assetlinks.json/route.ts`, each with `export const dynamic = "force-static"` and `return Response.json(DATA)`.
  - These set `application/json` explicitly.
  - A plain `public/` file without an extension would get a generic type **(unverified what Next picks)**.
- **Exclude `/.well-known` from `middleware` / `proxy` matchers** and from i18n or auth redirects.
- **Set `trailingSlash: false`** (the default).
- **Layout.** If a Next.js landing page holds the apex, Expo web can live at `app.<rpId>`; WebAuthn allows the rpId to be a registrable suffix of the origin.

### 3.3 Verify after each deploy

```bash
for f in apple-app-site-association assetlinks.json; do
  curl -s -o /dev/null -w "%{http_code} %{content_type} redirect=%{redirect_url}\n" https://<rpId>/.well-known/$f
done   # expect: 200 application/json redirect=
curl -s https://app-site-association.cdn-apple.com/a/v1/<rpId>          # Apple's CDN copy; lags (unverified endpoint behaviour)
curl -s "https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://<rpId>&relation=delegate_permission/common.get_login_creds"
```

- **AASA:** `{"webcredentials":{"apps":["TEAMID.<bundle>"]}}`.
- **assetlinks:** needs **every** signing SHA-256: the EAS keystore **and** the Play App Signing key.
- **Freeze the domain before the first passkey signup.** The rpId is the account.

---

## 4. Recommended monorepo layout

```
metropolis-app/                       (private GitHub repo; public before submission)
├─ apps/
│  ├─ mobile/            Expo (iOS/Android/web). public/.well-known/*, Dockerfile.web, deploy/nginx.conf
│  ├─ api/               Node/TS API: card-auth webhook, idempotent ledger, Perpl/AUSD helpers, gas sponsor. Dockerfile
│  ├─ site/              (optional) Next.js landing on the apex if we want SSR/SEO; else skip
│  └─ docs/              (optional) static docs (e.g. fumadocs static export); Dockerfile → nginx
├─ indexer/              Envio HyperIndex, **self-contained**: package.json + own pnpm-lock, config.yaml,
│                        schema.graphql, src/, abis/, Dockerfile, docker-compose.yaml (Coolify-adapted)
├─ contracts/            Foundry (vault, card holds, engine)
├─ packages/shared/      ABIs, addresses, constants, zod schemas used by api + mobile
├─ deploy/               env templates (*.env.example, no values), traefik dynamic snippets, runbook notes
└─ .github/workflows/images.yml   matrix: api, web, docs → ghcr.io/<owner>/<app>:sha-xxxx
```

**Why `indexer/` is self-contained.** Envio Cloud wants `package.json` with `envio` pinned in the indexer root and a repo of at most 100 MB (`envio.md` §9). Keeping it standalone lets us switch between self-hosted and Cloud (fallback 2) without restructuring. Leave it **out of the root pnpm workspace** so it keeps its own lockfile. Whether Envio Cloud handles a workspace lockfile at the root is **(unverified)**.

### 4.1 Directory → Coolify resource

| # | Coolify resource | Type | Source / Base dir / File | Port | Domain | Limit |
|---|---|---|---|---|---|---|
| 1 | `metro-indexer` | **Docker Compose** (deploy key) | base `/indexer`, compose `/docker-compose.yaml` | hasura 8080 | `https://indexer.<d>:8080` (Hasura service only) | per compose (§4.2) |
| 2 | `metro-api` | **Docker Image** `ghcr.io/<owner>/metro-api:sha-…` (or Dockerfile, base `/`, file `/apps/api/Dockerfile`) | – | 3000 | `https://api.<d>` | 384m |
| 3 | `metro-ledger-db` | standalone **PostgreSQL** (or skip: SQLite on a volume in #2) | – | 5432 internal | none | 256m |
| 4 | `metro-web` | **Docker Image** `ghcr.io/<owner>/metro-web:sha-…` | – | 80 | `https://<d>` (= rpId) | 64m |
| 5 | `metro-docs` (opt.) | Docker Image | – | 80 | `https://docs.<d>` | 64m |

**Notes on the resources:**

- **API env** (runtime-only secrets): `LEDGER_DATABASE_URL` (the Internal URL of #3), `HASURA_URL=https://indexer.<d>/v1/graphql`, sponsor key (Literal), card-webhook secret, Perpl/Agora settings. Health check `/health`, rolling updates on.
- **API → Hasura:** use the public URL, or turn on Connect To Predefined Network on #1 and use its generated service name **(unverified name)**.
- **Hasura exposure:** `HASURA_GRAPHQL_UNAUTHORIZED_ROLE=public` (read-only), console **off**, and a required admin secret. Add a Traefik rate-limit middleware via the label `coolify.traefik.middlewares=hasura-rl` with a dynamic-file definition. The bounty wants a public GraphQL URL in the README.

### 4.2 Adapting Envio's example compose for Coolify

Starting point: `references/envio-local-docker-example/docker-compose.yaml`. Changes:

- **Drop `ports:`, `container_name: envio-indexer` and the custom `networks:`.** Coolify supplies a per-resource network; host ports bypass Traefik; a fixed name collides. This matches akashi's KB-FIX #7.
- **Required secrets:**
  - `ENVIO_PG_PASSWORD: ${SERVICE_PASSWORD_64_POSTGRES}` (reuse the same variable in all three services)
  - `HASURA_GRAPHQL_ADMIN_SECRET: ${SERVICE_PASSWORD_64_HASURA}`
  - **`ENVIO_API_TOKEN: ${ENVIO_API_TOKEN:?}`**. The example omits it, but the self-hosting doc requires it.
  - `HASURA_GRAPHQL_ENABLE_CONSOLE: "false"`
- **V3 env names:** `ENVIO_TUI=false` replaces `TUI_OFF` (`envio.md` §1). Set `LOG_LEVEL=info`, not `trace`. The `ENVIO_*` config variables (addresses, start blocks) must be available at **runtime**. `pnpm envio codegen` runs at image build, so check whether config interpolation happens at codegen or at start **(unverified)**.
- **Limits:** `mem_limit` on all three services (800m / 512m / 384m) and `cpus: 0.8` on the indexer.
- **Postgres data:** keep the named volume `envio-indexer-storage`.
- **Indexer health check.** The example's indexer check probes `127.0.0.1:8080` *inside the indexer container*, which looks wrong: the indexer listens on `ENVIO_INDEXER_PORT` 9898. Point it at 9898, or `exclude_from_hc: true` **(unverified which endpoint the V3 indexer exposes)**.
- **Hasura health check:** keep the TCP check. Its domain is `https://indexer.<d>:8080`.

---

## 5. Deploy runbook (nothing executed; each [OK?] needs the user's OK at that moment)

**0. Access (read-only).**
```bash
ssh -f -N -L 8001:localhost:8000 agari-box
coolify context use agari-new && coolify context verify
coolify server list
coolify resources list
ssh agari-box 'free -h; df -h /; docker stats --no-stream'
```
Record the baseline in `ids-and-txs`.

**1. Domain.**
- **[OK?]** Buy the domain.
- Choose the rpId (apex).
- **[OK?]** Create A records for `<d>`, `api.<d>`, `indexer.<d>` and `docs.<d>` pointing at the Contabo IP, TTL 300. If the DNS is on Cloudflare, use **DNS-only**, because HTTP-01 needs a direct route.
- Check with `dig +short`.

**2. Repo.**
- **[OK?]** Create the private GitHub repo.
- **[OK?]** Create a Coolify private key `metro-deploy` and add it as a **read-only** GitHub deploy key.
- **[OK?]** Create the Coolify project `metropolis` (environment `production`).

**3. CI.** Add `.github/workflows/images.yml` (akashi's matrix pattern: `docker/build-push-action`, `platforms: linux/amd64`, tags `sha-…`), then either:
- **[OK?]** make the GHCR packages public, or
- **[OK?]** run `docker login ghcr.io` on the server with a read-packages token.

**4. Ledger DB.**
- **[OK?]** Create the Postgres (`coolify database create postgresql …`) with a 256m limit, or choose SQLite.
- **[OK?]** Optionally configure an S3 backup.

**5. Indexer.**
- **[OK?]** Create the Compose app from the deploy key: base `/indexer`, compose `/docker-compose.yaml`, Auto Deploy OFF, Preserve Repository ON only if files are bind-mounted.
- Set `ENVIO_API_TOKEN` and the contract variables.
- Set the Hasura domain.
- **[OK?]** `coolify deploy uuid <indexer>`.
- **Verify:**
  - `curl https://indexer.<d>/v1/graphql` with a `_meta`/`chain_metadata` query;
  - sync progress in `coolify app logs <uuid>`;
  - `docker stats` shows the indexer under 800m.

**6. API.**
- **[OK?]** Create the Docker Image app (port 3000, `https://api.<d>`, health check `/health`, limit 384m).
- `coolify app env sync <uuid> --file deploy/api.env` (gitignored; secrets runtime-only).
- **[OK?]** Deploy.
- **Verify:**
  - `/health` returns 200;
  - the card-webhook signature test;
  - replaying the same idempotency key yields one ledger row;
  - the sponsor drip on testnet first.

**7. Web (rpId host).**
- **[OK?]** Create the Docker Image app (port 80, `https://<d>`, Direction Allow).
- **[OK?]** Deploy.
- **Verify:** §3.3 (200, `application/json`, no redirect, Apple CDN, Google DAL).
- **Only after this passes:** build the EAS apps with `webcredentials:<d>` and start passkey signups.

**8. Docs (optional).** **[OK?]** Create and deploy it the same way as web.

**9. CI deploy hook (optional).**
- **[OK?]** Enable API Access.
- **[OK?]** Create a deploy-scoped API token.
- Add `COOLIFY_WEBHOOK` / `COOLIFY_TOKEN` as GitHub secrets and a `curl --fail` step after the push.
- Otherwise, keep deploying manually with `coolify deploy uuid`, as akashi does.

**10. Post-deploy.**
- Record the UUIDs, domains, limits and `docker stats` in an ids file.
- Re-check RAM once akashi deploys. If available memory falls below ~0.5 GiB or swap grows, apply the fallbacks in §2.4.

---

## 6. Open items

- Compose service hostnames after "Connect To Predefined Network" **(unverified)**. Use public URLs until checked.
- Watch Paths with a deploy-key and manual-webhook source **(unverified)**.
- V3 indexer health endpoint and port, and whether `ENVIO_*` interpolation happens at codegen or at runtime **(unverified)**.
- Real memory of Hasura and Postgres under our load **(measure)**.
- Whether Apple strictly requires the `application/json` Content-Type for AASA **(unverified)**. Serve it anyway.
- Whether the Expo web export copies dot-folders from `public/` **(unverified)**. The Dockerfile copies them explicitly.
