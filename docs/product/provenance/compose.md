# Provenance — composed operations (B4 deposit address, B11 network fee, "Pay with")

Branch `claude/compose`. Every surface here is built from the foundation and the Money area's own pieces; 21st.dev
was searched first (Part A0) and nothing fit a React Native port better than what the app already has.

| Surface | 21st search | Result | Built from |
|---|---|---|---|
| B4 deposit address (QR, address, Copy · Share) | `crypto deposit address qr` → Wallet Card 2 (#5214), QR Code (#1706, #6177), Crypto Swap Card (#7973) | none fit: web `Card` boxes with gradients and borders (Part A5 "rows, not boxes"); the QR ports are plain square-module codes | `features/fund/DottedQr` (already ported from tom_ui/qr-code #12248), `groupedAddress`, `ActionCircle`s — the Receive (B3) grammar with the ORIGIN chain's mark as the badge |
| B4 timeline (Waiting → Bridging → Arrived) | — (reused) | — | `features/money/BridgeTimeline`'s `TimelineStep` (ported from sean0205/vertical-titled-stepper #29815), now exported |
| "Pay with" chip + picker (ticket, pool) | `payment method selector pay with token` → Payment (#7478), Payment Method Card Checkbox (#24917), Modern Payment Form (#4268), Minimal Payment Modal (#5742) | none fit: card-number / checkbox forms, not an asset chip | `features/send/AmountStep`'s `AssetChip` (Phantom P20 chip) on the pool sheet; a text chip in the ticket's buying-power line; `features/money/AssetPicker` in a `ChildSheet` |
| "Network fee" step in Details | — | — | `ReviewRow` "Steps" line via `stepsLine` (`@senryo/query` compose.ts) |

No new marks: Relay's mark (`ids.provider("relay")`) and the chain marks already exist in `@senryo/identity`.
