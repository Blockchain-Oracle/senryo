# Senryo × UGLYCASH revamp — approved plan, 7 October 2026

**Recommendation: adopt the supplied UGLYCASH native visual and interaction system across Senryo, with explicit adaptations for Senryo's accounts, trading, networks and providers. This includes the background colors.** Implement in complete journeys on the existing Expo/React Native stack. Treat this as a new product-wide direction, not another Home-only palette adjustment.

Status: **approved by the user (“lgtm”), 7 October**. The first implementation slice covers native colors/type, three-context navigation over the retained stacks, Money Home, Display Balance/privacy and contextual Face ID. [Implementation and validation record](../design/reviews/2026-10-07-uglycash-foundation.md). The remaining journey and functional roadmap below stays in scope. No release upload, deployment or contract transaction is part of this slice. The earlier research-only status describes the planning turn, not current source.

**Later user clarification, 7 October:** all prediction interactions belong inside the mobile app. The website is not a replacement or required trading destination. Initial prediction underlyings are **BTC and ETH only**. If existing integrations cannot deliver the required native experience, the user accepts writing/deploying Senryo's own prediction contract on **Monad testnet**, with Mainnet a subsequent possibility. Working interpretation: stake/settle in **MON**, while predicting BTC/USD or ETH/USD; BTC/ETH are not the collateral. This is an acceptable fallback to evaluate, not an instruction to abandon providers or immediately deploy an unspecified contract.

**Final scope clarification, 7 October:** substantial cleanup is authorized as part of the revamp. The user explicitly includes usernames, all forms, receive, profiles and onboarding loading. All 89 supplied screens have now had a second visual pass. The [forms and states contract](../design/reference-study-2026-10-07-uglycash/forms-and-states.md) is part of implementation acceptance, including each of the 19 onboarding screens, actual username validation/save rules and states absent from the reference.

## 1. Product and authority lock

Senryo is a **mobile app for accessible pair trading on Monad, predictions, money movement and Kinpaku**, with social discovery supporting traders. Practice comes first; the browser is a companion. Existing holdings compatibility does not turn meme-coin discovery into the product positioning.

The authoritative visual source is the user's 16 UGLYCASH ZIPs: **89 screenshots, all inspected**, indexed by SHA-256 and step in the [new study](../design/reference-study-2026-10-07-uglycash/README.md). [All flows](../design/reference-study-2026-10-07-uglycash/flows.md) and the [parity ledger](../design/reference-study-2026-10-07-uglycash/parity-ledger.csv) are part of this plan.

Latest instruction > supplied native pixels > actual Senryo capability/security contracts > supplementary Refero metadata > older visual plans. UGLYCASH supersedes the conflicting Slush/Fomo Home/Card composition, dark-default Living Lacquer palette, violet/blue general action styling, Fomo dock and floating inset sheet geometry. Preserve actual account/operation integrity, authentic entity marks, approved owned art, receipts, privacy, accessibility and all retained product work. An older file saying “approved” does not veto this new visual direction.

The two linked chats were read directly, including the correction about mobile-first product understanding, prediction clutter and retaining everything in the plan. Historical simulator/deployment statements are not reverified release facts.

The later steering adds **Tradash live behavior and sound**, and inspection of the sibling `canton-season3` / Owarine work. UGLYCASH remains the color/branding/composition authority. Tradash is a leveraged long/short reference; Senryo predictions retain actual binary/contest semantics. See the [Tradash fidelity contract](../design/reference-study-2026-10-07-uglycash/tradash.md) for evidence, data ownership, chart/audio details and explicit adaptations.

Working baseline: `/Users/abu/dev/hackathon/metropolis`, branch `codex/senryo-unified`, HEAD `44d876ba5e2e8f4e812a2ad170eaef393e714845`. Existing dirty work includes prediction components, CardIssued, product docs and unfinished website assets/CSS. Preserve it. Record the actual baseline again before implementation; do not reset the checkout or resurrect an older worktree. The existing source census covers 114 mobile/web entries and 1,317 source files; it is an inventory, not per-file runtime acceptance.

### Current project status and completion dependencies

The [status snapshot](../design/reference-study-2026-10-07-uglycash/project-status.md) maps every product area to source, historical acceptance, present observations and next gates. On 7 October the public API health/readiness and both prediction discovery reads returned 200. Config advertises only Practice engine chain 10143. The XAU/EUR socket connected but delivered observations about 29 minutes old during a 12-second sample; source freshness needs diagnosis before a live-chart claim. Provider/store/device readiness is not inferred from health checks.

