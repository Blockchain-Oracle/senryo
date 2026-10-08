# Senryo product flow book

For current product positioning, implementation boundaries and readiness, start with the [current product brief](current-product.md) and [reference follow-through plan](../plan/reference-followthrough-2026-10-04.md). Senryo is a mobile app; predictions are part of its scope. This flow book retains the comprehensive capability specification. Its 2 October “today” descriptions are historical snapshots, not current acceptance evidence.

The original screen authority (D-237…D-250, 2 Oct 2026) was built with the `product-how-tree` method (`~/.claude/skills/product-how-tree/`): objects × verbs with the symmetry rule, a how-ladder per capability, evidence-backed answers, a surface pass (before → after → why) and a two-way trace. Current approved amendments above take precedence where the implementation direction has changed.

| Page | Covers |
|---|---|
| [a-identity.md](flows/a-identity.md) | A1–A11 first launch, create, sign in, session, switch, recovery, profile, mode, sign out / delete, settings, terms |
| [b-money.md](flows/b-money.md) | B1–B16 any-asset holdings, receive, deposit from other chains, card/bank, swap, send, withdraw, fees, activity |
| [c-trading.md](flows/c-trading.md) | C1–C12 markets, detail, long/short ticket, Perpl, positions, TP/SL, liquidation, orders, alerts, copy a trade |
| [d-earn.md](flows/d-earn.md) | D1–D2 pool deposit / redeem |
| [e-card.md](flows/e-card.md) | E1–E6 Kinpaku card |
| [f-social.md](flows/f-social.md) | F1–F7 people, profiles, follow, feed, mute/block, share |
| [g-system.md](flows/g-system.md) | G1–G7 notifications inbox, deep links, offline/update, accessibility, sound/haptics, web, judge path |
| [routes.md](flows/routes.md) | Live-tested routes: holdings discovery, any↔any swap, bridges, Ramp |

The model, matrices, cross-cutting rules, decision log and surface pass below are copied from the approved plan (Part 0) so they survive outside the session.

## Part 0 — The product, interrogated end to end

### 0.1 The method: new skill `product-how-tree` (created first thing at execution, via `anthropic-skills:skill-creator`)

**Purpose.** Before designing or building, find every gap a user would otherwise have to point out. Use it when:
- planning;
- auditing UX;
- the user says flows feel shallow or inconsistent;
- reviewing a screen against the whole product.

**Steps.**
1. **Promise and personas.** One sentence on what the product lets people do; the personas and their end-to-end journeys.
2. **Objects.** Every noun the user sees, holds or acts on. List **every instance**, with the identity (logo/avatar) it must show.
3. **Verbs.** Every action a user could reasonably expect on each object type: borrow from the references and from what similar products let people do.
4. **Capability matrix (object × verb).** Each cell is ✓ (supported), *route*, or ✗ with a **named reason**.
   - **Symmetry rule:** if a verb works for one instance of a type, it works for **all instances**, in **both modes** and on **web**, unless a named reason is written in the cell.
   - This is the rule that catches "withdraw only dollars".
5. **How-ladder per supported cell.** Ask "how?" through fixed lenses until every answer is concrete:

   | Lens | Question |
   |---|---|
   | Entry | Where does the user start (every entry point)? |
   | Which | Which instances; picker; search; logos; ordering |
   | From → To | Sources and destinations, chains, networks, people |
   | Who / When | Guest, new, locked, unlocked; Practice/Mainnet; geo/KYC; market state |
   | How much | Amount entry, units/fiat toggle, Max, min/max, fees, rates, caps, decimals |
   | How | Steps, confirmation level (slide / Face ID / passkey), what is signed |
   | How long | Instant vs async, ETA, pending, resume after kill |
   | What if | Cancel, failure, unknown outcome, offline, insufficient balance/fees, wrong input, edge instances (spam token, closed market) |
   | After | Result, receipt, Activity, push, inbox, share, reverse/undo |
   | Consistency | Same pattern as its siblings? Cross-links (own ↔ trade)? |
   | Copy & identity | Words (no sentences on primary screens), marks |
6. **Evidence.** Answer each lens from code (file:line), docs or research. Mark the rest `UNDEFINED`. Unknowns become research tasks, not questions for the user.
7. **Decisions.** Settle everything that is product-internal. Ask the user only real scope choices, in plain words, with a recommendation.
8. **Surface pass (the answers change the screens).** List every screen, sheet, dropdown and empty state. For each, ask:
   - Which capabilities enter or happen here?
   - Given the answers, what must it now show and in what order?
   - **What changes vs today (before → after → why)?**
   - What is the layout: hero, sections, actions, child sheets, motion?
   - What are its states and copy?

   The capability answers *always* propagate to the surfaces: a new rule ("any asset") changes Home, the balance, pickers, sheets and login.
9. **Two-way trace.**
   - Every capability card has at least one entry point on some surface.
   - Every element on every surface maps to a capability card.
   - Orphans either way are gaps.
10. **Outputs:**
   - the capability matrix;
   - capability cards (the how-ladder answers);
   - cross-cutting rules;
   - a gaps/bugs list with file:line;
   - the decision log;
   - the flow book files;
   - an acceptance checklist per card.

### 0.2 Promise and personas

**Promise.** Senryo is a phone app on Monad where you:
- sign in with Face ID (no seed phrase);
- hold and move **any** asset;
- trade gold, silver, FX and crypto long or short;
- earn from the trading pool;
- spend with the Kinpaku card;
- follow and learn from other traders.

It offers Practice money to learn and Mainnet for real.

| Persona | Journey |
|---|---|
| P1 New, no crypto (saver who wants gold) | create → practice → buy with card → own gold or trade gold |
| P2 Crypto holder | create → deposit from another chain → swap → trade/Perpl → card |
| P3 Daily trader | open → manage positions → alerts → card spend |
| P4 Earner | deposit to pool → redeem |
| P5 Judge | web/APK → create → practice trade → stateless sign-in → Mainnet Perpl trade |

### 0.3 Objects (every noun, with the identity it shows)

| Object | Instances | Identity |
|---|---|---|
| **Asset** | MON (native).<br>Stablecoins: AUSD (Agora USD), USDC, USDT0.<br>Majors: WBTC, WETH, cbBTC.<br>Yield/LST: shMON, syrupUSDC, mUSD, GHO.<br>Gold: XAUt0 (Tether Gold).<br>Meme tokens (nad.fun).<br>**Any other ERC-20** sent to the address.<br>Practice: test AUSD/USDC, testnet MON. | Real token marks (identity pipeline: web3icons, token list logos, GeckoTerminal). Unknown tokens get a generated monogram + "Unverified". |
| **Chain** | Monad (both networks), plus external chains for deposit/withdraw (§0.8): Ethereum, Base, Arbitrum, Optimism, Polygon, BNB, Solana, Bitcoin, Tron, TON… | Chain marks |
| **Market** (perp) | Engine: XAU, XAG, EUR, GBP, JPY, CHF, CAD; SPY/QQQ (listable); NVDA/TSLA/SPCX/EWY (read-only, B2); Oil (no feed).<br>Perpl: BTC, MON, ETH, SOL, HYPE, ZEC, LIT, VVV, PUMP, NEAR. | Asset mark + leverage badge + venue mark (Senryo/Perpl) |
| **Position** | Engine (one net per market, ≤32); Perpl | Market mark + side tag |
| **Order** | TP, SL (bound to a position instance) | — |
| **Price alert** | Above/below on any market or token | Market mark |
| **Pool share** | Senryo pool (sLP), pending redemptions | Pool mark |
| **Card** | Kinpaku virtual (sandbox in Practice; issuer on Mainnet) | Card art |
| **Card transaction** | Auth/hold, capture, refund, decline | Merchant name (+ category glyph) |
| **Person** | Profiles (handle, avatar, bio, stats), you | Avatar |
| **Post** | Trade event (opened/increased/closed), thesis, reply | Avatar + market mark |
| **Notification** | Fills, TP/SL, liquidation, money arrived, card, alerts, social | Mark of the subject |
| **Destination** | Saved own address/exchange (with exchange mark), bank (Ramp) | Exchange/bank/chain mark |
| **Activity item** | Every movement, trade, card event, social action | Subject mark |
| **Account** | Passkey identity, address, handle, session, mode, settings | Avatar + Monad mark |

