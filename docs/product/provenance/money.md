# Provenance — Money (any asset), flow book B1–B16

Area agent: Money. Branch `claude/ui-money`. Every new component was searched on 21st.dev first
(`npx -y @21st-dev/cli search "<what>" --type c`). The table records what was ported, or why nothing fit. Ports are
React Native rewrites: Reanimated 4, react-native-svg and Gesture Handler. No web libraries were added.

## Ports

| Component (file) | 21st source | What was ported | Deviations |
|---|---|---|---|
| `features/fund/DottedQr.tsx` | tom_ui/qr-code **#12248** (search "dotted qr code") | The `qrcode` module matrix drawn as dots, with the finder patterns skipped and drawn separately. | Solflare S21 grammar: round finder eyes (a ring around a disc) instead of rounded squares. Error correction H with a paper disc under the Monad badge. Dark ink on the paper plate in both themes, for scanner contrast. Dots are drawn as three bucketed Paths, not ~600 `<circle>`s, and resolve as particles with a stagger. Reduce Motion skips the stagger. |
| `features/swap/SwapCards.tsx` | ssychui/swap-ticket **#27122** (search "swap card crypto") | The pay and receive plates trade places on flip, the flip disc turns 180°, and the rate line sits in the footer. | Reanimated layout transition instead of framer-motion. No Buy/Sell CTA colour flip: a slide confirms. The slippage chip is replaced by the Details disclosure. |
| `features/money/BridgeTimeline.tsx` | sean0205/vertical-titled-stepper **#29815** (search "stepper timeline vertical") | Numbered dots joined by a connecting line, a check when done, a spinner on the live step. | Three fixed steps (Sent → Bridging → Delivered/Refunded/Failed), driven by `/v1/bridge/status`. A failed state is drawn in the down colour. |
| `features/money/ActionCircle.tsx` | radiumcoders/grid-button **#13564** (search "action buttons grid circle") | An icon disc over a short label, with a press scale. | 56 pt circles (D-196). A disabled circle keeps its place and shows a reason of 4 words or fewer; an optional note can show for an enabled circle. |
| `features/money/SearchField.tsx` | santoshvarmaaddala/search-bar **#1645** (search "search input bottom") | A filled plate with the leading search glyph. | Bottom-anchored (Phantom P22). Trailing tools: a 36 pt Scan circle and a text Paste (Fomo F31). No web focus ring. |
| `features/money/ChainGrid.tsx` | preetsuthar17/selector-chips **#1963** (search "chain selector network") | A wrap of selectable tiles, with the selected tile raised. | Each tile carries the chain mark, the time, and the provider. Unavailable chains stay visible, dimmed, with their reason. |
| `features/fund/ReceiveCard.tsx` (NetworkPill) | haydenbleasel/pill **#1600** | A mark and a label on a raised pill. | Monad mark plus the network name. |
| `features/activity/FeedRow.tsx` + `Receipt.tsx` | hari/transaction-list **#2943** (search "activity list transactions") | Row → detail behaviour. | The detail is a ChildSheet receipt (Share, Explorer), not an in-place expansion. |

## Searched, none fit (built on the foundation)

| Need | Search | Result → what was used |
|---|---|---|
| Asset picker / token select | "crypto token selector", "token select asset picker" | Only web selects and a model picker came back. `AssetPicker` was built from `AssetRow` plus `SearchField`, following Fomo F22. |
| Keypad | "number keypad" | bankkroll/number-pad #3711 is already ported as `components/trade/Keypad`, so it is reused. |
| QR scanner | "qr scanner" | Only generators came back. `Scanner.tsx` was built on expo-camera's `CameraView` barcode scanner. |
| Receive / address card | "receive crypto address" | Only wallet cards came back. Solflare S21 grammar was followed directly. |
| Send recipient | "send money recipient" | Only payment forms came back. Phantom P22 grammar was followed directly (`RecipientStep`). |
| Deposit method list | "deposit method list" | Only saved-payment checkboxes came back. The kit `SheetRow` was used, following Fomo F20/F21. |
| Receipt | "transaction receipt" | Ticket and confirmation cards came back. The receipt reuses `ReviewRow` rows. |
| Balance breakdown | "balance breakdown" | Only a chart and a billing card came back. The balance sheet uses kit `SheetRow`s with marks. |
| Practice par swap (D-252) | — (no new component) | The swap ticket's own plates, Details line (`DetailsLine` extracted from `QuoteLine`) and review rows carry the par variant; the route row carries the Senryo seal. |

## Marks (rule 7)

- Asset marks come from the registry's art when it exists (`hasArt`). Otherwise they come from the token list's or
  GeckoTerminal's `logoUrl`, drawn by expo-image (lazy, `lib/native-modules.ts`). An unknown token gets the
  registry's labelled monogram.
- Provider marks have no art yet, so the labelled fallback shows for: Monorail, KyberSwap, Relay, Circle CCTP, Across,
  LI.FI and Ramp.
- Chain marks have no art yet, so the labelled fallback shows for: Optimism, Avalanche, and the Sepolia testnets.
- These marks need art plus provenance in `packages/identity` (a shared package, not this area).