Existing passkey/account, native biometric, risk/trading, money/journal, receipt, card-sandbox, social, notification, Skia/Reanimated and audio machinery should be carried forward. Predict is currently **view-only, REST-polled every 20 seconds**; its existing chart shows outcome-share prices, not the underlying settlement-price line. Real-time chart/data and execution/positions/claims are separate delivery milestones. Mainnet, Perpl/funding/card production, physical push/device acceptance, pool lifecycle, programmes/content and companion/distribution remain open with their named dependencies.

This revamp therefore has two connected tracks: the entire mobile visual/journey system, and the remaining functional completion/acceptance. We will not mark a capability complete because its redesigned screen exists. Each slice owns both and records a concrete dependency when provider/platform work cannot yet finish.

## 2. Approaches considered

| Approach | Consequence | Recommendation |
|---|---|---|
| Adopt UGLYCASH presentation and complete journeys while reusing Senryo's domain/services | Closest usable fidelity; reveals missing club/share/provider contracts; allows reviewable sequential slices | **Use this** |
| Apply new colors and cards to the current shell | Faster first screenshot; retains the wrong navigation, sheet, keyboard and account hierarchy | Insufficient for the user's request |
| Rewrite the whole app and replace the account/provider substrate | More regression risk; can lose working recovery, journals, risk and payment behavior without improving visible fidelity | Unnecessary |

The selected target is one direction. No alternate palette or unrelated “inspired by” redesign is proposed. Implementation sequence does not remove scope.

## 3. Visual lock, including every background layer

| Role | Proposed commitment | Evidence / uncertainty |
|---|---|---|
| Native light canvas | **#F5F5F5**, fresh-install default | Dominant pixels U04-S01, U14-S13/S17, U16-S03. JPEG sampling, not source token extraction |
| Raised content card | **#FFFFFF** | U04 Home, U07 rankings, U15 portfolio |
| App-owned sheet | **#F5F5F5**, edge-attached, rounded upper corners | U03/U04/U14-S17. Replace existing 8-point floating inset geometry |
| Input/search inset | **#ECECEC** starting sample | U14-S13; validate per component and state |
| Primary ink/black CTA | Black; white text on black | Throughout native forms and source method sheets |
| Vivid action accent | **#FA00FF** for reference trade/publish/selected controls and limited glow | U01/U04/U16. Do not reinterpret it as every background, all text or positive P&L |
| Secondary text | Use a contrast-checked gray; #6E6E6E is an initial readable candidate on #F5F5F5 | Exact source gray varies. Small text cannot default to sampled pale gray |
| Positive/negative facts | Dedicated green/red, preserving genuine direction and +/- labels | Source charts and money facts. Never use magenta to mean a profitable trade |
| Profile/onboarding/success scene | Blue sky with clouds and composited owned art | U03/U12/U13/U14/U01-S09. Requires actual image asset, not a flat blue substitute |
| Send workspace | Owned grayscale texture, dark panel, distinctive amount/keypad treatment | U11-S03–08. This is a deliberate separate visual environment |
| Scrim | Dim the still-recognizable parent for ordinary sheets; tune against source | U04/U14. Do not replace with the older universal heavy blur |
| Native alerts/checkouts/share sheets | Native system/provider rendering | OS/version-dependent; preserve the genuine ceremony |
| Splash/system bars/background transitions | Coordinate with the light canvas and active scene | Current `app.config.ts` imports DARK for native background/splash; change requires checking native build impact |
| Dark preference | Retain an accessible dark option as a labelled Senryo adaptation | No native dark reference supplied. Explicit existing user preference is preserved; old purple styling is not the target |

**Typography:** source uses strongly condensed headings/amounts alongside readable utility text. Refero's website style names Helvetica Now Display Cn Bold and Inter; this does not prove the native app uses either. Identify a matching licensed/vendored condensed face before locking native glyphs; compare actual headline and money strings at phone scale. Do not silently substitute generic bold Inter or copy web display sizes into the app. Keep fractional digits quieter, currency aligned with the numeric baseline, tabular values where appropriate and Japanese glyph coverage. No clipped accessibility text.

**Geometry:** reproduce the original 393 × 852 inferred point canvas before adapting to 390/402-point phones. Estimate and validate gutters, top strips, row heights, card radius, sheet top corners, amount baselines and bottom safe-area clearance from originals. Existing 20-point gutters and 44-point minimum touch targets can remain only where the reference and accessibility support them. Do not assert exact 16/38/46-point radii from web metadata.

**Contrast adaptation:** sampled #FA00FF against white is approximately 3.23:1; black on magenta is 6.51:1. Keep neon magenta; use black for small text on its filled controls or another measured compliant treatment. Record this visible deviation. Don't soften the whole palette to avoid the issue.