### 0.4 Capability matrices (symmetry check)

**Assets × verbs** (✓ = supported; M = Mainnet only, Practice shows a lock + reason at the action; route = §0.8)

| Verb ↓ / Asset → | MON | AUSD / USDC | USDT0 | WBTC / WETH / cbBTC | Yield / LST | XAUt0 gold | Meme | Unknown ERC-20 | Practice assets |
|---|---|---|---|---|---|---|---|---|---|
| See in Holdings + detail page | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ under "Other tokens" (hideable, no price unless one is found) | ✓ |
| Receive on Monad (same single address) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (appears automatically) | ✓ |
| Deposit from another chain | Relay | USDC: CCTP/Relay; AUSD: Relay | Across | swap on arrival (bridge USDC/ETH, then swap) | same | LI.FI/Relay from Ethereum XAUt | ✗ (no bridge; buy here) | ✗ | USDC via CCTP testnet |
| Buy with card/bank (Ramp) | M | M (if listed) | M | ✗ → buy USDC then swap | ✗ → via swap | ✗ → via swap | ✗ → via swap | ✗ | ✗ |
| Swap from / to any other | M | M | M | M | M | M (impact rule) | M | sell only, warned | AUSD↔USDC at par (PracticeSwap, D-252); others locked |
| Send to person/address (Monad) | ✓ (fee reserve kept) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (warned) | ✓ |
| Withdraw to own address/exchange (Monad) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Withdraw to another chain | Relay | CCTP / Relay | Across / LI.FI | composed swap → USDC → route | same | LI.FI → Ethereum XAUt | composed swap → USDC → route | ✗ | USDC via CCTP testnet |
| Sell to bank (Ramp) | M | M | M | ✗ → swap to USDC first, auto | same | same | same | ✗ | ✗ |
| Fund a trade (auto-swap to AUSD) | ✓ | ✓ (direct) | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | P$ direct |
| Fund the card / pool (auto-swap) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | P$ direct; pool: test USDC at par (D-252) |
| Price alert / watch | ✓ | — | — | ✓ | ✓ | ✓ | ✓ | ✗ | — |
| Trade the perp of it (cross-link) | Perpl MON | — | — | Perpl BTC/ETH | — | XAU (engine) | — | — | — |
| Hide / report spam | — | — | — | — | — | — | ✓ | ✓ | — |

**Markets × verbs**

| | Engine OPEN | Engine closed / stale / halted | Read-only (SPY etc.) | Perpl crypto |
|---|---|---|---|---|
| Discover, view, chart, holders, feed, about, share | ✓ | ✓ + state banner | ✓ + reason | ✓ |
| Watch, price alert | ✓ | ✓ | ✓ | ✓ |
| Long / Short | ✓ | ✗ open (reopen time shown); reduce/close ✓ | ✗ (named dependency) | M (Perpl) |
| Own the underlying (cross-link) | XAU → XAUt0 | same | — | BTC/ETH/MON tokens |
| Post a thesis about it | ✓ | ✓ | ✓ | ✓ |

**Other objects × verbs (all ✓ unless noted)**
- **Position:**
  - view, add, reduce (25/50/75/100), close;
  - TP/SL set / edit (replace) / cancel;
  - share;
  - liquidation warnings;
  - history.

  Perpl positions: the same set, except TP/SL via Path A later; until then the cell reads "TP/SL on Perpl soon".
- **Pool:** deposit (from any asset), request redeem, claim, history.
- **Card:** get, fund (any asset → auto-swap), set limit, freeze/unfreeze, reveal, Add to Wallet (✗ Apple entitlement, named), pay or simulate, activity, repay debt.
- **Person:** find (search, leaderboard, recommended, holders, feed), view, follow, send money, trade this (copy a trade), mute, block, report, share.
- **Post:** read, like, reply, share, report, delete own, compose (listed profiles).
- **Account:** create, sign in, unlock/lock, switch account, recover, backup passkey, export phrase, edit profile, visibility per mode, mode switch, sign out, delete data.
- **Notification:** receive, inbox, tap through, mark read, per-channel settings.
- **Destination:** save, name, reuse, delete.
- **Activity:** list, filter, receipt, share, explorer.

### 0.5 Cross-cutting rules (the patterns the user keeps catching, now written down)

1. **Any holding, any action.** Every asset picker lists *all* holdings with marks, balances and search. Actions that can't apply to an asset show it disabled with ≤4 words why ("No bridge for this token").
2. **Any amount.** Exact entry, units ↔ $ toggle, Max (net of the fee reserve), available + locked, each with the path to free it ("P$300 in open trades ›").
3. **Any destination.**
   - People: @handle, following, recents.
   - Address: paste, **scan QR**.
   - Saved own destinations: exchange marks.
   - The chain picker is **filtered to routes valid for the chosen asset**, each with chain mark, fee, ETA and minimum.
4. **One intent, one confirmation.** If the user lacks the right asset or place, the operation composes steps: swap → move → act. Details lists the steps; the journal tracks each (`packages/query/src/operations.ts`).
5. **Every money action:** review → slide (+ Face ID / passkey per policy) → status → receipt → Activity row → push if async. Unknown outcomes are never duplicated.
6. **Every list item opens a detail; every detail has an actions row.**
   - Own ↔ trade cross-links: Gold token ↔ XAU perp; MON/BTC/ETH token ↔ Perpl perp.
   - Person ↔ their positions ↔ markets.
7. **Real identity everywhere.** Every asset, chain, venue, provider, exchange and person shows its mark; unknown tokens show a monogram + "Unverified". No dots.
8. **Practice parity.** Every flow exists in Practice with P$. Routes that exist only on Mainnet show the same screen with a lock at the action.
9. **Every screen has four states:** loading skeleton (never a fake $0), empty with a next action, error with reason + action, offline.
10. **Everything async is trackable:** pending Activity row, push, inbox entry, resume after kill.
11. **Confirmation levels are stated:**
    - slide for every money action;
    - Face ID per the session policy;
    - passkey step-up for sends to others, approvals, swaps, security changes, over-cap trades.
