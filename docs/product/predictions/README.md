# Senryo prediction market — product how-tree (8 Oct 2026)

> **Source of truth for flows.** Decisions are D-256…D-272. Every screen is built from this file plus the reference evidence.
>
> **Still to write:**
> - `surfaces.md` (before → after → why for every screen) in S5 for the phone and in S6 for the web.
> - `trace.md`: every capability has an entry point, and every element maps to a capability. This is a gate at the end of S6.


**Promise:** *Call the next move on any price: Up or Down, live, in dollars, with one tap.*

**Personas**
1. **Curious newcomer** (judge, friend): first launch → Practice → first call in under 30 s → win or lose → shares.
2. **Crypto native** with funds on another chain: Real → Add money from Solana or Base through Aurora → calls → withdraws.
3. **Stock watcher:** opens TSLA at 9:30 ET → 5m calls → notifications when the market opens.
4. **Grinder:** many 1m calls, streaks, leaderboard, cash-out timing.
5. **Earner:** supplies USDC to the pool and watches the epoch PnL.
6. **Web visitor:** no install, passkey or wallet, same loop on desktop.

**Objects and identity**
- Market: a feed mark (from `packages/identity`).
- Window: market + cadence + start; open K and close; countdown.
- Call (position): band, stake, shares, entry, cash-out value, status.
- Balance: Practice Test USD / Real USDC.
- Deposit: method, source chain/asset (chain and token marks), status.
- Withdrawal: destination, status.
- Pool share.
- Session: caps, time left.
- Person: handle, avatar, stats.
- Proof: open and close prints, transactions.
- Notification.

**Verbs × objects**, with the symmetry rule: every verb works in Practice and Real, on mobile and on web, unless a reason is named.

| Object | Verbs |
|---|---|
| Market | browse, search, star, alert-on-open, share link |
| Window | watch, call Up / Down / Range / Moonshot, see crowd split, see proof |
| Call | cash out (full or partial), share, see receipt, see in history |
| Balance | add (Practice: grant; Real: Aurora any-chain / Monad USDC / Pay with MON), withdraw (Monad address; another chain through Aurora, if supported), see activity |
| Session | turn on, see caps, extend (Face ID), end |
| Pool | supply, withdraw, see epochs |
| Person | follow, see calls (opt-in), invite |

Gaps with named reasons:
- ✗ card buy: no on-ramp at launch.
- ✗ Real withdraw to a non-EVM chain: only if Aurora supports withdrawals.
- ✗ MON market on testnet: no entitled feed.

### Deposit ("Add money"): UGLYCASH flow 11221 + Fuse 8743/8732 + Phantom 3703 + Polymarket "Transfer crypto"

**Aurora facts** (checked live on 8 Oct; full notes are in the session scratchpad `deposit/NOTES.md` and are copied to `docs/research/pivot/aurora.md` in S0).

- **Arrival times and minimums** (dry quotes into Monad USDC):

  | From | Arrives in | Minimum / note |
  |---|---|---|
  | Solana | 22 s | |
  | Arbitrum | 27 s | |
  | Base | 37 s | 0.15 USDC |
  | Ethereum | 47 s | 0.30 USDC fee |
  | BTC | about 13.5 min | |
  | BNB Chain | | $1,000 temporarily |
  | Tron | | $100 temporarily |

  Fees are about 2 bps on stablecoins plus ours (0–500 bps, split 60/40 in our favour).
- **APIs:**
  - Swap and Deposits: `intents-api.aurora.dev`, with the key in the URL path.
  - Connect: `intents-connect-api.aurora.dev`, with the `x-api-key` header; SDK `@aurora-is-near/intents-connect@7.25.1`.
  - Rate limit: 100 per 10 s and 2,000 per hour, per key and endpoint.
  - No webhooks and no testnet.
- **Permanent per-user address:** `POST /api/persistent-deposit-address/{key}`, with recipient = **the user's Mera address**. That choice is fixed for good, because changing it changes every address. One address serves all EVM chains.
  - The docs contradict each other on whether Aurora must approve the account (403 otherwise).
  - **Fallback:** a one-time Swap quote address (`FLEX_INPUT` plus a deadline). `refundTo` is the Mera address for EVM sources; for non-EVM sources the user is asked for a refund address.
