# Controls, sheets and navigation consult — 1 Oct 2026 (Codex gpt-6.1-sol, xhigh, read-only)

**Why this exists.** On 1 Oct the user tested the simulator build and rejected three things as a whole: the buttons, the
way sheets and the auth step "pop up", and the navigation. They liked the six-scene story and the plus fan, said "learn
from Fomo", and "mediocre is never an option". The lead measured the Fomo frames and asked Codex for exact numbers.
This is Codex's answer, verbatim below the line. It supersedes `direction.md` §3–5 where they disagree (D-196).

**What the lead adopted differently, and why** (declared deviations):
- **Content scrolls behind the dock.** Codex reserved an opaque footer lane; the reference (F12, M09) has rows passing
  under the glass, which is what makes it read as glass. The plus sits beside the dock, so nothing tappable is covered,
  and the last row scrolls clear (`useDockInset`).
- **The dock sits at the reference's height** (about 30 pt above the screen edge, F12/F16), not 42.
- **The active bubble overshoots a little and stretches while it travels** (M10's liquid bubble); Codex clamped it.
- **Press scale is 0.97** (felt on a 56 pt control), not 0.98; release is a 160 ms ease-out, not a spring.
- **Sheets rise on the iOS drawer curve** `cubic-bezier(0.32, 0.72, 0, 1)` over 480 ms and leave in 240 ms on the
  ordinary ease-out; a released drag returns on a spring that keeps the finger's velocity.
- **Selector rows have 20 pt corners** (F20 measures closer to 20 than 16) and a 12 pt gap.
- **The ceremony sheet opens with the tap and the passkey chooser is called at once** (no wait for layout): nothing is
  added to time-to-first-trade, and the sheet is already there when the system sheet leaves.
- **The plus shows wherever the dock does**, not only on tab roots: beside the dock it covers nothing.
- **Session state keeps a place for an account** (a small chip under the bar on Home and You); guests see no strip.

---

**Replace universal pills and bordered containers with rounded rectangular actions, filled selectors, and one coordinated sheet system.**

All dimensions below are **points at 402×874**. Reference measurements are approximate, ±2 pt; colours come from compressed frames. Springs, haptics and implementation choices are **Senryo specifications**, not recovered Fomo code. Evidence IDs resolve through the [reference gallery](/Users/abu/dev/hackathon/metropolis/docs/design/reference-study-2026-09-30/gallery.html).

**A. Button system**

Fomo’s visible construction:

| Evidence | Geometry | Fill and edge |
|---|---|---|
| F01 welcome | Two **354×56**, radius **12**; gap **12** | Apple white/black label; Google near `#15131E`/white label. Provider icon precedes centred label. Fine perimeter highlight; neither is a full pill. |
| F08 terms | Continue **338×46**, radius **12** | Disabled dark fill, muted label, fine rim. Enabled blue counterpart visible in F36. |
| F09 Deposit | **140×48**, radius **12** | `#414EF4`; approximately **1 pt** lighter upper bevel, darker outer edge. Interior is essentially uniform. |
| F16 Rewards/utilities | Rewards **105×36**, radius **8**; utilities **36 diameter** | Rewards repeats blue bevel, gift before label. Utilities use translucent gray fill and white icons. |
| F37/F41 presets/commit | Presets approximately **84×38**, radius **12**; commit **370×56**, radius **12** | Presets are dark filled rectangles. Commit is a rounded rail with a leading inset thumb; these frames establish disabled states only. |

Adopt Fomo’s **shape hierarchy and upper-edge depth**:

| Senryo variant | Height / radius | Appearance |
|---|---|---|
| Primary | **56 / 12** | Blue `#414EF4`, white label |
| Compact primary | **44 / 10** | Same construction; intrinsic width, **16** horizontal padding |
| Secondary | **48 / 12** | `#201E2B`, `#F5F4FA` label |
| Text | **44 / 0** | Transparent, `#8B95FF` label |
| Utility | **36 diameter**, **44** target | `#201E2B`, **20** icon |
| Destructive / Long / Short | **56 / 12** | Semantic red/green fills; same anatomy |
| Amount preset | **38 / 12**, **44** target | Neutral fill; selected `#2C2938` |

Primary: **1 pt clipped inner-top highlight** `#FFFFFF26`; shadow **y=2, blur=4, black 16%**. Secondary highlight `#FFFFFF0F`, no shadow. No outline variant.

Inter **17/22, 600**; compact **15/20, 600**; presets **18/22, 600**. Leading icon **20**, gap **8**; centre the combined icon-label group.

Press: scale **1→0.98 over 80 ms**, label translates **1 pt down**, blue becomes `#343ED3`; release spring **mass 1 / stiffness 600 / damping 32**, overshoot clamped. Utility scale **0.94**. One light impact on accepted action; selectors use selection feedback.

Disabled: neutral `#201E2B`, label `#8F8B9F`, no bevel, shadow, motion or haptic. Loading retains width and label, reserves a **20 pt spinner slot**, blocks repeat taps. Keep transaction hold at **500 ms**, with linear progress and cancellation on early release. **[F01/F08/F09/F16/F37/F41]**

**B. Sheet system**

| Family | Reference → Senryo geometry |
|---|---|
| Compact selector | F20 approximately **386×438**, x=8, y=428, radius≈38. Senryo: **8 horizontal/bottom inset**, width **386**, all corners **38**; content height, maximum **520**. |
| Tall detail | F13 begins near **y=90**, reaches bottom. Senryo: **(0,90,402,784)**; top corners **38**; scrolling body, fixed footer. |
| Transaction | F37/F41 largely cover parent. Senryo: **(0,54,402,820)**; top corners **38**; fixed identity, amount and commit zones. |
| Nested child | Funding child F21 grows upward; SL/TP F44 overlays ticket. Funding uses exchanged panels; SL/TP uses a retained-parent overlay, initial height **366**, top corners **38**. |

Compact fill `#13121A`; tall/transaction `#0A0911`. Handle **36×4**, radius **2**, centred **14** below top; invisible **44 pt** drag zone. Title **22/28, 600**, centred at **top+40**; child Back target **44**. Content inset **16**; action rows **70 high**, radius **16**, gap **16**, borderless fill `#201E2B`; simple network rows **54 high**. **[F20/F21]**

Scrim black **44%**, no blur. Entrance: compact **420 ms**, tall/transaction **460 ms**, bezier **(.16,1,.3,1)**. Scrim enters over **180 ms**. Exit **260 ms**, bezier **(.4,0,1,1)**. Content travels with its panel. **[M02/M12]**

Drag follows finger; upward resistance **÷6**. Dismiss beyond **min(120, 25% of sheet height)** or downward velocity **900 pt/s**. Content transfers downward drag only at scroll offset zero. Otherwise return with spring **1/300/32**, clamped.

Funding exchange: parent moves down **80 pt** and fades over **180 ms**; child starts rising at **100 ms**, settles by **600 ms**. Maintain one scrim and retained parent fields/scroll. Back reverses the exchange. SL/TP retains the visible ticket; keyboard reduces available body height and keeps Save above it. **[M16/F44]**

Use **one custom Reanimated + Gesture Handler host**, within an Expo Router `transparentModal`, on both platforms. Native `formSheet` provides detents/corners, but cannot guarantee this inset/travel/exchange contract; `fitToContents` needs explicit sizing, and Android form sheets lack nested stacks. [Expo documentation](https://docs.expo.dev/router/advanced/modals/). The installed screens package also documents non-customizable formSheet duration. [Installed API](/Users/abu/dev/hackathon/metropolis/apps/mobile/node_modules/react-native-screens/src/types.tsx:614).

**C. Auth over the welcome**

Retain all six scenes and their layout. Create account remains **362×56**; below, two **175×44** controls separated by **12**: filled “I have an account”, text “Browse markets”. **[F01; story-scenes-1-3]**

Create/sign-in opens a **280 pt** ceremony sheet over the story. After its first layout, invoke the native passkey chooser. Pause scene advancement; retain ambient artwork. Show one **36 pt passkey glyph**, one title, one **16/22** explanation and one **20 pt spinner**. Remove boxed waiting notes and speculative completed-step lists. Second confirmation replaces the explanation in place. **[S07/M02; CeremonyCard]**

Failures replace content **inside that sheet**; height changes over **220 ms**. Standard failure height **320**, rect **(8,546,386,320)**:

- Title at **top+52**, **22/28**; Close target **44**, upper right.
- Body at **top+92**, width **346**, up to three **22 pt** lines.
- Primary **346×56** at **top+178**.
- Optional secondary text action **44 high** at **top+246**.
- No warning tile, nested card, repeated note or Back button. Grow for larger text.

Bad configuration: **“Account setup unavailable”**; body: “This app couldn’t connect to Senryo’s account setup. Continue at senryo.xyz with the same account.” Primary **Open senryo.xyz**; secondary **Try again**. **[F08/F36; auth-failure-bad-configuration]**

| Failure | Action |
|---|---|
| Cancelled | Dismiss silently; restore story and tapped control |
| PRF unavailable / not supported | Open web; no retry |
| Host not allowed / insecure context | Open senryo.xyz; no retry |
| No credentials | Choose another passkey; secondary Create account |
| No create option | Explain provider setup once; Try again |
| Wrong account | Choose the correct passkey |
| Invalidated | Confirm with passkey |
| Timeout / interrupted / unknown | Try again; **failed creation uses sign-in first**, with possible saved-passkey explanation in the body |

These branches adapt the current auth classifications; Fomo does not establish Senryo’s authentication semantics.

**D. Selectors and chips**

| Control | Senryo specification | Evidence |
|---|---|---|
| Mode control | **198×34**, radius **12**, **44** target; full “Practice · Paper money” / “Mainnet · Real money”, **13/18, 600**, **12** chevron; semantic wash, no outline | P12 mode notice; rejected home-guest |
| Mode selector | **344 high**, two **72 pt** filled rows, selected check **20**; deliberate **56 pt** “Switch to real money” action | F20/F21 adapted |
| Categories | **34 high**, radius **10**, padding **12**, gap **8**; inactive transparent, selected `#201E2B`; **14/18, 600** | F09/F12 |
| Segmented | **44 high**, radius **12** track, padding **4**; selected cell radius **9**, `#2C2938` | F37 keypad/chart |
| Periods | **28 high**, radius **8**, **44** target; inactive text only, selected neutral fill; **13/18, 600** | F16 |

Selection indicator moves **180 ms**, bezier **(.2,.8,.2,1)**; label colour **120 ms**; one selection haptic. Fomo outlines category chips; Senryo deliberately removes those outlines.

**E. Navigation**

F12/F16 dock measures approximately **340×54**, horizontal inset **31**, bottom gap **29**; F09 is wider, approximately **378×60**. No persistent labels. **[F09/F12/F16/M10]**

Senryo reserves a footer **safeBottom+80 high**—**114** with a 34 pt safe area. Scroll viewport ends at **y=760**:

- Dock **(28,776,286,56)**, radius **28**.
- Five **56 pt** slots within **3 pt** outer padding.
- Plus **(326,780,48,48)**; gap **12** beside dock.
- No list content occupies this lane, including during scrolling.
- Fan circles remain **48**, centres spaced **72** above the relocated plus. Preserve existing choreography. **[P12/P19/M06; rejected tour-social-you-fan]**

Active region **54×48**, radius **24**, top inset **4**; spring **1/500/36**, clamped. iOS 26 uses native glass, base tint `#201E2B66`, active white tint **12%**. Android uses blur intensity **60** plus those fills; reduced transparency uses opaque `#201E2B`. [Expo GlassEffect](https://docs.expo.dev/versions/v57.0.0/sdk/glass-effect/).

Use Lucide **House, ChartCandlestick, CreditCard, UsersRound**, plus actual profile avatar. Icons **24**, inactive stroke **2**, `#8F8B9F`; active white stroke **2.25**, Home filled silhouette. Avatar **28**, active ring **2**. Accessible names; no visible dock labels.

Headers: fixed **56 pt** below safe top; mode right. Home retains seal/compact balance, collapses over **132 pt**; Markets retains title/categories; Card uses Kinpaku title; Social places Feed/People beneath; You scrolls its **64 pt** avatar/profile beneath. Remove universal Browsing/alerts strip. **[F09/F12/F16]**

Dock/plus appear on tab roots. Push market detail, profile edit, recovery and receive instructions; sheets handle selectors, shared positions, tickets and SL/TP. Preserve each tab’s scroll. **[P02/F21/F44]**

**F. Surface rule**

Remove default `Panel` and row borders. RN `borderWidth: 1` means **1 pt**, not one physical pixel.

Market rows: **64 high**, bare page background, **48 pt** identity. Grouped settings cards: radius **20**, filled, no perimeter. Notes: plain text; distinct status may use a filled wash with **12 pt** padding. **[F09/F12/F16/F20]**

Borders allowed only for input boundaries, focus indication, and glass/material rims: ordinary boundary **0.5 pt**, focus **2 pt**. No borders around chips, auth bodies, notes or ordinary buttons. **[F44]**

**G. Supersede direction.md §§3–5**

- **§3:** universal pill buttons, radius-24 sheet tops and blanket hairlines → A/B/F. **[F01/F20]**
- **§4:** generic press feedback and shared entrance/exit easing → A/B; retain story/fan motion. **[M02/M06/M16]**
- **§5:** labelled 64 pt dock, 16 pt inset and plus above it → reserved lane in E; sheet geometry/navigation → B/E. **[F12/F16/P12]**