12. **Web parity** follows mobile (same capability cards).

### 0.6 Capability cards (how-ladder answers; full steps, copy and states go to `docs/product/flows/*.md`)

#### A. Identity and access

**A1 — Look around before an account**
- **How:** Welcome → Browse.
- **Rules:** Markets, details, feed, profiles and leaderboard are open to guests.
- **What if:** any action opens the account sheet (Create / Sign in / Keep browsing), then **resumes the original action**.
- **Gap:** create from the sheet skips setup (`account-required.tsx:21`).

**A2 — Create account**
- **How:** Create → one passkey → address → setup steps:
  1. handle, with explicit per-mode visibility;
  2. follow traders;
  3. Practice money (P) / Buy with card (M);
  4. terms;
  5. Face ID primer;
  6. notifications primer;
  7. Home with a first-action card.
- **Rules:**
  - Handle: `[a-z0-9_]{4,20}`; taken, reserved and blocked words each get their own copy.
  - One address on both modes; Practice public on by default, Mainnet off.
- **What if:**
  - Cancel: silent; welcome is not marked complete.
  - No PRF / unsupported device: open on the web.
  - Orphaned passkey: "I already have an account".
  - App killed mid-setup: setup resumes.
- **Gaps:**
  - welcome is marked complete before the passkey succeeds;
  - a kill skips setup (`welcome.tsx:28`);
  - visibility is silent (`handle.tsx:78`);
  - reserved names show "taken".

**A3 — Sign in**
- **How:**
  - Same phone: "Continue as @handle" (Face ID).
  - New phone or reinstall: "I have an account" → passkey picker → "Signed in as @handle".
- **Rules:** stateless rebuild of everything (skeletons, never $0).
- **What if:**
  - The passkey opens an empty, different account: warn and offer the other passkey.
  - No profile: offer a handle.
  - Terms not accepted: gate.
- **Gaps:** the backup-passkey trap; no warning.

**A4 — Unlock / lock**
- **How:** the first signing action asks for Face ID → the session runs (length 5–60 min, idle 1–15) → it locks on background, idle or timeout.
- **Rules:**
  - Face ID per trade: off in Practice; Mainnet ≥ $50.
  - Over the session cap ($250/trade, $1,000/session): passkey step-up.
- **What if:** Face ID changed → full passkey; the privacy plate shows in the switcher.
- **Gap:** the over-cap step-up is missing (`policy/evaluate.ts:70-81`).

**A5 — Switch account**
- **How:** Session sheet → Another account → passkey → that account becomes active (one active account per phone).
- **What if:** it warns that the other account's hint will replace this one.
- **Gap:** UNDEFINED today; define and build.

**A6 — Recover**
- **How:** Settings → Recovery:
  - passkey sync status;
  - add a backup passkey (native or web hand-off);
  - export 24 words (step-up, capture-blocked, 60 s, no copy).
- **What if:** no sync provider → strong prompt to add a backup.
- **Gap:** no mobile backup passkey.

**A7 — Edit profile**
- **How:** Profile → Edit: avatar (12 portraits), name ≤32, handle (old one held 30 days, 5 changes per 30 days), bio ≤160, visibility per mode.
- **What if:** handle taken; rate-limited.

**A8 — Mode switch**
- **How:** Pill → two rows (Practice P$x / Mainnet $y) → Mainnet confirm (one sentence + slide) → session locks.
- **What if:**
  - Open positions on the other mode are kept.
  - A deep link with the other chainId opens this sheet first.
- **Gap:** verbose notices today.

**A9 — Sign out / delete data**
- **How:**
  - Sign out: confirm.
  - Delete: confirm + step-up → removes server profile, follows, posts, prefs, **alerts, push tokens, vault blobs, inbox watches** and all local keys → results page.
- **What if:** offline → local part done, server part retried.
- **Gaps:** server leftovers; the privacy notice doesn't match.

**A10 — Settings**
- **How:** Profile → gear:
  - Account: Wallet & address, Security (session), Recovery, Mode.
  - Preferences: Appearance, Sounds & haptics (preview), Notifications, Hide balances, Replay welcome.
  - About: Status, Help, Terms, Privacy.
  - Blocked & muted.
  - Delete data; Sign out.
  - Diagnostics via long-press on the version.
- **Rules:** browsing needs no Face ID; loosening a setting needs step-up.
- **Gap:** blocked/muted screen missing.

**A11 — Eligibility / terms**
- **How:** before the first money action, the terms gate (version per address). Before the first Mainnet trade, the region self-check.
- **What if:** a blocked region can still deposit and withdraw own funds; trading is gated.
- **Gap:** terms are never enforced.

#### B. Assets and money

**B1 — See holdings**
- **How:** Home → Assets section, ordered by value: verified tokens with marks, value and 24 h change, then a collapsed "Other tokens" (unverified, hideable).
- **Rules:**
  - **Discovery of any ERC-20 at the address** (route §0.8).
  - Each dollar asset's row folds the trading-account part into its balance ("AUSD 512.00 · 300 in trades").
- **What if:** price unknown → "No price"; the total shows Partial (`≈` + ⓘ).
- **Gap:** only 9 listed tokens are shown; unknown tokens are invisible.

**B2 — Asset detail (any asset)**
- **How:** tap a holding or token.
- **Shows:** mark, price + chart, your balance (wallet / in trades / locked, with reasons), actions row.
- **Actions:** Receive, Send, Swap, Withdraw, Buy (if Ramp lists it), Trade (if a perp exists), Alert, Hide (unverified).
- **Also:** About, this asset's activity.
- **What if:** a read-only token (no route) disables Swap with the reason.
- **Gap:** token pages today are a discovery view with Buy/Sell only.

**B3 — Receive on Monad (any asset)**
- **How:** Plus → Receive, or asset → Receive:
  - asset chips (preselect, any);
  - one wallet QR (dotted, Monad badge), grouped address;
  - Copy / Share / Explorer circles;
  - "Only send on Monad" with the mark.
- **After:** arrival detected → sound + push + Activity; the asset appears in Holdings.
- **What if:**
  - Sent on the wrong chain: explained on the page, with a route to recover where one exists.
  - Spam arrives: lands under Other tokens.
- **Gap:** the inbox address strands tokens, so it's removed from Receive; a single address replaces it.

**B4 — Deposit from another chain**
- **How:** Add money → From another chain → pick asset (marks) → pick source chain (only valid routes, with marks, fee, ETA, min) → quote → deposit address/QR (or connect) → timeline (sent → bridging → arrived) → asset in Holdings.
- **What if:**
  - Below minimum: refund explained.
  - Expired quote: late deposits still count.
  - Refunded or failed: reason + tx refs.
  - App killed: resume.
  - Route degraded: banner.
- **Gap:** placeholder today; route per §0.8 (Aurora / NEAR Intents primary).

**B5 — Buy with card or bank (Ramp)**
- **How:** Add money → Buy with card or bank → asset (Ramp-listed: MON, USDC, AUSD, USDT0) → amount → Ramp widget (KYC/payment) → arrives in the wallet → Activity + push.
- **What if:** cancel; KYC fail; pending; region unsupported; partner key missing → row disabled with that reason.
- **Gap:** not built (D5).

