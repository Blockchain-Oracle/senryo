# 12 · The trade slip (Codex direction, 12 Oct 2026)

Asked of Codex (gpt-6.1-sol, xhigh, read-only) for R5.11's second half: "a pending card that becomes the receipt slip in place". Source references: Mitoshi's `Receipt.tsx`, `VerdictStamp.tsx`, `CallCard.tsx` (crypto-world-fair/web); live mitoshi.xyz did not load for it. Kept verbatim below; decisions taken from it are D-327 onwards in `docs/plan/decisions.md`.

Ship **one trade object that stays in place from tap through settlement**. This direction uses the named source files; live `mitoshi.xyz` failed to load. No files were edited.

1. **Placement and lifecycle**

   **Web ≥1024px:** insert the pending card as the newest, expanded row in the terminal’s positions rail. Home and Calls show the same object through `PositionsPanel`.

   **Web <1024px and phone:** replace the View-position pill with a **144px/pt compact card** for the focused trade. Tapping it opens the positions sheet with that object expanded. Keep the chart and action buttons visible; never open the sheet automatically.

   At tap, show **“Signing…”**, market mark, **“BTC · Up · 5m”** or **“BTC · Up · Ride”**, Practice/Real, **Stake $5.00 / Pays if right $10.70** or **Margin $5.00 / Leverage 40×**. Quotes are labelled **“Quoted”** until booked. Pending money stays outside equity and Unrealized totals.

   Before commitment, show **“N° Pending”**; once available, show the digest separately as **“Request 7AC19F42”**. The final folio comes from the **ticketId or rideId**, never the transaction hash. Preserve the component’s local key while attaching those identifiers.

   Pending says **“Waiting for the fill”**; count down only when the API supplies `target`. At fill, replace quoted facts with booked facts and show **“Open”**, without a result stamp. Then show **“Settles in 4:32”** / **“Closes in 3:42:18”**, with a **3px draining bar**, normalized from fill to expiry.

   At authoritative completion, replace the clock/bar with realised result and stamp **inside that same card**. Keep it until dismissed or the next entry; retain it under **“Just finished”** for the session. Partial closes stay open. Unknown outcomes retain the card and use existing journal recovery.

   The toast owns status narration and recovery actions; the card owns lasting facts. Its changing labels do not create another live announcement.

2. **The slip**

   **360px maximum width**, responsive below that; **20px padding, 12px radius**. Paper is **`LIGHT.card` #FFFFFF**, ink **`LIGHT.foreground` #000000**, fixed in both themes. Use Senryo’s condensed display face for the **48px realised figure**, Inter for **13px facts**.

   Layout: Senryo + folio → market/side/lane or leverage → realised figure and completion timestamp → facts → perforation → proof, mode and QR stub. Perforation: **1px dashed rule, two 16px side notches**. One receipt-only shadow: **`0 8px 24px #0000001F`**, applied once to the paper.

   Stamp: **88px square, 4px corners, −4° rotation**, double inset frame. `KINPAKU.lacquer` supplies the field; its foil ramp supplies the frame; **`MATERIAL.goldLeaf.highlight`** supplies readable lettering. Gold denotes the authored seal; result text and net figure communicate outcome.

   **English only:** operational verdicts must read immediately; Kinpaku supplies the Japanese identity.

   Stamp words, with `/` indicating a line break:

   | Calls | Rides |
   |---|---|
   | Won | Closed / Up |
   | Lost | Closed / Down |
   | Refunded | Knocked out |
   | Cashed out / Gain | Capped |
   | Cashed out / Loss | Ended |

   Add **“Cashed out / Even”**, **“Closed / Even”**, and ride **“Refunded”**. Ride Up/Down means **net result**, independently of entry direction. Use call `pnl`; rides use **`pnl − fees − openFee`**, matching [existing result accounting](/Users/abu/dev/hackathon/metropolis/packages/calls/src/use-ride-results.ts:39).

   Folios: **`N° C-10143-000123`**, **`N° R-10143-000123`**; decimal IDs padded to at least six digits, never truncated.

   Call facts: **Stake, Pays if right, Came back, Entry, Line/band/strike, Close/Cashed out at, Closed by, Signed with**. Ride facts: **Original margin, Leverage, Trade size, Entry, Exit, Knock-out price, Cap price, Fees, Came back**.

   Call proof links use **`/proof/w/?id=<windowId>&chainId=<chainId>`**, supplemented by the cash-out transaction link. Ride proof opens the explorer transaction that completed it. Preserve expandable call timeline/window evidence below the paper.

   **Merge the existing share card into this artifact.** Share and Save PNG use the same static slip: **1080px wide, proportional height**, QR linking to the network-specific receipt. Web downloads directly; phone exports through the native save/share sheet. **No PDF in R5.11.**

3. **Privacy**

   Mask monetary facts, net result and ROI in visible text, accessibility labels and capture surfaces. Keep folio, direction, prices, timing and proof navigation usable.

   Block **both Share and Save PNG** with **“Show balances to share or save this receipt.”** Recheck privacy immediately before handing off the image; discard a capture if privacy changed. Never unhide automatically.

4. **Motion and sound**

   Fill updates crossfade over **180ms**. Result stamp presses over **220ms**: scale **1.12 → 0.98** and y **−8 → 0** over 120ms, then settles to **1.00** over 100ms. Reduced motion uses a **100ms opacity fade**.

   Animate once on an observed completion; history, reload and exports show the final static stamp. Existing result hosts own win/loss/refund sound, haptics and confetti. The slip emits no additional cue.

5. **Exact file plan**

   **Shared:** add `packages/calls/src/{trade-slips.ts,use-trade-slips.ts}`. Change `{receipt.ts,links.ts,intent-journal.ts,use-intent-recovery.ts,use-call-flow.ts,use-ride-flow.ts,use-position-actions.ts,use-ride-results.ts,index.ts,react.ts}` for shared identity, lifecycle, words and accounting. Add receipt material/elevation tokens in `packages/tokens/src/{marks.ts,scale.ts,tokens.css}`.

   **Both apps:** add `src/features/receipts/{TradeSlip,ReceiptStamp,ReceiptActions,RideReceipt}.tsx` and `receipt-png.ts`; change calls `{CallReceipt,CallTimeline,WindowProof,CallsScreen}.tsx`, terminal `TerminalScreen.tsx`, positions `PositionRow.tsx`.

   **Web:** change `PositionsPanel.tsx`, terminal `PositionsPill.tsx`, `app/globals.css`, `components/shell/DrawerHost.tsx`, `lib/shell/drawer-param.ts`; add `drawers/RideDrawer.tsx`, `features/receipts/PublicRide.tsx`, `app/ride/page.tsx`.

   **Phone:** change `PositionsList.tsx`, `ViewPositionPill.tsx`, `theme/layout.ts`, `lib/deep-link.ts`; add `app/rides/[rideId].tsx`.

   **Required ride data:** change API-client/query/API `rides.ts`; add public read-only **`GET /v1/rides/:rideId`**. Change `services/common/src/rides.ts`; add `0031_ride_receipts.ts` to retain original margin and completion transaction across reloads.

   **Delete:** both `calls/ShareCallButton.tsx`, web `calls/share-card.ts`, phone `calls/ShareCard.tsx`, shared `ShareCall`/`shareOf`, and duplicated receipt hero/facts markup. Keep `CallReceipt` as its loader and evidence wrapper; keep `toast-run.ts`.


