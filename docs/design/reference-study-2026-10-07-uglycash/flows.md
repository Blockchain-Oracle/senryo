# All supplied flows and Senryo mappings

“Observed” below means visible in the ordered screenshots. Taps and transitions inferred from changed states are not timestamped observations. All unseen failure, retry and exit branches remain required target acceptance, rather than assumed reference behavior. Exact describes the intended presentation; adapted describes Senryo-specific semantics. None of the supplied flows is silently excluded.

## U01 — “Adding Bitcoin to portfolio” — 10 screens

Observed: S01 USDT holding drawer with chart, position facts, Share/Add thesis, transactions and Sell/Buy. S02 zero amount, number pad and disabled rail. S03–04 entered amount and fee. S05 expanded details: fee, output, impact, gas and estimate. S06 thumb mid-rail. S07 processing. S08 check. S09 blue-sky **USDT sell** result with Update thesis/Close. S10 portfolio return. The archive title is inconsistent with the actual flow.

Target: `features/asset`, `features/swap`, `features/trade`, positions, receipt and thesis owners. Exact amount hierarchy, disclosure and rail states; adapted spot-swap/perp reduce-close contracts. Never translate a spot sell into a leveraged close without its real quantity, risk and review. Fee/output data come from the selected route; no sponsored-gas or 30-second promise inherited. Missing: source quote expiry, cancellation threshold, retry, failed/unknown settlement. Preserve amount and show journal-backed recovery.

## U02 — Adding funds via Apple Pay — 7 screens

Observed: S01 portfolio → S02 Add funds method sheet → S03 Apple Pay token search → S04 zero amount → S05 $2 and fee → S06 native Apple Pay confirmation → S07 payment processing. Apple Pay is paying Crossmint in this reference. No delivered balance is shown.

Target: `features/money`, `features/fund`, `features/money/ramp.ts`, add-money sheet and arrival tracking. Exact method-picker/search/amount hierarchy where the actual provider permits; adapted Ramp native SDK and supported Monad assets. Apple Pay appears only when the real provider/account/region/asset supports it. Native provider-owned checkout cannot be reskinned as an app-owned clone. Preserve cancel, provider error, started/pending/released/delivered distinctions and return to the same draft. Crossmint parity is a capability decision, not an assumed Ramp property.

## U03 — Adding users to club — 5 screens

Observed: S01 club profile: sky header, member/friend counts, photo, description, creation date, performance card, Traders/Posts/Liked, Privacy/Notifications, Share/Add/Delete. S02 empty user-search sheet. S03 results with Add. S04 some rows become Member. S05 membership list with Remove and owner identity.

Target: retained clans/competitions scope plus `features/social`, API social authentication/moderation, query and identity. Exact surface/row/state anatomy. Additive club lifecycle requires persistent club, membership, invite/request, owner/admin roles, visibility, notifications, moderation and deletion contracts. The screenshots do not establish whether private-club “Add” invites or forcibly enrolls; resolve that distinction in the API contract. No fake working membership controls while service work is pending.

## U04 — Concealing wallet balance — 5 screens

Observed: S01 Home balance with quieter fractional digits, white balance card over black account header. S02 Display Balance sheet with preview and Privacy mode toggle. S03–04 illustrated concealment choices replace values in preview and parent. S05 dismissed sheet; concealment also applies to Portfolio total. Text says tapping balance also hides it.

Target: `lib/hide-balances.ts`, `features/home/HomeHeader.tsx`, balance-details, assets, portfolio and card. Adapt existing persisted boolean into display preference with selected owned illustration, preserving old setting migration. New explicit Display Balance entry opens the sheet; tapping balance toggles concealment, while the information affordance opens breakdown. Mask sensitive values in compact headers, accessibility output, notifications previews and share previews according to their own visibility contracts. Reuse Senryo artwork, not UGLYCASH pig/mascot crops. Keep explicit Show/Hide for discoverability.

## U05 — Copying link to profile card — 3 screens

Observed: S01 another user's holding drawer → S02 full-screen black trade card with hanging bear art, date/identity/P&L/entry/invested/current and Copy/Share → S03 public profile with Copied toast. It is not clear whether Copy copied a URL, image, or mixed payload.

