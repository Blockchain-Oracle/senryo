# S5 — the phone loop (pivot plan "S5 Mobile core loop")

**Goal:** on the existing Senryo app (runtime 0.4.0, over the air only, D-270), a newcomer goes from the story to a
filled BTC 1m call in three taps after the passkey, watches it live, cashes out or gets paid automatically, and finds
it in Calls with its receipt and proof. Practice runs on Monad testnet with Test USD.

**Authority:** `pivot-2026-10-08.md` (S5, how-tree, craft list, stack and budgets), `docs/product/predictions/README.md`,
reference frames (Phantom P14–P18 + M08 prediction frames, Fomo R3 for the look — `docs/design/reference-study-2026-09-30/`),
`docs/design/reference-study-2026-10-07-uglycash/tradash.md` (the live loop and feedback contract), Owarine's terminal
(`~/dev/hackathon/owarine/web/src/features/terminal/`, engine maths) and mobile parts (`owarine/mobile/src/features/markets/`).
Every component: reference evidence → 21st.dev search → React Native port → `.21st/design.json` provenance.

**Gate:** first confirmed call within 3 taps after onboarding (taps and seconds recorded) · the stateless test (wiped
simulator, identity and positions rebuilt from the passkey) · session-expiry experience · zero React renders per tick on
the terminal (profiler) · chart ≤ 2 ms per frame · 1 SSE connection · 0 RPC calls from the app (network log) · `pnpm gate` 0.

## Steps

### Foundations (no UI)
- [x] S5.1 Pricing mirror `@senryo/core/market` (BandMath + quotes, Solady `lnWad` via CWF) — **bit for bit with the
      deployed `quoteOpen` over 7,300 random cases** (`scripts/drive/src/band-quote-check.ts`)
- [x] S5.2 `packages/live`: one SSE client (`expo/fetch` streaming on native, `fetch` on web; opened by the first
      subscriber, kept 5 s across routes, closed after 60 s hidden, `Last-Event-ID`, reseeded from `/v1/prices/recent`),
      server-time offset from `time` frames, per-feed stores (Float64 rings, per-frame batched flush, plain `subscribe`
      for the chart and odometers), user topic via a stream ticket
- [ ] S5.3 `@senryo/query` markets hooks: catalogue (`staleTime: Infinity`), account (balance, allowance, epoch,
      session), calls/history/timeline/stats/leaderboard/window proof, submit intent + status, practice grant, session
      grant/revoke — invalidated by the user's stream events (`ticket`, `intent`, `session`, `dollars`), no polling
- [ ] S5.4 Zero RPC from the app: balance from `/v1/markets/account`; retire `useDollarBalance` RPC polling,
      `useNetworkBalances`, the RPC half of `account-check`, and the app-side sender for markets
- [ ] S5.5 Signing: an open/close intent signed by the session key when a grant is live (no Face ID), else by the
      passkey owner with Face ID; the session grant ("Turn on one-tap calls": caps, length) and revoke; permit for the
      first call's allowance; the account policy allows exactly these typed-data shapes

### Shell and cleanup
- [ ] S5.6 `packages/config/src/nav.ts` (pure data, `iconKey`): dock Home · Markets · [seal = Trade] · Calls · More; the
      More grid; route-coverage check
- [ ] S5.7 Setup order: passkey → handle → terms → test dollars (auto, with sound) → first call → one-tap → notifications;
      fix the broken `follow`/`money` steps; new story copy and art for the six scenes
- [ ] S5.8 Delete what the pivot left: dead `Stack.Screen`s, unused trading modules, stale copy (leverage, liquidation,
      card limits, "trades"), dead storage keys, the liquidation sound, `policyContext` trading fields

### The loop
- [ ] S5.9 Terminal: Skia live chart (Owarine engine as worklets: 600-sample ring, ease 0.18 at 60 Hz, nice grid, one
      reused path, `Picture` dot grid), the line K with entry marker and win zone, countdown ring, odometers on shared
      values, amount (last stake, $1/5/10/25/Max, keypad), quote in words, UP/DOWN → CLOSE (long-press partial),
      lockout at −20 s, auto-roll, result reveal (win/loss/refund), honest states (reconnecting, paused, missed print)
- [ ] S5.10 Markets (BTC/ETH/SOL × 1m/5m/15m/1h with live price, countdown, crowd split) and Home (balance, open calls,
      next windows, Practice chip)
- [ ] S5.11 Calls: open and history (Won/Lost/Refunded filters), the timeline receipt, the window's proof
- [ ] S5.12 Wallet: Practice sheet (Get test dollars, Receive Test USD), Withdraw (EIP-3009 through the relay), Real
      methods visible and locked
- [ ] S5.13 Results and share card, session chip ("One-tap on · 12 min · $76 left"), Sound & Vibration, result pushes

### Acceptance
- [ ] S5.14 Simulator pass per merged area; gate measurements recorded in `acceptance.md`
- [ ] S5.15 OTA to runtime 0.4.0 (production channel); handoff in STATUS

## Handoff
(written at the end of the stage)
