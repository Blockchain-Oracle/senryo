# The owner's phone review, 12 Oct afternoon — synthesis

## What the owner said (paraphrased, with their words where it matters)

- **Parlay:** "the parlay is even worse… what the hell is something like this… the design can be better."
- **Duel:** "why is Duel different from the games part… it looks like Warm-up, deal the cards… design this to be
  better… use 21st to revamp… be creative on your own too."
- **Earn:** "the way the input button is showing — why is it showing that?"
- **Status:** "mid" ("this is pretty cool, man… it's just… mid").
- **Terminal market picker:** "when this drop down is showing, this Up or Down button should not show… what's the
  purpose of this drop down if this button below is covering it… I cannot drag it more up… it's not making sense."
- **Overall:** "I hate the phone… adjust this even beyond what I mention."

## What the phone shows today (`shots/`)

| Surface | Today |
|---|---|
| Parlay (`phone-parlay.png`) | A long list: mark, name, "1m calls reopen in 0:14" on every row, grey Up / Down pills. No price, no chart, no odds, no slip in sight. |
| Duel (`phone-duel.png`) | A form: radio dots for Free / $10 / $50 / $100 pots, "$40.00 goes in now", a white "Find a duel" button, an empty "Your duels". Nothing reads head-to-head. |
| Earn (`phone-earn.png`) | "$0.00" hero, pool numbers, six "Hour by hour" rows of 0.000 %, then Supply / Withdraw with a bare "$ 0.00" input and "Sign in to earn" for a guest. |
| Status (`phone-status.png`) | Two lists of rows that say "Working". |
| Market sheet (`phone-terminal-market-sheet.png`) | Opens low; the floating dock draws over it and hides its rows; it can't be dragged taller; the ticket stays live above it. |

## Root causes

1. **The shared phone `Sheet` renders inside the tab screen, under the dock layer, with one fixed max height**
   (`apps/mobile/src/components/sheet/Sheet.tsx`). All 17 sheets in the app inherit both faults. The dock already has a
   hide state (`components/shell/dock-context.tsx`) that sheets don't use.
2. **Parlay, Duel's entry, Earn and Status were ported as forms and lists** — the R7 rewrite reached the games and the
   match, not these entry screens.
3. **Duel's match reuses the warm-up swipe deck** (both apps, and Owarine too). The deck isn't wrong; the sameness of
   the shell around it is.

## Where the references and Codex agree

- **Market sheet:** above the dock with a modal scrim that makes the ticket inert; near-full height for a long list
  (refs: content-sized 50 %…92–96 %; Codex: snaps 62 / 88 / 100 %); drag-to-dismiss only at the list's top; search, chips
  (Favourites, Hot, asset classes), rows with the 24 h line and change, reset on open, untradable markets listed with a
  reason.
- **Parlay:** live markets with prices, 24 h lines and per-side odds; a slip that always exists as a bar above the dock
  and grows into a sheet; one big "Pays N×"; a place button that names its blocker; legs that roll to the next round; a
  capture motion into the slip (Mitoshi's arc, Codex's sockets). Between rounds: keep everything live, one banner, picks
  as next-round drafts — never "reopen in" on every row.
- **Duel:** a two-seat stage (you vs an opponent seat), tier tiles with the commitment spelled out
  (`3 × $10 calls + $10 pot = $40`), a searching ring in the opponent's seat with real queue counts, a scoreboard match
  with persistent portraits, a result card worth sharing, a rank ladder. Codex: the match as three shared market lanes
  (not the stacked deck) so Duel and Warm-up stop looking alike; rename "Free" to "No pot" (it still stakes $30).
- **Earn:** a guest sees the value of one pool share, never a personal $0.00 and never a bare input; the share price as
  the hero; a share-value chart (1D / 7D / 30D) that plots unit value, not deposits; supply / withdraw as a keypad sheet
  (Codex) with wallet-scaled chips and MAX (refs); withdraw sized to what's free; pending requests as receipts; the risk
  sentence by the action.
- **Status:** a verdict hero ("Live" / "Delayed" / "Unavailable" / "Unverified") with a tally; per-component tiles
  (feeds, keeper, relay, chain / indexer, deposits) with 24 h / 90 d bars; pulses only on real observations; timestamps
  on every figure; incidents; problem systems first and open.

## Choices the plan makes

| Choice | Options | Recommendation |
|---|---|---|
| Sheet engine (phone) | extend our `Sheet` with detents + a root host above the dock; or `@gorhom/bottom-sheet` 5.2.14 (JS-only, peer Reanimated ≥ 4, so it ships by update) | A spike on the market sheet decides; adopt one engine for all 17 sheets (one implementation per capability). |
| Parlay home | Owarine's terminal mode ("add to parlay") vs a dedicated builder | Both, one slip: the builder page is the full experience; the terminal gains an "Add to parlay" path into the same slip. |
| Duel match | the swipe deck vs three market lanes | Lanes for Duel (head-to-head, both seats visible); the deck stays Warm-up's. |
| Earn amount entry | inline input + chips vs a keypad sheet | The keypad sheet with chips; the screen itself shows no input. |

## Data the designs need that the api doesn't serve yet

- **Status history:** no stored health snapshots — uptime bars need the api to record its health digest every minute
  and serve 24 h / 90 d buckets; incidents need a small table.
- **Duel queue counts:** `/v1/duel/queue` returns only your own entry — tier tiles need "N waiting" per tier.
- **Earn share value:** derivable from the indexer's hourly epochs (value / supply); the pool started 12 Oct 07:33, so the
  headline is "Since launch · 7 h" until there's history.
- **Parlay odds per market:** the quote engine prices a leg per window; the builder needs one indicative price per side
  per card for the selected window (batched).

## 21st.dev starting points (searched 12 Oct)

- Number Pad **3711** (keypad sheet); Number Ticker (rolling totals).
- Pulse Loader **28530** / radar-effect **10759** (matchmaking ring).
- Status Bar **26906** (openstatusHQ, AGPL — adapt the interaction, build our own bars); incident timeline 24943.
- Leaderboard Podium **13057** / Leaderboard Table 30672 (Duel ranks).
- Drawer **31360** (snap points), Magnetic Drawer 19360 (sheets).
- motion-add-to-basket **24524** / interactive-checkout **109** (fly to slip); hold-to-confirm **23527**.
- Comparison-2 **21217** (versus), countdown 19328, balance-chart 30538, collapsible-05 **28413** (vault card).

## Sources

- `01-owarine.md` — Owarine's phone and web, all five surfaces.
- `02-mitoshi-canton-tradash.md` — Mitoshi, Canton S2, Tradash.
- `03-codex-direction.md` — Codex's direction (xhigh, with the screenshots).
- `shots/` — the phone today.