Target: `features/social/share-links.ts`, trader positions/profile, existing trade card/receipt infrastructure. Exact artifact-first presentation and feedback; adapted owned Senryo card art and verified current facts. Keep trade-card link distinct from profile link; settle payload by checking existing share backend/deep links. Blocked part: stable public trade permalink/image metadata if absent. Do not expose another user's private position or use a negative P&L card as a positive result.

## U06 — Exporting private keys — 5 screens

Observed: S01 portfolio export entry → S02 warning/acknowledgement and disabled Ethereum/Solana buttons → S03 acknowledgement checked and buttons enabled → S04 export page with Copy key → S05 Copied. The key itself and any actual authentication are not visible.

Target: `app/account/recovery.tsx`, `features/auth/PhraseGrid.tsx`, passkey step-up and `packages/account` recovery functions. Adapt the warning-sheet/acknowledgement presentation to **Export recovery phrase**, the actual Senryo recovery method. Keep fresh passkey authentication, screenshot protection, hide on background/timeout and current no-clipboard contract. Raw Ethereum/Solana-key export and the competitor clipboard behavior are not implied by visual fidelity. Missing raw-key interoperability, key derivation/ownership and supported-network contracts remain blocked if requested as an additional capability. Never present an empty export page as success.

## U07 — Filtering trading clubs leaderboard — 3 screens

Observed: S01 Social Communities surface on sky background, white Trading Clubs panel, All/Crypto/Traditional/Predictions and 24h/7d/30d/alltime. S02 category Traditional selected. S03 24h selected and rankings change. Medal/ordinal, avatar, name, membership/trade counts and P&L have separate roles.

Target: existing trader leaderboard and retained club leaderboard. Exact category/period/filter hierarchy, selected pills and aligned rows; adapted supported Senryo categories (Pairs/Predictions/other verified execution classes) and actual supported periods. Club rankings need a real aggregation/scoring service, realized/unrealized definition, snapshot freshness, membership cutoffs and anti-abuse rules. Never compute rank from a decorative local sample. Empty/no-ranking/error and preserved filter state required.

## U08 — Following users — 2 screens

Observed: search query with Clubs/Users tabs and Other Users rows with Follow; then Followed Users and Other Users groups, Unfollow actions and same retained query/keyboard.

Target: `features/social/FollowButton.tsx`, People/FollowListScreen, API follow and query caches. Exact row grouping, black Follow/white Unfollow and contextual identity. Existing follow semantics stay; pending state must prevent duplicate taps, failure restores state, private/listed/blocked cases use actual rules. Group reordering must preserve focus and scrolling. Club tab becomes real only with its search owner.

## U09 — Searching for users — 2 screens

Observed: club-scoped sheet with club title, Username field and empty Find users illustration; populated results while keyboard is visible, clear affordance and Add row actions.

Target: People search plus future membership picker. Exact input/list/empty illustration geometry; adapted generic People action = Follow, club action = Add/Invite according to verified permissions. Keep query after child profile dismissal and show loading/no-match/network failure separately. Never treat a search failure as “no users.”

## U10 — Searching — 5 screens

Observed: S01 portfolio floating search trigger → S02 focused full-page search → S03 numeric query, empty Tokens/Prediction Markets/Users groups → S04 text query with token and prediction results → S05 scrolled prediction/user results with keyboard dismissed. Some results are political; that is source content, not Senryo scope.

Target: market search, predictions search/watchlist, social search, shared identity and search adapters. Adapt one global entry with grouped Pairs, Predictions, People and later real Clubs; existing holdings/token compatibility stays accessible without becoming the pitch. Separate group loading/error/empty states; cancel returns to originating list position; click routes with correct provider/network/instrument. Source does not demonstrate recents; retain Senryo's existing recents as an addition.

## U11 — Sending money — 8 screens

Observed: S01 Portfolio Transfer → S02 first-use “Move money globally” primer → S03 textured Send workspace with pixel amount, balance/country selectors, Request/Wallet/Send controls and custom keypad → S04 insufficient funds → S05 black source-balance chooser with fees and verification route → S06 valid smaller amount → S07 recipient search with empty Recents → S08 no matching recipient. There is **no review, signature, receipt or successful send** in this archive.

