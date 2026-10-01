# Senryo mobile: strict UX, design and motion review

**Reviewed 1 October 2026. Verdict: the redesign has a credible foundation, but it is not ready for mobile design acceptance.** The A3 shell and ticket are materially closer to the approved references. The first-use experience still presents the old text-led onboarding, the planned account/profile sequence is missing, and several recovery and confirmation details need correction before polish can be accepted.

This is feedback for the lead, mobile builder and artwork owner. It reviews the implementation and the adequacy of the earlier design guidance, including guidance written by this reviewer. It does not replace the product plan, authorize new product scope, or mark unfinished journeys as complete.

Read the [short implementation brief](2026-10-01-mobile-agent-brief.md) first, then use this document for the rationale and acceptance criteria. The [snapshot manifest](2026-10-01-mobile-review-snapshot.json) records checkout identities, selected source hashes and captured-media provenance.

## 1. Evidence and boundaries

### What was inspected

| Evidence | What it establishes | Limit |
|---|---|---|
| Main checkout, initially clean; latest reviewed HEAD `c3e8239` | Merged product, plans, design foundation and older mobile flows | Main is not the active A3 shell/ticket implementation |
| A3 shell/ticket checkout, HEAD `98e61c4`, 98 dirty entries at snapshot | Current implementation in progress, including new shell, ticket, nested sheets and hold control | Dirty code is changing; a captured screen can precede its source fix |
| A4 identity checkout, HEAD `bccf226`, clean at snapshot | New passkey glyph and identity support have been committed on that branch | This does not establish merged coverage or finished onboarding artwork |
| Agent screenshots from foundation and A3 rounds | Settled visual hierarchy, clipping, states and missing visible content | Screenshots do not prove gesture quality, frame pacing or successful transactions |
| Live Simulator computer-use inspection, A3 iPhone 17 / iOS 26.5, fan open | Current settled fan appearance; exposed accessibility tree contains the fan actions rather than underlying tabs | No live motion recording or full assistive-technology traversal was performed |
| Current plan, decisions, flow spec, direction, handoff and parity ledger | The intended scope, journey order, semantics and design contract | A requirement is not implementation evidence |
| Local Solflare, Phantom and Fomo reference study | Reference anatomy, observed compositions, journey patterns and recorded motion | Exact source springs, biometric semantics, sound and haptics were not established |
| 21st static review | Main auth: 13 files, 0 errors/warnings; A3 source: 196 files, 0 errors/warnings, 12 suggestions | The A3 suggestions flag comment issue numbers as hex colours; this is not a visual approval |

The source uses Expo 57, React Native 0.86.3, Reanimated 4.5.1 and Skia 2.6.2. This review uses native interaction expectations, not web-only CSS prescriptions.

**Evidence labels used below:** `Code` means inspected implementation; `Capture` means a visible screenshot or live settled state; `Risk` means a scenario supported by source but not reproduced end to end; `Proposal` means recommended design work. Severity expresses user impact and acceptance priority, not certainty of runtime reproduction.

No new account was created, money sent, order placed, permission accepted or external post published during this review. Existing S6 authentication captures are historical; they do not establish a current authentication outage. The active simulator was inspected without taking over the builder's journey.

### Current authority and scope

Use the latest user decisions and `docs/plan/00-plan.md` §0, current `v2-plan.md`, decisions and approved Living Lacquer direction. The old D2 Desk direction is retired. Reference evidence informs presentation and interactions; it cannot override Senryo's money, authentication, eligibility or truthfulness rules.

The handoff's authority table currently puts reference evidence ahead of product rules. **Tighten that wording.** This is a weakness in the earlier documentation, not an instruction to copy competitor functionality. Authentic reference presentation must remain subordinate to target-product facts.

The user has excluded predictions/sports, NFTs/collectibles, the dApp browser, travel/borrowing/virtual accounts/cashback, tracking prompts and a separate app PIN/password (D-194/D-195). These are **not missing features**. Phone-lock fallback belongs to the actual passkey/OS model. Other explicitly blocked baseline features need the plan's unblock path; do not silently invent providers, prices, users or successful outcomes.

### Completion is still largely unproven

The parity ledger has 216 rows: 160 Adapted, 26 Blocked, 19 Excluded, 9 Exact and 2 Additive. **178 acceptance statuses are pending.** Most other statuses describe acquisition, adopted patterns or rules rather than passed native journeys. The inspected acceptance registry does not contain completed S1b/J1–J11 native fidelity evidence.

The plan explicitly schedules J4 before J1. It is fair to say onboarding is unfinished, rather than accuse the builder of falsely completing it. It is equally fair to reject the mobile experience as ready while a new user still sees that unfinished first impression.

## 2. Assessment: what works and what fails

### Preserve the progress

- The A3 violet ground, rounded surfaces, floating dock, enlarged numbers and lavender quick-action circles are meaningfully closer to the approved language.
- The live action fan settles into the correct right-hand vertical composition with a strong blurred backdrop. It is not a radial menu. The inspected accessibility tree isolates the open fan from the tabs.
- The A3 ticket brings the main number, leverage ruler, keypad/presets and transaction-sheet anatomy together. This is substantial progress over the older generic form.
- Practice amounts use `P$`; stale ticket prices explicitly say they are not live. These are useful honesty decisions.
- A3 replaces the misleading capacity partition with independent availability cells. Keep that change.
- The latest Markets source uses a horizontal `ChipRow`, addressing the earlier wrapped-category screenshot. Verify the new result rather than file the old screenshot as an unfixed source defect.
- The identity branch has added an actual passkey glyph. Do not tell that owner to repeat already-completed acquisition work.