**Art and identity:** Senryo seal and Kinpaku gold-leaf card remain owned identities. Preserve/recompose approved onboarding art in the reference's framing and sky composition. Create/source an owned sky, send texture, privacy illustrations, club invitation and share-card artwork with provenance. Do not ship competitor mascots, stickers, cards, Visa/payment-provider branding without the actual capability, screenshot crops, generic replacement coin circles, fake verification badges or invented user photos.

## 4. Proposed navigation and information architecture

Reproduce UGLYCASH's **three-context floating dock plus top context tabs**, adapting its labels to Senryo. Keep current route URLs and stack/state ownership behind the new shell. This is a proposed navigation adaptation requiring review with the design, rather than a claim that the source already has Senryo's five destinations.

| Bottom context | Top destinations | Existing routes / retained capability |
|---|---|---|
| Money | Home · Card · Activity · Pool · Profile | `/home`, `/card`, `/activity`, `/lp`, `/you` |
| Trade, owned seal as central visual anchor | Pairs · Predict · Watchlist · Orders · Profile | `/markets` and its existing modes, `/orders`, `/you` |
| Social | Feed · People · Clubs · Profile | `/social`, existing people/search/watch routes; real club routes added with services |

Senryo's core pair trading is one tap from every root. Card remains prominent under Money rather than buried in settings. Profile has a consistent entry in each context; opening it preserves origin so Back restores the right parent. Global search sits above the dock on applicable discovery screens, matching the source; hide it when a keyboard or transactional sheet owns the space.

Use top selectors that scroll only when needed on smaller widths or large text. Do not squeeze five labels into illegible widths. Preserve route stacks, tab scroll positions, search drafts, watchlist selections and deep links across context switches. Existing five logical route stacks can remain registered; change chrome and route-to-context mapping rather than destroying and recreating screens. Context and source route must be explicit for shared Profile/Activity pages.

The older separate Phantom plus/fan **presentation** is superseded by the supplied method-sheet presentation. Preserve all four operations (Send, Receive, Add money, Swap) through the new Money/Transfer sheet and relevant existing entry points. Do not run two competing floating docks or repeat all four actions in every hero. Home uses source-style Add funds/Withdraw; trade portfolio exposes the actual wallet↔trading Transfer when available. The method sheet distinguishes these operations clearly.

Clubs is retained capability work, not a fake placeholder list. Until the service exists, the design preview can demonstrate its anatomy with clearly labelled design fixtures; production cannot pretend those memberships or rankings are real. Existing users, following and trader leaderboard remain fully reachable during rollout.

## 5. Screen and journey contracts

### Money Home and privacy

Use U04/U14-S19: top strip → dark account/card header with handle and small card affordance → overlapping white balance card → compact portfolio/trading summary → relevant content. Keep one dominant true balance; do not reproduce the reference's demo growth counter, APY/cashback marketing or synthetic performance. Wallet, margin, pool equity and Kinpaku capacity retain their actual accounting; spending capacity is not a second asset. Use concise Practice/Paper money context with correctly aligned currency/cents.

Balance tap toggles concealment; explicit Display Balance opens the U04 preview/toggle/illustration sheet; the information affordance opens real breakdown. Migrate the existing persisted hide-balances boolean without revealing amounts. Use an owned concealment mark. Cover compact header, portfolio/card amounts, screen-reader values and user-generated previews. Public performance privacy and local hide-balances are separate controls.

Loading keeps geometry; known zero, unavailable, partial and stale are different states. Contextual add-funds/withdraw actions do not bypass account/legal/review guards. Transaction rows open Senryo details/receipt first; explorer stays secondary.

### Trading, holdings, predictions and thesis

Use U01/U16 for a detailed instrument/position drawer: identity and author/context, price/change, chart and periods, invested/current/average facts where meaningful, Share/Add thesis, expandable transaction history, then the correct actions. Use the source amount/keypad/fee-disclosure/slide hierarchy for supported transactions. Retain Senryo's specific margin, leverage, liquidation, SL/TP, reduce/close, pending order and durable-operation semantics. A spot token sell and a perp close are separate operations.

Lead Markets with pairs. Keep Predictions as a clear named destination. One readable title/question, authentic underlying identity and outcome/contest facts precede secondary filters. Put category/period/provider filters behind compact controls using the reference's hierarchy; prevent the earlier crowding of network, 5m/15m and context labels. U10 supplies grouped search; it is not evidence for a new binary prediction trade flow. Existing Polymarket public binary discovery and Castora numerical contests stay distinct. Execution, positions, exits, claims and settlement remain required integration work; view-only state stays truthful until verified.