- **One provider (cleanup rule):** Aurora replaces Relay's deposit addresses. Relay's keyless tracking also retires on 24 Nov. The CCTP, Across and LI.FI routes are deleted.
- **Bug to fix when porting:** the incident parser must read `scopeType` / `scopeValue`.
- **Arrival signal:** primarily **our own watch** of USDC `Transfer` to the user's address. Only while a deposit is pending: `getLogs` filtered by topic from the API, finalized blocks. Aurora status is a secondary check: every 5 s while the sheet is open, every 30 s while pending, stopping on success.

**Entry points**
- Balance tap on Home.
- The "+" in the dock fan.
- The empty state ("Add money to make a call").
- The Up/Down button when funds are short (a sheet with the shortfall pre-filled).
- ⌘K "deposit".
- A deep link.

**Practice sheet**
- One hero: **Get test dollars**. The grant is automatic at sign-up; a top-up is allowed once a day.
- Second: Receive Test USD (QR).
- The Real methods stay visible, locked with "Real money only".
- "From any chain" shows a **live read-only Aurora quote** ("From Base, 50 USDC arrives as ≈ 49.88 in ≈ 37 s") and a **Switch to Real** button. There's no fake deposit and no simulated arrival.

**Real sheet: "Add money"**
- Dotted-texture sheet with a triangle of three methods, plus Activity:
  - **Any chain** (Aurora): "Send from Solana, Base, Bitcoin… lands as USDC";
  - **USDC on Monad**: your address, QR, copy;
  - **Pay with MON**: converts in the same tap.
- **Any chain**, step by step:
  1. **Send from:** a chain grid with marks, minimum and ETA, sorted by speed. For EVM chains we read the user's own address there and pre-select it ("You have 42 USDC on Base").
  2. **Asset:** "N assets supported".
  3. **Amount** (optional): a server-side dry quote shows *you send*, *you get at least*, the fees and "≈ 37 s".
  4. **Address:**
     - "Sending from **Base** · **USDC**", the permanent address, a dotted QR with the chain mark, Copy and Share;
     - **Transfer requirements** directly underneath: send only USDC from Base, the minimum, and that another token or network may lose funds;
     - Stellar shows its memo.
  5. **Live status strip:**
     - Waiting (with an optional "paste tx hash", which goes to `/deposit/submit` to speed things up);
     - Seen on Base (explorer link);
     - Moving to Monad · ≈ 30 s left (countdown);
     - Arrived +$49.89.
     - It survives the app being killed (server-held).
  6. **Arrival:** sound, haptic, balance count-up, a push notification, an Activity row.
  7. **Receipt:** both transactions, the route ("Aurora Intents"), fees, times, the address, and "Get help" pre-filled for Aurora support.
- **"Place this when it lands"** (Intents Connect, web only during judging, because it needs an external source wallet through AppKit; the phone gets it after judging, D-270):
  - The user picks market, side, stake and worst price; Mera signs an EIP-712 order.
  - On arrival, Aurora's intermediary calls `approve` + `BandReserve.depositAndCommit(amount, order, sig)`.
  - **This never reverts.** If the window is closed or the price is past the limit, the funds go to the user's wallet and the screen says "Added · call skipped".
  - The order targets "the next open window of this market", because delivery takes 20–50 s and windows roll.
  - Aurora pays the Monad gas.
  - A failed execution offers Retry or Withdraw.
- **What if:**
  - below the minimum → a named refund to the source address;
  - wrong network → explained before copying, with the network stated inline;
  - stuck → "Taking longer than usual", with support details;
  - refunded → a receipt.
- **After:** balance odometer +$x, push notification "Your $20 arrived", an Activity row, and a receipt with both chains' transaction links.

### Other journeys

**Onboarding**
1. Six-scene story (new copy).
2. Passkey (one Face ID).
3. `$handle`.
4. Terms.
5. Test dollars granted, with a sound.
6. **"Try your first call"** in the live terminal on BTC 1m.
7. "Turn on one-tap calls" (the session grant).
8. Notifications.

Mera's target: confirmed transaction in ≤ 3 taps after the passkey.

**Call**
1. Pick market and window.
2. Choose an amount: last stake remembered; presets $1 / 5 / 10 / 25 / Max, or the keypad.
3. Tap UP or DOWN.
4. "Opening…", then filled at the next print (about 2 s).
5. CLOSE appears; live cash-out value.
6. Calls close at −20 s.
7. Result reveal; the payout lands.

**Cash out:** one tap on CLOSE; a partial close with a long-press (25 / 50 / 100%); the receipt shows entry → exit.