### The design is still assembled more than directed

The welcome screen describes protocols before giving a person a reason to care. Guest screens repeatedly ask for an account but do not offer a satisfying read-only journey. Generic state panels and technical settings often occupy space where the next useful action should be. The ticket is visually much better, but its margin label, protection scope, dismissal and failure semantics still demand interpretation.

The main craft problem is hierarchy and continuity: what does this screen let me do, what just changed, what remains safe, and where will I return? More rounded boxes will not answer those questions. The next pass needs an authored first-use story, state-specific layouts and explicit transition ownership.

## 3. Findings requiring action

**P1:** block acceptance of the affected journey. **P2:** resolve before mobile fidelity acceptance. **P3:** refinement after the critical flows work. No reproduced P0 loss is claimed.

Paths in findings are repository-relative. `Main` is `/Users/abu/dev/hackathon/metropolis`; `A3` is its `.claude/worktrees/agent-a1ba38b2613c31cc6` checkout; `A4` is `.claude/worktrees/agent-a9be93059e7b22f08`. Read the snapshot fingerprints and current diff before editing concurrent work.

### R01 · P1 · TP/SL can report the last leg as the whole outcome

**Code / Risk — A3:** `apps/mobile/src/features/trade/TpSlChild.tsx:147`, `:150`, `:157`, `:175`, `:261`; `packages/query/src/trace.ts:143`.

Saving SL and TP runs two separate requests sequentially. The helper swallows request-construction errors, ignores the tracked result, and continues. `useSendTrace.run` resets its event list for each request, so the second leg replaces the first leg's trace. Both input fields are cleared regardless of outcome. The UI derives a single saved/failed state from the final trace and can say “nothing changed” after an earlier leg finalized, or imply the whole edit was saved when only the last leg succeeded.

**Required:** track each leg and its identity separately; preserve failed or unresolved inputs; show partial success precisely; retry only a verified failed leg after reconciling current triggers. Stop or explicitly manage continuation after a failed first leg. Surface construction errors. A global success message requires all intended legs to have verified outcomes. Do not represent two independent transactions as atomic.

**Acceptance:** SL finalized / TP failed; SL failed / TP finalized; request build failed; both finalized; interruption after the first result; relaunch while the second result is unknown. Every state names what changed, retains the outstanding intent and avoids duplicating an already-saved trigger. Use permitted controlled money/security verification, not a superficial UI test mirroring the implementation.

### R02 · P1 · Hold-to-confirm does not invalidate the attempt on unmount

**Code / Risk — A3:** `apps/mobile/src/components/trade/HoldToConfirm.tsx:84–97`, `:123–127`.

The control cancels on release, disabled state, reset-key change and app background. Its effect cleanup only removes the AppState listener. It does not clear the reduced-motion timeout, cancel the running animation or invalidate the attempt when the ticket disappears. A pending callback can therefore retain the confirmation action after unmount. This scenario was not exercised with a live order.

**Required:** one lifecycle cleanup invalidates the attempt, clears the timer and cancels animation. The commit boundary must recheck that the intended account, network and ticket values still match the reviewed intent. Preserve the existing accessible review path in `TicketFooter`; it is a good adaptation of the hold gesture.

**Acceptance:** begin holding and navigate/dismiss before completion, including Reduce Motion; change mode/account/amount; background; rapidly reopen. No abandoned intent commits. Each valid attempt commits at most once.

### R03 · P1 · New-account onboarding is not a completed journey

**Code / Capture — Main/A3:** `features/auth/Onboarding.tsx:27–43`, `:86–93`; `WelcomeActions.tsx:36–45`; `lib/account/provider.tsx`; `lib/storage.ts`; `app/index.tsx`.

The story still has three text-only pages. Successful creation/sign-in/unlock routes to the tab root rather than the planned new-account sequence. A local hint/welcomed flag does not represent handle, follow, voucher, terms, primers, completion or resumable onboarding progress. There is no corresponding complete route sequence in the inspected mobile tree.

**Required:** separate guest, returning-account, new-account, locked-session and interrupted-setup states. Account creation must not automatically mean onboarding is complete. Returning users should recover their destination without repeating optional setup. New users need the scoped J1 sequence with optional stages clearly identified, durable progress and no duplicate ceremony after relaunch.

**Acceptance:** fresh install → browse → gated action → create → setup → preserved intent; fresh install → existing account; interrupted setup → correct resume; cancel ceremony → prior screen; no credential; unsupported device; offline retry; account already exists but profile setup is incomplete. Never resume a money action by submitting it automatically.

### R04 · P1 · Recovery warning and primary action contradict each other

**Code — Main/A3/A4:** `features/auth/AuthFailure.tsx:30–46`; `WelcomeActions.tsx` retry mapping.

When creation may have left a passkey behind, the text warns against creating another account, but the filled primary button remains “Try again” and repeats the create flow. The safer sign-in route is secondary. The user must resolve a technical ambiguity under stress.

**Required:** promote the verified recovery/sign-in path for that failure class; explain that the credential may already exist. Avoid a generic retry when configuration or device support cannot be repaired by repetition. Give a precise web fallback and a way back. Do not promise that all passkeys sync to all devices.

**Acceptance:** after a potentially completed OS sheet, the most prominent next action does not blindly create another credential/account. Copy and actual action agree for every failure class.

### R05 · P1 · TP/SL scope differs from the order-ticket expectation

**Code / Capture — A3:** `features/trade/TpSlChild.tsx:41–70`, `:195–199`; ticket capture below.