**Live trading workspace:** adopt Tradash's focused chart/current-price/position feedback and contextual controls inside the new UGLYCASH shell. Header identifies the instrument or exact prediction round; one chart and its live value dominate; compact period/view/settings and position controls sit within reach; detail/review opens over the retained chart context. No lime/dark Tradash chrome is imported. Native Skia/Reanimated already exist. Reuse engine subscriptions, add a version-verified prediction provider stream, and distinguish underlying price, resolution print, outcome-share price and executable exit value. Keep a short live view separate from actual historical periods. Use time-based easing, timestamped samples, stale/closed states, truthful raw numeric values, restrained rolling digits and explicit next-round selection. Preserve Senryo approval/review/journal rules; a reference's one-tap live order does not authorize changing them. Full [data, chart, sound and acceptance contract](../design/reference-study-2026-10-07-uglycash/tradash.md).

Proposed execution sequence: live **read-only** BTC/ETH binary workspace plus provider/native-contract feasibility → select a viable native execution route → genuine quotes/orders/positions/exit/settlement/claims. Existing Castora numerical contests remain separate retained integration work, not a substitute for binary Up/Down. Provider/account/network/eligibility dependencies must be real before enabling actions; discovery remains usable while those are built. Native completion must not depend on sending the user to a provider's website to place, manage or claim a prediction.

### Prediction execution amendment — native app and owned Monad fallback

The user's requirement is the end-to-end experience: choose BTC/ETH and round, view real-time prices/rules, enter/review/approve, watch the actual position, exit when supported, settle/claim and inspect history inside Senryo. A backend/API/contract is infrastructure behind that native experience. An explorer/source link can be secondary information; it cannot substitute for an unfinished native feature.

| Route | Fit | Decision criterion |
|---|---|---|
| Existing binary venue integrated natively | Can reuse external liquidity/settlement; requires compatible account, network, eligibility, API and native transaction lifecycle | Keep if it genuinely supports the complete in-app journey and required market scope |
| **Senryo-owned BTC/ETH binary contract on Monad testnet** | Removes dependency on another venue's trading UI; can use test MON with the existing passkey wallet and native controls | Accepted fallback. Evaluate contract/oracle/liquidity model and implement if provider route fails the native requirement |
| Basic round pool with claim only at expiry | Smaller contract, but stake is locked and payoff depends on pool rules | Not equivalent to Tradash-style entry/live exit. Do not quietly substitute this restricted model for the requested experience |

Contract design must specify round length (existing 5m/15m are starting candidates, not newly confirmed choices), fixed start/end times, entry cutoff, exact price feed/boundary rule, equal-price outcome, missing/stale oracle timeout/refunds, fees, collateral accounting and permissionless user claims. A live price chart does not itself resolve a contract. Existing `SessionOracle` is a pair-trading push-feed/session adapter; reusing its latest value does not establish the exact opening/closing price for a short BTC/ETH round.

For tradable binary shares with early exit, select a fully collateralized liquidity/quote mechanism and fund its testnet liquidity. A contract deployment alone does not create a counterparty, executable price or reliable Close. State stake, shares, quote/expiry, price impact, maximum loss, fees and current exit proceeds truthfully. Keep settlement oracle and indicative display feeds distinct. Do not copy the unlicensed Castora contract or port Owarine's Canton ledger model.

Treat prediction collateral as a separately accounted balance; do not draw on Senryo's existing pair LP or card collateral implicitly. Native MON requires payable calls, gas reserve/maximum spend, protected passkey authorization, exact-once operation reconciliation and MON-denominated payouts/refunds. Dollar equivalents are indicative; a MON stake is not a stable dollar balance. A wrapped-MON implementation, if selected, must handle the conversion inside the app and record the denomination accurately.

Execution milestones for the fallback:

1. Specify the smallest model that still delivers the requested native entry/position/exit/settlement lifecycle. Verify BTC/ETH feed availability, historical/boundary evidence, update costs and testnet/Mainnet deployments against current official documentation and read-only chain checks.
2. Implement original contracts and targeted invariant/adversarial tests for collateral conservation, bounded payouts, withdrawal/claim reentrancy, cutoff/oracle manipulation, liquidity/slippage, duplicate claims, refund and permission boundaries; integrate existing native account/operation owners.
3. Deploy and verify on Monad testnet; record chain/address/bytecode/constructor/roles and transactions. Use test MON for end-to-end native opening, live observation, closing, settlement/claim/refund and interruption recovery. Clearly identify test money.
4. Evaluate Mainnet separately: deploy/configure actual network contracts and oracle endpoints, fund liquidity/gas, reconcile roles/monitoring/indexer and verify real-money accounting/security/operations. Passing testnet proves that tested lifecycle, not production readiness automatically.

