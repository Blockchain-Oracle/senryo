# Feature matrix (parity)

Status: Pending → Shell → Partial → Done (or Blocked + resolution). Rows only advance, and only at stage gates. Evidence = an `acceptance.md` row, commit or route check. Legend: AG Agora · MR Mera · AU Aurora · EN Envio · T1 Track 01 rubric.

| F | Feature | Criterion | Stage | Status |
|---|---|---|---|---|
| F-01 | Native iOS + Android app | AG "mobile application" | S5/S15 | Pending |
| F-02 | Passkey sign-in (Mera) mobile + web, one prompt | AG; MR one-prompt | S6 | Partial — web create/sign-in/recovery verified in Chrome on rpId senryo.xyz; native code + simulator pass (21ae20c); device run + prompt counts after the senryo-web deploy |
| F-03 | AUSD balance held + displayed | AG | S6/S8 | Pending |
| F-04 | Fund AUSD from any chain / Monad wallet | AG; AU | S9 | Pending |
| F-05 | Trade on Perpl from the app | AG deliverable | S7 | Pending |
| F-06 | Perpl positions, close, PnL, vault↔Perpl moves | AG "three integrations together" | S7 | Pending |
| F-07 | One balance: gold/silver engine + card holds (+ Perpl bucket) | AG creativity; T1 originality | S8/S10 | Pending |
| F-10 | TTFT measured (taps + seconds) | MR | S6/S12 | Pending |
| F-11 | Scoped session + re-prompt matrix + expiry UX | MR session design | S6 | Pending |
| F-12 | Stateless test (fresh device rebuild) | MR | S6 | Partial — web: clear site data → sign in → same address; backup-passkey recovery on a fresh profile → same address; device run pending |
| F-13 | Composability: relayed gas, Aurora intent signed by Mera, 7702 spike, second-passkey vault | MR bonus | S6/S9 | Partial — S3: relayed starter claim reached finalized on a fork; vault/prefs storage routes (0882b3d); S6: 7702 signed authorization behind step-up (D-145), backup-passkey vault client. Aurora S9 |
| F-14 | No custody backend (invariant) | MR | S0+ | Pending |
| F-20 | Intents Connect deposit → `depositFor` live | AU | S9 | Pending |
| F-21 | `depositAndOpen` | AU | S9 | Pending |
| F-22 | Persistent address + inbox sweep | AU | S9 | Pending |
| F-23 | Refund/settlement states handled | AU | S9 | Pending |
| F-24 | ≥3 source chains incl. Solana | AU bonus | S9 | Pending |
| F-25 | Cash-out via Swap API | AU | S9 | Pending |
| F-30 | Multichain HyperIndex (143 + 10143) | EN | S4 | Partial — local sync at head on both chains via HyperSync (41 s, 6fb6ecd); hosted deploy S14 |
| F-31 | Derived/aggregated entities | EN | S4 | Done — daily/protocol aggregates computed in handlers; stats query returns (6fb6ecd, acceptance S4) |
| F-32 | Perpl account linking + fill attribution | EN | S4/S7 | Partial — taker-fill cursor: 17,217 fills paired, 0 unattributed; app-user linking lands in S7 |
| F-33 | Indexer drives features (portfolio, activity, candles, stats) | EN | S4/S8 | Partial — `@senryo/indexer-client` returns testnet portfolio/activity/candles/stats from the S3 drive; app wiring S8 |
| F-34 | Public GraphQL + README | EN | S14 | Pending |
| F-35 | HyperSync analytics script | EN | S4 | Done — Perpl 7-day analytics ($87.4M volume, 474k fills, 93 liquidations) |
| F-40 | RWA pool engine (testnet → mainnet) | T1 | S2/S8 | Pending |
| F-41 | Session-aware oracle (hours, stale, circuit, reduce-only) | T1 originality | S2 | Pending |
| F-42 | Risk buckets from chain | T1 design | S8 | Pending |
| F-43 | Liquidation + insurance + TP/SL triggers | T1 | S2/S8 | Partial — keeper liquidated a testnet position in 1.7 s, finalized (tx 0x6b44a112…c4c3); trigger job built; mainnet S8 |
| F-44 | LP deposit/redeem | T1 | S8 | Pending |
| F-45 | Execution trace | T1 design | S8 | Pending |
| F-50 | Card allowance + holds lifecycle | codex §A | S2/S10 | Partial — holds within the signed allowance, capture + release via the webhook outbox, ledger balanced (fork check, 0882b3d); live issuer S10 |
| F-51 | Immersve sandbox card (testnet) | card route a | S10 | Pending |
| F-52 | Lithic ASA hold-before-approve + p50/p99 + simulate | card route b | S10 | Partial — ASA responder built from Lithic docs, concurrency check passes on a fork; sandbox keys [OK?] + p50/p99 S10 |
| F-53 | Laso real prepaid | card route c | S10 | Pending |
| F-60 | Onboarding, practice mode, vouchers | product | S6/S12 | Partial — services side: practice claim + voucher relay reached finalized on a fork (api smoke 17/17); client: Create-first onboarding, practice claim signing, watch-only (21ae20c); claim wiring S6.12 |
| F-61 | Haptic + sound map, Live Activities, widgets, push | product / iOS feel | S12 | Pending |
| F-62 | Web desk (desktop) | T1 design | S11 | Pending |
| F-63 | Docs site + legal + /stats | judges, traction | S13 | Pending |
| F-64 | Traction evidence (testers, metrics, quotes) | T1 founder + traction (45%) | S-GTM | Pending |
| F-70 | Public repo, MIT, AI disclosure, setup README | rules §4.1 | S0/S17 | Pending |
| F-71 | Demo ≤3 min, pitch ≤2 min, logo | rules | S17 | Pending |
| F-72 | Live link + judge guide + watch mode | track deliverables | S15/S17 | Pending |
| F-80 | Runtime Practice ↔ Mainnet toggle (F06/F49), mode on every money surface | product honesty | S8.22 | Pending |
| F-81 | Real identity marks for every known entity + original commodity/FX art | study LG01–LG38 (D-170) | S1b | Pending |
| F-82 | Reference-led redesign "Living Lacquer" (journeys J1–J11, fidelity acceptance) | study C01–C44, M01–M18 (D-168) | S1b | Pending |
| F-83 | Handles + avatars | study OP11, FT038/039/065 (D-174) | S12b | Pending |
| F-84 | Follow + leaderboard + Your rank | study OP17, FT066/083/085 | S12b | Pending |
| F-85 | Trade feed (fills, theses, replies, likes, Top Trades) + market Holders/Feed | study FT070/074–077/098/099 | S12b | Pending |
| F-86 | Market breadth: FX majors on the engine; equities/indices indicative (B2 route); crypto via Perpl | user + study M09 (D-175) | S8.23/S7 | Pending |
| F-87 | Spot Monad tokens (buy/sell via Uniswap v4) | study FT071 | S1b J11 | Pending |
| F-88 | Mainnet cold start (inbox sweeper, vouchers, equity-gated top-ups) + TxRecovery | product (D-179) | S8.24 | Pending |