“Add SL/TP” appears inside a new order ticket, but the child supports only an existing held position. With no position, it cannot add protection. With a position, the change applies to the current side and size, excluding the additional ticket amount. That qualification comes after entering the child. A user can reasonably assume they are protecting the order being reviewed.

**Required:** if pre-attached protection is supported, define its execution and partial-failure contract explicitly. If it remains an adaptation, disclose it at the parent entry point and label it “Manage existing position protection”; identify market, side, size and network before editing. Do not call this full C42 parity while new-order protection remains absent.

**Acceptance:** a new trader cannot leave the ticket believing a new order has a stop attached when it does not. An existing trader knows exactly which exposure each trigger protects. The lead owns any protocol capability decision.

### R06 · P1 · Full-height ticket lacks a discoverable visible close action

**Code / Capture — A3:** `components/sheet/TransactionSheet.tsx`; ticket screenshot.

Dismissal depends on a draggable header, scrim or Android Back. The almost full-height sheet leaves little useful scrim, and there is no visible labelled close/back action in the ticket capture. During pending execution, gesture/scrim/back cancellation is locked; the user needs a clear explanation of what can still be left safely and where the outcome is tracked.

**Required:** provide an explicit close action before submission and accessible equivalent. During execution distinguish “stop waiting here” from cancellation of a submitted transaction; expose durable status/recovery navigation if leaving is supported. Preserve ticket inputs on a reversible close. Never make dismissal an implicit retry or cancellation claim.

**Acceptance:** a one-handed user, VoiceOver user and Android Back user can leave before committing. Pending/unknown results remain discoverable after background/relaunch; no gesture causes a duplicate send.

### R07 · P1 · Merged balance register depicts overlapping capacities as partitions

**Code — Main:** `features/portfolio/BucketRegister.tsx:21–35`, `:60–74`.

The register sums Free to trade, Free to spend, Locked and In Perpl to derive segment widths. The first two are overlapping usable capacities, not disjoint portions of a total. The graphic gives an incorrect mental model even when each individual number is correct (D-178).

**Disposition:** A3 `features/home/Availability.tsx` already removes this bar and uses independent cells. Keep the fix and prevent the old visual from surviving on another route. Finish each cell's explanation and data provenance. Do not invent an additive total or promise that quoted capacity is a guaranteed spend/trade amount under all conditions.

**Acceptance:** every balance surface distinguishes balance, available trading capacity, available spending capacity, encumbrance and external venue allocation. A user never needs to add the capacities together.

### R08 · P2 · Child sheet lifts for the keyboard but does not bound its content

**Code / Risk — A3:** `components/sheet/ChildSheet.tsx:70–79`, `:123`, `:129–144`.

The child translates upward by keyboard height but has no bounded available-height layout or scrolling body. A long trigger list, small phone or enlarged text can push content and Save out of reach. Moving the whole sheet is not sufficient keyboard support.

**Required:** cap the sheet to the available safe-area viewport, keep a stable title/back area, make the body scrollable and ensure the focused field and primary action are reachable. Avoid losing the parent order values. Verify keyboard transitions on both platforms rather than assuming one inset strategy works everywhere.

**Acceptance:** smallest supported phone, large text, both price/percent fields and a long trigger list; keyboard open; error text added. No field, Back or Save becomes inaccessible.

### R09 · P2 · Onboarding typography and security copy retain the retired language

**Code / Capture — Main/A3:** `Onboarding.tsx:27–43`, `:86–93`, `:124–136`; `WelcomeActions.tsx:90–92`; `AuthCard.tsx:17–20`; `CeremonyCard.tsx`.

The first frame has a large empty field, uppercase green kicker, dense protocol copy and a three-page progress bar. “FACE ID IS YOUR ACCOUNT” conflates the device's user verification with the passkey/account model. The auth card's nominal primary tone uses the positive green tint, not the new primary blue. Ceremony step labels are static completed-tense statements rather than established progress, and platform shorthand does not cover Touch ID or phone-lock fallback well.

**Required:** implement the authored six-scene story in §4, sentence-case UI and clear benefit copy. Reserve green/red for semantic outcomes, gold for brand/card material and blue for primary action. Use “passkey” for the credential, actual OS wording for the ceremony and a precise account/session description. Do not simulate Face ID progress or claim a key cannot be backed up/synced if the actual model permits that.

**Acceptance:** a new user can explain the benefit, Practice versus Mainnet, the next action and how they would sign in again. The story has genuine material artwork and independently composed scenes; a recoloured text carousel does not pass.

### R10 · P2 · Current captures expose unresolved chart and navigation anomalies

**Capture, source fix partly present — A3:** Markets and market-detail captures in §5; Markets now uses `ChipRow`; detail has dock-hiding intent in source.

An earlier Markets capture wraps “Commodities” inside an equal-width segment and truncates supporting labels. The current source has already replaced that category row. A detail capture has no visible chart through a large central region and a partially visible lavender fan circle at the bottom, despite the detail's intended hidden dock/fan state.

**Required:** recapture the latest bundle and investigate the detail anomaly: route focus/visibility, chart layout, data status and Skia rendering. Show loading, no history, stale history and failure deliberately; an unexplained blank plot is not a valid settled state. Keep Short/Long above the safe area without a root-navigation remnant.

**Acceptance:** current-source captures and a motion recording show the corrected categories, readable identity metadata, a visible chart or meaningful data state, and no clipped root fan on detail/ticket. Do not blame the chart library or assert a current defect from a stale screenshot without reproduction.

### R11 · P2 · The ticket still asks the user to infer key information

**Capture / Proposal — A3:** ticket below; `TicketHeader.tsx`, `TicketFooter.tsx`, `TradeHeader.tsx`.

