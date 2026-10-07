# Forms, onboarding, receive and profile — second-pass contract

7 October 2026. The user specifically asked for another careful pass through usernames, forms, receive, profiles, colors and onboarding loading, and authorized substantial cleanup as part of the revamp. **All 16 flows / 89 screenshots were visually rechecked using all 28 private contact sheets.** This document adds implementation and acceptance detail to [the plan](../../plan/uglycash-revamp-2026-10-07.md); it does not claim these changes are built.

Evidence IDs resolve through [manifest.json](manifest.json). “Observed” describes supplied pixels; “required adaptation” describes Senryo behavior that the source cannot establish. Screenshots do not prove timing, server validation, finality or transitions between unrecorded states.

## First run: every supplied onboarding screen

| Evidence | Observed presentation | Senryo target and required branches |
|---|---|---|
| U14-S01–S04 | Four sky/art welcome compositions, condensed captions, magenta progress segments and bottom black Get started | Owned Senryo art in comparable framing; real product promises; responsive safe area; progress follows actual page; Back/skip and returning-user entry stay reachable. Loading an art asset cannot block account access indefinitely |
| U14-S05 | Auth landing, owned-looking hero art, headline, legal copy and distinct provider choices | Genuine create/sign-in/guest/restore routes with passkey account ownership; no decorative Apple/Google/phone buttons without integrations |
| U14-S06–S07 | Empty and filled phone form with keyboard and bottom action | Form layout/keyboard treatment is reusable; phone authentication is not part of Senryo's present account model and is not added merely to copy this screen |
| U14-S08–S09 | Empty code with disabled Next, then filled code with enabled black Next; Paste/resend affordances | Conditional future phone/code integration only. Current passkey flow needs its actual native ceremony/cancel/failure states, not pretend OTP entry |
| U14-S10 | Compact account-linked error sheet over the retained dimmed auth parent; support primary and secondary dismissal | Map classified passkey/account failures to accurate action and retry. Existing wrong/empty account confirmation keeps Use it/Pick another; never silently adopt a different account |
| U14-S11–S12 | Genuine native Apple sign-in, Signing in… spinner and biometric overlay above the parent | Use genuine native passkey UI. Preserve the origin while the OS owns the ceremony; serialize prompts; native cancel returns safely. This spinner is not evidence for a full-screen app loader or a fixed duration |
| U14-S13–S14 | Enter your username, large centered wordmark, recessed broad rounded field, large condensed text, magenta caret and black Claim username above the keyboard | Owned Senryo identity; exact form hierarchy with the username state contract below. Both recorded buttons look black; server availability/disabled rules are Senryo requirements, not proven source behavior |
| U14-S15 | Referral field with Paste icon, secondary no-code action and black Continue; keyboard absent in capture | Preserve actual supported voucher/referral semantics and optional path. Validate real code; save pending/failure/expiry; no copied fee-discount claim. Pasting never submits automatically |
| U14-S16 | Compact legal sheet over gray parent, document rows with chevrons, black Accept | Actual Senryo documents/version and required acceptance. Document child Back returns to the same sheet; failure to record acceptance leaves a retry, not completed setup |
| U14-S17 | Home visible under compact Face ID primer, magenta icon, black Enable and outlined Not now | Move current full-page primer to Home context; persist account-scoped defer/complete. Capability checking, unsupported/unavailable/not enrolled/denied/lockout are distinct |
| U14-S18 | Genuine iOS permission alert above Home | Genuine Expo/native permission and scan result; no imitation permission dialog or success animation as a substitute. Background/cancel cannot mark enabled |
| U14-S19 | Returned Home with the source balance/card hierarchy | Actual account state, setup progress and balances; optional notification prompt only after the biometric ceremony ends. No synthetic balance growth |

Source owners: `features/auth/useAuthFlow.ts`, `features/setup/{SetupScreen,SetupField,progress}.tsx/ts`, `app/setup/handle.tsx`, account/security stores and `lib/biometrics.ts`. The current auth controller already distinguishes idle, running, failure, account check, same-account, signed-in and closing. Restyle those states; do not erase them. Its existing 1,200 ms sign-in confirmation is a Senryo choice, not a measured UGLYCASH delay; it must not delay correctness or trap navigation.

The shared setup container currently carries older Fomo spacing, seal bar and staggered entry. Replace its visible composition where it conflicts with U14. Retain keyboard lifting, accessible labels and per-account progress ownership. Do not force the username screen, legal sheet and Home biometric primer into one generic full-page template.

