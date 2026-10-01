# Mobile revision brief for the Senryo implementation agent

**Design acceptance is pending.** Preserve the new lacquer shell, fan and ticket anatomy. Correct transaction/recovery behaviour first, then deliver the authored onboarding and complete native journey evidence.

This brief accompanies the [full strict review](2026-10-01-mobile-ux-review.md) and [source/evidence snapshot](2026-10-01-mobile-review-snapshot.json). Read the full finding before editing: it distinguishes inspected code, captured UI, inferred risks and proposed design work. Screenshots may predate working-tree fixes.

## Non-negotiable boundaries

- Latest user decisions and current product/money/authentication rules govern. Living Lacquer replaces D2 Desk. Solflare, Phantom and Fomo supply reference evidence, not target financial or credential claims.
- Do not add the excluded predictions/sports, NFTs, dApp browser, travel/borrow/virtual accounts/cashback, tracking or separate app PIN/password.
- Preserve dirty concurrent work. The reviewed A3 checkout is `.claude/worktrees/agent-a1ba38b2613c31cc6`; the A4 passkey-glyph work is already committed at `bccf226`. Recheck current branch/diff before changes.
- Keep reference recordings, frames and the ignored reference study out of Git. The review's local screenshot archive remains ignored.
- Use real data/identities/outcomes. Sample card, unavailable feed, acquired glyph, passing static review and visible route each prove different things; none proves a completed journey.
- Follow the repository's no-UI-tests rule. Consequential logic needs appropriate money/security verification; visual changes need native acceptance evidence.

## First: close the ticket and recovery risks

| Finding | Owner / target | Required correction | Demonstration required |
|---|---|---|---|
| R01 · P1 | A3 money owner; `TpSlChild.tsx`, `packages/query/src/trace.ts` | Each SL/TP leg gets its own durable outcome; retain failed fields; surface request-build errors; never show “nothing changed” for partial success or imply both saved from the last trace | First leg success/second failure, inverse, both success, build failure, interruption/relaunch; no duplicate retries |
| R02 · P1 | A3; `HoldToConfirm.tsx` | On unmount invalidate attempt, clear timeout and cancel animation; verify current reviewed intent again at commit | Dismiss/navigation during hold, especially Reduce Motion; account/mode/value change and background; no abandoned or duplicate commit |
| R05 · P1 | Lead + A3; ticket SL/TP entry | Decide actual pre-attached protection capability. If this only edits a held position, label it at the parent and identify existing side/size/network before entry | New order cannot appear protected; existing-position edits cannot be mistaken for protection of additional size |
| R06 · P1 | A3; `TransactionSheet.tsx` | Visible close/back before send; explicit pending/unknown-result navigation and durable recovery; retained draft on reversible close | One-handed and accessible dismissal; Android Back; pending/background/relaunch cannot resend |
| R04 · P1 | Auth owner; `AuthFailure.tsx` | When creation may have saved a passkey, promote sign-in/recovery over repeating create; actionable support/configuration fallback | Primary action agrees with recovery warning in each failure class |
| R07 · P1 | Home owner | Keep A3 independent availability cells; remove remaining summed partition graphics from reachable mobile surfaces | Balance/capacities are never presented as disjoint portions to add together |

Do not wait for the whole art pass to fix these. They block acceptance of the affected journeys.

## Then: make the current visual slice reviewable

1. Reproduce current Markets/detail/ticket on the latest bundle. The older category-wrap screenshot has a source fix (`ChipRow`); show its result. Resolve the blank-chart/clipped-fan detail capture rather than guess its cause.
2. Add **Margin** beside the main ticket number; keep leveraged size distinct. Give guests one account CTA and preserve the draft through auth. Carry full Practice/Paper money or Mainnet/Real money meaning on the transaction surface.
3. Make the TP/SL child a bounded keyboard-aware sheet with a scrollable body and reachable action. Test long existing trigger lists and large text on the smallest supported phone.
4. Show a meaningful unavailable liquidation state when calculation prerequisites are missing. Preserve clear stale-price wording; never make an old displayed quote appear live for visual cleanliness.
5. Record fan → destination → ticket → child → parent → close/back. One owner must coordinate exit layers, input and focus. Demonstrate rapid reverse, cancellation and reduced settings.
6. Check all segmented-control hit areas, collapsing-header invisible descendants, numeric/ruler accessibility and native outcome announcements. `accessibilityLiveRegion` alone does not establish iOS behaviour.

## Onboarding must be authored, not reskinned

The present three text pages and automatic post-auth tab redirect are not J1 acceptance. Implement the approved six-scene story and a real new-account setup state machine after the art gate.

### The story

Use an inset rounded/clipped hero, dimensional original material objects, independently layered foreground/shadow/background, concise sentence-case benefit copy and a stable bottom control area. Keep violet app chrome; scene colour fields belong to the artwork. Gold belongs to brand/card material; green/red belong to financial/outcome semantics; primary action is blue.