**B6 — Swap any ↔ any**
- **How:** Plus → Swap, or asset → Swap:
  1. pay (any holding) → receive (any verified token, searchable);
  2. flip; amount;
  3. rate, price impact, minimum received, route marks, network fee;
  4. slide + step-up → status.
- **Rules:**
  - Impact over 1% warns; over 5% blocks, showing the max size that stays under it. This generalises the gold cap.
  - The MON fee reserve is kept.
- **What if:** quote moved → re-review; no route → disabled with reason.
- **Gap:** only 9 tokens via Uniswap v4; any↔any needs an aggregator (§0.8).

**B7 — Send any asset to a person or address (Monad)**
- **How:** Plus → Send, profile → Send, or asset → Send:
  1. Recipient: bottom search for @handle / following / recents / paste / **Scan**.
  2. Asset (any holding) + exact amount.
  3. Review: avatar, address, network fee.
  4. Slide + step-up → status → receipt.
- **Rules:**
  - Checksum.
  - A contract recipient warns.
  - Sending to an inbox address is blocked.
  - Sending to yourself redirects to Withdraw.
  - A first-time recipient gets a warning.
  - The handle is re-resolved before broadcast.
- **What if:** locked balance explained with its path; unknown outcome → no new send.
- **Gaps:**
  - AUSD/USDC only today;
  - no scanner;
  - no contract/checksum checks;
  - wrong copy ("shows in Activity", "money stayed in your account").

**B8 — Withdraw any asset to my own address/exchange (Monad)**
- **How:** Home → Withdraw:
  1. Asset (any holding).
  2. Destination: saved / new address (paste, scan; exchange marks such as Coinbase, which supports Monad USDC).
  3. Amount.
  4. Review → slide → status.
- **Rules:** a dollar asset partly held in trades pulls the trading-account part as an automatic step; the locked part is explained.
- **Gap:** today only trading → own wallet.

**B9 — Withdraw any asset to another chain**
- **How:** Withdraw → To another chain → asset → chain (filtered to valid routes for that asset, with marks, fee, ETA, min) → address → quote → slide → timeline.
- **Rules:** an asset with no route offers "Swap to USDC and withdraw" as one composed operation.
- **What if:** refunds, failures, expiry: as in B4.
- **Gap:** placeholder; route per §0.8.

**B10 — Sell to bank (Ramp off-ramp)**
- **How:** Withdraw → To bank → asset (Ramp-sellable; others are auto-swapped first) → amount → Ramp widget (payout details) → the app sends the crypto to Ramp's address inside the same operation → status until payout.
- **What if:** region or method unsupported; KYC.
- **Gap:** not built (D5).

**B11 — Network fees**
- **Rules:**
  - Never called "gas" in the UI.
  - Practice: sponsored (drip/top-up).
  - Mainnet: MON pays fees. Any operation with MON below the reserve prepends "swap ~$0.50 to MON".
  - Max on MON keeps the reserve.
- **Gap:** the Mainnet top-up path can't work on 143; `SwapTicket` has no fee preflight.

**B12 — Activity and receipts**
- **How:** Home → clock → All / Trades / Money / Card → receipt (share, explorer).
- **Rules:** includes **wallet transfers in and out, swaps, bridges, Ramp** (an indexing route is added) and pending journal entries.
- **Gap:** wallet transfers and swaps are not indexed today.

**B13 — Contacts and saved destinations**
- **How:**
  - People = following + recents.
  - Saved destinations: name + address + chain + mark (exchange/bank). Managed in Settings → Wallet.
- **Gap:** none exist today.

**B14 — Spam tokens**
- **Rules:**
  - Unverified tokens sit under Other tokens: no price, no swap-in suggestions, hideable, reportable.
  - Sending them is allowed with a warning.
- **Gap:** new.

**B15 — Practice money**
- **How:** Add money → Get practice money: P$100 claim (once), voucher, daily faucet. **All of it lands where it is usable**, and is routed automatically.
- **Gap:** today the claim credits trading, the pool uses the wallet, and the faucet is hidden on the pool screen.

**B16 — Total and breakdown**
- **How:** tap the hero → Assets / Positions / Earn / Card holds / Card debt (Repay) / Arriving.
- **Rules:** missing sources are listed.

#### C. Trading

**C1 — Discover markets**
- **How:** Markets: Watchlist / Tokens / Perps; chips All / Commodities / FX / Crypto / Equities; search (markets, tokens, people); one dismissible "Go long or short" card.
- **Rules:** read-only rows show a lock; on Mainnet before the deploy, engine rows show "Opening soon".

**C2 — Market detail**
- **How:**
  - Header: mark, ticker, leverage badge, venue.
  - Price, chart (timeframes).
  - Tabs: Holders (Following chip) / Feed / About (description + stats + Technical details).
  - Sticky Short/Long.
  - Header actions: alert, watch, share, history.
  - "Own it" link when the underlying exists (XAU → XAUt0).
- **What if:** closed / stale / halted / holiday banner with reopen time.

**C3 — Open long or short (engine)**
- **How:**
  1. Short (red) or Long (green) opens the ticket on that side; a header toggle flips it.
  2. Ticket:
     - margin hero + leveraged size;
     - leverage ruler (1–10× metals, 20× EUR/GBP/CAD, 10× JPY/CHF);
     - liquidation estimate;
     - Add SL/TP;
     - keypad/chart switch;
     - presets ($10/$50/$100/Max);
     - "Pay with" (buying power; any asset via auto-swap);
     - Details (fee 5 bps, spread, funding/borrow rate, acceptable price ±50 bps, 120 s quote).
  3. First time: a risk explainer, with a short-specific card.
  4. Slide (Face ID per policy, step-up above the cap) → status → position.
- **Rules for a short:**
  - profit when the price falls;
  - liquidation **above** entry;
  - TP below the mark, SL above;
  - shorts receive funding when longs dominate;
  - red rail, "Slide to short".
- **What if — blockers in order:**
  1. offline
  2. region (M)
  3. no account
  4. terms
  5. not enough buying power → Add money / pay with another asset
  6. market closed → reopen time
  7. stale price
  8. leverage clamp
  9. OI/trade cap → max size shown
  10. minimum size ($5 exposure)
  11. **opposite side open → "You're long P$300 · Close it first ›"**
  12. quote moved → re-review
  13. unknown outcome → no resend
- **Gaps:**
  - the over-cap step-up is missing;
  - opposite side surfaces late as "quote changed";
  - funding/borrow rates are never shown before a trade.

**C4 — Open on Perpl (crypto, Mainnet)**
- **How:** the same ticket, venue mark Perpl. The first time, the operation includes:
  - an approve and a ≥10 AUSD account deposit (from any asset, auto-swapped);
  - an IOC order at mark ± slippage;
  - fill confirmed from decoded events at the finalized block.
- **What if:**
  - IOC not filled: "Price moved — nothing opened."
  - Region blocked: read-only.
  - Perpl down: banner.
- **Gap:** not built (D1).

**C5 — Manage a position**
- **How:**
  - PnL hero (coloured by profit, not by price direction);
  - chart with an entry line;
  - stats (size in oz for metals, units for FX; entry; mark; liquidation);
  - funding/borrow breakdown;
  - Add (ticket), Reduce 25/50/75/100 + slide, Close + slide, Share.