## Username: a first-class journey

**Visual target:** U14-S13–S14, including canvas, title/identity scale, field, caret, keyboard and anchored black action. Keep Senryo's `@handle` identifier semantics; a competitor's `$` decoration or wordmark does not change the stored name. Display name and username remain separate. Source does not show checking, taken, saving or failure; these are required adaptations.

Actual owners: `app/setup/handle.tsx`, `features/profile/useHandleField.ts`, `features/profile/{handle-copy,save-refusal}.ts`, `packages/query/src/social.ts`, `packages/api-client/src/{social.ts,routes/profile.ts}`, `services/api/src/social/profiles.ts`. Current rules are 4–20 lowercase letters/numbers/underscores, normalization and a 30-day released-name hold. Reuse those contracts unless changing client and server deliberately together.

| State | Presentation and action contract |
|---|---|
| Empty / suggested / focused | Large editable field with real accessible label; suggestion never overwrites typing when account hydration finishes. Preserve actual optional skip behavior; it must not imply a handle was claimed |
| Typing / checking | Reserve message height; show Checking… after a change while awaiting the matching check. Keep keyboard/focus/caret stable. Existing debounce is 300 ms; this is source implementation, not reference timing |
| Available | Enable claim only for the exact current normalized value. A cached availability result is advisory; the authoritative save can still refuse a name claimed meanwhile |
| Invalid | Distinguish length, allowed characters and blocked names. Show concise field-local reason; action stays unavailable |
| Taken / reserved | Distinct messages; do not label an institution-reserved handle as merely taken |
| Held | Explain previous-owner protection. Setup currently blocks held names; the editor permits a server-authorized last-owner reclaim attempt. Preserve that distinction and server authority |
| Check failed / rate limited | Connection/retry or actual retry window; no available-green from an earlier query. Retry checks the current value, never silently changes it |
| Saving | Single pending claim, stable action dimensions and in-button indicator; disable duplicate tap/keyboard submit. Do not advance setup before the save succeeds |
| Save refused / interrupted | Map HANDLE_TAKEN/HANDLE_HELD and other real failures to field/action. Keep typed value and visibility choices. Reconcile an uncertain outcome against saved profile before retrying a write |
| Saved / resumed | Invalidate/update the correct profile and identity consumers; advance exactly once. Relaunch finds the saved account-specific handle and completed step |
| Edit unchanged / rename / remove | Save sends only changed fields. Explain the real old-name hold before renaming/removing; do not change a display name when changing a username |

Acceptance: fast successive edits with slow/out-of-order responses; paste/clear; upper-case normalization; offline/retry; just-taken race; held-name reclaim; keyboard submit and repeated tap; background/return and account switch during request; restored account; long allowed name and large text. Never render one account's pending name/availability on another account.

Visibility choices already saved with setup must remain explicit and retain Practice/Mainnet separation. They can use a compact contextual control within the new composition; they cannot disappear because the competitor's username screen lacks them.

## Form and loading rules across the product

- Preserve the reference's distinct roles: black form/confirmation CTA; gray disabled control; magenta trading/publish/selected control; #F5F5F5 canvas/sheets, white raised cards and approximately #ECECEC input inset. Use contrast-checked ink and the same condensed display/amount hierarchy. Every nested form, keyboard accessory, validation line and pending control participates in the revamp.
- Keep the focused field, caret and primary action visible above the actual keyboard/safe area. Hide conflicting search/dock controls while the keyboard owns that space. Long text can scroll; do not solve clipping by shrinking every font. Android Back dismisses keyboard/sheet in the correct order.
- Separate initial fetch, refresh, validation, native authorization, submitting and finality. First fetch reserves the eventual geometry; background refresh retains valid data with its actual freshness. A mutation uses local pending feedback. No arbitrary full-screen spinner for every request, countdown simulating backend progress or fixed decorative wait.
- Source loading evidence is specific: U01-S07 processing in the amount rail, U02-S07 native payment processing, U14-S12 native sign-in processing. Search/username/profile fetch skeletons and error states are necessary Senryo additions, not recovered source components.
- Preserve amount/header/fees while processing U01-style financial work. Disable another submission; retain operation ID and reconciliation. Signed/submitted/pending/unknown/failed/completed stay separate. Network timeout alone is not proof of failure. Success money facts come from the actual quote and result; do not copy inconsistencies or transient ghosted digits in a captured reference frame.
- Keep drafts across recoverable errors and nested Back. Account/network changes invalidate incompatible quotes/addresses/results explicitly. Cancellation stops work only where it truly can; an already submitted transaction remains discoverable in Activity.
- Field errors are local, readable and announced accessibly; screen/provider failures retain retry or recovery. Empty/no results/known zero/unavailable/hidden/stale are different states. Keep button width and reserved message space stable without freezing Dynamic Type.
- Native share/auth/Apple Pay screens keep native rendering and lifecycle. Preparing an image, copying, opening a share sheet and sending a message are different events. Do not report completion for an event the app cannot observe.

