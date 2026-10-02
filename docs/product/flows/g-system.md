# G — System

Capability cards G1–G7 from the plan (§0.4 "Notification", §0.5 rules 9–12, §0.6 G, §0.7 #15, §0.9 "Notifications", "Search", Part C, Part F7). `UNDEFINED` = not settled by code or docs; each is a research task, not a question for the user. "Defect n" = Part 1 of the plan.

**Paths.** `M/` = `apps/mobile/src/` · `K/` = `services/keeper/src/` · `API/` = `services/api/src/` · `AC/` = `packages/api-client/src/` · `W/` = `apps/web/src/`.

## Facts every card uses

- **Push pipeline.** A keeper job decides → `push_sends` ledger row (idempotent on a chain-prefixed event key, `K/notify.ts:54-66`) → Expo → the phone. Only finalized triggers push (`K/notify.ts:6-10`).
- **Channels today:** `fills`, `liquidation`, `deposits`, `card`, `priceAlerts` (`AC/routes/engagement.ts:49`, `K/notify.ts:22`). Each device stores one switch per channel, default on (`API/routes/engagement.ts:117-139`).
- **Who sends what today:**

  | Push | Channel | Sender |
  |---|---|---|
  | TP/SL closed or reduced a position | fills | `K/jobs/maintenance.ts:97` |
  | Close to liquidation | liquidation | `K/jobs/watch.ts:60` |
  | Liquidated | liquidation | `K/jobs/liquidate.ts:74` |
  | Price alert crossed | priceAlerts | `K/jobs/watch.ts:31` |
  | Deposit arrived (inbox sweep only) | deposits | `K/jobs/sweeps.ts:67` |
  | Card | card | **none** (defect 8) |

- **Copy rules already in the keeper:** Practice titles start "Practice · " (`K/push-messages.ts:31-34`); money is P$ or $ by network (`:44-47`); every link carries `?chainId=` (`:36-38`).
- **Ledger retention:** 30 days (`K/constants.ts:22-26`).

---

### G1 Notifications: inbox and channels
- **Promise:** Hear about what moved your money, and find every notice again in one inbox.
- **Entry points:** Home header bell with an unread count (today `M/app/(tabs)/home/index.tsx:50`) · a push tap · Settings → Notifications · setup primer (A2) · the "will notify" line on an alert.
- **Steps:**
  1. Bell → **Notifications**: title, gear (channels). Tabs **All · Alerts**.
  2. **All:** grouped Today / Earlier. Row = subject mark (market, token, avatar or card art) · one-line title · time. Unread rows sit on a raised fill. Rows from the other mode carry a "Mainnet" / "Practice" tag.
  3. Tap a row → marked read → opens the same target as its push (through the mode sheet if the mode differs, G2).
  4. Opening the screen clears the bell count. ⋯ → "Mark all read".
  5. **Alerts:** active alerts (mark, "Gold above $4,200", state) → tap to edit, swipe to delete, "+ New alert" (card C9).
  6. Gear → **Channels:** the OS permission row first, then one switch per channel.
- **Channels (target):**

  | Channel | Title | Default | Sends |
  |---|---|---|---|
  | fills | Trades | On | TP/SL fills; Perpl fills (C4) |
  | liquidation | Liquidation | On | Warning and event |
  | deposits → money | Money in | On | Any asset arriving on any route (B3/B4/B5), sends received |
  | card | Card | On | Holds, declines, refunds (E4) |
  | priceAlerts | Price alerts | On | Alert crossed |
  | social (new) | Followers and replies | On | New follower, reply, like |
  | traders (new) | Traders you follow | **Off** | A followed trader opened a position |

- **Rules:**
  - **Inbox = ledger.** Migration 0009 adds `title`, `body`, `url`, `read_at` to `push_sends`. `GET /v1/notifications` (session, both networks for the address, newest first, 30 days) and `POST /v1/notifications/read` follow the `alertsListRoute` pattern (`API/routes/engagement.ts:52-58`; Part F7).
  - A channel switch controls the **push**, not the inbox: a row is written even with no device on that channel (`K/notify.ts:97-99`).
  - **One retry** after a failed delivery (network or 5xx), never for `DeviceNotRegistered` (`K/notify.ts:145-146`).
  - A newer push with the same collapse key replaces the older one (`K/notify.ts:37-38,120-123`).
  - Android: one OS channel per kind; Liquidation is high importance (`M/lib/notifications/PushHost.tsx:18-25,56-66`).
  - No app-icon badge (`M/lib/notifications/push.ts:59`, `PushHost.tsx:52`); the in-app bell count is the badge.
  - Switch changes save at once (`PUT /v1/push/token`); a failed save flips back (`M/app/account/notifications.tsx:93-99`). A registration that failed is sent at the next unlock (`PushHost.tsx:82-90`).
  - Copy: title ≤ 8 words, the market or token first ("Gold TP filled · +P$42.10"). No body sentence unless a number needs it.
- **States:**

  | State | Copy |
  |---|---|
  | Loading | Five skeleton rows |
  | Empty | "No notifications yet" |
  | Failed | "Couldn't load · Retry" |
  | Offline | "Offline · showing saved" |
  | Guest | "Notifications need an account" + Create account (`notifications.tsx:101-111`) |
  | Permission undecided | Banner "Notifications off" + Turn on |
  | Permission denied | Banner "Off in Settings" + Open Settings |
  | Build without the module | "Update Senryo for notifications" (`notifications.tsx:113-123`) |
  | Channel save failed | "Not saved · Retry" |
- **After:** read state syncs across devices; the target screen opens.
- **Today → gap:**
  - The bell opens price alerts (`M/components/shell/Utilities.tsx:52-58`). There is no inbox screen and no list API.
  - `push_sends` stores no title, body or url (`K/notify.ts:62-65`), so nothing can be shown later.
  - Failed deliveries are never retried (`K/notify.ts:79-83,105-107`; defect 11).
  - The card channel has no sender (defect 8). Deposits push only for inbox sweeps (`K/jobs/sweeps.ts:67`), so any-asset arrivals are silent.
  - No social channels (`AC/routes/engagement.ts:49`).
  - The channel page is rows with sentences + prose panels (`notifications.tsx:26-40,129-147`).
  - The alert cap of 50 counts both networks (`API/routes/engagement.ts:18,67-70`) and there is no edit (`M/features/markets/AlertsScreen.tsx:35-36`) (defect 11, card C9).
- **Acceptance:**
  - [ ] Set a TP on a Practice position → it fills → push "Practice · …" → tap opens the position → the inbox shows the row, read.
  - [ ] Turn the Trades channel off → the next fill makes no push but appears in the inbox.
  - [ ] Kill the network on the keeper host for one delivery → the push arrives once, on the retry.
  - [ ] A Mainnet push tapped in Practice → mode sheet first.
  - [ ] Bell count matches unread rows; opening the inbox clears it.

### G2 Deep links
- **Promise:** Any Senryo link or push opens the right screen, in the right mode, after whatever must come first.
- **Entry points:** `senryo://` links · `https://senryo.xyz/…` (associated domains and verified Android links, `apps/mobile/app.config.ts:38,53-57`) · push taps · shared profile, post, receipt and trade links · pasted text in Search.
- **Links:**

  | Link | Opens | Needs an account |
  |---|---|---|
  | `/markets/<SYMBOL>` | Market detail | No |
  | `/positions/<id>`, `/activity`, `/orders`, `/alerts` | That screen; guests see its own "Create account" state | No |
  | `/watch/<address or @handle>` | Profile, read-only | No |
  | `/watch/?address=…&chainId=…` (web share form) | Same profile | No |
  | `/receive`, `/withdraw`, `/send`, `/swap`, `/lp`, `/voucher`, `/balance-details` | That flow | Yes (`M/lib/incoming-link.ts:6-13`) |
  | `/account/(identity, recovery, security, delete, profile)` | That page | Yes |
  | `/card/(allowance, reveal, auth, wallet)` | That card page | Yes |
  | Legacy `/portfolio`, `/trade`, `/trade/<m>`, `/fund`, `/account` | Remapped (`M/lib/deep-link.ts:19-25`) | As the target |
  | New: `/notifications`, `/asset/<address>`, `/receipt/<id>` | Inbox, asset detail (B2), receipt (B12) | Yes, except asset |

- **Steps:**
  1. The link arrives (cold or warm) → `+native-intent` → `incomingLink` (`M/app/+native-intent.tsx:4-9`).
  2. Welcome not done, setup owed, or an account path → the link is stored (MMKV, survives a kill) and the app opens normally (`incoming-link.ts:14-18`).
  3. The host waits until the account is read, Welcome and setup are behind, and no setup is owed (`M/components/shell/DeferredLinkHost.tsx:16-24`).
  4. A guest on an account path → the Account sheet, once per link (`DeferredLinkHost.tsx:25-31`); after sign-in or create + setup, the link opens.
  5. A link for the other network → the mode sheet "This link is for Mainnet" → switch → the link opens (`deep-link.ts:46-57`, `M/app/(sheets)/network.tsx:28-39`). "Stay" drops it with the toast "Link not opened".
  6. An unknown path → Home (`M/app/+not-found.tsx:4-7`) with the toast "Link not found".
- **Rules:**
  - `next` must be an in-app path, never `//host` or a scheme (`network.tsx:8-9`).
  - `chainId` is stripped before routing; an unknown chain opens in the current mode (`deep-link.ts:51-55`).
  - Routing never throws (`+native-intent.tsx:5-9`).
  - Push taps take the same path (`M/lib/notifications/PushHost.tsx:28-36,68-74`), deduplicated per notification id.
  - **Paste anything:** Search accepts an address, @handle, token address or Senryo link and routes it as a link (profile, asset, market). Recent searches stay on the phone, per network (`M/lib/storage.ts:33-34`).
- **States:** waiting behind Welcome/setup → nothing visible until done · offline → the screen's own offline state.
- **After:** the pending link is cleared once opened (`DeferredLinkHost.tsx:32-34`).
- **Today → gap:**
  - An account created from the guest sheet skips setup, so the link opens before setup (`M/app/(sheets)/account-required.tsx:21`; defect 6).
  - The shared watch link is `…/watch/?address=` with no chainId (`M/features/auth/IdentityPanel.tsx:29`). On the phone it hits no route (`M/app/watch/` has only `[address]`) and silently lands on Home (defect 7). **Decision:** share `https://senryo.xyz/watch/?address=0x…&chainId=…` (the web's static form, `W/app/(desk)/watch/page.tsx:8`), and remap `/watch?address=X` → `/watch/X` in `deep-link.ts`.
  - Unknown links redirect with no word (`+not-found.tsx:4-7`).
  - Asset, receipt and inbox links don't exist yet.
- **Acceptance:**
  - [ ] Clean install → open a `/withdraw` link → Welcome → Create → setup → Withdraw opens.
  - [ ] Open a Mainnet market link in Practice → mode sheet → switch → the market opens.
  - [ ] Share the watch link from Wallet & address → open it on another phone → the profile opens in the right mode.
  - [ ] Paste an address into Search → that profile opens.

### G3 Offline, update, status and help
- **Promise:** The app always says what it knows, how fresh it is, and what to do next.
- **Entry points:** automatic (banner, blocker) · Settings → Status · Settings → Help.
- **Steps and rules:**
  - **Offline:** a floating banner "You're offline" (title only, ⓘ "Showing last known values"). Queries pause and refetch on reconnect; a warn haptic on drop (`M/components/shell/OfflineBanner.tsx:12-27`). Money actions show the first blocker, `OFFLINE` (`packages/core/src/blockers.ts:59`).
  - **Stale values:** anything past its freshness shows "Updated 3m ago" in `text3`. A stale price is the market's state banner (C2).
  - **Over-the-air updates:** expo-updates on channels `preview` / `production` (`apps/mobile/eas.json:25,33`), runtime by app version (`apps/mobile/app.config.ts:85-88`). No check options are set, so the library defaults apply (check at launch, apply at the next cold start). **Decision:** also check on foreground after 30 min; Settings shows "Update ready · Restart".
  - **Forced update:** `GET /v1/config` already returns `minAppVersion` (`AC/routes/info.ts:11-12`, `API/routes/info.ts:25-38`). Below it → full-screen "Update Senryo" + **Get the update** (TestFlight / Play / APK). Used for contract and breaking API changes. Read at launch, cached.
  - **Status page** from `GET /v1/status` (`API/routes/info.ts:44-89`): per network — Network (head age), Prices (oracle age per market), Indexer (lag), then Card, Perpl, Bridges. Each row: mark + "OK" / "Slow" / "Down" / "Unknown" + age. Pull to refresh; footer "Checked 12:04".
  - **Help:** FAQ (one-line questions, tap to expand), Email support (`M/app/account/help.tsx:1`), About & sources (today's content), Judge guide (G7).
- **States:**

  | State | Copy |
  |---|---|
  | Offline | "You're offline" |
  | Status loading | Skeleton rows |
  | Status unreachable | "Status unavailable · Retry" |
  | Below minimum version | "Update Senryo" |
  | Update downloaded | "Update ready · Restart" |
  | Update check failed | Silent |
- **After:** nothing stored except the cached config.
- **Today → gap:**
  - Status is a placeholder (`M/app/status.tsx:3-10`) although `/v1/status` exists. Perpl and Aurora report "unknown" (`API/routes/info.ts:83-88`).
  - `minAppVersion` has no reader in the app (no match in `apps/mobile/src` or `packages/query/src`).
  - No FAQ; Help is sources + contact (`help.tsx:22-40,100-110`).
  - The offline banner carries a body sentence (`M/lib/copy/diagnosis.ts:5-8`).
- **Acceptance:**
  - [ ] Airplane mode → banner; Home keeps its last values marked "Updated…"; the slide shows the offline blocker.
  - [ ] Raise `MIN_APP_VERSION` on the API → relaunch → "Update Senryo".
  - [ ] Stop the card service → Status shows Card "Down" within one refresh.

### G4 Accessibility
- **Promise:** Every flow works with VoiceOver and TalkBack, large text and reduced motion, and never by colour alone.
- **Entry points:** system settings; no in-app switch.
- **Rules:**
  - **Labels:** every control has a role and a label (e.g. `M/components/shell/Utilities.tsx:41-42`). The back button reads "Back", never a route name (`M/app/_layout.tsx:95-96`). Titles use the header role.
  - **Confirm without a gesture:** the confirm control exposes an "activate" action (`M/components/trade/HoldToConfirm.tsx:135-136`). `SlideToConfirm` keeps it: double-tap confirms, with the same Face ID / step-up.
  - **Story:** announces each scene title (`M/features/onboarding/Story.tsx:52`); no autoplay with a screen reader or Reduce Motion (`Story.tsx:27-28`).
  - **Dynamic Type:** heroes cap at 1.3×, controls at 1.35× (`packages/tokens/src/scale.ts:187,192`). Rows wrap; amounts never truncate.
  - **Reduce Motion:** staggers, rolling digits and springs become fades (e.g. `M/features/setup/PrimerScreen.tsx:76-96`).
  - **Reduce Transparency:** glass becomes a solid fill (`M/components/shell/useReduceTransparency.ts:5`).
  - **Colour + sign:** every change carries + or − (`M/lib/money.ts:28,53`) and positions say Long / Short.
  - **Live results:** async outcomes announce politely (`PrimerScreen.tsx:124-125`, `M/app/account/security.tsx:134`).
  - **Targets:** ≥ 44 pt, including 36 pt circles via hit slop (`Utilities.tsx:43`).
  - **Charts:** a one-line summary label ("Gold, up 1.2% today, $4,180 to $4,236").
  - The privacy plate is hidden from assistive tech (`M/features/auth/PrivacyPlate.tsx:21-22`).
- **States:** n/a.
- **After:** n/a.
- **Today → gap:**
  - Font caps appear in 35 files only; new components (`SlideToConfirm`, `AssetPicker`, keypad, inbox rows) must set them.
  - Chart summaries: UNDEFINED in code today.
  - No audit has been recorded. Run Accessibility Inspector on each merged area.
- **Acceptance:**
  - [ ] VoiceOver: create an account, open a Practice trade (double-tap confirms), close it — every element reads.
  - [ ] Largest text size: Home, ticket and Settings show no clipped amounts.
  - [ ] Reduce Motion on: no stagger or rolling digits; the story doesn't autoplay.

### G5 Sounds and haptics
- **Promise:** Outcomes sound and feel like they happened; nothing chirps for no reason.
- **Entry points:** Settings → Sounds & haptics.
- **Rules:**
  - **Sound cues** (Part C) for finalized outcomes, arrivals and welcome only. No sound for taps or navigation (`M/feedback/sound.ts:5-10`).

    | Cue | When | File today |
    |---|---|---|
    | swipe | Story scene settles | `scene` ✓ (`Story.tsx:53`) |
    | welcome | Setup done, once per account | `onboarding` ✓ (`M/app/setup/done.tsx:38-44`) |
    | opened / closed | Position opened / closed | `fill` ✓, one cue for every other completed operation (`M/components/shell/FeedbackHost.tsx:23-28`) |
    | sent | Send, withdraw or swap finalized | `send` ✓ (`FeedbackHost.tsx:25-26`) |
    | received | Money arrived, any asset | `deposit` ✓, but only for own deposit/claim/faucet operations (`FeedbackHost.tsx:23-24`); incoming transfers have no cue |
    | unlock | Session unlocked | ✗ declared, no file |
    | liquidation | Liquidation event | ✗ declared, no file |
    | alert | Price alert in-app | ✗ |
    | error | Failed outcome (off by default) | ✗ declared, no file |

  - **Haptics:** eight words (`M/feedback/haptics.ts:10`) — tick (tabs, chips, keypad), press, snap (detents, scenes), confirm, filled, warn, fail, liquidation (two beats, `haptics.ts:31-40`).
  - Two switches, both default on (`M/feedback/fire.ts:19-31`, `M/app/account/preferences.tsx:31-61`).
  - Sounds follow the silent switch and mix with other audio (`sound.ts:29-33`); never in the background (`sound.ts:52`).
  - A sound failure never touches the action (`sound.ts:34-36,56-58`).
  - **Preview:** Sounds & haptics lists each cue with a play button (players created on demand). Until freeze, three variants per cue can be picked by ear; unused ones are removed (Part C).
- **States:** module missing → silent.
- **After:** choice stored on the phone.
- **Today → gap:**
  - `unlock`, `liquidation` and `error` have no files (`sound.ts:11-20`), so the unlock sound (`M/features/auth/useAuthFlow.ts:41`) and the liquidation default (`fire.ts:17`) play nothing.
  - No opened/closed split, no alert cue, no preview. Outcome sounds fire once per operation, only for live, foreground outcomes (`FeedbackHost.tsx:8-21`); arrivals need B3's detection before they can sound.
  - The Sounds row has a sentence subtitle (`preferences.tsx:36`).
  - Sound quality can't be judged by the agent; the user picks by ear.
- **Acceptance:**
  - [ ] Ringer on: open a trade → opened cue; receive MON → received cue.
  - [ ] Ringer off: no sounds; haptics still fire.
  - [ ] Haptics off: the ruler detents stop.
  - [ ] Preview plays each cue.

### G6 Web parity
- **Promise:** senryo.xyz does every capability card with the same steps and words.
- **Entry points:** senryo.xyz.
- **Rules:**
  - The same cards A–F. Named differences only:

    | Topic | Web |
    |---|---|
    | Face ID | Passkey prompt ("passkey" wording, `packages/account/src/copy.ts:15-19`) |
    | Push | None; the inbox is the channel |
    | Haptics | None |
    | QR scan | Camera if allowed, else Paste |
    | Add to Wallet | Not offered |
    | Backup passkey | Native here (WebCrypto + file) |

  - Same API, same routes, same copy tables.
- **Today:** routes are landing, account, card, fund, markets, portfolio, trade, watch, terms, privacy (`W/app`). Fund, card, portfolio holds and the ticket are previews with sample data (`W/components/screens/fund-screen.tsx:45-48`, `card-screen.tsx:23-25`, `portfolio-screen.tsx:58-60`, `trade/ticket.tsx:153-155`).
- **Gap:** no setup, social, alerts, inbox, activity, send/withdraw/swap, settings list. The web has backup-passkey recovery that the phone lacks (`W/components/auth/welcome-actions.tsx:126-133`). The per-card parity table goes in `capability-matrix.md`.
- **Acceptance:**
  - [ ] Create on the phone → sign in on the web → same address, positions, profile.
  - [ ] Walk A2, C3, B7 and F4 on the web with the same copy as the phone.

### G7 Judge path
- **Promise:** A judge reaches a real trade in under two minutes on any device, even when geo-blocked.
- **Entry points:** README "Judge? Start here" → judge guide · web landing · TestFlight / APK link and QR · Help → Judge guide.
- **Steps:**
  1. Open senryo.xyz or install.
  2. Create account (passkey) → setup (Skip everywhere except Terms).
  3. Practice: Get P$100, or a voucher code from the guide.
  4. Long Gold with a stop loss → status → position. Short EUR → close half.
  5. Stateless proof: sign in on a second device → same address, same positions.
  6. Mainnet: voucher (12 AUSD) → Perpl BTC long → close.
  7. Geo-blocked or no PRF: the watch link of the demo account + the demo video.
- **Rules:**
  - Practice is never geo-gated (D-038, `docs/plan/00-plan.md:82`).
  - Mainnet vouchers: 12 AUSD each, capped count (`docs/plan/00-plan.md:155`); Perpl needs ≥ 10 AUSD (`00-plan.md:74`).
  - Watch mode is read-only for anyone (`M/app/watch/[address]/index.tsx:1-5`, `W/components/screens/watch-screen.tsx:4`).
  - Target: the "wow" in under two minutes, nothing broken on a fresh device (`00-plan.md:263`).
- **States:**

  | State | Copy |
  |---|---|
  | No PRF | "Open senryo.xyz" (`M/features/auth/AuthFailure.tsx:24,48-49`) |
  | Geo-blocked on Mainnet | "Not available in your region" + Use Practice |
  | Vouchers used up | "All vouchers used" (`M/app/setup/voucher.tsx:21`, shortened) |
- **After:** the guide lists the demo account's address and the Mainnet tx hashes.
- **Today → gap:**
  - No judge guide (`docs/submission/` doesn't exist).
  - Perpl isn't built (C4, D1). Mainnet vouchers wait for the core deploy (D4).
  - The watch link lacks chainId (G2; defect 7).
  - External TestFlight targeted for about 9 Oct (plan D11).
- **Acceptance:**
  - [ ] A fresh phone: install → first Practice trade in under 2 min, stopwatch.
  - [ ] A US IP: Practice works; Mainnet shows the blocker; the watch link opens the demo account.