- **What if:** a closed market reduces only at the closed spread; a profitable reduce waits 20 blocks; protection failed after open → "Unfinished: add SL".
- **Gap:** FX quantity shows "oz".

**C6 — TP / SL**
- **How:**
  - At open: Add SL/TP sheet (price or %, potential P/L) → placed right after the fill.
  - Later: the position's TP/SL row → set / edit (replace) / cancel.
- **Rules:**
  - Bound to the **position instance**: the keeper skips triggers older than the position's open; closing cancels leftovers.
  - Size follows the position.
  - TP may fill up to 1% worse, SL up to 3%.
- **Gap:** orphan triggers can fire on a later position (`TriggerOrders.sol:49`).

**C7 — Liquidation**
- **How:** warning at ≤1.5× maintenance margin → push + banner "Add money or reduce" → if liquidated: push + post-mortem sheet (price, penalty, what remains).
- **Rules:** the card's holds and debt count against liquidation equity (stated on the card intro).

**C8 — Orders**
- **How:** Profile/Activity → Orders: active TP/SL (edit/cancel) + history (filled, cancelled, expired).
- **Gap:** no history today.

**C9 — Price alerts**
- **How:** bell on any market or token → above/below + % chips → saved → push + inbox → edit/delete.
- **Rules:** 50 per mode.
- **Gap:** no edit; the cap is shared across modes.

**C10 — Watchlist**
- **How:** star on a market or token → Watchlist tab; synced per account (D-232).

**C11 — Copy a trade**
- **How:** feed post or a profile position → "Trade this" → a ticket prefilled with side and leverage; the user picks the amount.

**C12 — Performance**
- **How:** Profile → periods 24h / 7d / 30d / All. Realized PnL, the same as the leaderboard and public profile; the own profile also shows the value chart.

#### D. Earn
- **D1 — Deposit:** Home → Earn → Pool:
  - your investment, APR (last 7 days, with its source), pool value, in use;
  - Deposit from any asset (auto-swap to AUSD);
  - compact disclosures: capital risk, 24 h redeem delay, open-market rule, value can fall;
  - slide → status.
  - What if: cap reached; paused.
- **D2 — Redeem:** request (25/50/100%) → countdown → Claim (only while every market is open; the next window is shown) → AUSD to the wallet.

#### E. Card (Kinpaku)
- **E1 — Get card:**
  - Card tab → intro → Practice: instant Lithic sandbox virtual card; Mainnet: issuer route (KYC) → daily limit ($50–500, 30 days) → ready.
  - What if: KYC pending/failed; issuer unavailable (named).
- **E2 — Spendable and funding:**
  - The hero is "Spendable" (free-to-spend under the limit).
  - "Add funds" from any asset = swap + move into the trading account.
  - "Keep card ready" moves arriving dollars at the next unlock (default on).
- **E3 — Controls:** Freeze / **Unfreeze**, Limit, Details, Wallet circles.
- **E4 — Pay:**
  - Tap, or Simulate in sandbox → decision in ≤2.8 s → hold → push → capture/refund → row.
  - Declines carry their reason: over limit, not enough spendable, frozen, prices paused.
  - Over-capture → card debt → Repay.
- **E5 — Reveal and Wallet:**
  - Reveal: step-up, capture-protected, auto-hide.
  - Add to Wallet: locked; the named dependency is Apple's provisioning entitlement.
- **E6 — Activity:** the card's own transactions; also in Activity → Card.
- **Gaps:**
  - the intro claims cards can't cause liquidation;
  - no issuance, no unfreeze, no debt repay;
  - the card push has no sender.

#### F. Social
- **F1 — Find people:** search, leaderboard (24h/7d/30d/All, realized PnL, floor; "Not ranked"), recommended, holders, feed authors.
- **F2 — Profile:** avatar, name, @handle, bio, follows, stats line, period PnL + chart, positions (if shared), trades.
  - Header: Share / History / Settings (own) or Follow + ⋯ (others).
- **F3 — Follow:** follow/unfollow; followers and following lists.
- **F4 — Feed:**
  - Global / Following; trade events + theses.
  - Like, reply, share, report, delete own.
  - Tap a trade → that market (+ Trade this); tap a thesis → thread.
  - Compose (listed only, 280 characters, optional market).
- **F5 — Mute / block** with a management list in Settings.
- **F6 — Send money** from a profile (B7 with the recipient prefilled).
- **F7 — Share:** trade card image, profile link (fixed `/watch` route with chainId), receipt.

#### G. System
- **G1 — Notifications:**
  - Push channels: TP/SL fills, liquidation warning/event, money arrived (any asset, any route), card, alerts, new follower, replies/likes, followed trader opened (off by default).
  - Inbox (bell, from the keeper ledger + API), mark read, per-channel settings.
  - One retry on failure.
- **G2 — Deep links:** wait through welcome/setup/account; carry the mode.
- **G3 — Offline, update, status, help:**
  - offline banner, stale values marked;
  - OTA on launch; forced update on contract change;
  - status page; FAQ.
- **G4 — Accessibility:** VoiceOver labels, Dynamic Type caps, Reduce Motion, colour + sign.
- **G5 — Sounds and haptics:**
  - Sounds for finalized outcomes, money arrived, welcome.
  - Haptics for tabs, detents, slide, errors.
  - Separate switches; respects the silent switch.
- **G6 — Web:** the same cards (S11b).
- **G7 — Judge path:** guide, watch mode, Practice voucher, Mainnet Perpl.

### 0.7 Decision log (settled now; recorded as D-237…D-250 at execution)

1. **No separate "Cash" bucket.**
   - Every token is an Asset; the trading account is internal, visible only as "in trades / locked" on dollar assets.
   - "Buying power" appears in the ticket.
   - The Home hero is Total.
2. **One Receive address (the wallet) for every asset.** The deposit inbox leaves the user-facing flows.
3. **Symmetry (§0.5) is binding.** Exceptions need a named reason in the matrix.
4. **One intent = one confirmation.** Swap/move steps are composed automatically and listed in Details.
5. **Generic price-impact rule for every swap** (warn >1%, block >5% with the max size). It replaces gold-specific caps.
6. **Practice = full rehearsal with P$.** Mainnet-only routes are locked at the action.
7. **Network fee reserve on Mainnet.** Never the word "gas".
8. **TP/SL are bound to a position instance.**
9. **Opposite side** gets an explicit pre-slide blocker.
10. **Over-cap trades** get a passkey step-up.
11. **Explicit per-mode visibility at setup;** the shared address is stated.
12. **Welcome completes only on success or Browse;** setup is owed from the passkey on.
13. **Card readiness:** auto-move arriving dollars at unlock (default on). Card intro corrected.
14. **Periods unified** to 24h / 7d / 30d / All.
15. **Notifications inbox from the server ledger.**
16. **D-041 reversed:** Ramp buy/sell.
17. **Own gold** = XAUt0 as an ordinary asset (no special flow beyond the cross-link).

### 0.8 Routes (live-tested 2 Oct; this table drives every picker)