| Scene | Purpose | Visual direction / truth boundary |
|---|---|---|
| One balance | Explain useful capacity without protocol overload | One lacquer object, subtle trading/spending paths; no additive capacity pie |
| Passkey | Explain the actual next OS action | Original dimensional key/device composition; no fake scan, invented progress or guaranteed device sync |
| Markets | Make the product breadth understandable | Koban/chōgin and authentic pair/asset objects; accurate market/mode availability, no invented returns |
| LP | Introduce liquidity with risk | Purposeful pool/vault material; no fictitious APY or withdrawal certainty |
| Kinpaku | Introduce the card | Lacquer and directional foil; preview/region/provider readiness remains explicit |
| Practice/Mainnet | Establish the safe starting context | Paper money foreground, Real money distinct; story never changes actual mode automatically |

Create, sign-in and browse must be available immediately. Six story segments are not six mandatory setup gates. Provide non-swipe navigation and pause autonomous changes while interacting or using assistive technology. Reduced Motion receives the same quality of artwork in a static composition.

Before J1 integration, provide all six static compositions, dark/light phone contact sheet, pending-passkey art, completion foil, twelve default avatars and representative motion samples for the plan's B12 design/illustrator review. The A4 passkey glyph is useful identity infrastructure; it is not the six-scene artwork package.

### The state machine

Distinguish guest, returning user, new account, interrupted setup and locked session. Store account-bound/versioned progress under the approved storage/privacy model. Account created, profile finished, permission deferred and money credited are separate outcomes.

Required sequence/states: welcome → passkey education/actual OS ceremony → handle (Skip/validation/availability/error) → follow (none selected by default/Skip/real ranked-data states) → optional voucher (invalid/used/pending/finalized) → actual required terms → device-security primer only where the real model needs it → optional contextual notifications → outcome-specific completion → Home or retained destination.

No duplicate ceremony after interrupted creation. No repeated optional setup for returning accounts. No imitation biometric prompt or separate app PIN. No tracking prompt. A preserved trade/send destination returns to review; it never submits automatically. Completion foil celebrates only the outcome actually verified.

Use the full review's copy candidates and composition table. These candidates require capability-aligned copy, not invented product claims. Keep the approved six-scene format unless the user explicitly changes that direction.

## Apply the same standard beyond onboarding

| Journey | Missing acceptance work to carry forward |
|---|---|
| Home / LP | Freshness beside balance; independent capacity explanations; guest versus real zero; sourced vault risk/performance, request history and redemption timing |
| Markets | Search/watchlist/filters; canonical identity and availability; chart/status, detail sections and root/detail navigation consistency |
| Positions | Position identity and PnL basis; margin/reduce/close; orders/triggers; pending/unknown outcome, receipt and scroll restoration |
| Funding / receive | Asset/network/address hierarchy; deposit inbox versus account address; warnings beside QR/copy; provider-compatible instructions, expiry and credited-outcome evidence |
| Social | Useful guest browsing; distinct no-follows/no-posts/unavailable/error states; real profiles/feed/compose/replies/search, avatar editing and recipient/scanner flow |
| Card | Preview distinct from active card; original artwork; real provider setup/allowance/reveal/freeze/wallet/activity; unavailable safety actions apparent before tapping |
| You | Profile first; one guest invitation; approachable security/recovery; deeper advanced details; permission/privacy/help/status and safe destructive actions |
| Spot tokens | Canonical identities and actual holdings/quotes, route/slippage review, mode eligibility and outcome recovery |
| Receipts/share | Actual finalized outcome, readable financial context/mode/network, receipt identity and branded export evidence; text-only native Share is not image-card acceptance |

Continue the approved journey order. Prepare artwork in parallel within the existing ownership structure so J1 does not stall at its design gate; this brief does not ask the reviewer to launch additional agents or take over implementation.

## Evidence required before reporting a slice complete

- Identify checkout/commit or dirty patch, build/bundle, device/OS, mode, account/data setup and capture time.
- Show current phone-scale happy, guest/empty, pending, stale/offline, failure and unavailable states as applicable. Include dark/light, smallest supported viewport and large text.
- Show motion start/intermediate/settle/exit, back/restore, interruption and rapid reversal against the correct M-clips. Constants and settled screenshots are not motion evidence.
- Demonstrate safe-area/keyboard clearance, reachable 44-point targets, retained parent draft/scroll, restored focus and destination.
- Demonstrate Reduce Motion/Transparency, VoiceOver and TalkBack on the consequential path. Report physical-device performance separately from simulator choreography.
- Reconcile financial outcomes with actual receipts. Partial success and unknown result remain distinct from failure; no automatic duplicate send.
- Update relevant FT/C/M/LG acceptance rows with evidence or a precise Adapted/Blocked/Excluded disposition. Do not close B12 for file existence or a journey for successful lint.

Your response to this review should list each resolved finding, link its current-source evidence, explain any remaining adaptation/blocker, and identify the next smallest complete journey for review. The reviewer should be able to verify the result without inferring it from implementation notes.
