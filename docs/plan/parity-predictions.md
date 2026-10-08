# Parity ledger: Owarine and crypto-world-fair capabilities → Senryo stages (pivot D-256)

**Rule:** nothing is dropped silently.
- Each row maps to a stage, a Canton-only equivalent, or "needs the user's decision".
- "Excluded" requires the user's explicit decision.
- First-pass mapping by keyword (8 Oct). Rows are re-read when their stage starts, and the Senryo column gains built / accepted / deployed evidence.

## Owarine (`../owarine/docs/plan/capabilities.json`, 219 rows; state as Owarine recorded it)

| Owarine id | Capability | Owarine state | Senryo stage / disposition | Senryo status |
|---|---|---|---|---|
| L-01 | Root layout, providers, pre-paint theme, fonts, PWA manifest | not-live | S6 web · S10 ship | — |
| L-02 | Desktop header, grouped nav, balance pill, account menu | local | S8b agents and desks | — |
| L-03 | Mobile pill nav + "Everything" drawer | not-live | S5/S6 shell and kit | — |
| L-04 | AppStrip, Marquee ticker, footer, grain, cursor, theme toggle | not-live | S5/S6 shell and kit | — |
| L-05 | Design system (Yosuku port) | not-live | S5/S6 kit (Senryo UGLYCASH system; Yosuku design NOT copied) | — |
| L-06 | Toast / transaction feedback | not-live | S5 (results/pushes) · S8 alerts | — |
| L-07 | Error boundaries | not-live | S5/S6 (error boundaries in both apps) | — |
| L-08 | Write-journal recovery on session start | not-live | S7 stocks | — |
| L-09 | First-run Tutorial | local | S5 onboarding | — |
| L-10 | Wrong-network banner | not-live | S5/S6 (network/mode chip; Practice vs Real) | — |
| L-11 | / editorial landing | not-live | S6 web · S10 ship | — |
| L-12 | How it works | local | S5 Calls/history · S8 edge stats | — |
| L-13 | Demo | not-live | S3/S5 wallet · S9 Real deposits | — |
| L-14 | Pitch folio | not-live | S6 web · S10 ship | — |
| L-15 | Stats / traction | local | S8 stats | — |
| L-16 | Status | local | S3 /health + S6 /status page | — |
| L-17 | News wire | local | Needs user decision (news wire) | — |
| L-18 | Download / PWA install | not-live | S6 web · S10 ship | — |
| L-19 | Native app + /native-auth | not-live | S1b native build + S5 | — |
| L-20 | Documentation site | local | S10 docs site | — |
| L-21 | Legacy redirects | not-live | S1 cleanup (delete legacy routes) | — |
| L-22 | Share cards (The Call, Earned Heat) | not-live | S7 Earn (pool supply) | — |
| L-23 | Social OG images | local | S8 social | — |
| L-24 | Wallet connect / disconnect / account switch | local | S6 web "Use a wallet" (AppKit, loaded on click) | — |
| L-25 | Get test funds | local | S3/S5 wallet · S9 Real deposits | — |
| L-26 | Add-money modal + CreditWelcome | local | S5 onboarding | — |
| L-27 | Tap-trading (session key + SESSION grant + sponsor) | not-live | S7 stocks | — |
| L-28 | Trading Balance vault | local | S7 Earn (pool supply) | — |
| L-29 | /markets hero-as-ticket | not-live | S2–S6 core loop | — |
| L-30 | §01 live-now rail cards | not-live | S2–S6 core loop | — |
| L-31 | §02 "Just ask" word board | not-live | S5 Home (word board → featured live windows) | — |
| L-32 | Call ticket (one-tap) | local | S2–S6 core loop | — |
| L-33 | Verdict + inline claim | local | S2/S3 settlement · S7 Proof page | — |
| L-34 | Claim-all plate | not-live | S2/S3 automatic claimFor (no claim-all needed; credits claimable if a push fails) | — |
| L-35 | Plain-position cash-out | local | S2–S6 core loop | — |
| L-36 | Range (ticket mode + /games/range) | local | S8 games | — |
| L-37 | Boost 2×/3× (LeverageReserve) | local | S7 bands/baskets · S8 parlay/boost | — |
| L-38 | Parlay | local | S7 bands/baskets · S8 parlay/boost | — |
| L-39 | Private mode | local | Canton-only privacy → UI privacy mask only (positions are public on Monad) | — |
| L-40 | Market Surface | not-live | S8 Surface | — |
| L-41 | Sensei AI dock | not-live | S8b agents and desks | — |
| L-42 | The Room | local | S8 social | — |
| L-43 | Price alerts | not-live | S5 (results/pushes) · S8 alerts | — |
| L-44 | Reels | local | S8 social | — |
| L-45 | Takes | local | S8 social | — |
| L-46 | Portfolio | local | S5 Calls/history · S8 edge stats | — |
| L-47 | Trader Edge | local | S5 Calls/history · S8 edge stats | — |
| L-48 | Leaderboard | local | S8 social | — |
| L-49 | Reputation, badges, CSV | local | S5 Calls/history · S8 edge stats | — |
| L-50 | Earn (maker vault) | local | S7 bands/baskets · S8 parlay/boost | — |
| L-51 | Strategies desk | local | S8b agents and desks | — |
| L-52 | Launch an agent (4-step builder) | local | S8b agents and desks | — |
| L-53 | Copy a strategy | local | S8b agents and desks | — |
| L-54 | Agents board | local | S8b agents and desks | — |
| L-55 | Strategy runner + self-host | local | S8b agents and desks | — |
| L-56 | Paid Memory Market | not-live | Tempo/MPP-specific → n/a (needs user decision) | — |
| L-57 | Reversion preset | local | S8b strategies | — |
| L-58 | Trade from X | not-live | S8b (needs an X account, owner action) | — |
| L-59 | X recovery / claim | not-live | S8b (X account) | — |
| L-60 | X relay | not-live | S8b (X account) | — |
| L-61 | Games hub | local | S8 games | — |
| L-62 | Practice | local | S8 games: Practice | — |
| L-63 | Duel (Free/Ranked) + match link | local | S8 games | — |
| L-64 | Games history | not-live | S8 games | — |
| L-65 | Rank + seasons | local | S8 games | — |
| L-66 | Lucky Draw | not-live | S8 games | — |
| L-67 | Moonshot | local | S7 bands/baskets · S8 parlay/boost | — |
| L-68 | Line Rider | local | S8 games | — |
| L-69 | Candle Hop | local | S8 games | — |
| L-70 | Game audio, motion, art, settings | not-live | S8 games | — |
| L-71 | Game profile, achievements, friends | not-live | S8 games | — |
| L-72 | /dev/* fixtures | not-live | S5/S6 /dev/kit page + dev fixtures (DX) | — |
| L-73 | Ops host and health | local | S6 web · S10 ship | — |
| L-74 | API surface | local | S3 API surface | — |
| Y-01 | Founder waitlist + referral rank (/waitlist) | not-live | S8 games | — |
| Y-02 | Creators guide, creator card studio, creator recovery (/creators, /creator/studio, /creator/recover) | not-live | Yosuku feature → needs user decision | — |
| Y-03 | Founder Line Studio (/studio) | not-live | Yosuku feature → needs user decision | — |
| Y-04 | Internal social content board (/social) | not-live | S8 social | — |
| Y-05 | /fund card on-ramp + cross-chain deposit (CCTP) | not-live | S3/S5 wallet · S9 Real deposits | — |
| Y-06 | In-app editorial /docs page | not-live | S6 web · S10 ship | — |
| Y-07 | Agent/MCP tx-builder (/api/bet/build), npm SDK, MCP server | not-live | S8b agents and desks | — |
| Y-08 | Polymarket discovery rail; multi-coin ticker + Fear & Greed | not-live | Excluded by the pivot (Polymarket discovery deleted, D-256) | — |
| Y-09 | Sensei persistent memory (MemWal) | not-live | S8b agents and desks | — |
| Y-10 | TEE-attested agent / attested X bind | not-live | S8b agents and desks | — |
| Y-11 | Name-service handle claim (.yosuku.sui) | not-live | S8 $handle (Senryo handles, not a name service) | — |
| Y-12 | Encrypted rooms (Seal) | not-live | S8 social | — |
| Y-13 | TheBell floating draggable countdown widget | not-live | S5 countdown ring (terminal + chips) | — |
| Y-14 | Site-wide + per-market OG images | not-live | S6/S10 OG images + share cards | — |
| Y-15 | /agent attested showcase | not-live | S8b agents and desks | — |
| Y-16 | Standalone Trading Balance deposit/withdraw modal | not-live | S3/S5 wallet · S9 Real deposits | — |
| Y-17 | Native iOS/Android app | not-live | S1b + S5 (native apps exist) | — |
| Y-18 | Creator earnings pool row (builder codes) | not-live | S7 stocks | — |
| A-1a | Bearish exposure via existing primitives | not-live | S2 Down band (bearish view covered by Down) | — |
| A-1b | Inverse position (linear short, not binary) | local | S7 bands/baskets · S8 parlay/boost | — |
| A-1c | Fade a trader/agent | local | S8b agents and desks | — |
| A-2a | Yield on idle Trading Balance | not-live | S7 Earn (yield = pool supply) | — |
| A-2b | Supplier ("be the house") UI for every reserve | local | S7 Earn (pool supply) | — |
| A-2c | Yield reporting | local | S7 Earn epoch reporting | — |
| A-3a | Trader profiles, follows, social leaderboards | local | S8 social | — |
| A-3b | Copy human traders | local | S8b agents and desks | — |
| A-3c | Ticker rooms, cashtag takes, activity feed, notifications | local | S8 social | — |
| A-3d | Trade-from-X for stocks | not-live | S8b (needs an X account, owner action) | — |
| A-3e | Blinks: every Window as a signed share link, where the reference had a Solana Action (/actions.json, /api/actions/w/<marketId>, /api/actions/t/<symbol>/<cadence>) | not-live | S8 social | — |
| C-S19a | Baskets /baskets, basket hub, measured in points (D-124) | local | S7 bands/baskets · S8 parlay/boost | — |
| C-S19b | "Your baskets" cover card and basket cover (pickBasketHedges) | not-live | S7 bands/baskets · S8 parlay/boost | — |
| C-S20a | Valuation lanes (OPENAIV/ANTHROPICV), hub "Token vs Pyth" (D-125) | not-live | No Monad price source → marked "no source" (needs user decision to add a source) | — |
| C-S20b | Pyth entitlement gate: a lane lists only while the probe says the index is readable | local | No Monad price source → marked "no source" (needs user decision to add a source) | — |
| C-S21a | Desk pages /desk, /desk/new, /desk/[id], /desk/[id]/record, /desk/[id]/decision/[seq], desk OG image (D-126) | local | S8b agents and desks | — |
| C-S21b | Desk API: /api/desk/[owner] + actions, approvals, check-now, feed, mandate, mode, opened, records, records/[seq], share; /api/desk/marks | local | S8b agents and desks | — |
| C-S21c | Desk program: attested reference, premium ceiling, hash-chained operator_checkpoint, shadow/pause mode, token allowlist | local | S8b agents and desks | — |
| C-S21d | DeskWatcher toasts; judges' shared read-only desk | local | S8b agents and desks | — |
| C-S22 | Desk UX kit from 21st components (D-127), web and native | not-live | S8b agents and desks | — |
| C-S23a | Closed market: word board and ticket out of hours, 24/7 chips, "No quotes yet", games tell the truth out of hours | not-live | S8 games | — |
| C-S23b | Pre-open resting call ("Schedule a call") | local | S7 "Schedule a call" before stock open | — |
| C-S24a | Dark-mode balance controls; compact /short | local | S7 bands/baskets · S8 parlay/boost | — |
| C-S24b | Strategy runner rests while no Window trades; isStalledOpening drops a Window whose opening print is over 2 min late | local | S8b agents and desks | — |
| C-S25 | Sponsor visibility: "Built on" band, per-price source line (S25b), docs sponsor page, footer credit | not-live | S6 web · S10 ship | — |
| C-PUSH | Push notifications: api/push/register, api/push/drain, ops push-clock, Expo; fills, results, payouts | not-live | S5 (results/pushes) · S8 alerts | — |
| C-DOC-01 | Docs site: 42 pages, llms.txt, llms-full.txt, /raw, /api/search, OG, sitemap, captures | local | S6 web · S10 ship | — |
| C-PROOF | /proof feed and /proof/[market] with ReverifyButton | local | S2/S3 settlement · S7 Proof page | — |
| C-MKT-01 | Ticker hub /tickers/[symbol] + OG (basket and valuation modes) | local | No Monad price source → marked "no source" (needs user decision to add a source) | — |
| C-MKT-02 | Lanes: Regular, Gap (Monday), 24/7 xStock token, PreStocks pre-IPO; session, halt and gap states | local | No Monad price source → marked "no source" (needs user decision to add a source) | — |
| C-MKT-03 | Cadences 300/900/3600 s plus Gap; Masayume 4 h and 1 d; Masayume's BTC/ETH cadence lanes | local | S7 stocks | — |
| C-MKT-04 | Price sources (PrintSource: Pyth, RedStone, Switchboard, attested) | local | S2/S3 settlement · S7 Proof page | — |
| C-MKT-05 | Oracle quorum and cross-check-and-void (maxDeviationBps, VoidReason specific reasons) | local | S2/S3 settlement · S7 Proof page | — |
| C-MKT-06 | BTC/ETH realised-vol re-measure before fair values go live | local | S2–S6 core loop | — |
| C-MKT-07 | D-123 demo-cash and ladder depth at the reference's scale (100,000 credits a day) | not-live | S2–S6 core loop | — |
| C-MKT-08 | Region hold (D-095, HTTP 451, RegionNote) | not-live | S9 region hold for Real (geo header via Cloudflare) | — |
| C-MKT-09 | /api/sentiment crowd flow | not-live | S8 crowd split (indexer) | — |
| C-MKT-10 | /api/proof/pyth | local | S2/S3 settlement · S7 Proof page | — |
| C-MKT-11 | /api/dev/verify-message | not-live | S6 dev tools | — |
| C-MKT-12 | Holdings-dependent UX: cover and hedge cards, "Your stocks", drop bell, landing Cover | not-live | S7 stocks | — |
| C-MKT-13 | X grammar <btc/eth> | not-live | S8b (X account) | — |
| C-DAML-01 | Engine abu-pm-main: Series, MarketTerms, WindowState, PriceQuote, OpenPrint, Resolution, VenueCash, Quote, BuyQuote, Leg, NettedResidual and the money gate | local | S2/S3 settlement · S7 Proof page | — |
| C-DAML-02 | Venue mode (admin_set_mode: pause, reduce-only) | local | Canton-only → EVM equivalent (Mera account / USDC / contract) | — |
| C-DAML-03 | Product dependents (product_add_dependent / release_dependent) | local | Canton-only → EVM equivalent (Mera account / USDC / contract) | — |
| C-DAML-04 | Strategy creator_seal (sealed spec), set_runner, deactivate | local | S8b agents and desks | — |
| C-DAML-05 | Season prize pool and arena tiers | local | S8 games | — |
| C-DAML-06 | Canton Coin rail (CIP-56 transfer instructions, seats on our participant) | live | Canton-only → EVM equivalent (Mera account / USDC / contract) | — |
| C-OPS-01 | Supervisor, heartbeats, /health, calendar, earnings, halt-watch, SSE, print_archive | local | S7 stocks | — |
| C-OPS-02 | Window roller | local | S2–S6 core loop | — |
| C-OPS-03 | Oracle feeders (Coinbase, Kraken, Bitstamp 1-minute closes), replacing price-relay | local | S2/S3 settlement · S7 Proof page | — |
| C-OPS-04 | Pricer and quote issuer over K venue cash shards; venue price ladder over SSE | local | S2–S6 core loop | — |
| C-OPS-05 | Settler (SettleBatch), resolver proposer, netting, rebalancer, expiry sweeper, reserve reporter | local | S7 Earn (pool supply) | — |
| C-OPS-06 | Projector (/v2/updates → Postgres), replacing the indexer | local | S4 indexer (Envio) | — |
| C-OPS-07 | Seat funding and close-out | local | S2–S6 core loop | — |
| C-OPS-08 | strategy-runner + self-host runner-main.ts | local | S8b agents and desks | — |
| C-OPS-09 | leverage-keeper | local | S8b agents and desks | — |
| C-OPS-10 | game-room, matchmaker, duel-projector, duel-settler | local | S8 games | — |
| C-OPS-11 | x-relay | not-live | S8b (X account) | — |
| C-OPS-12 | desk-runner (opt-in) | local | S8b agents and desks | — |
| C-OPS-13 | market-maker vault mode (MAKER_MODE=vault) | local | S7 Earn (pool supply) | — |
| C-OPS-14 | Actor set split VENUE / LEGACY / OPT-IN | local | S3 keeper actor set | — |
| C-N00 | Native shell: NativeTabs, header, floating pill dock, BottomDrawer, More side panel, haptics, pull-to-refresh | not-live | S5/S6 shell and kit | — |
| C-N01 | Native route / (index, first-run redirect) | local | S5 onboarding | — |
| C-N02 | Native route /welcome | not-live | S5 onboarding | — |
| C-N03 | Native route /onboarding | local | S5 onboarding | — |
| C-N04 | Native route /connect (seat drawer) | not-live | S5/S6 shell and kit | — |
| C-N05 | Native route /account | local | S5 You/Account | — |
| C-N06 | Native route /funds (demo-credits grant) | not-live | S3/S5 wallet · S9 Real deposits | — |
| C-N07 | Native route /ticket (sheet) | local | S2–S6 core loop | — |
| C-N08 | Native route /markets (tab) | local | S5 Markets tab | — |
| C-N09 | Native route /markets/[id] | local | S2/S3 settlement · S7 Proof page | — |
| C-N10 | Native route /portfolio (tab) | local | S5 Calls/history · S8 edge stats | — |
| C-N11 | Native route /portfolio/edge | not-live | S5 Calls/history · S8 edge stats | — |
| C-N12 | Native route /reels (tab) | not-live | S8 social | — |
| C-N13 | Native route /games (tab) | not-live | S8 games | — |
| C-N14 | Native route /games/practice | not-live | S8 games | — |
| C-N15 | Native route /games/duel | not-live | S8 games | — |
| C-N16 | Native route /games/duel/[matchId] | not-live | S8 games | — |
| C-N17 | Native route /games/lucky | not-live | S8 games | — |
| C-N18 | Native route /games/range | not-live | S8 games | — |
| C-N19 | Native route /games/moonshot | not-live | S8 games | — |
| C-N20 | Native route /games/line-rider | not-live | S8 games | — |
| C-N21 | Native route /games/candle-hop | not-live | S8 games | — |
| C-N22 | Native route /games/history | not-live | S8 games | — |
| C-N23 | Native route /games/rank | not-live | S8 games | — |
| C-N24 | Native route /activity | not-live | S5 Activity | — |
| C-N25 | Native route /agents | not-live | S8b agents and desks | — |
| C-N26 | Native route /baskets | not-live | S7 bands/baskets · S8 parlay/boost | — |
| C-N27 | Native route /claim (X recovery) | not-live | S8b (X account) | — |
| C-N28 | Native route /desk | not-live | S8b agents and desks | — |
| C-N29 | Native route /desk/new | not-live | S8b agents and desks | — |
| C-N30 | Native route /desk/[id] | not-live | S8b agents and desks | — |
| C-N31 | Native route /desk/[id]/record | not-live | S8b agents and desks | — |
| C-N32 | Native route /desk/[id]/decision/[seq] | not-live | S8b agents and desks | — |
| C-N33 | Native route /earn | not-live | S7 Earn (pool supply) | — |
| C-N34 | Native route /how-it-works | not-live | S5/S6 How it works | — |
| C-N35 | Native route /leaderboard | not-live | S8 social | — |
| C-N36 | Native route /notifications (push settings; its nav entry was removed 25 Sep, the screen stays) | not-live | S5 (results/pushes) · S8 alerts | — |
| C-N37 | Native route /parlay | not-live | S7 bands/baskets · S8 parlay/boost | — |
| C-N38 | Native route /pool (redirect) | not-live | S7 Earn | — |
| C-N39 | Native route /sensei | not-live | S8b agents and desks | — |
| C-N40 | Native route /short | not-live | S7 bands/baskets · S8 parlay/boost | — |
| C-N41 | Native route /status | not-live | S6 web · S10 ship | — |
| C-N42 | Native route /strategies | not-live | S8b agents and desks | — |
| C-N43 | Native route /strategies/[id] (redirect) | not-live | S8b agents and desks | — |
| C-N44 | Native route /tickers/[symbol] | not-live | S5 market terminal per symbol | — |
| C-N45 | Native route /trade-from-x | not-live | S8b (needs an X account, owner action) | — |
| C-N46 | Native route /u/[address] | not-live | S8 public profile /u/[address] | — |
| C-N47 | +native-intent deep-link handling | local | S5 deep links (senryo.xyz/m/BTC-5m) | — |
| C-N48 | Home-screen widget and Live Activity | not-live | S2–S6 core loop | — |
| C-N49 | Onboarding with sound | not-live | S5 onboarding | — |
| C-N50 | Android ongoing notification and Android APK (FCM credentials added) | not-live | S5 (results/pushes) · S8 alerts | — |
| C-N51 | Live spot stream and venue ladder on the phone (react-native-sse) | local | S2–S6 core loop | — |
| C-N52 | DropBellWatcher, DeskWatcher on the phone | not-live | S8b agents and desks | — |
| C-ADD-01 | "Who can see this" chip (web and phone) | local | Canton-only privacy → n/a (Monad positions are public; copy says so) | — |
| C-ADD-02 | Per-party view switcher with the literal query on screen (web and phone) | local | Canton-only → EVM equivalent (Mera account / USDC / contract) | — |
| C-ADD-03 | Seat link between devices (QR + 6-character code) | local | S5 onboarding | — |
| C-ADD-04 | iOS first-run demo-credits gate | local | S5 onboarding | — |
| C-ADD-05 | 1-minute demo lane resolved by the three oracle parties | local | Canton-only → EVM equivalent (Mera account / USDC / contract) | — |
| C-ADD-06 | Institutional event markets resolved by committee attestation | local | S2/S3 settlement · S7 Proof page | — |
| C-ADD-08 | Ticket write-progress steps (desk-kit StepProgress) and firm-quote ring (20 s) | local | S8b agents and desks | — |
| C-ADD-09 | Resolution timeline on /proof/<market> beside ReverifyButton | local | S2/S3 settlement · S7 Proof page | — |
| C-ADD-10 | Seat pool-full, draining and waitlist plates | local | Canton-only → EVM equivalent (Mera account / USDC / contract) | — |
| C-ADD-11 | Privacy matrix page with a runnable command; trust-boundary statement on /proof | local | S2/S3 settlement · S7 Proof page | — |
| C-X01 | "Strategies on X" strip on /agents (removed in the reference, d4a693e5) | not-live | S8b agents and desks | — |
| C-X02 | Mobile removals of 25 Sep: install strip, News, Pitch, Demo, Print proof, Stats, Market Surface, Download, the /more and /notifications nav entries | not-live | S2/S3 settlement · S7 Proof page | — |
| C-X03 | Friends and follows (removed in the reference, fb782348) | not-live | S8 social | — |

## crypto-world-fair (Mitoshi) capabilities not covered above

| CWF capability | Senryo stage / disposition | Senryo status |
|---|---|---|
| Order-book engine (CLOB, mint/merge, 0.001 grid) | Not ported: the shared pool (D-260) is the counterparty. Its window, print and settle rules are ported (S2) | — |
| Lanes: 66 series (crypto 5m 24/7; 9 stocks × session 5m/15m/60m + Gap + 24/7) | S2 catalogue (crypto) · S7 (stocks: session lanes; Gap and 24/7 need a source, so they need the user's decision) | — |
| First call: hero, word board, one-tap ticket, verdict, auto-pay after 300 s, claim-all, cash-out | S5 (auto-pay at the boundary + 10 s instead of 300 s) | — |
| Accounts: one ceremony → faucet → arm one-tap; wallet key $25/day | S5 (Mera + SessionGrant D-267) | — |
| Trading Balance (EventVault grants) | S2 SessionGrants (caps) — no separate custody balance; the wallet is the balance | — |
| Earn (MarketMakerVault) | S7 Earn (supply to the shared pool at epochs) | — |
| Specialist tickets: Parlay, Range, Moonshot, Boost, Private desk, Surface | S7 Range/Moonshot · S8 Parlay/Boost · Surface S8 · Private desk → Canton-only privacy (no) | — |
| Agents/calls (registry, ERC-8004 IDs, copy/fade, runner, Memory Market) | S8b (MPP is Tempo-only) | — |
| Trade from X | S8b (needs an X account) | — |
| Games (hub, Practice, Lucky, Line Rider, Candle Hop, Duel + season pool, rank) | S8 | — |
| Social & assistant (Sensei, rooms, takes, alerts, reels, profiles, moderation, deletion, season league) | S8 / S8b | — |
| Proof & analytics (/stats, /status, leaderboard, edge, badges, /proof reverify, news, share cards) | S7 Proof · S8 stats · S6/S10 status | — |
| Bridge (Robinhood → Tempo, LayerZero) | Tempo/Robinhood-only → n/a | — |
| Stock trading (Uniswap v4 pools, guard hook) | Out of scope after the pivot (no spot trading); needs the user's decision to revisit | — |
| Themes (agent-run baskets) | S7 baskets (no agent) · S8b agent | — |
| Launchpads (stablecoin, memecoin) | Out of scope after the pivot; needs the user's decision | — |
| Shell S22 (rail, Everything drawer, Sound & Vibration, privacy) | S6 web · S5 phone | — |
| Terminal S23 (designed, unbuilt) | S5/S6 (Owarine terminal is the source) | — |
| Exits with the app closed S24 (D-193) | S8 | — |