The giant `P$50.00` has only a leveraged-size line above it; it needs an explicit nearby **Margin** label. The guest footer repeats Create in multiple forms, alongside a disabled full-width account CTA. The practice capsule says only “Practice”, while the approved safety language is “Practice · Paper money”. The liquidation field is a skeleton in a settled guest capture without an explanation of what is required to calculate it.

**Required:** label margin and leveraged size distinctly; make one guest conversion action primary; preserve the chosen ticket as a draft through auth; state unavailable liquidation information meaningfully. Keep the complete mode/money meaning available on the transaction surface, including large text. A stale market price can remain informative, but must not quietly become a tradable fresh quote.

**Acceptance:** ask a reviewer to point to margin, exposure, fee, liquidation basis, current mode, data age and what will happen on the next action. They should not infer these from colour or position alone.

### R12 · P2 · Accessibility semantics need native validation

**Code / Risk — Main/A3:** `Onboarding.tsx:76–83`; `components/kit/Segmented.tsx`; `theme/layout.ts:24`; `CollapsingScreen.tsx`; `ExecutionTrace.tsx:128`; `TicketFooter.tsx:83`.

- The story is marked adjustable but supplies no increment/decrement actions or visible non-swipe story navigation.
- Segmented cells have a 32-point minimum height without an expanded hit area. A taller parent track does not prove each item's target meets the project's 44-point floor. The new category `ChipRow` has its own larger target treatment; do not conflate the two.
- The expanded collapsing header fades with opacity but does not explicitly remove its actionable descendants as it disappears. The compact representation is hidden from accessibility. Verify there is one usable semantic representation and no invisible Add money action.
- Financial/progress announcements rely in several places on `accessibilityLiveRegion`; this property is documented for Android, so it alone cannot establish iOS announcements. Add appropriate native announcements/focus handling and verify them without narrating every price tick. [React Native 0.86 accessibility](https://reactnative.dev/docs/0.86/accessibility).

**Required:** actual VoiceOver/TalkBack traversal, focus restoration after fan/child dismissal, announcement of critical changes, accessible numeric editing/ruler controls, full text scaling and reduced transparency. Roles and labels in source are necessary but insufficient.

**Acceptance:** create/sign-in, choose mode, read balance/capacity, edit ticket, open/close child and review a failure without sight or a long press. Decorative art is excluded; financial facts and actionable rows remain individually understandable. Colour is always paired with words/signs.

### R13 · P2 · Outcome/staleness vocabulary is not consistently carried through the shell

**Code / Risk — A3:** `features/home/HomeHeader.tsx`; `features/home/HomeBody.tsx`; `components/kit/states.tsx`; ticket and receive routes.

The balance hero can render a stale reading without carrying the body's freshness treatment beside the number. A signed-out balance must not appear as real zero. A balance delta that includes funding is not automatically investment performance. A receive address, pending arrival and credited core balance are separate states.

**Required:** carry freshness/account/mode meaning with each consequential number; label balance change honestly if it includes flows. For deposit receipt acceptance, correlate the credited outcome with the intended transfer/account/network rather than a visual balance disappearance alone. Keep pending, delayed and unknown distinct from failed.

**Acceptance:** offline with cached values, fresh empty account, guest, indexer delay after finalization, deposit arrived but sweep not credited, reconnect and mode switch. No skeleton silently becomes zero and no animation declares an unverified success.

### R14 · P2 · Guest, empty and unavailable states are too similar

**Capture / Code — A3:** Social, You and Markets routes; `components/kit/states.tsx`.

The Social page shows filters over a large unavailable body. That is honest infrastructure status, not an empty feed or completed social experience. You repeats Create account in both utility strip and a large card while foregrounding technical account settings. Several generic dashed panels treat distinct situations as one layout.

**Required:** author a guest view that has useful browsing content; one account invitation tied to a specific benefit; an empty state that helps populate the surface; an unavailable state with an explanation and working alternative; an error with a retained context and recovery action. Do not invent traders or activity to fill a screen.

**Acceptance:** guest/no account, fresh account/no positions, no followed traders, backend unavailable, network error and genuine zero results each have appropriate distinct copy, illustration/hierarchy and next action.

### R15 · P2 · Identity and material-art readiness remains incomplete

**Code / Capture — Main/A3; positive A4 update:** identity inventory, `brand/art`, card source and foundation contact sheet.

First-pass metal/FX discs and venue marks exist; the A4 passkey glyph is now committed. Six onboarding scenes, completion foil and twelve default avatars remain open. The old Kinpaku PNG/lime presentation is not the intended lacquer and gold-leaf composition. Upcoming `EUR`/`NVDA` placeholders are not sufficient canonical pair/company identities or evidence of an execution-ready market.

**Required:** finish the original artwork with the plan's illustrator/design-owner review; preserve authentic asset/pair/chain/venue/provider/company marks and provenance; distinguish unavailable art from unsupported execution. Use Lucide for utilities, not replacement entity logos. Do not mark the art blocker closed because a file exists.

**Acceptance:** approved contact sheets at phone scale; correct silhouette, cropping, optical size and contrast in dark/light; real pair naming; no emoji/initial substitutes where identity matters; no whole-screen lemon yellow card theme.

### R16 · P2 · Preview card actions create expectations before revealing limitations

**Code — Main/A3:** `app/(tabs)/card/index.tsx`; `features/card/CardFace.tsx`; sample card data.

The card is marked Preview, but Freeze is a live-looking action that only tells the user after tapping that freezing will arrive later and nothing changed. Wallet provisioning and account/card activity are also pending. Freeze is a safety operation, so its availability needs to be apparent before action.

**Required:** complete the provider-backed operation or show an explicit unavailable/disabled preview treatment with the reason. Real card status, allowance, region/KYC, reveal and freeze states must come from the provider. A sample PAN or card image does not establish a usable card.

**Acceptance:** viewers can distinguish a preview from their active card, know what can be done now, and never leave believing a card was frozen when it was not.

### R17 · P2 · Motion choreography is implemented in pieces but not accepted as a sequence

**Code / Risk — A3:** `ActionFan.tsx:65–78`, `:119`; `TransactionSheet.tsx`; `ChildSheet.tsx`; `HoldToConfirm.tsx:130`; `Onboarding.tsx`.

Fan selection dispatches its destination while the exit remains mounted. That may be a valid combined transition, but its layering, input ownership and interruption behaviour need a recording. Hold progress animates percentage width, which performs layout work during a critical interaction; use a fixed measured fill with a clipped, correctly anchored transform if profiling confirms or implementation can avoid that cost. Onboarding skips its intro under Reduce Motion but still has ordinary page entrance transitions.

**Required:** apply the motion acceptance matrix in §7. Give one owner to every combined transition. Disable stale exit-layer input, support interruption/reversal, and make reduced-motion behaviour a full journey path. Do not certify motion from two settled screenshots or a spring constant.

**Acceptance:** no clipped fan/sheet, ghost taps, doubled overlays, focus loss, leftover dock, or stale callback after navigation. Record start, intermediate, settle and exit, including a rapid reversal and Reduce Motion.

## 4. Onboarding direction: make the first minute coherent

### What the earlier guidance missed

The prior documents were strong at cataloguing components and reference frames but weak at selecting the emotional and instructional sequence. They did not sufficiently distinguish marketing story progress from setup progress, explain why a person should complete each step, or say what should be deferred. They also left some technical copy sounding more authoritative than the actual credential model justified.

Keep the approved six scenes. Do not convert them into six mandatory setup gates. Create/sign-in/browse actions must be available immediately; story exploration is optional. Keep later permissions contextual and optional where the plan allows. Apple recommends helping people start quickly and making onboarding engaging and optional; this supports the approach, while Senryo's actual required acknowledgments still come from its product policy. [Apple onboarding guidance](https://developer.apple.com/design/human-interface-guidelines/onboarding).

### Recommended art direction: six material scenes, one stable control area

**Proposal within the approved direction:** an inset, clipped, rounded hero with original dimensional objects, bold changing artwork fields and quiet violet app chrome. Let the gold-leaf/koban/chōgin identity live in the materials. Each scene needs a composition, not a utility icon placed in an oversized card.

Use foreground object, middle object, soft contact shadow and a secondary material detail as independent layers. The title sits consistently below/alongside the hero; one short body sentence explains the promise. The CTA area stays fixed within the safe area and does not jump with scene length. At large text the artwork yields height before the controls disappear. No whole-screen colour flash during reading.

| Scene | Suggested headline and truthful explanation | Artwork / composition | Motion and boundary |
|---|---|---|---|
| 1 · One balance | **One balance. More possibilities.** “See what is available to trade and spend.” | One lacquer balance object with two restrained paths; koban and Kinpaku material cues | Paths reveal independently. Never split the same dollar into simultaneous spent/traded amounts or draw an additive capacity pie |
| 2 · Passkey | **Your account, with a passkey.** “Use your device to create and unlock your account.” | Dimensional passkey object resting on lacquer; small device cue | Key settles independently of background. OS ceremony follows a deliberate CTA; no imitation biometric scan or guaranteed cross-device sync claim |
| 3 · Markets | **Explore beyond one market.** “Browse commodities, FX and crypto. Availability depends on the market and mode.” | Koban/chōgin and correctly identified market/pair objects with space between them | A short stagger, then quiet rest. No fictitious quotes, promised returns or generic coin substitutes |
| 4 · LP | **Explore the liquidity vault.** “Review how liquidity works and the risks before adding money.” | Layered pool/vault material object, distinct from account balance | Slow independent liquid/material movement if authored well. If the route is not ready, say so; no invented APY or withdrawal guarantee |
| 5 · Kinpaku | **Meet Kinpaku.** “Explore the card and its availability.” | Lacquer card with directional gold foil, restrained seal and authentic proportions | Small material tilt/foil glint. Preview/setup availability must remain explicit; no “spend anywhere” or eligible-region promises without provider evidence |
| 6 · Practice/Mainnet | **Start with paper money.** “Practice first. Mainnet uses real money.” | Two clearly labelled material states; Practice foreground, Mainnet distinct | A deliberate state swap with text retained. Nothing switches the actual account network automatically |

These are copy candidates, not new product claims. The lead must align every line with the current backed capability before shipping. The original six-scene specification already names these subjects; this table supplies the missing narrative and composition direction.

Use Create account as primary when there is no hint; returning-account continue/sign-in as primary when appropriate. Keep “I already have an account” and “Browse markets” clear and subordinate. The six-segment story indicator is not a checklist of tasks. Provide explicit next/previous access; pause any autonomous scene changes while the user interacts, uses assistive technology or backgrounds the app. Swipe/auto rules are target adaptations because the recordings do not establish them fully.

**Review artwork before J1 integration**, as required by B12/§5.10: all six static scenes, one dark/light phone contact sheet, passkey pending composition, completion foil, avatar set and three short representative motion samples. The bar is clean silhouettes, material plausibility, original brand character and legibility at actual phone size. Placeholder icons are not an acceptable final art pass.

### Alternatives, if the user later chooses to change the story format

| Option | Benefit | Tradeoff / authority |
|---|---|---|
| A · Six material scenes, recommended | Closest to the approved Solflare baseline; teaches the multi-surface product | Requires disciplined art direction and truthful copy |
| B · One strong hero plus contextual education | Fastest route to useful browsing; fewer scene assets | Changes the approved six-scene contract; requires an explicit direction decision |
| C · Dark cinematic product vignette | Strong Fomo-like product mood | Risks obscuring the product and overloading motion; also changes the approved story contract |

Proceed with A under the existing approval. B/C are creative options for discussion, not excuses to silently reduce fidelity.

### Auth and setup sequence

1. **Welcome:** immediate create, sign-in or browse. Returning users should not wait for a timed logo intro.
2. **Passkey education:** one concrete explanation of the next OS action and recovery limitation; a direct Create passkey action. Show pending with purposeful material art, not a fabricated progress checklist.
3. **Native ceremony:** actual OS UI; cancellation restores the prior state. Failure actions depend on whether a credential may already have been saved.
4. **Handle:** why identity is useful, character/availability validation, privacy explanation and Skip. Keep typed text on Back. Respect the existing 30-day hold rule; do not redesign its policy casually.
5. **Follow:** explain the utility, show sourced people and reasons, select none by default, allow Skip. If ranking/data is unavailable, present that state honestly rather than seed fictional social proof.
6. **Voucher:** optional, with Paste and clear invalid/used/expired/pending/finalized states. A finalized credit may change the balance; merely submitting a voucher cannot trigger the success reveal.
7. **Acknowledgment:** enforce only the real required terms; links are readable and acceptance is recorded. Do not add excluded competitor attestations.
8. **Device-security primer:** verify whether the implementation actually needs a separate prompt. Distinguish passkey user verification from optional fast unlock; do not ask for redundant Face ID consent just to imitate the reference. No separate app PIN.
9. **Notifications:** explain a concrete benefit before the native prompt, allow deferral and respect prior OS decisions. No tracking prompt.
10. **Completion:** account creation, profile setup and any credit are separate outcomes. The original foil reveal celebrates the outcome actually achieved. Continue goes to Home or the retained destination; it never silently submits a retained trade/send.

Store a versioned, account-bound onboarding state with the lead's privacy/storage model: finished/deferred steps, draft values where appropriate and intended destination. Do not retain secrets or raw ceremony material in a UI-progress object. Recovery should let a returning account skip optional profile work while keeping it discoverable later.

The first useful post-setup action should be specific: view a market, understand available paper money, or deliberately claim practice funds if supported. Avoid landing a novice on a dense empty account with unexplained advanced controls.

## 5. Visual evidence and screen-specific guidance

The images below are local, archived under the already ignored reference-study directory. Do not add competitor captures or the reference corpus to Git. Main/A3/A4 source timestamps and screenshot timestamps differ; use the manifest to distinguish them.

### Onboarding: token changes did not change the experience

Foundation-stage comparison, not a claim that this is a new J1 redesign:

![Senryo foundation welcome beside the Solflare reference](/Users/abu/dev/hackathon/metropolis/docs/design/reference-study-2026-09-30/reviews/2026-10-01-senryo-mobile/onboarding-reference-comparison.png)

The gap is composition and narrative: artwork scale, independently layered objects, concise benefit copy, stable control placement and expressive scenes. A new font, palette and rounded CTA cannot supply those missing qualities.

### Ticket: preserve the anatomy, resolve the ambiguity

![A3 practice ticket with selected margin and leverage](/Users/abu/dev/hackathon/metropolis/docs/design/reference-study-2026-09-30/reviews/2026-10-01-senryo-mobile/a3-ticket.png)

Keep the centred amount, ruler and keypad grouping. Add the explicit Margin label, full mode meaning, discoverable close, accurate protection scope and one guest account CTA. The stale-price disclosure is useful. Do not conceal it simply to make the layout cleaner. Explain unavailable liquidation data instead of indefinitely implying it is loading.

### Market detail: no acceptable blank chart state

![A3 market detail capture with blank plotting region and clipped root fan](/Users/abu/dev/hackathon/metropolis/docs/design/reference-study-2026-09-30/reviews/2026-10-01-senryo-mobile/a3-market-detail.png)

Reproduce against the current bundle before assigning cause. The correct settled result has a real chart with its data age, a purposeful loading/no-history/error treatment, or a declared unavailable feature. A floating partial action circle cannot survive on this surface.

### Other captured surfaces

| Surface | Required refinement |
|---|---|
| Markets | Verify the new horizontal category fix; keep useful rows visible above the dock; search/watchlist/filter entry points; correct pair/company identities; readable venue/open/stale metadata; no placeholder market presented as supported execution |
| Home | Balance first, independent capacity explanations second, useful practice/funding action third; positions and Kinpaku/LP affordances below. Carry stale/account/mode state with the balance. Explain lock constraints where they affect the next action |
| Social | Sourced feed/people hierarchy and guest browsing; no empty filter labyrinth over an unavailable service; different states for no follows, no posts and service failure |
| You | Profile identity for signed-in users; one clear guest invitation; security/recovery still reachable without making protocol diagnostics the first reading task; organize advanced details deeper |
| Funding/Receive | Amount, asset and destination network before provider choice; distinguish core deposit inbox from account address; warnings beside the QR/copy action rather than after a long scroll; compatible network/provider instructions, expiry and status tracking |
| Kinpaku | Original lacquer/gold artwork; explicit provider/preview eligibility; truthful setup/reveal/freeze/wallet actions; spending availability tied to balance/risk meaning |
| Receipts/share | Finalized outcome first, readable financial context, mode/network and receipt identity. Native text Share exists, but that is not proof of a branded image-card composition/export |

Archived [Markets](../reference-study-2026-09-30/reviews/2026-10-01-senryo-mobile/a3-markets.png), [Social](../reference-study-2026-09-30/reviews/2026-10-01-senryo-mobile/a3-social.png), [You](../reference-study-2026-09-30/reviews/2026-10-01-senryo-mobile/a3-you.png), [fan](../reference-study-2026-09-30/reviews/2026-10-01-senryo-mobile/a3-fan.png) and [foundation contact sheet](../reference-study-2026-09-30/reviews/2026-10-01-senryo-mobile/foundation-contact-sheet.png) are supporting local evidence, not completion artifacts.

## 6. Journey coverage and missing perspectives

### Journey disposition

This is a review map, not a rewritten progress ledger. Implementation presence is distinct from fidelity and end-to-end acceptance.

| Journey | Reviewed disposition | Acceptance gap / next work |
|---|---|---|
| J1 Onboarding | Old three-page story and auth routes exist; six-scene/post-auth journey pending | Art approval, resumable setup, recovery/action hierarchy, primers, completion, guest/destination restoration |
| J2 Add money | Older claim/voucher/receive/route surfaces exist; A3 route migration underway | Mode-aware hub and nested context; QR/asset/network consistency; pending/credit truth; compatible provider paths and return-state preservation |
| J3 Markets | New shell/rows/detail in progress | Fresh corrected captures; visible chart/data states; search/watchlist/filters; detail sections, alert/history; canonical availability |
| J4 Ticket | Strongest active visual slice | R01/R02/R05/R06; margin/exposure clarity; eligibility; SL/TP keyboard; confirmation, unknown outcome, receipt and share |
| J5 Positions | Existing implementation, redesigned journey pending | Position identity, PnL basis, margin/reduce/close, triggers and orders, post-action reconciliation, receipt and scroll restoration |
| J6 Home | New collapsing shell and availability cells in progress | Capacity explanations, freshness, meaningful guest/new-user content, balance details, positions and action tiles |
| J7 Card | Preview and old art remain | Provider-backed availability/status, setup/allowance/reveal/freeze, activity and authorization details, authentic artwork |
| J8 Social | Placeholder/unavailable tab; plan depends on S12b | Feed/people/profile/compose/reply/follow/search; identity/avatar editing; honest guest/empty/failure states; recipient/scanner flow |
| J9 You | New shell over account/settings surfaces | Profile hierarchy, recovery model, permissions, privacy/help/status, destructive action clarity and accessible layouts |
| J10 LP | Planned alongside Home | Sourced composition/risk/performance; deposit/redemption semantics, liquidity/timing, pending request/history and outcome recovery |
| J11 Spot tokens | Planned later | Canonical token identities, real holdings/quotes, slippage/route review, outcome/recovery and mode/eligibility distinctions |

### Perspectives that were under-specified

| Person / situation | Design requirement |
|---|---|
| Novice who wants to explore | Read-only value before account creation; explain perps/margin/liquidation at the point of need; one safe Practice path |
| Experienced trader | Fast ticket entry, retained values, risk/protection clarity and reliable pending status; education must not block repeat use |
| Returning user on a new device | Credential/provider limitations, no duplicate account creation, reconstructed balances rather than false zero, preserved destination |
| Small-phone / one-handed use | Important actions reachable; visible dismissal; scrollable keyboard sheets; dock clears all content; long labels have a designed layout |
| Large text / low vision | Content reflows, controls stay reachable, financial meaning never truncated, number caps justified rather than blanket text-scaling suppression |
| VoiceOver / TalkBack | Deliberate focus order, modal isolation/restoration, accessible numeric edits and non-hold confirmation, critical announcements |
| Reduce Motion / Transparency | Static high-quality art, short direct transitions and opaque readable surfaces; capability does not depend on movement or blur |
| Weak connection / stale cache | Age and status beside numbers, preserved draft, explicit Retry; delayed/unknown outcome separate from failure; no fictitious success |
| Market closed / moved price | Browsing remains informative; trade readiness explained; no current order silently priced from stale display data |
| No funds / funds encumbered | Explain which capacity is constraining the action and offer a relevant route; do not show a generic insufficient-balance dead end |
| Privacy-conscious user | Minimal public-profile explanation, skippable discovery, contextual permissions, no preselected follows or excluded tracking |
| Card user under stress | Real freeze status, availability before action, clear failed/unknown state and durable history; preview cannot mimic a safety operation |

Respect platform text and accessibility preferences throughout. Apple's accessibility guidance supports legibility and adaptable interfaces; the concrete viewport and traversal checks here are Senryo acceptance proposals, not claims that Apple prescribes this exact matrix. [Apple accessibility guidance](https://developer.apple.com/design/human-interface-guidelines/accessibility).

## 7. Motion acceptance: judge behaviour, not declarations

Use the approved motion grammar. The reference recordings do not reveal exact springs; the project's constants are declared adaptations. A generic “all transitions under 300 ms” rule does not override the approved longer sheets, chart and scene transitions. Likewise, React Native springs are not a web CSS review problem.

| Interaction | Approved target / treatment | Evidence needed |
|---|---|---|
| Press and selection | Press 80–120 ms; selection 160–180 ms; restrained physical response | Press, release, cancel and disabled control; no semantic colour misuse |
| Page push / return | Around 320 ms; one route owns transition; restore prior scroll/values | Entry/back from market, profile and funding detail; correct focus restoration |
| Action fan | Send leads; roughly 200 ms entry with 25 ms item stagger; live blur ~160 ms, plus rotation ~180 ms; reverse exit ~180 ms | M06-aligned start/intermediate/settle/exit; selection → destination choreography; rapid reverse; no duplicate input |
| Dock | ~240–280 ms spring; continuous indicator and correct root/detail visibility | Tab switch, scroll, child/detail/ticket entry and back; no cropped plus/fan, bottom content or keyboard collision |
| Collapsing header | Scroll-driven ~132 pt; stable mode meaning and optical balance | Slow/fast scroll, reverse, short page, large text, focus traversal; no fading interactive ghosts |
| Compact / tall sheets | Compact ~420 ms; tall ~420–480 ms; grounded spring treatment | Snap/drag/close, interruption, backdrop, explicit controls, safe area and Android Back |
| Parent → child → parent | Combined transition around 600 ms with parent kept and dimmed | Parent amount/ruler/chart retained; keyboard open/close; Back returns without reconstruction jump |
| Leverage ruler | Direct drag with meaningful snap; spring 1/500/40 | Fast/slow drag, bounds, selected tick, accessible adjustments, at most one intended selection haptic |
| Financial number changes | ~140–180 ms; preserve digits/sign/readability | Fresh/stale/unknown transitions; never animate missing data as zero or label balance flow as returns |
| First chart reveal | ~600–900 ms only after real data; subsequent updates do not replay the grand reveal | First load, empty/error, refresh, timeframe changes and live tick; no misleading invented history |
| Story scenes | Around 850 ms authored layered change; ambient layers independently 6–10 s | Scene forward/back, CTA fixed, pause/resume/background and static reduced version |
| QR reveal | Around 650 ms with final truthful payload | Actual final code scans; stable asset/network/address; animation cannot substitute an invalid intermediate payload for a usable QR |
| Completion foil | ~700–900 ms after the named verified outcome | Account exists versus voucher/funding finalized; failed/unknown has no success foil; static reduced variant |
| Reduce Motion | Static art/direct chart; roughly 100 ms crossfades where needed | Full create/browse/ticket/recovery path, not just skipped splash |
| Reduce Transparency | Opaque readable modal/dock/fan material | Contrast, depth and focus remain understandable without blur |

Haptics supplement a visible change; they do not prove a financial result. Sound is currently a silent no-op with no supplied sources and is not established by the reference captures. Do not add arbitrary transaction sounds as a substitute for motion design. If sound is later authored, respect preferences and tie outcome sounds only to verified outcomes.

For performance, inspect real frame pacing on supported physical hardware before making a 60 fps claim. Simulator recordings can establish choreography but not physical-device performance. Profile layout animations and heavy live blur/Skia overlap where needed; avoid speculative optimization that degrades the approved material language.

## 8. Guide for the implementation agent

### Work order

1. **Lead:** assign findings to current owners, recheck source fingerprints and keep concurrent work separate. Fix documentation authority ambiguity. Do not overwrite dirty checkouts or rebuild an already-fixed category row.
2. **A3 / money owner:** resolve R01/R02/R05/R06 before ticket acceptance. Finish the child-sheet viewport behaviour, explicit amount labels and guest/auth continuation.
3. **A3:** recapture current Markets/detail/ticket and resolve chart/dock anomalies. Record the whole fan → route → sheet → child → back sequence with interruption and reduced settings.
4. **Artwork owner:** deliver the six-scene storyboard, foil and avatar approval package now, alongside the already planned implementation order. Keep authentic identity acquisition separate from original hero composition.
5. **J1 owner:** implement the scoped state machine and first-use narrative after the art gate. Correct recovery priorities and security claims; use the actual OS ceremony.
6. **Journey owners:** continue the approved J4 → J3 → J6/J10 → J5 → J2 → J1 → J8 → J7/J9 → J11 sequence, with this feedback applied to each slice. Satisfy the outcome/recovery and accessibility gates before broad visual refinements.
7. **Lead/reviewer:** collect evidence into the acceptance/parity records. A route, acquired asset, passing linter or screenshot alone cannot close a journey.

### Required evidence per slice

- Current checkout/commit, dirty-source fingerprint or patch identity, app build/bundle identity, device/OS, mode, account/data setup and capture time.
- Actual phone-sized settled states for happy, guest/empty, pending, stale/offline, failure and unavailable states that apply to the slice; dark/light and smallest supported viewport plus large text.
- Motion start/settle/exit against the relevant M-clips, including back/restore, interrupt and rapid reversal.
- Parent values, scroll, focus and destination restoration demonstrated, not merely described.
- Reduce Motion, Reduce Transparency, VoiceOver and TalkBack validation appropriate to the flow.
- Honest backed data and receipt/outcome evidence for consequential operations; no invented balances, users, prices or provider success.
- Acceptance disposition per relevant FT/C/M/LG row: passed with evidence, adapted with a named difference, blocked with the actual prerequisite, or excluded by a recorded user decision.

Do not add automated UI tests against the repo's no-UI-tests rule. Use native review evidence and appropriate money/security checks for consequential logic. Reversible visual adjustments do not need tests that simply repeat their implementation.

### Definition of an acceptable revision

The revision should let a fresh user understand the product, explore without pressure, create or recover the correct account, complete/defer setup safely, understand Practice versus Mainnet, and arrive at a useful next step. A trader should understand margin, exposure and protection; leave a sheet deliberately; and recover accurately after a failed or unknown outcome. Material artwork, typography, motion and identity must feel composed as one product across those states.

This review does **not** certify device performance, the complete OS passkey ceremony, Android UX, provider-backed card operations, LP/spot execution, live financial outcomes or every planned journey. Those remain explicit acceptance gates. The agent's next report should state what was corrected and show the evidence for each claim.