Target: `app/withdraw/send.tsx`, money input/review, handle resolution, QR scanner, account signer and operation journal. Exact workspace composition, source chooser and recipient-search hierarchy; adapted supported assets/networks, actual transfer fees and signer. Senryo needs an owned texture and matching readable display face. Request/global/country routes remain capability work, not pretend cash remittance. Add missing recipient confirmation, amount/fee review, authorization, pending, final/failed/unknown outcome and receipt. No instant/free/undo claim imported.

## U12 — Sharing club profile via messages — 4 screens

Observed: club profile → illustrated invitation preview on dimmed parent → native share sheet with PNG → Messages composer containing image, invitation text and link. No sent-message outcome is shown.

Target: future club detail and owned invitation renderer, system share, public URL/deferred-link handling. Exact preview-first hierarchy, dismiss and native handoff; adapted Senryo graphics and current club facts. Club link routes nonmembers through permitted join/request; private membership/data remain private. Cancel restores profile. Native share completion is not proof a recipient joined or a message was delivered.

## U13 — Sharing financial profile by message — 3 screens

Observed: public profile with performance chart, counts and open/closed holdings → native URL share sheet → Messages composer with profile caption and link. No sent outcome shown.

Target: TraderProfile/ProfileHeader, `share-links.ts`, web watch query route and native deferred links. Exact native share flow; adapted network-qualified Senryo URL and preview metadata from public fields only. Handle browser fallback, app installed/not installed, signed-out, unlisted/deleted profile and network choice. Native share cancellation remains silent.

## U14 — Signing up & onboarding — 19 screens

Observed: S01–04 blue-sky carousel, product phone compositions, condensed captions and progress marks; S05 auth landing with Apple/Google/phone options and legal copy. S06–09 phone number/SMS/code keyboard forms. S10 account-linked error sheet. S11–12 native Apple sign-in and biometric ceremony. S13–14 username keyboard form. S15 optional referral. S16 terms sheet. S17 **Face ID primer sheet over Home**. S18 **iOS permission**. S19 Home.

Target: Welcome/auth/setup, passkey/account provider, handle, voucher, terms, biometric/native configuration. Exact content hierarchy, concise one-task screens, keyboard placement and contextual Face ID sheet. Adapt auth options to real Senryo passkey creation/sign-in/restore/guest; phone OTP/OAuth are not silently added or faked. Preserve owned approved onboarding art, recomposed in the reference layout/background rather than replaced without need. Referral copy follows actual eligibility; no 10% commission benefit imported. Persist completed steps per account, migrate existing pending state, legal acceptance before gated actions, then show Home and contextual biometric primer. Notifications follow a separate optional prompt after user context, never stacked under another system alert. This adapts phone/account setup while retaining Face ID and recovery.

## U15 — Transferring funds via QR code — 4 screens

Observed: portfolio → Add funds → Deposit crypto sheet with Solana/USDC copy, branded QR, address and Copy → portfolio with a higher balance. No sender, transaction hash, polling duration or finality evidence appears.

Target: receive sheet, `features/fund/DepositAddress.tsx`, `DottedQr`, network/asset selectors and arrival tracker. Exact method → QR/copy → contextual return. Adapt to actual Monad/network/address and supported token; never accept the source's “any token on Solana” as Senryo's deposit promise. Show minimums/wrong-network guidance only when real. Copy feedback is not receipt; credit requires confirmed account data. Add QR scanning readability and full-address accessibility checks.

## U16 — Writing trade thesis — 4 screens

Observed: holding drawer Add thesis → expanded keyboard-aware composer with author, text, attached asset/amount, “Visible to everyone,” 0/200 counter and disabled Post → nonempty text/enabled magenta Post → drawer with published author/body/Thesis marker/time and Update thesis.

Target: ComposeThesis/API posts, owned position attachment, Feed/Thread/position detail. Exact contextual entry/composer/return and inline published placement. Adapt the source's 200 limit to the current API's real 280 unless jointly changing validation; never truncate silently. Current composer has create behavior; confirm/add true edit support before labelling Update thesis. Add draft retention, publish pending, server error/retry, owner edit/delete/moderation and account/network change handling. Posting in implementation QA uses an authorized sandbox account; no public external post is part of this plan.