## Receive and Add funds

**Observed U15:** portfolio → compact Add funds method sheet → taller Deposit crypto sheet with title/network explanation, centered QR, full address and black Copy wallet address → portfolio with a changed balance. These images alone do not establish deposit attribution or confirmation. The source uses Solana/USDC; Senryo must label its actual Monad chain/mode/token.

**Target:** preserve that sheet hierarchy and visual spacing, with Senryo's genuine methods. `features/fund/ReceiveCard.tsx` currently uses one wallet address for every token on the selected Monad network; asset chips alter share text, not the destination. Do not replace it with the narrower trading-deposit inbox or imply asset selection creates another address. Chain/mode is always legible beside the QR/address; optional explanatory text must be verified rather than inheriting old exchange-support claims.

| State | Required behavior |
|---|---|
| Account/address unavailable | Reserve QR/address layout; show accurate loading, locked-account action or error. Never render a placeholder as a scannable payment destination |
| Ready | QR encodes the exact supported address/URI. Display full readable address, actual network/mode, supported assets and black Copy action; compare at phone scale and scan using another device |
| Copy / share | Copied feedback only after clipboard success; keep failure actionable. Share payload uses the same address/network as the displayed QR. Cancellation returns to the sheet; it is not a received deposit |
| Waiting / refresh | Keep ready QR usable while balances refresh; no fake progress. Leaving the sheet does not cancel an inbound transfer |
| Arrival | Reconcile actual transfer/holdings evidence, asset, amount and destination. Current `useArrival` observes a balance increase; it does not prove its origin. Reset baseline on account/network change, avoid classifying an initially discovered token or stale-to-fresh scan as a new external deposit, deduplicate repeated refreshes/cues |
| Other-chain deposit | Keep `DepositAddress.tsx`'s actual bridge quote/address and Waiting/Bridging/Arrived/Refunded/failure lifecycle separate. Persist the saved route/address; no direct-wallet QR substituted for a bridge deposit |
| Account/network change | Replace QR, explanatory text and copy/share payload together; clear old arrival/copy feedback and incompatible selection. Never mix one chain's badge with another destination |

U02 Add funds uses a provider's genuine native Apple Pay approval and Processing Payment. Model preparation, availability/region/asset check, quote, native checkout cancel/decline, processing and wallet delivery separately. Loading methods preserves the sheet rather than displaying invented providers. Reopening a provider operation reconciles the existing attempt.

## Profiles, edit forms, search and share

U13 establishes a sky header with identity/follow/share, readable name/handle/bio, time-range controls, financial chart and position lists. U12 adds club settings/member counts and a separate invitation artwork preview. U05 adds a distinct trade card. Use owned sky/identity/art and actual public facts. A missing bio is different from a failed profile fetch; a private portfolio is different from $0.

`features/profile/ProfileEditor.tsx` currently owns authored portrait selection (no uploads), username, display name, bio and four network visibility flags. It sends changed values, pins Save above the keyboard and maps server refusals to fields. Preserve that behavior while replacing its older field/header/surface composition. New upload/banner controls need real storage, moderation and failure contracts before being enabled.