The same Solidity design and native UI can be used on both networks, but Mainnet is **not only a token-label change**. Networks have separate state/deployments, dependencies and real-value collateral/liquidity. Refer to Monad's current [testnet information](https://docs.monad.xyz/developer-essentials/testnet), [Mainnet information](https://docs.monad.xyz/developer-essentials/network-information) and [deployment summary](https://docs.monad.xyz/developer-essentials/summary). Current [Pyth EVM deployments](https://docs.pyth.network/price-feeds/core/contract-addresses/evm) and [price-update documentation](https://docs.pyth.network/price-feeds/core/fetch-price-updates) are an oracle candidate research source, not a locked vendor or proof that exact-boundary settlement is already available.

U16 composer is contextual to a real owned position, shows attachment/visibility/count over the keyboard and returns to that position after confirmed posting. Retain the real 280-character API limit unless changing both contracts. Confirm/add an edit endpoint before promising Update thesis. Failed publish keeps draft; pending prevents duplicates; moderation and deletion remain.

### Add funds, receive, send, swap and cash-out

Adopt U02/U15 short method sheets with actual provider/asset marks. Receive states name the precise network, token/address, QR and Copy; arrival comes from actual data. Native funding stays in-app where the current provider supports it. Apple Pay checkout is genuine and provider-driven; Apple Pay processing is not wallet delivery. No automatic Crossmint, Solana, bank rail, fee or “buy any token” claim.

U11 Send gets the same textured workspace/amount/source selector/recipient search structure using owned artwork. Fill the reference's missing latter half: recipient identity/address and network verification → amount and fee review → genuine approval → journal-backed pending/final/failed/unknown outcome → branded details/receipt. Preserve draft across cancel/insufficient funds/provider return. A submitted onchain transfer is not undoable because a reference has an Undo-looking control.

Swap keeps executable quotes distinct from display prices, with supported pair, output, fee, slippage, expiry, gas, route failure and changed-quote review. Cash-out and bridge retain actual provider status, refunds and destination checks. No quoted value is invented to make the redesigned screen look finished.

### Kinpaku card

Use the new light surfaces, compact controls and money hierarchy around Senryo's actual full card artwork. The supplied screenshots show card promotion but **not** issuance, reveal, freeze, spending or repayment journeys. Preserve Senryo's current real card lifecycle; extend the reference language without calling those screens exact UGLYCASH copies.

Keep unissued/locked/issuing/active/frozen/unavailable distinct, bounded signed daily allowance, expiry, genuine Available/On hold/debt/Repay, secure details, authenticated activity and receipts. Pending approval cannot share the screen with an earlier attempt's terminal error. Sandbox truth is adjacent to the card; no live spending, cashback or Wallet provisioning claim imported.

### People, profiles, clubs and sharing

Use U08/U09 People rows and contextual search, U13 sky-header public profiles, U07 ranking cards and U03 club controls. Real identity/photo, follow state, aligned P&L, time periods and privacy determine the data. Profile financial facts appear only when actually public. Missing data is not a zero chart.

Share three separate things: public profile URL (U13), trade card/permalink (U05), club invitation image/link (U12). Each has its own permitted fields, owned renderer, caption, image/link metadata, native preview and deferred destination. No sent/joined success is inferred from opening a share sheet. Invite/join, add/remove, member roles, privacy, notification opt-in, scoring and moderation need persistent service contracts before production controls work.

Username is an explicit journey, not a minor input restyle: reproduce U14-S13–S14's title/owned identity, large recessed field, condensed text, magenta caret and black keyboard-anchored action. Keep Senryo's actual @handle and server claim rules; implement empty/typing/checking/available/invalid/taken/reserved/held/check-failed/saving/refused/saved/resumed and profile rename/remove states. Profile editing, search and Receive have their own complete [state tables](../design/reference-study-2026-10-07-uglycash/forms-and-states.md). Source native sign-in/payment spinners do not establish a universal app loader or timing.

### Settings, recovery and the rest of the product

Apply the same canvas, typography, groups, sheet shapes and control language to account/security/privacy, notifications/alerts, terms/help/status, restore/delete data and error states. U06 warning/acknowledgement presentation maps to the actual recovery-phrase flow: fresh passkey, protected reveal, hide after timeout/background and no clipboard. Do not replace it with a hollow “Copy Ethereum/Solana key” page.

Pool, rewards/referrals/clans/competitions, news/chat/X linking, notifications, provider enrollment, Mainnet, web companion, accessibility, widgets/Live Activities, docs/distribution and operations remain in the existing [follow-through register](reference-followthrough-2026-10-04.md). New visual scope does not close or drop them. Add UGLYCASH-native patterns when their individual contract is implemented; no fake reward amounts, fake news or decorative chat threads.

## 6. Face ID and first run — exact visible ordering, honest authorization

Source U14 has two different system ceremonies: Apple sign-in at S11–12 and local Face ID enablement at S17–18. Senryo's account uses passkeys. We keep that account model and reproduce the **local biometric primer** treatment, not a fake Apple OAuth sheet.

Proposed new-account sequence:

1. Reference-composed welcome with owned art and concise Senryo promises → create account / existing account / guest using genuine existing routes.
2. Real passkey ceremony; cancellation leaves account state uncreated and draft intact.
3. Handle and optional voucher/referral where actually supported; compact forms and correct keyboard layout.
4. Actual required legal acceptance; maintain its gating and accepted-version record. No competitor legal documents or commission benefit copied.
5. Home visible → compact **Enable Face ID** bottom sheet, owned/system face icon, one sentence, black Enable button, outlined Not now. No full-page illustrated biometric detour.
6. User taps Enable → actual native permission/scan → dismiss to the same Home after verified result. OS owns the permission alert and Face ID rendering. App owns the primer and truthful state.
7. Separate optional notifications request after the biometric ceremony has completely ended, or defer until notification context. Never stack two permission prompts.

Resuming an interrupted setup uses per-account persisted state. Migrate existing `SETUP_STEPS`/pending entries so moving Face ID over Home does not restart completed setup, repeat terms, lose voucher state or strand restored users. Declining a local primer is stored as deferred; don't nag on each Home render. Retry lives in Security or a user-initiated unlock when appropriate. Returning sign-in and restored-device behavior are explicit paths, not reruns of every first-run screen.

Keep permission state, last successful scan, device-gated secret availability and transaction authorization separate. A successful `authenticateAsync` is not proof that a transaction was signed or that every future unlock has valid key access. Device biometric confirmation does not replace passkey step-up for recovery or policy changes. Use accurate descriptions matching existing session/threshold/every-trade behavior.

Required branches: loading capability check; Face ID/Touch ID/Android biometric type; none enrolled; unavailable hardware; unsupported old binary; decline/Not now; native cancellation; permission denied with Open Settings; lockout; failed scan; app inactive/background; success; biometric enrollment changed. Reuse `lib/biometrics.ts`, `system-prompt.ts`, `foreground.ts`, account secret store and step-up ownership. Ensure privacy cover protects app-switcher captures without obscuring a user-requested native prompt; never start signing while inactive.

