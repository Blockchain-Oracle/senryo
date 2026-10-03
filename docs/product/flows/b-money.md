# B — Assets and money (capability cards B1–B16)

Source: plan `jiggly-munching-island.md` §0.3–§0.9, Part 1, Part A, Part D; method `product-how-tree`. Routes live in
[`routes.md`](routes.md). Written 2 Oct 2026 against `claude/premium-takeover` @ `96411ec`.

**Path shorthand:** `m/` = `apps/mobile/src/` · `q/` = `packages/query/src/` · `ch/` = `packages/chain/src/` ·
`cfg/` = `packages/config/src/` · `sol/` = `contracts/src/periphery/`. `UNDEFINED-n` items are listed at the end.
**Modes:** (P) = Practice (testnet 10143, P$) · (M) = Mainnet (143, real money).

## The symmetry rule (binding, plan §0.7 decision 3)

Every asset at the user's address supports **Receive · Send · Swap · Withdraw (Monad)**. **Other chain** and **Bank**
work where a route exists. Otherwise the action composes "swap to USDC first" into the same confirmation, or the
action is disabled with a named reason of 4 words or fewer. No screen special-cases one asset: XAUt0, MON and memes
use the same pickers, sheets and receipts as AUSD.

| Class | Instances | Mark | Verified |
|---|---|---|---|
| Native | MON | Monad | ✓ |
| Dollar (collateral) | AUSD ("Agora USD", `packages/identity/src/entities.ts:84`), USDC | token list | ✓ (+ trading part) |
| Dollar (other) | USDT0, GHO, mUSD, syrupUSDC | token list | ✓ |
| Majors / LST | WBTC, WETH, cbBTC, shMON | token list | ✓ |
| Gold | XAUt0 `0x01bF…1071`, 6 dp (token list, 2 Oct) | token list | ✓ |
| Meme | nad.fun curve / graduated | GeckoTerminal image or monogram | if listed |
| Unknown ERC-20 | anything else at the address | monogram + "Unverified" | ✗ |
| Practice | test AUSD, test USDC (`MockAUSD`/`MockUSDC`), testnet MON | same marks | ✓ |

## B0 — Shared contracts (every card uses these; built once in the foundation)

- **B0.1 Asset picker (`AssetPicker`).**
  - Lists *all* holdings: verified by value, then "Other tokens (n)" collapsed.
  - Each row shows mark, name, amount and value. AUSD and USDC rows add "· 300 in trades".
  - Search by name, symbol or pasted address. It opens on the entry point's asset.
  - Rows that can't do this action stay visible, disabled, with the reason ("No bridge for this token").
- **B0.2 Amount (`AmountEntry` + keypad).**
  - Exact entry in the asset's own decimals, with a units ↔ $ toggle when the asset is priced.
  - Max = spendable minus the fee reserve (MON only, B11).
  - The line under the hero reads "Available 212 · 300 in trades ›". The link opens the path that frees the locked part.
  - Route minimum and maximum are shown inline.
- **B0.3 Destination (`RecipientSearch`, `ChainPicker`).**
  - The search bar sits at the bottom and accepts a name, @handle or address, with Paste and **Scan** circles.
  - Recents and Following show above the search bar. Saved destinations show with exchange marks.
  - The chain grid is filtered to valid routes for the chosen asset. Each tile shows fee, ETA and minimum.
- **B0.4 Composer (one intent = one confirmation).**
  - The operation records `plannedActions` in the journal (`q/operations.ts:11-24`).
  - Step order: [fee top-up] → [pull from trading] → [swap] → [approve] → act.
  - Details lists the steps. One slide and one step-up sign every step (the pattern at `m/features/tokens/useTokenTrade.ts:127-158`).
  - If a step fails after earlier ones completed, the outcome is `partial` (`q/operations.ts:48`). The row then offers
    **Finish**, which runs only the remaining steps. Completed steps are never resent.
- **B0.5 Outcome (`OperationStatus`, Part A8).**
  - pending → success (check, 3 facts, next action, Share) / failed ("Review again") / unknown (no new action).
  - Facts come from `reviewedIntent`, never from the latest balance (`m/features/withdraw/MoneyReceipt.tsx:28-46`).
- **B0.6 Confirmation levels (rule 11).**
  - Slide on every money action.
  - Face ID per the session policy.
  - **Passkey step-up** for sends to any address that isn't the user's own, approvals, swaps and cross-chain or bank exits.
  - Withdraw to the user's own Monad address stays in session scope (D-039; `m/features/withdraw/WithdrawToSelf.tsx:77`).
- **B0.7 Practice parity.**
  - Every card exists in (P) with the same screens.
  - Mainnet-only routes keep their row and lock at the action: "Mainnet only" plus the reason in ⓘ.

---

### B1 See holdings (any asset)
- **Promise:** every token at your address appears, with its mark and value.
- **Entry points:** Home → **Assets** tab · Balance sheet → Assets row · every `AssetPicker` (B0.1).
- **Steps:**
  1. Home → underline tabs Positions · **Assets** · Earn.
  2. Verified rows by value: mark, name, amount; value + 24h % on the right. AUSD/USDC: "512.00 · 300 in trades".
  3. "Other tokens (n) ›" (collapsed): unverified rows with a monogram or GeckoTerminal image, amount, "Unverified", no value.
  4. Tap a row → Asset detail (B2).
  - (P) test AUSD, test USDC, testnet MON. Stables valued at peg, MON shows "No price" (testnet has no prices). P$ symbol.
  - (M) every token at the address, priced (routes.md §1).
- **Rules:**
  - Discovery: `GET /v1/holdings?chainId`, server-side and cached. HyperSync `Transfer` logs → candidate tokens →
    `balanceOf`/`decimals`/`symbol` multicall at one finalized block. MON via `eth_getBalance`. Alchemy fallback.
  - A token is verified only when its **address** is in the Monad token list. Never match by symbol.
  - Unverified tokens get no price, are excluded from Total, and drop out at zero balance.
  - Dollar rows add the trading collateral (`AccountSnapshot.ausd/usdc`, `ch/portfolio.ts:150-163`) as their "in trades" part.
  - Pool shares are not an asset row. They live in Earn (D1).
  - Sort: priced value desc → verified unpriced → symbol.
  - Hidden tokens (B14) are excluded, with a "Hidden (n)" footer under Other tokens.
