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
| Add money → From another chain | On the Senryo app (bridge flows not built on the web yet) |
| Asset → Swap | Mainnet only (aggregators don't serve Practice) |
| Card → Card details | On the app · screen-capture protected |
| Card → Add to Apple Wallet | Needs Apple approval |
| Card → Get card | Card unavailable while `/v1/config` reports the card service off on this network |
| Send / Withdraw → Scan | Paste stands in for the camera (flow book G6 "QR scan: camera if allowed, else Paste") |
