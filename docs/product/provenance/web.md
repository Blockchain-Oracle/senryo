# Provenance — Web parity (flow book G6, plan D10)

Area agent: Web. Branch `claude/web`. The web (`apps/web`, Next static export) now runs the judge path on the same
capability cards as the phone, on the shared packages (`@senryo/query`, `@senryo/chain`, `@senryo/core`,
`@senryo/account`, `@senryo/api-client`, `@senryo/identity`, `@senryo/tokens`). Every new component was searched on
21st.dev first (`npx -y @21st-dev/cli search "<what>" --type c`); the table records what was ported, or why nothing
fit. The machine record is `apps/web/.21st/design.json` (`components.installed`, `components.removed`).

## Ports

| Component (file) | 21st source | What was ported | Deviations |
|---|---|---|---|
| `components/kit/slide-to-confirm.tsx` | starc007/slide-action-button **#29304** (search "slide to confirm button") | Drag the thumb past a threshold to confirm, spring back when released early, the arrow morphing into a check. | The side's tone (long green / short red / primary). `busy` holds the rail with a spinner; `disabled` shows the blocker as the label. A completed slide stays completed until `resetKey` (the reviewed intent) changes — one slide is one confirmation, no auto-reset timer. Enter / Space on the thumb confirms (the web's explicit confirm and the accessible path). |
| `components/kit/action-circle.tsx` | radiumcoders/grid-button **#13564** (search "action buttons grid circle") | An icon disc over a short label with a press scale. | 56 px circles (D-196). A locked circle keeps its place and names why in ≤ 4 words ("Mainnet only"). |
| `components/kit/dotted-qr.tsx` | tom_ui/qr-code **#12248** (search "dotted qr code") | The `qrcode` module matrix drawn as dots, finder patterns drawn separately. | As on the phone (Solflare S21): round finder eyes, error correction H with a paper disc under the Monad badge, dark ink on the fixed paper plate in both themes, three dot buckets that settle once (Reduce Motion: none). |
| `components/money/receive-screen.tsx` (`NetworkPill`) | haydenbleasel/pill **#1600** (search "pill badge") | A mark and a label on a raised pill. | Monad mark + network name. |

Reused from the existing web kit (already ported, recorded in `design.json`): vercel-tabs #1597 (top tabs, Home /
profile / social underline tabs), originui/slider #304 (leverage ruler with detents), ddoemonn/segmented-control #23552
(markets filters, chart periods), shadcn skeleton #1588, the vaul/radix responsive sheet (step-up, risk explainer).

### Round 2 ports (pool, activity, inbox, swap, bridges, scan)

| Component (file) | 21st source | What was ported | Deviations |
|---|---|---|---|
| `components/activity/activity-screen.tsx` | hari/transaction-list **#2943** (search "activity list transactions") | Row → detail. | The detail is the receipt (facts, steps, explorer links, Share), as on the phone. |
| `components/notifications/notifications-screen.tsx` | uvain/notification-panel **#27135** (the phone's source) | Rows grouped by day, the sentence first, time quiet beside it. | Today / Earlier; unread rows on a raised fill, no dots. |
| `components/shell/header-utilities.tsx` (bell) | ruixen.ui/notification-button **#7914** (the phone's source) | A round control with the count pill at its upper right. | Hidden at zero, capped at 99+, never a bare dot. |
| `components/swap/swap-screen.tsx` | ssychui/swap-ticket **#27122** (the phone's source) | Pay and receive plates with the flip disc between them. | No colour flip for buy/sell; Review → slide. |
| `components/bridge/chain-grid.tsx` (`ChainGrid`) | preetsuthar17/selector-chips **#1963** (the phone's source) | A wrap of selectable tiles, the selected one raised. | Mark, name, time and provider per tile; unavailable chains stay dimmed with their reason. |
| `components/bridge/chain-grid.tsx` (`BridgeTimeline`) | sean0205/vertical-titled-stepper **#29815** (the phone's source) | Numbered dots, a check when done, a spinner on the live step. | Sent → Bridging → Delivered / Refunded / Didn't arrive from `/v1/bridge/status`. |

**QR decoding (Scan, round 2).** The browser's `BarcodeDetector` is used where it exists (Chrome on macOS, Android,
ChromeOS). Elsewhere the scanner lazy-loads **jsQR 1.4.0** (github.com/cozmo/jsQR, Apache-2.0): no dependencies, no
install or postinstall scripts, integrity `sha512-dxLob7q65Xg2…9HzU/A==`. It is added to `apps/web` only; the lockfile
change is jsqr's own three entries (written by hand, verified with `pnpm install --frozen-lockfile`) so the mobile tree
is untouched. nginx now sends `camera=(self)`.

### Round 3 ports (public stats and judge guide, `claude/stats`)