**Withdraw** (Polymarket pattern): recipient (paste, scan, saved address, or `$handle`) · receive chain · receive token · amount + Max → "You'll receive ≥ X · ≈ 22 s · fee Y" → Face ID → status → receipt.
- **To a Monad address:** Face ID signs an **EIP-3009 `transferWithAuthorization`** (verified on Monad USDC) and the relayer submits it, so no MON is needed. Contract addresses and exchanges get a warning ("make sure your exchange supports USDC on Monad").
- **To another chain:** an Aurora Swap quote created only at confirm time (`EXACT_INPUT`, `refundTo` = the Mera address on Monad). Then a 3009 transfer to the quote's address and status polling until done. A fee above 2% gets a warning.

**Earn:** supply or withdraw at the next epoch; shows reserved vs liquid, epoch PnL and risk in words.

**Session:** chip "One-tap on · 12 min · $76 left" → when it expires, the next tap asks for one Face ID; settings for caps and length.

**Proof:** for every window, the open and close Pyth prints (publish time, confidence), the settle transaction, every call in it, and a "re-verify" button.

### Live-market craft list (not spelled out by the user, all in scope)

**Countdown and time**
- **Countdown ring** on every window chip and on the terminal header; a tick sound and haptic in the last 10 s.
- **Lockout state** at −20 s: "Calls closed · settles in 0:20".
- **Server-time sync**: SSE heartbeats carry server time, and the client keeps an offset. Countdowns never trust the phone clock.
- **Auto-roll** to the next window when one locks; staggered lanes so one is always open; "Next opens in 0:12".

**Chart**
- **The line (K)** on the chart with the open price, your entry marker, a shaded win zone, distance to the line in $ and %.
- The chart tint flips green or red with *your* side, never with tick direction.
- **Odometers** (rolling digits) for price, cash-out value and balance. No re-render per tick outside them.

**Results and payouts**
- **Result reveal**: the line freezes, a stamp shows the close price.
  - Win: confetti, coin sound, success haptic, payout count-up.
  - Loss: a soft thud.
  - Tie: "Refunded".
- **Payout landing**: a "+$9.60" chip on the balance, "pending" until the receipt arrives.

**Social**
- **Crowd split**: "62% called Up", from the indexer, live.
- **Recent calls** ticker: "@kai · Up · $5 · 2s".
- **Streaks**: win streak and daily streak.
- **Share card**: chart, call and result as an image for X; deep link `senryo.xyz/m/BTC-5m`.

**Market information**
- **Volatility hint**: "Typical 5m move ±$45" (σ√τ in dollars).
- **Odds in words**: "pays 1.92× · about 52%".
- **Stock hours**: a "Closed · opens 9:30 ET (2h 14m)" badge plus "Notify me".

**Honest states**
- **Reconnecting**: the price is marked stale and UP/DOWN are disabled. Never trade on a stale price.
- **Source paused**: "Paused, price source unavailable" (for example the Pyth key). Open calls still settle or void correctly.
- **Missed print**: "Refunded, the price source missed the moment".

**Modes**
- **Practice**: sky tint and chip.
- **Real**: black chip; the first Real call needs terms and opt-in.

**Settings and access**
- **Sound & Vibration** settings (crypto-world-fair/Owarine shell).
- Reduced motion.
- Colour-blind safe: arrows and words, not colour only.
- VoiceOver labels.

**Navigation**
- **Watchlist**, recents, and ⌘K for markets, people and actions.

**Growth and history**
- **Referral**: an invite link, with bonus *test* dollars in Practice only.
- **History filters**: Won / Lost / Refunded; CSV export.
- **Leaderboards**: Practice and Real kept separate; day / week / all.

**After judging:** iOS Live Activities and widgets, which need a native build (D-270).

**21st.dev starting points** (ported to React Native; provenance goes in `.21st/design.json`; the reference frames decide the look):

| Component | 21st.dev item(s) |
|---|---|
| Countdown ring | `1737` Circle Progress |
| Rolling digits | `20071` Animate Digits |
| Swipe to confirm | `29304` Slide Action Button |
| Keypad | `3711` Number Pad |
| QR | `1706` / `6170` |
| Live chart reference | `28470` Market Chart |
| Confetti | `24692` |
| Toasts | `35703` Notification Stack |
| ⌘K | `33510` Command Menu (cmdk) |
| Sidebar | `29334` Animated Sidebar |
| Sheet | `31360` Drawer (snap points) |