**Holdings discovery (B1)**, running server-side in `services/api` (`GET /v1/holdings?chainId`), cached:
- **Primary: Envio HyperSync.** Use `https://143.hypersync.xyz` (testnet `10143.hypersync.xyz`) with the project's existing Envio token. Query ERC-20 `Transfer` logs with the address in topic1/topic2, then read balances, decimals and symbols with `balanceOf`/`decimals`/`symbol` batched through `rpc.monad.xyz`. Native MON via `eth_getBalance`.
- **Fallback: Alchemy Portfolio API** (`assets/tokens/by-address`, `monad-mainnet` / `monad-testnet`). One call; free key, created by me.
- **Verified status and logos:** an address is verified only if it is on the Monad token list (`tokenlist-mainnet.json`, 119 tokens with `logoURI`). Match by **address, never symbol**. Unknown tokens get a GeckoTerminal `image_url` if one exists, otherwise a monogram.
- **Prices:** Alchemy Prices API with GeckoTerminal `simple/networks/monad/token_price` as fallback (about 30 per minute, so cached).
- **Testnet:** balances only; no prices.
- **Spam rules**, given that spam was seen live (fake "WMON" `0x561a…`, SAKURA, JUSTIN):
  - an unverified token gets no price and doesn't count in the Total;
  - it sits in a collapsed "Other tokens" section;
  - a lookalike-symbol warning shows;
  - zero balances are dropped.
- **Wallet activity (B12, built 3 Oct):** the same scan also stores every movement it reads (`wallet_transfers`:
  ERC-20 transfers, WMON wraps, MON by transaction value and, on Mainnet, by internal call from
  `143-traces.hypersync.xyz`). `GET /v1/activity/wallet` folds them per transaction into received / sent / swap rows
  for Activity (`routes.md` §1).

**Any ↔ any swap (B6, plus auto-swap in trade/card/pool funding)**
- **Quotes:** query **Monorail** (`pathfinder.monorail.xyz/v4/quote`, free, 0 bps, buys and sells nad.fun curve tokens) and **KyberSwap** (`aggregator-api.kyberswap.com/monad/api/v1/routes` → `route/build`, free, sells curve tokens only) in parallel. Pick the better minimum output. Both route XAUt0 via PancakeSwap v3 and graduated memes.
- **Send list:** `[approve(router, exactAmount)?, call(tx.to, tx.data, tx.value)]`.
- **Router addresses are pinned in config.** The app rejects calldata aimed at any other `to`.
- **Kept as-is:** the Uniswap v4 Permit2 path for its existing tokens; `@nadfun/sdk` as the last resort for curve buys.
- **Testnet:** no aggregator coverage, so Practice swaps stay on direct contracts: test AUSD ↔ test USDC at par through `PracticeSwap` (D-252); every other pair locks.

**Out of Monad to other chains (B9)** (`services/api` proxies quotes; the app signs the source-chain transaction):

| Asset → | Ethereum / Base / Arbitrum / Optimism / Polygon | BNB | Solana | Tron | Bitcoin / TON |
|---|---|---|---|---|---|
| USDC | **CCTP v2** (Monad domain 15, no fee) · Relay for speed | Across / Relay | CCTP v2 / Relay | Relay → USDT | Relay (verify) |
| USDT0 | Across (via LI.FI, `order=FASTEST`) | Across | Relay / LI.FI | Across USDT | Relay (verify) |
| AUSD | **Relay** (AUSD→AUSD Ethereum, or →USDC) | Relay | Relay | swap → USDC → Relay | swap → USDC → Relay |
| XAUt0 | LI.FI → Relay to Ethereum XAUt | — | — | — | — |
| MON | **Relay** (native or USDC) | Relay | Relay | Relay | Relay |
| Any other token | composed: swap → USDC → route above | | | | |

**Into Monad from other chains (B4):**
- **Relay** from 60 chains (incl. BTC, Solana, Tron, TON) for MON, USDC and AUSD.
- **CCTP v2** for USDC from any CCTP chain.
- **Across** for USDC and USDT.
- **Aurora / NEAR Intents** (persistent deposit addresses, BTC/TON/Tron).

**Aurora status:**
- Aurora's Monad routes are **down right now**: open HOT-bridge incident since 1 Oct (`intents-api.aurora.dev/api/incidents`), and every Monad pair fails. It also has no AUSD or XAUt0.
- **What we build:** the Aurora integration (needed for the $5K bounty) plus an incident watcher. Aurora routes appear automatically when the `chain_all: monad` incident closes. Relay and CCTP carry the product meanwhile.
- **Bounty dependency, stated plainly:** the Aurora live demo needs the incident cleared before the 13 Oct freeze.
- **Testnet:** only CCTP v2 supports 10143. That gives Practice a real USDC cross-chain rehearsal (Sepolia ↔ Monad testnet); the other routes are locked in Practice.

**Card or bank (B5/B10): Ramp.**
- **Assets:** buy and sell MON, USDC, AUSD and USDT0 on Monad, live today. Buy $6.25–$15,000; sell from about $6.68; varies by country.
- **Asset IDs:** `MONAD_*`.
- **Buy:** the hosted page (`app.rampnetwork.com`, `userAddress`, `finalUrl`, `enabledFlows`) opens **without a key**, so buy ships immediately.
- **Sell:** the native off-ramp flow (`useSendCryptoCallback`: Ramp gives asset, amount and its deposit address → the app sends with step-up → returns `txHash`) needs a `hostApiKey` with off-ramp enabled. That key comes **through Ramp support, not self-serve.** I request it through the user's Chrome per their consent. Until then, sell shows "Bank cash-out pending Ramp approval".
- **Unverified points:** the deprecated `swapAsset` parameter (check the replacement); the React Native embed details (`WebView` + `postMessage` vs browser).

### 0.9 Surface pass — every screen, before → after → why

Order and layout are top to bottom. "Why" cites the capability card (§0.6) or rule (§0.5) that forces the change. Visual grammar follows Part A and the Fomo/Phantom/Solflare frames; components come from 21st.dev (Part A0).

#### Welcome and login (A1–A3, A11)

**Story (first launch)**
- **Before:** six scenes with a hitch on swipe; three actions; `welcomed` is set even on a cancelled passkey.
- **After:**
  - The scenes travel with the finger (±2 window, prefetched) with a soft swipe sound per settled scene.
  - A fixed action area: **Create account** (primary), **I have an account** (secondary), "Look around" (text).
- **Why:** A1, A2; the user's swipe-hitch complaint.

**Returning on the same phone**
- **Before:** "Continue · 0x…", "Open Home, locked", "Another account".
- **After:**
  - The user's **avatar + @handle** large; **Continue with Face ID** (primary); "Use another account" (text).
  - The address appears only when there is no handle.
  - Choosing a passkey that opens an empty, different account shows a sheet: "This passkey opens a different account" with *Use it* / *Pick another*.
- **Why:** A3; the backup-passkey trap.

**Sign-in result**
- **Before:** silent.
- **After:** a brief "Signed in as @handle" check moment (sound) → Home with skeletons.
- **Why:** A3.