SDK 57's official [Expo LocalAuthentication documentation](https://docs.expo.dev/versions/v57.0.0/sdk/local-authentication/) confirms the native API, capability/error states, permission configuration and that Face ID requires a development build rather than Expo Go. Physical-device success remains a separate acceptance requirement. [Apple's LocalAuthentication guide](https://developer.apple.com/documentation/LocalAuthentication/logging-a-user-into-your-app-with-face-id-or-touch-id) is the native behavior authority. Existing native configuration already has the biometric module; verify permission copy and build/runtime impact rather than reinstalling libraries reflexively.

## 7. Motion and material contract

The supplied files are screenshots. They show initial, intermediate and final states of the U01 slider and the layering of sheets/keyboards/native overlays. They do **not** establish exact durations, easing, spring parameters, audio or haptics. Request/use a recording only if exact source motion matching becomes necessary; it does not block the visual plan.

| Interaction | Preserve from evidence | Proposed implementation / acceptance |
|---|---|---|
| Sheet | Edge-attached base, rounded top, handle, dimmed live parent | Reuse current gesture machinery with new geometry; test scrim/drag/Back/keyboard/scroll handoff and restoration |
| Amount/rail | Huge centered amount, custom keypad, fee disclosure, disabled → drag → processing → result | Reuse current reviewed financial thresholds and invalidation; no second submission or success before journal facts |
| Native auth | Visible parent before/after genuine system UI | Serialize prompts, await foreground, cancel safely and preserve originating state |
| Follow/membership | Immediate clear row-state changes and grouping | Pending and server-confirmed result with rollback, no double tap or focus loss |
| Thesis | Composer expands with keyboard; posted content returns to context | Preserve draft on error, accurate attachment/visibility, safe dismissal |
| Search/dock | Content above dock, keyboard owns bottom space | Hide redundant floating controls while typing; preserve query, scroll and keyboard focus |
| Sky success | Full scene and owned identity after completed operation | Optional short art motion only after real result; Close stays available; no fabricated growth |

Retain existing purposeful press feedback as an initial Senryo adaptation, tune after phone comparison. Proposed 180–240 ms simple travel is an implementation starting range, never an observed source measurement. Keep continuous gesture work on Reanimated/UI thread, avoid blocking content on decorative entry, preserve current audio/haptic preferences and quiet-mode rules. Reduced Motion removes travel; Reduced Transparency uses a readable opaque material. Do not add a compulsory soundtrack to reference screenshots.

The user subsequently requested **Tradash-style sound and live feedback**. Its moving price head, rolling values, gain/loss band and event cues extend this contract; they are not inferred from the silent UGLYCASH ZIPs. Reuse Senryo's owned sound service and persisted preferences (effects/haptics currently default on), add confirmed open/close/settlement cues and optional rate-limited live-position reactions. Mute stale/background/reconnect bursts; deduplicate fills across socket/query/relaunch; respect the native silent switch and audio interruptions. Optional music is a separate opt-in. Don't ship Tradash audio files or count a clip playing as financial completion.

## 8. Implementation slices and source owners

Each slice delivers complete happy/failure/Back/resume behavior and evidence. No new framework, wholesale data refactor or separate expansive test project is needed.

The [39-row parity ledger](../design/reference-study-2026-10-07-uglycash/parity-ledger.csv) accounts for all 16 supplied flows and 23 cross-product/retained areas. The [route map](../design/reference-study-2026-10-07-uglycash/route-coverage.csv) carries all 114 existing mobile/web entries into these slices with their direct source owners; mapped/existing does not mean redesigned or runtime-tested. Newly required club/provider/platform routes join the same register as they are introduced.

| Slice | Work | Source owners | Exit gate |
|---|---|---|---|
| 0 — reference and capability lock | This study, Tradash/sibling fidelity, parity ledger, current status/dirty-state baseline; diagnose feed age; resolve font/art provenance; confirm proposed context mapping | New study/plan; engine/keeper/oracle freshness; existing product and follow-through docs | Reviewed target; every reference flow and retained family accounted for; current data facts stated |
| 1 — foundation and Home | New semantic color/type/shape roles, light default/native background plan, source shell/context tabs/dock, edge-attached sheet primitive, Home/balance/privacy | `packages/tokens`; mobile `theme`; `components/kit`, `components/shell`, `components/sheet`; home/portfolio; `lib/hide-balances.ts`; `app.config.ts` | Phone comparison of Home, privacy sheet, one populated list and keyboard sheet; all old routes reachable |
| 2 — first-run and security | Welcome composition, forms, terms sequencing, contextual Face ID, migration/resume, recovery restyle | auth/setup/account routes, `lib/biometrics.ts`, account/secure store, native configuration | Fresh/returning/guest/restored flows, cancel/decline/retry/background and actual native Face ID |
| 3 — money journeys | Add-funds method sheet, genuine native provider checkout, QR receive, Send texture/source/recipient/review/result, swap, withdrawal/bridge and branded details/receipts | money/fund/swap/withdraw; shared query/chain/account journal; provider adapters | Practice execution/quote/recovery and QR/readability; separate provider-delivery acceptance |
| 4A — live workspace and pair trading | Pair discovery/search, focused live chart and owned sound/reactions, position/instrument drawer, ticket/protection/close/orders; clean read-only Predict with actual streaming data | markets/trade/trading/predictions; existing EngineSocket/PriceStore and Skia; query/API/keeper/oracle | Feed-source age, reconnect/foreground/60–120 Hz/audio and entire Practice lifecycle; truthful prediction chart/rollover |
| 4B — native prediction execution | BTC/ETH only; viable native provider or original Monad testnet MON-backed binary contract; quotes/orders/positions/exit/settlement/claims/recovery; separate Castora/Perpl work retained | prediction/perpl adapters or new prediction contracts/oracle/liquidity; account/chain/journal/API/indexer/keeper | Complete native lifecycle and verified testnet contracts/transactions if fallback selected; Mainnet separately configured/funded/verified |
| 5 — people/profile/thesis/sharing | Contextual People/search/follow, sky profile, rankings, inline thesis + true edit, three distinct share artifacts and links | social/profile/watch/identity; API posts/follows/privacy; share renderers/deep links | Cross-network privacy, draft/error/rollback, correct share targets and return paths |
| 6 — clubs and programmes | Persistent club/membership/roles/privacy/notifications/moderation, club rankings/invites; retained rewards/competition contracts | New service/query/mobile club modules behind existing social/account owners | Real memberships/ranks/permissions; no fixture-backed production completion |
| 7 — card and remaining surfaces | Card lifecycle in new visual language; pool, alerts/inbox/settings/help/status and retained content/platform features | card/Lithic, LP, notifications, settings; retained work register owners | Complete lifecycle evidence; simulator/device/provider boundaries stated |
| 8 — companion and delivery | Web companion parity and mobile-first website using real new app captures; accessibility/performance/install/update; docs/release reconciliation | `apps/web`, shared tokens, store/build configuration and product docs | Relevant build/checks, device comparison and verified distribution state |

Card controls, settings, error surfaces and pool remain part of foundation coverage even before their full slice. Functional defects blocking a slice are repaired when encountered; don't postpone a broken quote or authentication state until after visual polish. Mainnet/provider prerequisites can proceed independently, but visible availability requires real capabilities and Practice acceptance comes before funded Mainnet checks.

Prepare the live-data/freshness work alongside foundation and money rather than waiting for all social/card art. Its first implementation gate is one actual instrument with current source time, reconnect and an owned cue; then extend to predictions with their own data authority. Do not port Owarine's Canton contracts, fair-price model or web canvas wholesale. Its source is a sibling precedent, not a shared Senryo backend.

When changing shared tokens, trace all package/web consumers. Separate native/companion product roles from marketing art roles so an unfinished website is not silently recolored by one global constant. Keep public claims current. Before changing any Turbo command/config, follow AGENTS.md and read the installed `turbo` bundled documentation.

### Cleanup within each slice

The user authorizes a substantial revamp and cleanup. Remove the superseded presentation once its real consumers have moved: old palette roles/styles, duplicate docks/fans, inset sheet composition, old setup field/header layout and the full-page Face ID primer. Consolidate shared fields/buttons/sheet states where their behavior is actually shared; keep contextual Send, legal, username, Receive and native ceremonies distinct.

Inventory imports, route entry points, asset references and preference/storage keys before deleting. Migrate setup progress, hide-balances, explicit theme/audio preferences and deep links; existing accounts must not restart onboarding or briefly reveal balances. Preserve the dirty source baseline and retained feature/account/provider work. Remove orphan files/assets only after consumer checks and comparable new journeys pass; no blanket checkout reset, route deletion or loss of unfinished backend work. Archive superseded design decisions with a clear current-plan pointer so contradictory historical “approved” directions do not drive new code.

Cleanup acceptance includes all 114 existing entries reachable or intentionally redirected, no competing navigation, no obsolete palette leaks in nested/error/loading surfaces, no missing asset/font references, and appropriate scoped type/lint/export checks. Functional service retirement or stored-data deletion requires its own concrete migration; visual cleanup does not imply either.

## 9. Acceptance and fidelity review

Use side-by-side reference and actual app captures at **393 × 852** plus representative **390 × 844 / 402 × 874**, a small Android phone, large text and reduced effects. Recreate comparable states with an authorized Practice account and actual data, hiding personal/secret information in retained evidence. Screenshots are only one part of acceptance.

For every slice:

1. Compare canvas, surface hierarchy, typography/glyphs, money baseline, gutters, art scale, corners, dock/keyboard/safe-area spacing, native overlay and clear selected/disabled states against named evidence IDs.
2. Click the whole journey: start, type, empty, populated, validation, loading, disabled, request, cancel/Back, retry, success/failure/unknown, interruption and relaunch. Keep parent scroll/draft/filters intact.
3. Check real API/chain/provider data and authority, deduplicated mutation, expired quotes, changed account/network, authenticated privacy and correct deep links. No fake fixture result counts as live acceptance.
4. Verify VoiceOver/TalkBack, Dynamic Type, contrast, focus order, minimum touch areas, reduced motion/transparency and Android Back. Small white-on-neon text is a tracked adaptation.
5. Run scoped lint/type checks and the relevant existing invariants; run platform export/build when changed native/config/font requirements justify it. Add only targeted tests for meaningful new lifecycle or migration risks. Respect installed Turbo docs if using repository Turbo scripts.
6. Record visual fidelity, source checks, simulator, physical device, provider execution, deployment and Mainnet acceptance as separate results. A beta upload is not an installed-device pass.

No revamp-wide completion until all 16 flows and retained Senryo families have owners, implemented or explicitly blocked semantics, visual comparison and required recovery acceptance. Blocked rows need the concrete dependency and next action; sequencing is not exclusion. The study currently proves reference inspection and source-grounded planning only.

## 10. Unresolved evidence and first concrete build target

Known source gaps: native font files/license; actual animation/audio; dark-mode screens; finished Apple Pay delivery; completed Send; export secret/auth sequence; Copy trade-card payload; club permission/join semantics; card operational flows. Senryo gaps: raw-key export compatibility, club services/scoring, stable trade-card public permalink if absent, thesis edit contract, provider/region/payment execution and outstanding Mainnet/prediction delivery. These remain named work, not decorative disabled controls.

Tradash narrows the live-chart/sound reference gap but does not supply exact UGLYCASH motion or a prediction execution provider. Current source-age diagnosis, current provider protocol/market identifiers, authoritative resolution data, native audio/performance and physical-device acceptance remain explicit gates.

**First reviewable implementation target:** Money Home + shared light tokens + source-style dock/top context navigation + edge-attached Display Balance sheet, accompanied by the contextual Face ID sheet over Home. Show the four matching reference states and their actual Senryo versions at phone scale before propagating component decisions across trading/social/card. Reuse current account and balance data. Follow with the full username/onboarding forms and native money journeys, using the second-pass state contract. This confirms the user's requested background, overall composition and biometric presentation early while preserving the full roadmap.
