# Decisions and open questions

The plan (`00-plan.md`) changes **only** through entries here. Format: `- **D-###** date · decision · evidence · approval`. Q-items: `### Q-###` with owner, blocks, default, status.

## Decisions
- **D-001…D-042** 2026-09-29 · the full decision table in `00-plan.md` §1 (D-001 track … D-042 card demo), including D-037 (Face ID default: practice OFF, mainnet ON above threshold) and D-038 (practice never geo-gated) · evidence per row in §1 · **approved by user (plan approval, 2026-09-29)**.
- **D-043** 2026-09-29 · pnpm **11.24.0** pinned (the user's toolchain in Agari/akashi; 12.8.1 exists but is not adopted mid-hackathon) · `pnpm -v`, `npm view pnpm dist-tags` · planner (S0 decision delegated by plan §4).
- **D-044** 2026-09-29 · `design/preview`'s nested `.git` (only a Create Next App commit, no remote) moved to the session scratchpad so the preview is tracked as plain files · `git log` in design/preview · planner.
- **D-045** 2026-09-29 · Node: services target Node 24 LTS in Docker; local dev runs Node 25 (installed) — `engines: ">=24"` · `node -v` · planner.
- **D-046** 2026-09-29 · TypeScript pinned `~6.0.3` in the catalog (7.0.2 is the native Go compiler; Expo SDK 57 and Agari use 6.0.3) · `npm view typescript`, Agari package.json · planner.
- **D-047** 2026-09-29 · Biome 2.5.14 is the only linter/formatter (`noMagicNumbers`, `noExcessiveLinesPerFile` confirmed in Biome docs via Context7 `/biomejs/website`); no ESLint · Context7 · planner.
- **D-048** 2026-09-29 · `context/_portal/` (login-gated portal capture incl. account views/screenshots) is gitignored — kept local for agents, never published in the public repo · privacy · planner.
- **D-049** 2026-09-29 · Brand **Senryo 千両** confirmed; domain **senryo.xyz** (user: buy via namecheap-cli only if ≈ $2; .app too expensive) — rpId = `senryo.xyz`, frozen once the first account is created · user · approved.
- **D-050** 2026-09-29 · GitHub repo `Blockchain-Oracle/senryo` created **public** (rules §7.2); judges' account can read it without an invite · https://github.com/Blockchain-Oracle/senryo · user OK-1.
- **D-051** 2026-09-29 · Namecheap API calls route through the Coolify server's static IP `84.46.247.92` via `ssh -D` SOCKS tunnel (user whitelists that IP once in Namecheap API Access) · namecheap-cli error 1011150 · planner.
- **D-060** 2026-09-29 · `@senryo/tokens` also emits the type scale (`--type-<role>-size|leading|tracking|weight`), spacing, motion and radius as CSS vars, plus theme-independent identity colours in `marks.ts` (`KINPAKU` foil, fixed `QR` ink/paper, `CHAIN_HUE`, `ASSET_HUE`). New type roles `micro` (10), `numTicker` (24), `numXl` (34) cover the D2 preview's sizes, so web never writes px · design-literals-web invariant; D2 preview sizes · S1 web.
- **D-061** 2026-09-29 · Web theming: next-themes `attribute="class"`, `defaultTheme="dark"`, themes `dark|light`, **no system follow** (the desk is a deliberate look); Tailwind 4 `@theme inline` maps tokens to utilities (`text-micro … text-num-hero`, `bg-up/down/gold`, `ease-desk`); `tailwind-merge` is extended with the type roles so `text-label text-primary` never collapse · Context7 `/tailwindlabs/tailwindcss.com` · S1 web.
- **D-062** 2026-09-29 · `transpilePackages` lists workspace packages explicitly (`@senryo/tokens` now; each new `@senryo/*` is added when first imported) — Next matches package names exactly, not globs · Context7 `/vercel/next.js` · S1 web.
- **D-063** 2026-09-29 · Static export uses `trailingSlash: true` (every route is `<route>/index.html`, which nginx serves without rewrites) and `images.unoptimized`; `/trade/[market]` is pre-rendered from `generateStaticParams` with `dynamicParams = false` · D-011 · S1 web.
- **D-064** 2026-09-29 · Until S6–S8, screens read **one** file, `apps/web/src/lib/sample.ts` (money as usd6/bps bigints), and show a visible **PREVIEW DATA** badge. Chart components that plot floats get values through `plotValue()` (display projection only; never used for money arithmetic) · CLAUDE.md money rule · S1 web.
- **D-065** 2026-09-29 · Seal mark 千 outlined from **Zen Old Mincho** (OFL) — Apple's system CJK fonts don't permit redistributing outlines; wordmark from JetBrains Mono Bold (OFL). Fonts are downloaded by `brand/scripts/render.sh`, not committed. The seal uses the Kinpaku foil gold `#fbe10f` (tokens `KINPAKU.foilMid`) rather than the UI gold `#fbfb0f`, which reads lemony at icon size · brand/README.md · S1 brand.
- **D-066** 2026-09-29 · Desk tab is labelled **Fund** (the preview said "Deposit") to match the route and plan §2.4; the Markets sample list follows D-005 (XAU/XAG live on Senryo, BTC/ETH/MON on Perpl, equities and FX shown as **SOON**); the register keeps the D2 three cells and D-010's "In Perpl" bucket is a separate line under the partition bar · plan §2.4, D-005, D-010 · S1 web.

## Open questions
| Q | Owner / ask | Question | Blocks | Default | Status |
|---|---|---|---|---|---|
| Q-001 | organizers (Discord/Support) | Which rubric applies (track page vs rules §5.2)? Judging/winner dates? Mainnet + testnet split OK? | pitch emphasis | plan for both | open |
| Q-002 | Agora / Perpl (gvan) | Testnet AUSD drip (faucet empty; Perpl testnet needs 100 AUSD) | practice Perpl | mainnet demo | open |
| Q-003 | Perpl | Builder code; web-origin whitelist; native key enrollment (profile prerequisite); geo-block enforcement | Path A, TP/SL on Perpl | Path B | open |
| Q-004 | Aurora mentor | Custom Actions for persistent addresses; refunds target; fee stacking; EVM signer with non-EVM origin | F21 | inbox sweep | open |
| Q-005 | Monad / Mera | Session-design review; Safari PRF `get()` status | F01/F08 | our policy + 7702 spike | open |
| Q-006 | Envio (Denham) | Self-hosted OK for judging; HyperSync limits | S4 | self-host | open |
| Q-007 | Immersve | Own test partner credentials | S10 | public sandbox | open |
| Q-008 | Chainlink (Darb) | Data Streams credentials (FX, equities, sub-minute XAU/XAG) | D-020 | gold + silver on push feeds | open |
| Q-009 | **user** | Name + domain | S1, S6 | — | **answered → D-049** (purchase pending IP whitelist) |
| Q-010 | **user** | Apple Developer membership | S6 iOS | — | **answered: user has one** |
| Q-011 | **user** | Team members, contact wallet, geofence list | registration | solo | open |
| Q-012 | **user** | Mainnet budget (≈60 MON keys, ≈400 AUSD seeds/demo/vouchers, ≈$30 Aurora, Laso ≈$105+, Apple $99, VPS €5–10/mo) | S7–S10 | ask per spend | open |
| Q-013 | **user** | "Shazam" reference repo | — | — | **dropped** (user unaware; Agari is the reference) |
| Q-014 | Chainlink / Pyth | Data Streams creds or Pyth trial for live XAU/XAG | D-020 | push + honest age | open |
| Q-015 | **user** | Any team member in a listed community partner? (Community bounty $5K) | bounty | not targeted | open |
| Q-016 | **user** | Tester communities you can reach (S-GTM) | traction | ask at S6 | open |