- **States:**
  - Loading: 3 row skeletons (never $0).
  - Empty: "No assets yet" + **Add money**, with method marks.
  - Error: "Couldn't load assets" · Retry.
  - Offline: last snapshot + "Offline" tag.
  - Partial: the row shows "No price", and Total shows `≈` ⓘ.
  - Spam: under Other tokens, "Unverified".
  - Lookalike symbol: "Not the listed WMON".
- **After:** —. Each row opens B2.
- **Today → gap:**
  - Only AUSD/USDC plus 9 generated spot tokens are read (`ch/portfolio.ts:116-147`, `cfg/generated/spot-tokens.ts`). Unknown tokens are invisible.
  - The holdings list is Mainnet-only (`m/features/tokens/TokenHoldings.tsx:21,24`). Practice wallet MON isn't counted (`ch/portfolio.ts:116-130`) (#12).
  - Prices are joined by **symbol** (`TokenHoldings.tsx:29`; `useTokenTrade.ts:56`).
  - Dollar rows carry no trading part. Home instead shows "Available to trade / Card availability" rows (`m/features/home/Availability.tsx:21-32`).
  - Home stacks sections instead of tabs (`m/app/(tabs)/home/index.tsx:66-80`).
- **Acceptance:**
  - [ ] (M) A wallet holding MON, USDC, XAUt0 and one spam token lists 3 verified rows by value plus "Other tokens (1)".
  - [ ] The spam token has no $ value, and Total is unchanged with it in the wallet.
  - [ ] AUSD with P$ in trades shows one row, "· 300 in trades", and its value counts once in Total.
  - [ ] (P) Testnet MON shows as a row with "No price", and Total is not marked `≈` because of it.
  - [ ] Kill the network: rows stay, with an "Offline" tag. A cold start offline shows skeletons, not $0.

### B2 Asset detail (any asset)
- **Promise:** one page per asset, with every action it supports.
- **Entry points:** Home Assets row · Markets → Tokens row · search · Activity row subject · picker long-press.
- **Steps:**
  1. Header: mark, name, symbol, verified badge (or an "Unverified" banner + **Hide**).
  2. Price + 24h, then the chart. Stablecoins have no chart.
  3. **Your balance:** amount + value. AUSD/USDC show breakdown rows Wallet · In trades · Held by card, each with its reason ›.
  4. Action circles: **Receive · Send · Swap · Withdraw** (+ **Buy** when Ramp lists it). Each opens its card with this asset preselected.
  5. Cross-link row: XAUt0 → "Trade XAU with leverage ›". MON/WBTC/WETH → "Trade on Perpl ›" (M).
  6. About (2 lines + More), then this asset's Activity (B12 filtered by token address).
  - (P) The page and circles are identical. Swap and Buy lock at their action.
- **Rules:**
  - Route by address: `/asset/[chainId]/[address]` (native = `0x0`). The old `tokens/[token]` symbol route redirects.
  - A circle is disabled only with a reason: "No route for this token", "Mainnet only".
  - The chart uses pool candles (`m/features/tokens/TokenChart.tsx`) when a pool is known. Otherwise it is hidden, never faked.
- **States:**
  - Loading: header + price skeleton.
  - Unknown token: header from the chain (symbol and decimals), monogram, "Unverified", no chart.
  - No price: "No price".
  - Zero balance: the balance block shows "None yet" + Receive.
  - Error: "Couldn't load this asset" · Retry.
  - Offline: "Offline" tag.
- **After:** actions open B3/B6/B7/B8/B5. Hide → B14.
- **Today → gap:**
  - Pages exist only for the 9 spot tokens (`m/features/tokens/TokenDetail.tsx:38-49`). Others show "has no live Uniswap pool".
  - Actions are Sell/Buy only (`TokenDetail.tsx:139-163`). (P) offers a network switch instead (`TokenDetail.tsx:143-156`).
  - Routing is by symbol (`TokenDetail.tsx:145`). AUSD, USDC and unknown tokens have no page.
- **Acceptance:**
  - [ ] AUSD, XAUt0, MON and a spam token each open a page with 4 circles.
  - [ ] Spam: banner + Hide, and its Swap circle reads "Unverified · sell only".
  - [ ] XAUt0 page → "Trade XAU with leverage ›" opens the XAU market. The XAU market → "Own real gold ›" returns here.
  - [ ] (P) Swap circle → ticket → the slide shows "Mainnet only".

### B3 Receive on Monad (any asset, one address)
- **Promise:** one address receives every token on Monad.
- **Entry points:** Plus → Receive · B2 Receive circle · Add money → Crypto on Monad / From an exchange · Settings → Wallet & address.
- **Steps:**
  1. Sheet: "Receive" + network pill (Monad mark; (P) "Monad Testnet").
  2. Optional asset chips (preselected from B2). They only change the share text, never the address.
  3. Dotted QR with the Monad badge. Address in grouped mono on two rows.
  4. **Copy · Share · Explorer** circles (56 pt + label). One line: "Any token on Monad".
  5. Link row "Sending from another chain? ›" → B4. From an exchange: an exchange-mark tip row "Choose Monad network".
  6. Opened from a flow: a "Waiting" pulse → arrival moment (sound + "Received 20 USDC").
- **Rules:**
  - The address is the wallet itself (plan §0.7 decision 2). The deposit inbox leaves every user flow.
  - Arrival = a holdings increase (B1 poll) or a server "money arrived" push for any asset (D7).
  - The same key controls this address on every EVM chain. That matters for wrong-chain recovery (UNDEFINED-3).
- **States:**
  - Guest: "Sign in to see your address".
  - Loading: QR skeleton.
  - Copied: "Copied" (haptic).
  - Offline: QR still shown, with an "Offline" tag.
  - Wrong chain: "Sent on the wrong chain? ›" → recovery page.
  - Spam arrival: no moment and no push. It lands silently in Other tokens.
