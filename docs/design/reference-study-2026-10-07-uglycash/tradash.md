# Tradash behavior and sound study — 7 October 2026

**UGLYCASH owns Senryo's visual identity; Tradash supplies the live trading behavior reference.** Preserve Senryo's name/seal/card art, use the supplied UGLYCASH background/color/type/composition rules, and translate Tradash's chart, position feedback and sound into the real Senryo market model. This is research and a proposed native implementation contract.

Later user clarification: BTC/ETH predictions must complete inside the native app. Existing providers are one route; an original Monad-testnet contract with test MON is an accepted fallback if they cannot deliver it. Follow the [native execution amendment](../../plan/uglycash-revamp-2026-10-07.md#prediction-execution-amendment--native-app-and-owned-monad-fallback), including oracle, liquidity/early-exit and separate Mainnet readiness. No website migration or required provider trading-page handoff.

## Evidence and authority

| Evidence | What was inspected | Limit |
|---|---|---|
| Live [Tradash](https://www.tradash.xyz/trade/BTC) | Public landing, five-step tutorial's first two steps, phone workspace at **390 × 844**, account/settings sheets, Sound effects/Haptics/Trade reactions/Background music controls; actual displayed BTC price changed between observations | No sign-in, account creation, deposit or order. No latency/fill/audio-on-device measurement; don't infer a guaranteed event rate from screenshots |
| Sibling study | `/Users/abu/dev/hackathon/canton-season3/context/13-revamp/TRADASH-FIDELITY.md` and `tradash/{LIVE-observations.md,SPEC-chart.md,SPEC-flow.md,SOUND-analysis.txt}` | User typed `caton-season3`; actual directory is `canton-season3`. Other chat instructions/decisions apply to Owarine, not automatically to Senryo |
| Shipped public bundle retained by sibling | Directly inspected price subscription, interpolation/frame sampling, demo open branch and sound module in the files below | Compiled output, not an upstream licensed source repository; do not copy code/art/MP3s into Senryo |
| Sibling implementation | `/Users/abu/dev/hackathon/owarine`, observed HEAD `22d29ff2`; live exit/PnL, chart engine, websocket feed and chart-feedback source | Confirms incorporation in source, not Senryo compatibility or Owarine native/device readiness. No sibling files changed or tests run |
| Senryo | Shared predictions schema/query/API; EngineSocket/PriceStore/market hooks; mobile OutcomeChart/MarketChart and feedback service | Planning source audit and public read checks, not all-device acceptance |

Inspected Tradash bundle root: `/tmp/claude-501/-Users-abu-dev-hackathon-canton-season3/a73f3fbd-3ab0-44ab-aa95-ffbcfbf6e6f1/scratchpad/tradash/`. These temporary files may disappear; the sibling specs retain the detailed provenance/line maps. Raw bundle SHA-256:

| File | SHA-256 |
|---|---|
| `js/1ajlb01q0ta5l.js` — chart/feed | `1919a278b2bac06446df0d9f34b2086dc8449a9e698cd71e5c3f6b628f41aa16` |
| `js/1-glruyr--bvu.js` — trade/sheets | `bfee8df0528d1258d4fb38b57614fadb5e5965f16a888bec44acd1789cfc58ad` |
| `js/1czbf01g7irmg.js` — includes sound module 722153 | `6fa0a48300a3a513508d4094866d5f8e746d4d5a61519b9deb731c57810c0f80` |

Directly read pretty-printed ranges: chart `12578–12625`, `13385–13485`, `14070–14155`; trade `16417–16464`; sound module `pretty/sound.js` initialization/playback/pitch/close branch. Other precise reaction/candle/sheet measurements below are **reported by the sibling spec**, not independently remeasured end to end in this turn. Conflicting duration estimates in its sound documents are not treated as exact native targets.

## What the reference does

Tradash's tutorial explicitly says UP goes **long**, DOWN goes **short**, opening a **leveraged position**. It is a perpetual trading interface, not evidence of a binary prediction exchange. Its phone chart is the workspace: asset/current price and equity above; compact size/leverage/fee/trailing controls; interval/chart-type/music below; View position and contextual action controls. Account/settings/history live in sheets over that context.

The direct bundle inspection confirms a shared symbol-listener websocket, REST initial mark-price snapshot and 1.5-second reconnect; an eased line approaches the raw tick by **0.18 per rendered frame**. Each frame is appended to a **600-sample** series, prefilling with the first price. The range follows the eased head. The marker uses the latest raw value; a position's PnL sign controls gain/loss color rather than the last tick direction. This creates the glide, rolling-number and living-position feeling the user noticed.

The sibling spec reports entry/break-even/protection tags, gain/loss band, off-screen tags, candle pan/pinch/crosshair/recenter, UP/DOWN changing to TRAIL/CLOSE for an open position, contextual position detail, and separate submitting/confirmed/error feedback. The demo open branch directly confirms immediate local position creation and open sound/haptic. Demo behavior is not live execution evidence.

Audio is event-based. Direct code shows distinct tap/open/close/win/loss/profit clips; predecoded WebAudio buffers; per-cue gain; pitched favorable steps on a major-pentatonic ladder; a short descending adverse cue; separate surge/slump synthesis; win/loss selected from realized PnL. The live settings expose independent effects, haptics and reaction toggles, plus music (off in the observed session). The sibling reports cooldowns and optional background loops. We have not listened to or accepted this behavior on a physical phone.

## Senryo translation

| Reference behavior | Senryo contract | Classification |
|---|---|---|
| Chart dominates the trading workspace; compact floating controls and sheets preserve context | Focused instrument/position mode inside Trade/Predict; UGLYCASH surfaces/type/colors; dock gives way to transaction controls only in that mode | Adapted |
| UP/DOWN leveraged execution | Pairs/perps use actual long/short/margin/risk contracts. Binary markets show the provider's actual Up/Down or Yes/No shares. Numeric contests accept a price prediction, not an invented Down share | Adapted |
| TRAIL/CLOSE morph | Show real pair protection/close controls; binary exit only when venue position/quotes support it. Trailing automation needs a reliable server/provider contract, persisted authority and recovery before offering it | Dependency-bound |
| Smooth moving head/current marker; rolling values | Native Skia/Reanimated, raw values for numerical decisions, time-corrected easing only for presentation | Adapted |
| Entry/profit band/liquidation tags | Use actual entry/mark/risk for pairs. Predictions distinguish underlying reference/strike, outcome price and executable exit value; no liquidation line or leverage implied for an ordinary binary share | Adapted |
| One-tap demo fills, direct live action | Preserve Senryo review/passkey/limits/journal. Any future faster trading needs explicit bounded authorization and execution design; this plan does not remove review gates | Adapted |
| Tick reactions and outcome audio | Owned cues, optional rate-limited live-position reactions, genuine fill/settlement events exactly once; existing mute/silent/background settings | Adapted |
| Dark lime visual system | Use UGLYCASH light/white/black/neon magenta, sky/profile scenes and semantic gain/loss colors | Superseded by user |
| Prefilled flat synthetic history/frame-count time | Draw real timestamped history and leave unobserved space empty; fixed time window unaffected by 60/120 Hz | Adapted for data truth |

The sibling Owarine implementation is useful precedent for frame-time correction, shared feeds and exit-value PnL. Its fair-price model, Canton contracts, slippage default, one-tap authority, trail implementation, live valuation and branding are not Senryo requirements. Reuse an independently compatible pure helper only after provenance and tests; do not import web DOM/canvas or Canton trading code into the native app.

## Real-time architecture proposal

1. **Reuse the existing engine infrastructure.** Senryo already has one EngineSocket per query environment, schema-validated prices, account invalidations, reconnect/backoff/ping and a frame-conflated PriceStore. Trace focus/network/account cleanup and source-age reporting before extending it. Do not create a socket per card or replace functioning pair reads wholesale.
2. **Prediction market stream adapter.** The current 20-second REST queries remain discovery/history and fallback. Add a provider-scoped, reference-counted public subscription for the visible outcome IDs; normalize snapshot, book/top-of-book/last-trade, tick-size and lifecycle updates. Use actual provider/market/outcome identifiers, independent of selected money mode. Route through the existing API websocket/fan-out boundary where compatible; settle direct-versus-proxy transport after verifying current provider limits/protocol. Public subscriptions do not supply authenticated order/position truth.
3. **Verify today's provider protocol first.** Current official [Polymarket real-time documentation](https://docs.polymarket.com/market-data/realtime-data) describes market feeds and outcome identifiers; [migration guidance](https://docs.polymarket.com/) links current SDK/protocol changes. Match the deployed venue/market version and existing token IDs before choosing wire messages. Don't blindly paste an older CLOB/RTDS websocket example. Castora needs its own verified contract/block/event lifecycle adapter, with honest polling where no streaming source exists.
4. **Keep four data authorities distinct.** Underlying live display price; provider's named resolution source/boundary print; outcome share price/order book; authenticated executable order/position/exit/settlement facts. Label the selected chart/units and source. A Binance/Coinbase display line cannot establish another oracle's final outcome. A 0–100% share-price history cannot be relabelled BTC/USD. Do not infer a winner because price approaches 100%.
5. **Freshness and reconnect.** Track source event time, receipt time, connection state and last verified snapshot separately, with a clock that changes stale state even when no tick arrives. Ignore out-of-order/duplicate events using provider-supported IDs/hash/time/version; do not invent sequence fields. Reconnect with jitter/backoff, obtain a fresh snapshot, then resume deltas. Pause/reduce background subscriptions, refetch on foreground, and expose stale/unavailable/closed-session states. A newly received old observation is not fresh.
6. **Chart model.** Bounded timestamped ring buffer, real initial history, explicit short Live window separate from historical period. Frame-time-based interpolation (starting reference tau about 84 ms, tuned on phones); no invented tick values, cubic overshoot across probability bounds or 120-Hz speedup. Skia and Reanimated are already dependencies. Keep animation outside React's per-frame reconciliation; publish retained latest values at a bounded cadence without dropping the final update. Accessible value text remains stable and not announced at tick frequency.
7. **Prediction lifecycle.** Upcoming → open → closed/locked → resolving → resolved/disputed → claimable/claimed where supported; preserve the selected contract and outstanding operation when a 5m/15m round rolls over. Offer the next round explicitly, never silently substitute its ID beneath a held position or signed review. Countdown uses authoritative timestamps; gaps/history/data-unavailable remain visible.
8. **Trading continuation.** Deliver live read-only chart fidelity first; then provider account/network/eligibility, quote depth/fees/minimum/tick/slippage/expiry, order sign/submit/partial fill/cancel/reject, holdings, sell/reduce, settlement/claim and durable recovery. Use spendable/exit value rather than multiplying underlying price change by binary stake. Preserve Decimal/BigInt calculations and don't double-count PnL in equity.

## Native sound and feedback contract

Reuse `apps/mobile/src/feedback/{fire,sound,haptics}.ts` and settings. Its owned cues already preload and respect the silent switch (`playsInSilentMode: false`), mixing and foreground. Extend the event vocabulary deliberately rather than installing another sound engine.

| Event | Proposed feedback | Acceptance |
|---|---|---|
| User presses a control | Existing press/haptic; restrained optional owned tap where useful | No navigation soundtrack; no double feedback from parent/child |
| Reviewed order submitting | Visual pending state | No fill or win sound yet |
| Confirmed open/add fill | Short owned open/fill cue and success haptic | Deduplicate by operation/fill identity across REST, socket, foreground and relaunch |
| Confirmed reduce/close | Owned close cue; gain/loss variant only from actual realized net result | Partial fill vs completed close distinguished; 0/unknown not falsely called a win |
| Optional live-position movement | Restrained favorable/adverse/threshold cue, bounded cadence/cooldown and max concurrency | Only new fresh observations for an actual position; no cold-start/reconnect backlog playback, muted/stale/background silence |
| Locked/resolving/settled/claim | Quiet state transition; final cue when actual facts arrive | Resolution is not claim delivery; claim success only after confirmed receipt |
| Optional music | Separate opt-in from sound effects | Owned licensed loop; interruption/focus/background handling, never mandatory |

Keep persisted user choices; effects/haptics currently default on. Provide previews and separate movement-reaction preference. Gain/loss color and audio never replace signed amounts/state labels. Reduced Motion disables rolling travel/callouts; visual interaction works without hearing or haptics. Record licensed owned assets and listen on actual iOS/Android devices with silent mode, headphones, other audio and interruptions.

## Review and performance gates

Compare phone layout at 390 × 844 and 393 × 852 with the UGLYCASH art/surface system. Record a short real-feed trace and playback for deterministic comparison; prove identical time span/easing at 60/120 Hz, bounded memory, responsive pan/pinch/Back and no entire-page React renders per tick. Target 60 fps on the representative phone (frame budget 16.7 ms), measure actual chart/main-thread costs and battery/thermal behavior over a sustained session; these are targets, not observed results.

Test initial/no history, zero liquidity, missing outcome ID, tick-size change, malformed/duplicate/out-of-order data, disconnect/stale/foreground, network/account changes, provider restart, round rollover while viewing/holding/reviewing, partial fills, cancel/unknown recovery and resolved/disputed/claim states. Phone audio/fill/provider acceptance remains separate from compilation and chart animation.