| Component (file) | 21st source | What was ported | Deviations |
|---|---|---|---|
| `components/ui/daily-bars.tsx` (`/stats/` per-day chart) | eugeneshilow/stacked-activity **#29474** (search "bar chart daily activity") | Daily columns from one baseline, the hovered day's track band, per-day hit zones wider than the columns, the hatched partial last day (today isn't over), clean {1, 2, 2.5, 5}×10^k scale steps, the grow-in stagger. | One series per chart: new accounts and trades are two small multiples on one day axis (two scales are never one stack or a second axis). The live legend moved to the caller so both charts share one hovered day; tap works as hover. Labels are HTML so text never scales with the SVG; Living Lacquer tokens (`--practice` / `--mainnet` per network) instead of the vizcn palette; motion/react with the lacquer ease, reduced motion draws in place; a visually hidden table carries every value. Recharts-based bar charts (heygaia #28559, retroui #28553) were not used: a charting library for two small series. |
| `components/public/markdown.tsx` (`/judges/`) | serafimcloud/markdown **#12396** (search "markdown prose renderer article") | The element grammar: headings, ordered and bullet lists, tables, quotes, code fences, external links in a new tab with `noopener`. | Not the dependency: the 21st component needs react-markdown + remark-gfm (the unified tree). The guide is our own file, rendered at build in a server component, so a ~250-line parser covering what the guides use ships zero JS; same-site links become in-app paths and repo-relative links open the file on GitHub. |

## Searched, none fit (built on the kit)

| Need | Search | Result → what was used |
|---|---|---|
| Phone dock | "bottom navigation bar mobile" | shadcnui-blocks/mobile-navigation-tabs #27897 and similar tab bars came back; the phone's own Dock grammar (five destinations, icon over label) was followed directly in `components/shell/bottom-dock.tsx`, shown below `sm` only. |
| Asset picker | "token select asset picker" | Only form selects and model pickers. `components/money/asset-picker.tsx` is `AssetRow` + a search field, as on the phone (Fomo F22). |
| Outcome surface | "transaction status success check" | Ticket/confirmation cards and progress bars. `components/kit/operation-status.tsx` follows the phone's `TradeTrace` contract (pending / success / failed / not confirmed yet; never resubmits). |
| Follow | "follow button" | A button group and like/heart buttons. `components/social/follow-button.tsx` is the kit Button with the phone's states (Follow / Following / Blocked / Limit reached). |
| Leaderboard / rows | "leaderboard list", "list item row avatar" | Achievement and item lists with boxes. Rows follow Part A rule 5 (`components/kit/list-row.tsx`, no boxes). |
| Feed row | "social feed post" | Post cards (boxed). `components/social/feed-row.tsx` follows the phone's FeedRow (Fomo F15): bare rows, verb plate, market line, Trade this. |
| Margin / amount entry | "amount input currency" | Input groups. The ticket's margin hero and the send amount are bare Inter Display inputs (Part A rule 1). |
| Stats figures | "stat tile kpi metric row", "stats metrics dashboard kpi" | Stat cards, KPI cards and an 8-bit dashboard (boxed tiles). `/stats/` keeps the app's grammar: traded notional as the one `AmountHero`, then `ListRow`s with a quiet glyph; a figure the indexer can't answer is "—" with its reason as the subtitle. The network switch is the installed segmented control #23552. |
| Period chips | "period selector chips" | preetsuthar17/selector-chips #1963 (already the phone's ChainGrid source); the web chips are plain pressed-state buttons with the same grammar. |

## Marks (rule 7)

- Every asset, market, chain, exchange and person uses `@senryo/identity` web components (`EntityMark`, the authored
  avatar set via `WEB_ART`), or a token list / GeckoTerminal `logoUrl` for tokens without registry art; unknown tokens
  get the registry's labelled monogram. No dots.
- The welcome page draws the seal from the registry (`brand:senryo`), never the kanji in a live font.
- The Kinpaku card art on the web is lacquer, the seal and the name, with no card numbers.

## Named locks on the web (same reasons as the phone)

| Where | Lock |
|---|---|
| Add money → Card or bank | Mainnet only (Ramp) |
| Card → Card details | On the app · screen-capture protected |
| Card → Add to Apple Wallet | Needs Apple approval |
| Card → Get card | Card unavailable while `/v1/config` reports the card service off on this network |
| Send / Withdraw → Scan | Camera where allowed, Paste always (flow book G6); a refused camera says so in one line |
| Swap (Practice) | Mainnet only — the API's own reason: no aggregator serves the test network |
| Add money → From another chain → Send | "Send from your <chain> wallet · soon": the transfer is signed on the other chain and the web has no connected-wallet route yet (same lock as the phone) |
| Add money → From another chain (Practice) | Only Circle's testnet USDC over CCTP; the other assets are locked Mainnet only |