- **After:** sound + push "Received 20 USDC" + Activity row (B12). The asset appears in B1.
- **Today → gap:**
  - Wallet / Trading account segmented control (`m/app/(sheets)/receive.tsx:12-25`, `m/app/fund/qr/[family].tsx:10-28`).
  - Asset segmented control limited to AUSD/USDC/MON (`m/features/fund/WalletReceive.tsx:16-20`). Text Copy/Share buttons (`:54-66`) and a sentence (`:68-70`).
  - The inbox accepts AUSD/USDC only (`sol/DepositInbox.sol:26-29`). It has no rescue path, so any other token or MON sent there is **stranded** (#4).
  - The arrival push exists for inbox sweeps only (`services/keeper/src/push-messages.ts:83-85`).
- **Acceptance:**
  - [ ] Plus → Receive shows one QR. Switching chips never changes the address.
  - [ ] Send 1 USDC and 0.1 MON from another wallet: each produces a moment, a push and an Activity row, and appears in Assets.
  - [ ] Send a spam token: it appears under Other tokens, with no push.
  - [ ] (P) The same layout with the "Monad Testnet" pill. Test AUSD arrives the same way.

### B4 Deposit from another chain
- **Promise:** bring MON, USDC, AUSD, USDT0 or gold from 60+ chains to your Monad address.
- **Entry points:** Add money → From another chain · Receive → "Sending from another chain? ›" · B2 Receive (asset preselected).
- **Steps:**
  1. Asset picker over the arrivable set (routes.md §4): MON, USDC, AUSD, USDT0, XAUt0. ETH/WBTC show "Arrives as USDC · swap here".
  2. Source chain grid, filtered to valid routes for that asset: chain mark, fee, ETA, minimum.
  3. Amount (exact) → quote: you receive, fee, ETA, route mark (Relay/CCTP/Across/Aurora).
  4. Either a deposit address + QR (persistent where the route offers one) or "Send from a connected wallet" (UNDEFINED-4).
  5. Timeline: Sent → Bridging → Arrived. The asset lands in B1.
  - (P) USDC only, via CCTP v2 (Sepolia → Monad Testnet). Other assets lock: "Mainnet only".
- **Rules:**
  - The destination is always the user's Monad wallet (Part F9).
  - Below the route minimum: "Below minimum · refunded". The refund goes to the sender on the source chain.
  - A quote expires (TTL per route). Late deposits to a persistent address still count.
  - Every deposit is an operation-journal record keyed by route id, so it resumes after the app is killed.
- **States:**
  - Loading quote: skeleton in the quote rows.
  - No route: the chain tile is disabled, "No route from Solana".
  - Route degraded (Aurora incident): banner "Aurora paused · using Relay".
  - Expired: "Quote expired" · Refresh.
  - Refunded: "Refunded on Base" + tx refs.
  - Failed: reason + source and destination hashes.
  - Pending after kill: Activity row with a spinner.
- **After:** timeline → success (3 facts: received, route, time) → Activity "Bridged 50 USDC from Base" → push on arrival.
- **Built (claude/compose, 2 Oct):** step 4 is a Relay open-mode deposit address (`POST /v1/bridge/deposit-address`,
  `GET /v1/bridge/deposit-status`; `m/features/fund/BridgeIn.tsx`, `DepositAddress.tsx`): issued only for the user's own
  wallet (Relay's order must pay exactly that wallet, asset and chain or it is refused), refunds go back to the depositor
  (`refundTo` = the origin's native placeholder, `recoveryAddress` = the same key), the address is kept per route and
  reused (open mode takes later deposits), the timeline is polled by address, issuing records an Arriving row.
  (P): "Mainnet only" (Relay has no test network). Solana / Bitcoin / Tron / TON origins: Relay with `RELAY_API_KEY`, or
  Aurora's persistent addresses once its Monad incident clears (routes.md §5).
- **Still open:** XAUt0 has no deposit address (no Relay solver for XAUT) — its row keeps the wallet-signed quote only.
- **Acceptance:**
  - [ ] (M) A live 10 USDC run from Base via Relay arrives in Assets, with Activity and push. A resumed kill mid-bridge shows the same row.
  - [ ] A below-minimum amount is blocked before the deposit address is shown.
  - [ ] While the Aurora incident is open, Aurora tiles are hidden and the banner shows. Once it closes, the tiles return without a release.
  - [ ] (P) CCTP Sepolia → Monad Testnet test USDC arrives. Other asset rows read "Mainnet only".

### B5 Buy with card or bank (Ramp)
- **Promise:** buy MON, USDC, AUSD or USDT0 with a card or bank transfer.
- **Entry points:** Add money → Card or bank · B2 **Buy** circle (listed assets) · setup step 3 (M).
- **Steps:**
  1. Asset (Ramp-listed rows enabled; others show "Buy USDC, then swap").
  2. Amount in local fiat (Ramp limits shown).
  3. Ramp hosted page in an in-app browser (`userAddress` = wallet, `finalUrl` = app link, `enabledFlows` = ONRAMP).
  4. KYC and payment happen in Ramp.
  5. Back in the app: "Arriving" row → arrival moment.
  - (P) Row locked "Mainnet only".
- **Rules:**
  - Assets live 2 Oct: `MONAD_MON`, `MONAD_USDC`, `MONAD_AUSD`, `MONAD_USDT0` (routes.md §6).
  - Buy limits run $6.25–$15,000 and vary by country.
  - Unlisted asset (e.g. XAUt0) → buy USDC, and the journal stores a pending "then swap to XAUt0" intent. On arrival a
    pre-filled B6 review opens. This is the named exception to one confirmation: the payment confirms in Ramp, the swap
    confirms on arrival (BD-6).
  - Arrival is detected by holdings (B1). Ramp purchase status: UNDEFINED-5.
- **States:**
  - Region unsupported: "Not available in your country".
  - Cancelled in Ramp: silent return, nothing recorded.
  - KYC pending: "Ramp is checking your ID".
  - Pending payment: Arriving row with a spinner.
  - Ramp unreachable: "Ramp unavailable" · Retry.
- **After:** push "Received 100 USDC" + Activity "Bought 100 USDC · Ramp" with the Ramp mark. Arriving clears.
- **Today → gap:** not built (D5). D-041 reversed. No Ramp mark in identity (`packages/identity/src/entities.ts:237-244` has Aurora/Uniswap/exchanges only).
- **Acceptance:**
  - [ ] (M) Buy at the Ramp minimum with a card: it returns to the app, an Arriving row shows, then USDC appears with a push.
  - [ ] Choose XAUt0: it buys USDC, and on arrival the swap review opens pre-filled.
  - [ ] Cancel inside Ramp: no Activity row.

### B6 Swap any ↔ any
- **Promise:** trade any token you hold for any listed token.
- **Entry points:** Plus → Swap · B2 Swap circle · ticket "Pay with" (auto) · card/pool funding (auto) · B9 composed step.
- **Steps:**
  1. "You pay" card: asset chip ⌄ (any holding, B0.1), amount, balance, Max.
  2. Flip circle.
  3. "You receive" card: asset chip ⌄ over all verified tokens (token list, searchable), estimate.
  4. One line: rate · impact. Details: route marks (Monorail/KyberSwap), minimum received, network fee, steps.
  5. Keypad → slide → step-up → `OperationStatus`.
  - (P) The same ticket. Test AUSD ↔ test USDC swaps **at par** through our own `PracticeSwap` (D-252, UNDEFINED-6 closed; `contracts/src/testnet/PracticeSwap.sol`, 10143 `0x1D75…9e6A`): no aggregator is asked, the receive plate shows the typed amount, the line reads "1 AUSD = 1 USDC · at par", Details and the review say "Practice swap · at par" with "Network fee: Sponsored", then the same slide → passkey step-up → `OperationStatus` → journal → Activity "Swapped AUSD → USDC". Both test dollars are always in "You receive". Every other Practice pair (MON, tokens) keeps the lock: "Swaps run on Mainnet".
- **Rules:**
  - Quotes come from Monorail and KyberSwap in parallel. The better `minOut` wins, and the routers are pinned (routes.md §2).
  - Approvals are exact (`ch/spot-swap.ts:111-131`).
  - Slippage defaults to 50 bps (`ch/spot-swap.ts:21`). The deadline is 300 s (`:23`).
  - **Impact:** over 1% turns amber. Over 5% blocks, with "Max $X under 5%". This replaces gold-only caps (plan §0.7 decision 5; BD-2).
  - Unverified tokens can be paid with (sell only, warned) and never received.
  - MON paid keeps the fee reserve (B11). The 10 MON floor (`ch/spot-swap.ts:33-37`) binds delegated accounts, and any MON-value step that follows another step within 3 blocks. A lone spend from an undelegated EOA may empty it (UNDEFINED-2).
  - When the paid asset is partly in trades, the composer prepends a pull from trading (B0.4).
  - Quote TTL ~30 s, then automatic requote. A change below the reviewed `minOut` → "Price moved · review again".
- **States:**
  - Quoting: shimmer on the receive amount.
  - No route: "No route for this pair".
  - Impact amber: "High impact 3.2%".
  - Impact block: "Too big · max $412".
  - Short balance: "Not enough XAUt0".
  - Short fee: "Add MON for fees" (B11 composes it).
  - Unknown outcome: "Checking the swap" with no new slide.
- **After:** success "Swapped 10 USDC → 0.0025 XAUt0" + Activity "Swapped" row + receipt (route, minOut, tx).
- **Today → gap:**
  - Trading-account AUSD↔USDC only, chosen by share chips (`m/features/fund/SwapTicket.tsx:58-63`). No fee preflight (`m/features/fund/useCollateralSwap.ts:34`) (#12).
  - Spot swaps are USDC↔9 tokens through Uniswap v4 (`cfg/spot.ts:1-10`). Impact is displayed only, with no gate (`m/features/tokens/useTokenTrade.ts:66-79`).
  - (P) shows a paragraph (`m/app/fund/swap.tsx:45-64`). (M) before deploy is a dead end (`swap.tsx:40-41`) (#4).
- **Acceptance:**
  - [ ] (M) MON → XAUt0, XAUt0 → USDT0 and WETH → MON each quote, slide, step-up, finalize, and appear in Activity.
  - [ ] A size over 5% impact blocks and shows the max. Tapping the max fills it.
  - [ ] A spam token appears in "You pay" with a warning and is absent from "You receive".
  - [ ] Calldata to a non-pinned router is refused before signing (test with a tampered quote on the fork).
  - [ ] (P) AUSD → USDC and back at par from the ticket: review "Practice swap · at par", slide, step-up, Activity row. The chain half is proven live (`scripts/drive` `practice-swap-check`, 3 Oct: approve 57.3k + swap 137.9k / 119.2k gas, exact par both ways, float total unchanged); the screen walk waits for the merged simulator pass.

### B7 Send any asset to a person or address (Monad)
- **Promise:** send any token to a @handle, contact or address.
- **Entry points:** Plus → Send · profile → Send (F6, prefilled) · B2 Send circle · Activity receipt "Send again".
- **Steps:**
  1. Recipient: bottom search "Name, @handle or address" + Paste + **Scan**. Recents and Following avatars above.
  2. Amount: asset chip "AUSD ⌄" (any holding), hero, keypad, Max.
  3. Review: avatar, @handle, full address (grouped), amount, network fee, steps. **Slide** → passkey step-up.
  4. Status → "Sent" sound → receipt.
  - (P) Identical with P$ and test tokens. Fees are sponsored.
- **Rules:**
  - Address checksum (EIP-55). A mixed-case mismatch → "Address typo · check it".
  - A contract recipient warns: "This is a contract".
  - **Inbox addresses are blocked**: "Deposit inbox · not a wallet".
  - Self → redirect to B8 (kept from `m/features/withdraw/SendToAddress.tsx:74-75,242-249`).
  - First-time recipient: "First send to this address".
  - A @handle is re-resolved just before broadcast (kept: `SendToAddress.tsx:149-156`).
  - Source order: wallet first, then the trading part via a composed pull (`SenryoCore.withdraw` to the recipient, `q/withdraw.ts:26-44`).
  - MON keeps the reserve (B11).
  - Unknown outcome → no new send (B0.5).
- **States:**
  - Resolving: "Looking up @kai".
  - Not found: "@kai isn't on this network".
  - Locked: "212 free · 300 in trades ›".
  - Short fee: B11.
  - Camera denied: "Allow camera to scan".
  - Unverified asset: "Unverified token · send anyway?".
- **After:** receipt (amount, to, fee, tx, Share) → Activity "Sent 20 AUSD to @kai" → the recipient gets a push (if a Senryo user) → recents update.
- **Today → gap** (#5):
  - AUSD/USDC only (`SendToAddress.tsx:55-58`). Wallet/Trading segmented control (`m/app/withdraw/send.tsx:33-41`).
  - Regex only, with no checksum, contract or inbox check (`m/features/withdraw/useRecipient.ts:12,41`). No scanner.
  - Wrong copy: "money stayed in your account" and "shows in Activity" (`m/features/withdraw/words.ts:8,11`). Wallet sends aren't indexed.
  - Recents come only from core `WITHDRAW` rows (`q/recipients.ts:33`).
  - The amount draft is cents-only, so 18-decimal tokens can't be entered (`m/features/withdraw/amount-draft.ts:11-15`).
- **Acceptance:**
  - [ ] Send MON, XAUt0 and AUSD to a @handle, a scanned QR and a pasted address. Each needs a slide and a passkey, then a receipt and an Activity row.
  - [ ] Paste a known inbox address: blocked. Paste a contract: warned. Paste your own address: redirected to Withdraw.
  - [ ] AUSD with 300 in trades: Max = wallet + free part, and the review lists "Pull from trades" as a step.
  - [ ] Kill the app after the slide: on relaunch the row shows pending, and no second send is possible.

### B8 Withdraw any asset to my own address or exchange (Monad)
- **Promise:** move any token to your exchange or another wallet you own, on Monad.
- **Entry points:** Home → **Withdraw** · B2 Withdraw circle · Settings → Wallet → saved destination.
- **Steps:**
  1. Asset (B0.1; "300 in trades" noted).
  2. To: segmented **Monad · Another chain · Bank**. Monad → saved destinations (exchange marks) + New address (paste/scan).
  3. Amount (B0.2).
  4. Review: asset mark → destination mark, you receive, fee, steps → slide (+ step-up unless the destination is your own Senryo address).
  5. Status → receipt.
  - (P) Identical, with test tokens and a saved test destination.
- **Rules:**
  - The B7 recipient checks apply (checksum, contract, inbox).
  - Exchange destinations show "Monad network only" + the exchange's asset tip. Coinbase supports Monad USDC (plan §0.6); other exchanges are UNDEFINED-7.
  - Dollar assets: the trading part is pulled automatically. The locked part (margin, holds) shows "300 backs open trades ›" → positions.
  - Withdrawable from trades = min(token balance, FreeToTrade) (`q/withdraw.ts:19-24`; `docs/plan/specs/risk-math.md:25`).
- **States:**
  - No saved destinations: "Add a destination" + New address.
  - Locked: "Only 212 can leave now".
  - (M) before core deploy: the wallet part still works, and trading pulls are disabled with "Trading not live".
  - Unknown outcome: no new action.
- **After:** receipt + Activity "Withdrew 50 USDC to Coinbase". The destination is offered for saving (B13).
- **Today → gap:**
  - The trading account → own wallet is the only path, AUSD/USDC only (`m/features/withdraw/WithdrawToSelf.tsx:41-44,67`).
  - (M) is a dead end before deploy (`m/app/withdraw/index.tsx:31-32`) (#4). Prose footer (`:51-53`).
- **Acceptance:**
  - [ ] Withdraw WETH to a pasted exchange address: step-up → receipt → Activity → "Save as Coinbase?" offered.
  - [ ] AUSD with a margin lock: Max stops at the free part, and the link opens Positions.
  - [ ] (M) before deploy: withdrawing a wallet token works, and no screen says "trading" is required.

### B9 Withdraw any asset to another chain
- **Promise:** send any token to an address on another chain.
- **Entry points:** B8 → **Another chain** · B2 Withdraw → Another chain.
- **Steps:**
  1. Asset.
  2. Chain grid filtered by the routes table (routes.md §3): mark, fee, ETA, minimum.
  3. Destination address (format checked per chain: EVM, Solana base58, BTC, Tron, TON).
  4. Amount → quote.
  5. Review: route mark, you receive, fees, ETA, steps → slide + step-up → timeline (Sent → Bridging → Delivered).
  - (P) USDC → Sepolia via CCTP only. Other assets read "Mainnet only".
- **Rules:**
  - An asset with no direct route composes "Swap to USDC and withdraw" as one operation (B0.4). Unverified tokens never auto-compose: "Unverified · swap first" (BD-7).
  - Quotes go through the `services/api` proxy. The app signs the Monad-side transactions (approve + deposit/burn).
  - Refunds land on the Monad wallet (Relay) or are re-mintable (CCTP).
- **States:**
  - Same as B4 (expired, refunded, failed, degraded).
  - Invalid destination format: "Not a Solana address".
  - Below minimum: "Minimum 5 USDC".
- **After:** timeline + push on delivery + Activity "Bridged 50 USDC to Base" + receipt (both hashes).
- **Today → gap:** shell only (`m/app/withdraw/cash-out.tsx:3-10`). The capability is always unavailable (`q/capabilities.ts:56`).
- **Acceptance:**
  - [ ] (M) 10 USDC → Base via CCTP or Relay is delivered. 5 AUSD → Base USDC via Relay is delivered.
  - [ ] XAUt0 → Arbitrum shows "Swap to USDC and withdraw" with 3 listed steps.
  - [ ] Kill mid-bridge: the timeline resumes.

### B10 Sell to bank (Ramp off-ramp)
- **Promise:** cash any token out to your bank.
- **Entry points:** B8 → **Bank** · B2 Withdraw → Bank.
- **Steps:**
  1. Asset (sellable: MON, USDC, AUSD, USDT0; others show "Swaps to USDC first").
  2. Amount.
  3. Ramp off-ramp flow (payout details).
  4. Ramp returns asset, amount and deposit address → review in the app → slide + step-up → the app sends to Ramp in the same operation → status until payout.
  - (P) "Mainnet only".
- **Rules:**
  - Needs a Ramp `hostApiKey` with off-ramp enabled, issued through Ramp support (not self-serve). Until then the row reads "Bank cash-out pending Ramp approval".
  - The sell minimum is about $6.68 and varies by country.
- **States:**
  - Region or method unsupported: "Not available in your country".
  - KYC: "Ramp is checking your ID".
  - Payout pending: "Payout on its way".
- **After:** Activity "Sold 100 USDC · Ramp" + payout status + push.
- **Today → gap:** not built (D5). `cashOut` is always false (`q/capabilities.ts:56`). The Withdraw footer says "Bank withdrawal is unavailable" (`m/app/withdraw/index.tsx:52`).
- **Acceptance:**
  - [ ] Without the key: the Bank tab shows the pending row and no dead button.
  - [ ] With the key (M): sell the minimum, the crypto leaves in one step-up, and the payout status appears.

### B11 Network fee reserve
- **Promise:** a money action never fails for lack of fee money.
- **Entry points:** every money action's review (fee row) · B1 MON row ("Keeps 0.4 for fees").
- **Steps:**
  1. The review shows "Network fee ~$0.01" (never "gas").
  2. If MON is short, Details adds a step: (P) "Fee top-up · sponsored"; (M) "Swap ~$0.50 to MON".
  3. The same slide covers it.
- **Rules:**
  - Fee budget = Σ (gas limit × signed max fee) over the planned steps (`m/features/trade/useGasTopUp.ts:102-117`). User max fee = base × 1.25 (`cfg/gas.ts:248-253`).
  - (P) Sponsor top-up via `StarterDrip.topUp` (`sol/StarterDrip.sol:104-112`), which funds the next 3 sends (`cfg/gas.ts:230`).
  - (M) MON pays. Max on MON keeps the reserve. Monad's value-dip rule: a transaction can't lower the balance below 10 MON
    (delegated EOAs always; undelegated EOAs except for one "emptying" transaction per 3 blocks;
    `context/02-monad/differences-from-ethereum.md:14-18`).
  - Composed steps that spend MON value go **first**, or keep ≥10 MON after them.
  - (M) zero-MON bootstrap: the sponsor top-up becomes eligible on **wallet** value ≥ $10. Today it requires core equity, which is impossible before deploy (BD-4).
- **States:**
  - Short: "Add MON for fees". The composed fix shows in Details.
  - Top-up refused: "Fee top-up unavailable · add MON".
  - Daily cap reached: "Fee limit reached · try tomorrow".
- **After:** the fee is in the receipt. The top-up is its own Activity row ("Network fee top-up").
- **Built (claude/compose, 2 Oct):** `planNetworkFee` (`q/compose.ts`) keeps a self-sustaining reserve — what one
  top-up costs (approve + aggregator swap × today's max fee). An operation that would leave less MON prepends
  "~$0.50 of a dollar asset → MON" as steps of the SAME operation (Details "Network fee"), waits 3 blocks for the new
  MON, then runs; an operation the MON already pays for is never blocked; below the top-up's own fee (a zero-MON wallet)
  it names the MON it needs. Send, withdraw, swap, pool deposit and the ticket (Mainnet) all plan it with the review.
  Fork-checked: `scripts/drive` `compose-fork-check`.
- **Still open:** the zero-MON bootstrap needs the sponsor (BD-4: `StarterDrip` on 143 + `topup.ts` eligibility on wallet
  value) — an EOA can't pay for its own first swap.
- **Was (before claude/compose):**
  - The (M) top-up can't work: it needs equity ≥ $10 (`services/api/src/topup.ts:41`, `cfg/gas.ts:236`) and there is no 143 address book (`packages/contracts/src/addresses/index.ts`) (#4).
  - `SwapTicket` has no preflight (`useCollateralSwap.ts:34`) (#12).
  - "Gas" in user copy (`m/app/(sheets)/add-money.tsx:65`, `m/features/fund/MonadInbox.tsx:153`, `m/features/withdraw/words.ts:8`).
  - The 10 MON reserve is applied unconditionally to MON sells (`m/features/tokens/useTokenTrade.ts:61`).
- **Acceptance:**
  - [ ] (M) A wallet with USDC and 0 MON sends USDC: Details lists "Swap ~$0.50 to MON", and one slide does both.
  - [ ] Max MON leaves the reserve. A second MON send within 1 s doesn't revert.
  - [ ] No screen in the app shows the word "gas" (grep check over `m/`).

### B12 Activity and receipts
- **Promise:** every movement of your money has a row and a receipt.
- **Entry points:** Home header clock · B2 "Activity" section · push tap · `OperationStatus` "View receipt".
- **Steps:**
  1. Full screen with segmented **All · Trades · Money · Card**.
  2. Pending journal rows on top (spinner). Then dated rows: subject mark, verb title, time, coloured signed amount.
  3. Row → receipt sheet: amount, from → to (marks), fee, route, steps, hashes, **Share** · **Explorer**.
  - (P) Identical. The explorer opens testnet.
- **Rules:**
  - Sources: indexer events (core, pool, card, starter), **wallet transfers in and out of any token** (D8), swaps (router events or the journal), bridges and Ramp (journal + route status), and pending journal records (`q/operations.ts:113-127`).
  - Dedupe by tx hash + log index.
  - Titles: "Sent 20 AUSD to @kai", "Received 0.1 MON", "Swapped USDC → XAUt0", "Bridged USDC to Base", "Bought 100 USDC · Ramp".
  - Unverified inbound transfers are hidden from All unless revealed (B14).
  - An unknown outcome row reads "Checking" and never offers resend.
- **States:**
  - Loading: 6 row skeletons.
  - Empty: "No activity yet" + Add money.
  - Error: "Couldn't load activity" · Retry.
  - Offline: cached rows + "Offline".
  - Indexer lag: pending rows stay until the event lands.
- **After:** Share sends a receipt image or link. Explorer opens the tx.
- **Today → gap:**
  - Indexer events only (`m/features/portfolio/useActivity.ts:21-35`). The indexer watches core, pool, starter and inbox stablecoin transfers only (`indexer/config.yaml:13-67`). Wallet transfers and spot swaps are missing.
  - The receipt sheet is a placeholder (`m/app/(sheets)/receipt.tsx:5-8`).
  - The pending block is captioned "Pending on this device", followed by a sentence (`m/features/portfolio/PendingOperations.tsx:30,50-52`).
  - The SWAP title is "Collateral swap" (`m/features/portfolio/activity-copy.ts:77`). There is an extra Orders chip (`:17`).
- **Acceptance:**
  - [ ] After B6, B7, B3 and B9 runs, each appears under Money with the right title and mark, and opens a receipt with Share and Explorer.
  - [ ] Receive 1 USDC from an outside wallet: a "Received" row appears without any app action.
  - [ ] Pending bridge row → kill → relaunch: the row is still there and resolves.

### B13 Contacts and saved destinations
- **Promise:** people and places you send to are one tap away.
- **Entry points:** B7 and B8 pickers · after a successful send ("Save as…") · Settings → Wallet & address → Saved destinations.
- **Steps:**
  1. People = Following + Recents (avatars).
  2. Saved destination = name + address + chain + mark (exchange, bank or own wallet).
  3. Manage: rename, delete (swipe), add (paste/scan).
- **Rules:**
  - Stored server-side per account and mode (SIWE), so they follow the account to a new phone (A3). Endpoint `GET/PUT /v1/destinations` (BD-5).
  - Recents come from journal + indexed sends of **any** asset, not only core withdrawals.
  - A saved address is re-checked (checksum, contract, inbox) on every use.
- **States:**
  - Empty: "No saved destinations" + Add.
  - Duplicate: "Already saved as Coinbase".
  - Offline: read-only cached list.
- **After:** the destination appears first in pickers.
- **Today → gap:**
  - None exist. Recents come from core `WITHDRAW` rows only (`q/recipients.ts:30-34`).
  - The last typed recipient is persisted per device and source (`m/features/withdraw/SendToAddress.tsx:96-101`).
- **Acceptance:**
  - [ ] Save "Coinbase" after a withdraw. Reinstall and sign in: it is still there with the Coinbase mark.
  - [ ] A send to a followed trader shows their avatar in Recents next time.

### B14 Spam and unverified tokens
- **Promise:** junk tokens never pollute your balance or trick you.
- **Entry points:** B1 Other tokens · B2 banner · pickers (Other tokens section).
- **Steps:**
  1. Unverified rows sit under Other tokens with a monogram + "Unverified".
  2. B2 banner → **Hide** or **Report**.
  3. Hidden tokens move to "Hidden (n)" (unhide there).
- **Rules:**
  - Verified = token-list address match only.
  - Unverified tokens: no price, no swap-in suggestion, never "You receive", no arrival push or moment, excluded from Total.
  - Send is allowed with the warning. Swap is sell-only, warned. No auto-compose (BD-7).
  - Lookalike symbol (e.g. a fake "WMON" `0x561a…`): "Not the listed WMON".
  - Hide/report is stored per account (with B13 storage). Reports feed the server spam list (UNDEFINED-8).
- **States:** hidden: "Hidden" · Undo; reported: "Reported" (toast).
- **After:** a hidden token leaves Other tokens and Activity All.
- **Today → gap:** new. Today these tokens are invisible, because only listed tokens are read (B1).
- **Acceptance:**
  - [ ] The live spam tokens (fake WMON, SAKURA, JUSTIN) land under Other tokens, show no value, and send no push.
  - [ ] Hide → gone. Hidden (1) → Unhide → back.

### B15 Practice money
- **Promise:** P$ lands where you can use it, in one tap.
- **Entry points:** Add money → **Get practice money** · setup step 3 (P) · empty Positions/Assets states.
- **Steps:**
  1. "Get P$100" card (art) → slide → status.
  2. Afterwards: "Claimed · use a code ›" → voucher sheet.
  3. "Daily top-up" row (faucet) on the same panel.
  - (M) The row is absent, and Card or bank leads.
- **Rules:**
  - One claim per address (`sol/StarterDrip.sol:73-74`): MON drip + practice AUSD credited to the trading account (`:76-82`).
  - Vouchers credit the trading account (`:100`). The faucet mints test stables to the wallet (`cfg/gas.ts:111-112`).
  - **Usable where it lands:** the composer routes P$ to wherever the next action needs it (trading ↔ wallet ↔ pool) as a composed step, so the user never sees the split (BD-3).
- **States:**
  - Signing/sending: inline spinner.
  - Already claimed: "Claimed".
  - Pending relay: "Claim pending · check status".
  - Voucher errors keep their named reasons (`m/app/(sheets)/voucher.tsx:21-30`), shortened to ≤8 words.
- **After:** P$ appears in Assets (AUSD "· 100 in trades") + Activity "Practice funds claimed".
- **Today → gap** (#12):
  - The claim credits trading, but the pool spends wallet AUSD (`m/features/lp/useLp.ts:73,77`).
  - The faucet is hidden on the pool screen (`m/features/lp/LpScreen.tsx:150-155`).
  - Sentence copy in the claim row (`m/app/(sheets)/add-money.tsx:62-81`) and the header (`:96`).
- **Acceptance:**
  - [ ] Fresh account: claim → P$100 → deposit P$50 to the pool from the pool screen with no "move to wallet" step visible.
  - [ ] Redeem a voucher → amount shown → Assets updates.

### B16 Total and breakdown
- **Promise:** one honest number, with its parts one tap away.
- **Entry points:** Home hero tap · compact header balance.
- **Steps:**
  1. Hero: Total (decimals in `text3`), `≈` ⓘ when partial, "— 24h" until value history exists.
  2. Tap → Balance sheet: Total, then rows with marks: **Assets** · **Positions** (PnL; margin as subtitle) · **Earn** · **Arriving** · **Card holds (−)** · **Card debt (−)** [Repay].
  3. "Missing price: SAKURA" row when partial.
- **Rules:**
  - Each dollar counts **once** (BD-1). Assets = wallet tokens (verified, priced) + trading collateral (gross).
  - Positions = unrealized PnL − accrued funding/borrow (margin is already inside Assets).
  - Earn = pool shares + pending redemptions (`ch/portfolio.ts:164-173`).
  - Arriving = bridges and Ramp with a finalized source leg, plus legacy inbox balances (`ch/portfolio.ts:174-195`).
  - Holds and debt are subtracted (BD-8). Today the code adds holds back (`ch/portfolio.ts:42-45`), and this rule changes that.
  - Partial = any verified component unpriced or unread (`ch/portfolio.ts:34-41`). Unverified tokens never make it partial.
- **States:**
  - Loading: hero skeleton.
  - Partial: `≈` ⓘ.
  - Stale: "Updated 2m ago".
  - Error: "Balance unavailable" · Retry.
  - Hidden balances (A10): "••••".
- **After:** rows open their surfaces: Assets tab, Positions tab, Pool, Activity (Arriving), Card.
- **Today → gap:**
  - The label "Total portfolio" + "Partial · View details" (`m/features/home/HomeHeader.tsx:52,69-75`).
  - The sheet is "Portfolio details" + a paragraph (`m/app/(sheets)/balance-details.tsx:14`, `m/features/portfolio/PortfolioDetails.tsx:25-29`).
  - Components are Wallet/Trading/Pool/Inbox (`ch/portfolio.ts:116,150,164,174`). There is no Arriving or holds row.
  - Practice MON is excluded (#12).
- **Acceptance:**
  - [ ] The sum of the sheet rows equals the hero to the cent (holds and debt subtracted).
  - [ ] Add a spam token: Total is unchanged and not `≈`. Unlist a verified token's price: `≈` + "Missing price" row.
  - [ ] An in-flight bridge shows under Arriving and leaves when it is delivered.

---

## Decisions settled here (BD-n; D-numbers are assigned when `decisions.md` records them)

| # | Decision | Why |
|---|---|---|
| BD-1 | Each dollar counts once: collateral sits in Assets, Positions = PnL only | Plan §0.9 lists both "in trades" on AUSD and "margin" on Positions, which would double-count |
| BD-2 | One impact rule for every swap (warn >1%, block >5%, show max size) | §0.7 decision 5; XAUt0 depth is thin (routes.md §2) |
| BD-3 | P$ is routed by the composer to where the next action needs it | B15 split defect |
| BD-4 | Mainnet fee top-up eligibility counts verified wallet value ≥ $10 | Core equity is impossible before deploy; zero-MON users are otherwise stuck |
| BD-5 | Saved destinations are stored server-side per account and mode | Stateless sign-in (A3) |
| BD-6 | Card purchases of unlisted assets buy USDC and swap on arrival (two confirmations, named) | Ramp confirms off-app, and the quote is unknown until arrival |
| BD-7 | Unverified tokens never auto-compose into another action | A composed step would hide a risky sale inside one slide |
| BD-8 | Card holds are subtracted from Total (shown as a "−" row) | Plan §0.9 says "Card holds (−)", while `ch/portfolio.ts:42-45` adds holds back. A hold is a committed payment |

## UNDEFINED (research tasks, not user questions)

1. **Holdings endpoint shape:** `/v1/holdings` response, cache TTL, HyperSync token scope. The Envio token is assumed to cover 143/10143 HyperSync.
2. ~~**Are user EOAs 7702-delegated on Mainnet?**~~ **Settled 2 Oct (claude/compose):** no. The app never signs an
   EIP-7702 delegation for a user account (`signDelegation` has no caller in `apps/`; D-145/D-155 were the sponsor spike),
   so accounts are plain passkey EOAs: the 10 MON floor binds only a second MON value spend within 3 blocks — which a
   composed operation is. The existing reserve on every native send is kept, and the composer puts MON-spending steps
   first (`packages/query/src/compose.ts` `assertMonOrder`).
3. **Wrong-chain recovery:** the same key controls the address on other EVM chains, but the user has no gas there. Candidates: a gasless permit route or phrase export (A6).
4. ~~**"Send from a connected wallet"** for B4~~ **Settled 2 Oct:** deposit address. Relay's open-mode deposit
   addresses work into Monad for USDC, AUSD, MON and USDT0 from every EVM chain in the route table without a key (live,
   `scripts/drive` `deposit-address-check`); Solana / Bitcoin origins need `RELAY_API_KEY`. A connected wallet stays out
   of scope.
5. **Ramp purchase status** with the keyless hosted page (what `finalUrl` returns). The React Native embed: `WebView` vs browser.
6. ~~**Practice swap:** no AUSD/USDC pool on 10143.~~ **Settled 3 Oct (D-252):** `PracticeSwap` swaps test AUSD ↔ test USDC at par from its own float (P$1,000,000 a side, refilled by the deployer's mint; no owner, no role). The ticket (B6) and pool "Pay with" (D1, test USDC → test AUSD) use it; MON and tokens stay locked in Practice.
7. **Exchange Monad support list** beyond Coinbase USDC, and the exchange tips per asset.
8. **Spam report backend** (store, threshold, shared list).
9. **Native MON inbound via internal calls** (contract → user): needs traces. Can HyperSync transaction selection find them?
10. **Swap event source for Activity:** router logs vs journal-only for swaps made outside the app.