| Area | Required states and fidelity checks |
|---|---|
| Own profile | Initial fetch/locked session, populated, no saved handle, actual zero/partial/stale finance, private and failed. Owned controls cannot appear on another user's profile; account switch clears private content |
| Public profile | Fetch, real not found, unavailable, permitted public fields, hidden trades and follow pending/failed. Identity and chart belong to the same account and period; no private facts in cached share art |
| Edit | Unchanged Save disabled; changed valid Save enabled; field checking/refusal; pending; saved; cancel/draft decision; background/account switch. Portrait preview and Save operate on the same draft; errors retain the draft |
| People / member search | U03/U08/U09: keyboard remains, results grouped, empty illustration, Add→Member or Follow→Unfollow without remounting the whole list. Distinguish initial empty query/no results/loading/error; row pending and rollback; actual role authorization |
| Global search | U10 groups actual pairs, scoped BTC/ETH predictions, users and future real clubs. Clear/dismiss restores correctly; out-of-order response cannot replace the current query; group failure is not no results |
| Rankings | U07 compact categories and period weight, real rank/avatar/name/count/P&L alignment. Preserve selected filters through retry and profile return; loading/empty/private exclusions cannot display invented winners |
| Profile URL share | U13 native URL preview, correct public destination and metadata; prepare/fail/cancel/return; cold/deferred link opens the right profile without exposing restricted data |
| Trade-card copy/share | U05 own image with exact permitted trade facts; preparation/error; clipboard feedback only after success; native preview. Source copy payload is unknown—define actual image/link behavior explicitly |
| Club invitation | U12 owned invitation image plus real link/role/privacy/expiry; native compose remains user-controlled. Preview→share does not prove message delivery or membership |
| Thesis | U16 keyboard-first contextual composer, owned position attachment, visibility/count and disabled→magenta Post. Use actual 280-character API contract, draft/error/pending/deduplication and confirmed return; implement edit contract before promising Update |

## All 16 flows: second-pass completion register

| Flow | Additional detail locked in this pass |
|---|---|
| U01 sell / instrument | Huge amount and custom keypad, fee expansion, disabled/drag/inline processing/check/sky result; preserve financial facts and parent context |
| U02 Apple Pay | Method sheet → search → amount → genuine native approval/processing; delivered funds require separate evidence |
| U03 club members | Contextual keyboard search, row Add/Member/Remove, owner permission and rollback |
| U04 balance privacy | Toggle changes preview immediately; illustration selection expands sheet; persisted masking covers parent/accessibility/share |
| U05 copy trade card | Separate owned full-card artifact and confirmed Copied feedback; define actual payload |
| U06 recovery | Acknowledgement gates action; authentic protected Senryo phrase reveal. Do not reproduce blank export viewer, raw-key incompatibility or unexplained purple Copy outlier |
| U07 club rankings | Category pill/period weight/sky-white panel geometry with real scoring and reserved loading/empty/error layout |
| U08 follow | Follow/Unfollow and group change retain query, keyboard/focus and rollback |
| U09 user search | Distinguish empty/query/no results/failure; Add respects club membership/role |
| U10 global search | Explicit result groups; focused keyboard versus scrolled/dismissed state; route/query restoration |
| U11 send | Primer/owned texture/amount/source/recipient. Add absent review/approval/journal/result states using Senryo's real money contract |
| U12 club share | Separate invitation image preview and native share/compose with correct join link and expiry |
| U13 profile share | Sky profile hierarchy and native public URL share; privacy-filter chart/positions/metadata |
| U14 onboarding | All 19 screens above; exact username hierarchy, compact legal and contextual Face ID; genuine auth/loading |
| U15 receive | Two method/deposit sheet heights, real network/QR/full address/Copy, actual arrival and return |
| U16 thesis | Contextual keyboard composer, attachment/count/visibility, publish pending/error, saved position and real edit support |

## Cleanup and implementation acceptance

Replace superseded presentation as each complete journey is ported: old dark-default roles, conflicting violet action styling, Fomo-only field composition, floating inset sheet geometry, competing docks/fans and full-page biometric primer. Trace consumers before removing components, old styles, imports and assets; the baseline contains unfinished work that must be preserved or deliberately integrated. Keep account/security/data/provider machinery and genuine feature reachability.

Use the same state set for visual comparison and functional walkthrough: reference-matched empty/focused/filled controls, validation, local pending, native overlay, failure, Back, resume and real success. Check at the reference phone size and representative iOS/Android sizes, large text and reduced effects. A matching screenshot is insufficient when the button, copied address, claimed handle, privacy or native ceremony behaves incorrectly.

Done for this document: second visual pass, source-owner inspection and state specification. Still open: implementation, actual app comparison, device/keyboard/native Face ID/QR scanning, provider delivery and native BTC/ETH prediction execution. The user's owned Monad-testnet contract fallback and full in-app requirement remain in the [execution amendment](../../plan/uglycash-revamp-2026-10-07.md#prediction-execution-amendment--native-app-and-owned-monad-fallback).