**Setup**
- **Before:** handle, follow, voucher, terms, Face ID and notifications as plain pages; visibility silent; a kill skips setup.
- **After:** Fomo grammar on every step: Back, centred seal, Skip, title + one line, a progress bar on top.
  1. **Handle:** input with "@", live inline result (available ✓ / taken / reserved / not allowed); below it a **"Show my trades"** row with Practice and Mainnet chips (defaults on and off; ⓘ explains that the address is shared).
  2. **Follow:** Fomo "Follow top traders" list (rank, avatar, 30-day PnL, check).
  3. **Money:** Practice → a big "Get P$100" card with art. Mainnet → the Add-money rows (card/bank, crypto, other chain).
  4. **Terms:** a sheet over Home (Fomo F08) with a checkbox + Continue.
  5. **Face ID primer, notifications primer:** art + one line + Allow / Not now.
  6. **Done:** Home with a first-action card.

  Setup is owed from the moment the passkey succeeds, so it resumes after a kill or a guest-sheet create.
- **Why:** A2, A11; defects 6–7.

**Guest account sheet**
- **Before:** three buttons.
- **After:** a compact sheet: art, "Create an account to trade", Create / I have an account / Keep browsing. On success it **resumes the original action**.
- **Why:** A1.

#### Home and money

**Home**

**Before:**
- seal; history, bell and mode;
- a "Locked" pill;
- "Total portfolio", amount, "Partial · View details";
- Add money / Withdraw;
- "Available to trade", "Card availability";
- a positions list and a pool row.

**After:**
1. **Header:** seal · Activity (clock) · Notifications (bell, with an unread **count badge**, not a dot) · mode pill (Monad mark + "Practice ⌄").
2. **Hero:**
   - Total with the decimals in `text3`; `≈` + ⓘ when partial; a "24h" line only when value history exists, else "— 24h" (Fomo).
   - **Tap → Balance sheet.**
3. **Add money** (primary) · **Withdraw** (secondary). Withdraw opens the **any-asset** withdraw flow.
4. **Weekly Top Trades** strip (Fomo): horizontal cards with avatar, market mark, PnL. Tap → that trader's position.
5. **Underline tabs** **Positions · Assets · Earn**, replacing stacked sections:
   - **Positions:** rows with mark, ticker + side tag + leverage, size · entry, coloured PnL + %. "liq x% away" appears only under 25%. Footer "Orders (n) ›".
   - **Assets:** **every holding**, by value: mark, name, amount; value + 24h %. Dollar assets show their trading part ("512.00 · 300 in trades"). Collapsed "Other tokens (n) ›". Row → Asset detail.
   - **Earn:** pool row (mark, invested, APR); pending redemption with countdown.
6. **Empty states:**
   - Positions: a featured-markets carousel (XAU/XAG/EUR cards + sparkline, "Opening soon" on Mainnet before the deploy).
   - Assets: "Add money" with method marks.
   - Earn: one line + Deposit.

Removed: the Locked pill, "Total portfolio" label, "View details" line, availability rows (buying power lives in the ticket; spendable on the Card tab) and the portfolio chart.

**Why:** B1, B16, rule 1; the user's balance complaints.

**Balance sheet** (the hero's "dropdown")
- **Before:** four paragraphs.
- **After:** a compact sheet with Total, then rows with marks: Assets · Positions (margin + PnL) · Earn · Arriving (bridges/Ramp) · Card holds (−) · Card debt (−) [Repay]. A "Missing price: SAKURA" row when partial. No paragraphs.
- **Why:** B16.

**Asset detail** (new; any asset)
- **Before:** token pages were discovery-only with Buy/Sell; stablecoins had no page.
- **After:**
  - **Header:** mark, name, symbol, verified badge.
  - **Price** + 24h; chart (hidden for stablecoins).
  - **Your balance:** amount + value; breakdown rows for dollar assets (Wallet / In trades / Held by card).
  - **Action circles:** Receive · Send · Swap · Withdraw (+ Buy when Ramp lists it).
  - **Cross-link row:** "Trade XAU with leverage ›", or "Own real gold ›" on XAU.
  - **About:** two lines + more. Activity for this asset.
  - **Unverified:** a banner + Hide.
- **Why:** B2, rules 1 and 6.

**Add money sheet**
- **Before:** voucher/receive/other-chain/swap rows with "Practice money has no value".
- **After:** Fomo "Deposit with" grammar — centred title, rich rows with marks on the right:
  - Practice: **Get practice money** (P$ art; "P$100 · free" / "Claimed · use a code ›").
  - Mainnet: **Card or bank** (Ramp; USDC · AUSD · MON marks).
  - **Crypto on Monad** (Monad mark; "Any token") → Receive.
  - **From an exchange** (Coinbase/Binance marks) → Receive with the exchange tip.
  - **From another chain** (ETH/SOL/BTC/Base marks; "60+ chains") → B4.
  - **Redeem a code.**

  Child panels slide in with Back.
- **Why:** B1–B5, B15.

**Receive**
- **Before:** an asset/inbox toggle, small Copy/Share text buttons, an orange warning.
- **After:** Solflare grammar:
  - "Receive" + a "Monad" network pill with its mark;
  - a dotted QR (particle resolve) with the Monad badge;
  - the address in grouped mono, two rows;
  - **Copy · Share · Explorer** 56 pt circles with labels;
  - one line "Any token on Monad";
  - a link row "Sending from another chain? ›".

  Opened from a flow, it shows a "Waiting" pulse, then the arrival moment (sound).
- **Why:** B3; Receive buttons complaint.

**Withdraw** (full sheet, child steps)
- **Before:** AUSD/USDC segmented control → trading → own wallet, plus prose.
- **After:**
  1. **Asset:** all holdings (marks, amounts, values, search; "300 in trades" noted).
  2. **To:** segmented **Monad · Another chain · Bank**.
     - Monad: saved destinations (exchange marks) + New address (paste / **scan**).
     - Another chain: a grid of chain marks **filtered to valid routes for that asset**, each with fee and ETA.
     - Bank: Ramp.
  3. **Amount:** a hero in asset units ↔ $, keypad, Max, "Available 212 · 300 in trades ›".
  4. **Review:** asset mark → destination mark, you receive, fee, ETA, route mark (Relay/CCTP), **slide**.
  5. **Status:** a cross-chain timeline.
- **Why:** B8–B10, rules 1–3.

**Send**
- **Before:** a dollar-only form; no scanner; wrong copy.
- **After:** Phantom grammar:
  1. **Recipient:** bottom-anchored search "Name, @handle or address" with Paste and **Scan** circles; Recents + Following avatars above.
  2. **Amount:** an asset chip "AUSD ⌄" (any holding), amount hero, keypad, Max.
  3. **Review:** avatar, @handle, short address, amount, fee, **slide** (+ step-up).
  4. **Status:** "Sent" sound, then the receipt.

  Contract, first-time and self recipients are handled inline.
- **Why:** B7.

**Swap**
- **Before:** collateral AUSD↔USDC, or 9-token USDC pairs.
- **After:** Phantom grammar:
  - a "You pay" card (asset chip ⌄, amount, balance, Max) / flip circle / "You receive" card (asset chip ⌄ over all verified tokens, estimate);
  - one line with rate · impact;
  - Details: route marks (Monorail/Kyber), minimum received, fee;
  - keypad; slide.
  - Impact >1% turns amber; >5% blocks, showing the max size.
- **Why:** B6.

**Plus fan**
- **Before:** Send · Receive · Add money · Swap.
- **After:** the same four (Phantom). The labels stay and the motion is kept (the user likes it).
- **Why:** unchanged; it now opens the any-asset flows.

**Activity** (header clock)
- **Before:** indexed trading/inbox events only.
- **After:** full screen with **All · Trades · Money · Card** segmented. Rows: subject mark, verb title ("Sent 20 AUSD to @kai", "Bridged USDC to Base"), time, coloured amount; pending rows with a spinner; tap → receipt sheet (share, explorer).
- **Why:** B12.

**Notifications** (header bell)
- **Before:** the bell opened price alerts.
- **After:** an **inbox** grouped Today / Earlier; rows with the subject mark + one-line title + time; unread rows on a raised fill. Tabs **All · Alerts** (alert management: edit / delete). Settings gear → channels.
- **Why:** G1, C9.

#### Trading

**Markets**
- **Before:** spot-tokens banner, "No practice venue" ×N, oil tagged equities.
- **After:**
  - Watchlist · Tokens · Perps.
  - **Tokens:** all verified Monad tokens (token list, 119) with Trending / Gainers chips.
  - **Perps:** chips All · Commodities · FX · Crypto · Equities.
  - Rows: 40 pt mark, ticker + leverage badge, short name, price + change. Locked rows show a lock symbol only.
  - One dismissible "Go long or short" card; search (Fomo F31).
- **Why:** C1, rule 7.

**Market detail**
- **Before:** an oracle-dot line, a Friends Switch, About as a diagnostics table.
- **After:**
  - **Header:** mark, ticker, badge, venue; Alert · Watch · Share · History circles.
  - Price; chart with timeframes.
  - **Tabs:** Holders ("Following" chip) · Feed · About (2–3 sentences + stats grid + "Technical details" disclosure).
  - An "Own real gold ›" row on XAU.
  - Sticky Short (red) / Long (green); a state banner when not open.
- **Why:** C2, rule 6.

**Ticket**
- **Before:** Long/Short segmented control, a mode chip that opened the money sheet, a Review button, gas copy.
- **After:** Fomo F37:
  - **Header:** mark, ticker, OI; price + "Market"; a small side toggle; non-tappable venue + mode label.
  - Leveraged-size line above the centred margin hero.
  - Ruler; Liquidation · Add SL/TP; keypad/chart switch; presets.
  - A "Buying power P$x · **Pay with AUSD ⌄**" line: any asset, swap included.
  - **Details:** fee, spread, funding/borrow rate, acceptable price.
  - A slide rail in the side's colour: "Slide to short".
  - Inline blockers: opposite side, closed market, over cap → passkey.
- **Why:** C3, C3a, C4.

**Order status**
- **Before:** a 5-stage chain trace + a 9-row table.
- **After:** `OperationStatus`. Pending is a verb + spinner on the rail. Success shows:
  - a check animation and sound;
  - "Short XAU opened";
  - Size / Entry / Liq.;
  - View position + Share;
  - Details (fee, fill, tx).
- **Why:** rule 5, Part A8.

**Position**
- **Before:** stat grid incl. Oracle, a hold-to-close, a TP/SL table.
- **After:**
  - PnL hero (coloured by profit); chart with the entry line.
  - Stat strip: Size (oz / units) · Entry · Mark · Liq.
  - Funding/borrow line.
  - TP/SL row: "Add" → the Fomo F44 sheet (price / %, potential P/L, Clear, Save).
  - Add · Reduce (25/50/75/100) · **Slide to close**; Share.
- **Why:** C5, C6.

**Pool**
- **Before:** paragraphs, a hidden faucet, wallet-only deposits.
- **After:**
  - Hero: your investment with the pool mark; APR chip with its source.
  - Stat strip: Pool value · In use · APR 7d.
  - Deposit / Redeem → keypad sheet with "Pay with" any asset.
  - Compact disclosure rows; pending redemption countdown + Claim window.
- **Why:** D1, D2.

#### Card

**Card tab, unissued**
- **Before:** fake "SENRYO PREVIEW 4242" art, a Sample ledger, prose.
- **After:**
  - Kinpaku art floating with a gentle tilt (no numbers).
  - "Get your Kinpaku card" + one line.
  - **Get card** (Practice: "Instant test card").
- **Why:** E1; defect 10.

**Card tab, issued**
- **Before:** —
- **After:**
  - Art with last4.
  - **Spendable** hero.
  - Circles **Freeze/Unfreeze · Limit · Details · Add funds**.
  - An "Add to Apple Wallet" row with the Wallet mark, locked with its reason.
  - A card-debt banner + Repay when needed.
  - Transactions (merchant, amount, status).
  - Practice: "Simulate a payment".
- **Why:** E2–E6.

#### Social and profile

**Feed**
- **Before:** plain rows, Global/Friends chips.
- **After:** Fomo F15:
  - Global · Following underline tabs.
  - Rows: avatar 40, name + verb tag + time, a position chip (mark, side, size, coloured PnL), text; like · reply · share.
  - "Trade this" on trade posts; a "New activity" pill; a compose button.
- **Why:** F4, C11.

**People**
- **Before:** Friends/Leaderboard chips, empty Recommended.
- **After:**
  - Leaderboard (Fomo: rank, avatar, PnL, period chips).
  - Recommended with blue Follow.
  - Following/Followers entry.
- **Why:** F1, F3.

**Own profile**
- **Before:** a settings list inside the profile; "Not listed in Mainnet…".
- **After:** Fomo F16:
  - Header circles Share · History · Settings.
  - Avatar (edit), name, @handle, bio, follows, meta line.
  - Period PnL hero + chart (24h/7d/30d/All).
  - Positions · Trades.
  - A "Make public on Mainnet" chip when private.
- **Why:** F2, C12, A10.

**Other trader**
- **Before:** —
- **After:** the same layout + **Follow** · **Send** · ⋯ (mute/block/report); positions when shared, each with "Trade this".
- **Why:** F2, F6, C11.

**Settings**
- **Before:** mixed with money rows.
- **After:** iOS grouped list with coloured icon squares (§A10 contents); Blocked & muted; Sign out at the bottom.
- **Why:** A10.

**Wallet & address**
- **Before:** an address page with a "Share watch link" button.
- **After:**
  - Receive grammar: avatar + @handle, QR, grouped address, Copy · Share circles.
  - Network rows with the Monad mark and explorer.
  - A "Signed in with Passkey" row; saved destinations.
- **Why:** A10, B13.

**Mode sheet**
- **Before:** paragraphs + "Switch to real money?" block.
- **After:** two rows (Monad mark, mode, balance, check); Mainnet → one sentence + slide.
- **Why:** A8.

**Search**
- **Before:** markets only.
- **After:** Fomo grammar: All · Tokens · Perps · Traders tabs, recents, a bottom search field with Paste.
- **Why:** C1, F1.

**Two-way trace check.** Every §0.6 card has an entry point above, and every element above maps to a card. The full trace table goes into `docs/product/flows/trace.md` at execution.
