# A — Identity and access

Capability cards A1–A11 from the plan (§0.4 "Account", §0.6 A, §0.7, §0.9 "Welcome and login", "Settings", "Wallet & address", "Mode sheet"). `UNDEFINED` = not settled by code or docs; each is a research task, not a question for the user. "Defect n" = Part 1 of the plan.

**Paths.** `M/` = `apps/mobile/src/` · `ACC/` = `packages/account/src/` · `AC/` = `packages/api-client/src/` · `API/` = `services/api/src/` · `W/` = `apps/web/src/`.

## Facts every card uses

- **One passkey, one address, both networks.** The address is derived from the passkey's PRF output with a frozen path (`ACC/constants.ts:8-13`). Practice (10143) and Mainnet (143) share it.
- **One account per phone.** The phone keeps one hint: address, credential, mode, time (`ACC/platform/types.ts:20-28`, key `ACC/constants.ts:59-63`). The hint holds **no handle or avatar**.
- **Fresh installs start in Practice** (`M/lib/storage.ts:23-24`).
- **Session defaults:** 30 min absolute, 5 min idle; choices 5/15/30/60 and 1/5/15 (`ACC/constants.ts:27-33`). Backgrounding locks (`M/lib/account/provider.tsx:73-79`).
- **Session caps:** $250 per trade, $1,000 per session, $250 per swap/approve/pool move, 10× equity, 20 signatures a minute (`ACC/constants.ts:36-45`).
- **Face ID per trade:** Practice off, Mainnet at or above $50 (`ACC/policy/types.ts:83`); Mainnet can't go below that floor (`M/lib/account/api.ts:46-51`).

---

### A1 Look around before an account
- **Promise:** Browse markets, traders and the feed with no account; the first real action asks once, then carries on.
- **Entry points:** Welcome → "Look around" · a deep link to any public screen · Settings → Replay welcome → "Look around".
- **Steps:**
  1. Welcome → **Look around** (text action) → Markets tab.
  2. Open to guests: Markets (list, detail, chart, Holders, Feed, About), Social feed and leaderboard, any profile (`/watch/<address|@handle>`), Home guest state, Card intro, Settings (Preferences and About rows). Watchlist stars stay on the phone (`M/features/markets/WatchlistSync.tsx:1-6`).
  3. Any account action → **Account sheet:** art · "Create an account to {verb}" · **Create account** · **I have an account** · "Keep browsing".
     - Verbs: trade, add money, follow, like, reply, post, set alerts, get a card, send.
  4. Create → passkey → setup (A2) → back on the same screen with the action re-opened (the ticket on the same market and side; the follow applied).
  5. I have an account → passkey picker → A3 → the same resume.
  6. Keep browsing or swipe down → nothing changes.
  - **Practice vs Mainnet:** a guest can switch the pill and browse Mainnet read-only; there is no session to lock.
- **Rules:**
  - The sheet carries the intent `{route, params, action}`. It resumes once, after setup is finished or skipped, and only if the action still applies (else it lands on the screen without acting).
  - Deep links already wait and resume after an account (`M/components/shell/DeferredLinkHost.tsx:25-34`, asked once per link `:26-29`).
  - Cancelling the passkey is silent (`M/features/auth/useAuthFlow.ts:44-48`).
- **States:**

  | State | Copy |
  |---|---|
  | Account store not read | Skeleton line (label "Opening Senryo", `M/features/auth/WelcomeActions.tsx:35`) |
  | Ceremony running | "Creating your account" / "Opening your account" (`M/features/auth/CeremonyCard.tsx:17-18`) |
  | Cancelled | Sheet slides away, no copy |
  | Failed | Shared failure copy + one action (`M/features/auth/AuthFailure.tsx:39-57`) |
  | Offline | Buttons stay; a ceremony that fails shows its shared copy. Setup steps show their own offline lines. **UNDEFINED:** whether passkey create succeeds offline on iOS/Android (associated-domain check) — test on device |
- **After:** `welcomed` is set; nothing else is stored for a guest.
- **Today → gap:**
  - The sheet closes on success and drops the action (`M/app/(sheets)/account-required.tsx:21`); callers pass no intent (e.g. `M/features/trade/TicketFooter.tsx:111`). Add the intent and resume.
  - Create from the sheet skips setup (same line; defect 6).
  - The title is fixed, and the body is a sentence (`account-required.tsx:30-31`).
  - The Welcome label is "Browse markets" (`WelcomeActions.tsx:101`) → "Look around".
- **Acceptance:**
  - [ ] Clean install → Look around → Markets, a market, a profile, the feed all open; no prompts.
  - [ ] As a guest, Long on Gold → sheet "Create an account to trade" → Create → setup → the ticket re-opens on Gold, Long.
  - [ ] Follow as a guest → sheet → I have an account → back on the profile, followed.
  - [ ] Keep browsing → same screen, same scroll.

### A2 Create account
- **Promise:** One passkey makes the account; a short setup makes it yours.
- **Entry points:** Welcome → Create account · Account sheet → Create account · guest states on Settings pages (e.g. `M/app/account/security.tsx:84-93`) · web welcome.
- **Steps:**
  1. **Create account** → sheet "Creating your account" → system passkey sheet (some providers ask twice; `CeremonyCard.tsx:36`).
  2. Success → unlock sound → setup. **Setup is owed from this moment** and resumes after a kill.
  3. Setup, one page each (Back · centred seal · Skip; progress bar on top; title + ≤ 1 line):
     1. **Username:** "@" input prefilled with a suggestion (`M/features/setup/suggest-handle.ts:14-22`); live inline result. Below it, **"Show my trades"** with **Practice** (on) and **Mainnet** (off) chips; ⓘ "One address on both networks. Each chip lists you there."
     2. **Follow top traders:** rank, avatar, 30-day PnL, check; none preselected (`M/app/setup/follow.tsx:18-21`). Button "Follow 3 and continue".
     3. **Money:** Practice → big "Get P$100" card with art (B15), "Have a code?" text opens the voucher field. Mainnet → Add money rows (Card or bank · Crypto on Monad · Another chain) + "Later".
     4. **Terms:** sheet over Home: three rows + ⓘ, one checkbox, Continue (A11). No Skip.
     5. **Face ID primer:** art, "Unlock with a look", Turn on / Not now (`M/app/setup/face-id.tsx:43-129`).
     6. **Notifications primer:** art, "Don't miss a move", Turn on / Not now (`M/app/setup/notifications.tsx:35-128`).
     7. **Done:** foil + "You're in, @handle" → Home with a first-action card (Practice "Open your first trade"; Mainnet "Add money").
- **Rules:**
  - Username `[a-z0-9_]{4,20}`, lower-case (`AC/social.ts:6-9`). The server decides reserved and blocked names (`AC/social.ts:1-4`, `API/social/profiles.ts:25,56`).
  - Visibility defaults: Practice listed + trades on, Mainnet off (`AC/social.ts:31-36`). The first save sends all four values explicitly.
  - Every step can be skipped except Terms; skipping still advances (`M/features/setup/progress.ts:1-5`, `M/app/setup/terms.tsx:27`).
  - Setup is bound to the address and versioned (`progress.ts:10-50`). Only **create** starts it.
  - Each new passkey gets a dated name so the picker tells them apart (`ACC/constants.ts:20-22`).
  - A voucher is signed in-session; the sponsor pays the fee; it is never re-sent by itself (`M/features/setup/useVoucher.ts:1-5`).
- **States:**

  | State | Copy |
  |---|---|
  | Cancelled passkey | Silent; Welcome unchanged, not marked welcomed |
  | Create failed, passkey may exist | Failure title + **I already have an account** (`AuthFailure.tsx:40-47`) |
  | No PRF / unsupported | Failure title + **Open senryo.xyz** (`AuthFailure.tsx:24,48-49`) |
  | Username checking | "Checking…" |
  | Available / taken / reserved / on hold | "@kai is available" / "Taken" / "Reserved" / "On hold" + ⓘ |
  | Invalid | "4–20 characters" / "Letters, numbers, _ only" / "Not allowed" |
  | Check failed | "Couldn't check · Retry" |
  | Lost the race on save | "Just taken · try another" |
  | Follow list loading / empty / failed | Skeleton rows / "No ranked traders yet" / "Couldn't load · Skip" |
  | Practice money | "P$100 added" · pending "Pending · Check status" · voucher errors as `M/app/setup/voucher.tsx:18-26`, shortened |
  | Killed mid-setup | Reopens on the owed step |
- **After:** profile with username and visibility; follows; P$ in Assets with an Activity row; terms version stored for the address; push registered; the welcome sound once (`M/app/setup/done.tsx:38-44`).
- **Today → gap:**
  - `welcomed` is set on tap, before the passkey (`WelcomeActions.tsx:83,96`). Set it only on success or Look around (defect 6, §0.7 #12).
  - Setup starts only in Welcome's `onDone` (`M/app/welcome.tsx:24-30`). The hint is written inside `create()` (`ACC/client.ts:79`), so a kill before `startSetup` lands on Home (`M/app/index.tsx:13-15`) (defect 6). **Decision:** the account provider writes the owed setup when `create()` resolves, and a `creating` marker set before the ceremony catches a kill in between.
  - Guest-sheet create never starts setup (`account-required.tsx:21`; defect 6).
  - Visibility is never shown; the save sends only the handle (`M/app/setup/handle.tsx:77-78`; defect 7).
  - Reserved names fall through to "That name is taken" (`handle.tsx:69-71`; defect 7). The editor already has "reserved" (`M/features/profile/useHandleField.ts:98-99`).
  - Step 3 is voucher-only (`voucher.tsx:33-101`). The P$100 claim lives elsewhere (B15).
  - Every step has a sentence body (`handle.tsx:95-96`, `follow.tsx:62-63`, `voucher.tsx:61-62`, `terms.tsx:15-19`). No progress bar (`M/features/setup/SetupScreen.tsx:69-108`).
- **Acceptance:**
  - [ ] Create → cancel the passkey sheet → still on Welcome; relaunch shows Welcome again.
  - [ ] Create → kill the app on the Username step → relaunch opens Username.
  - [ ] Create from the guest sheet → setup runs → back to the original screen.
  - [ ] Type `senryo` → "Reserved"; `ab` → "4–20 characters"; a free name → "@name is available".
  - [ ] Leave Practice on and Mainnet off → Practice leaderboard lists you; Mainnet doesn't.
  - [ ] Terms can't be skipped; every other step can.
  - [ ] Done → Home shows the first-action card.

### A3 Sign in
- **Promise:** The same passkey opens the same account on any phone, and warns you when it wouldn't.
- **Entry points:** Welcome (returning) → Continue with Face ID · Welcome → I have an account · Account sheet → I have an account · a failure's "I already have an account" · web welcome.
- **Steps:**
  - **Same phone:** avatar + **@handle** large → **Continue with Face ID** (one biometric read) → Home. Cancelling still opens Home, locked. "Use another account" (text) → A5. The address shows only when there is no handle.
  - **New phone or reinstall:** I have an account → "Opening your account" → passkey picker →
    - known or non-empty account → **"Signed in as @handle"** check moment (~1 s, unlock sound) → Home with skeletons;
    - an account with no profile and no holdings on either network → sheet "This passkey opens an empty account" · **Use it** / **Pick another**;
    - a phone that held a different account → sheet "This passkey opens a different account" · **Use it** / **Pick another**.
  - No username yet → Home first-action card "Pick a username" → A7.
  - Terms not accepted on this phone → asked at the first money action (A11), not at sign-in.
- **Rules:**
  - Everything rebuilds from chain + API; nothing depends on the old phone. Skeletons, never $0 (§0.5 #9).
  - Discoverable sign-in may open any Senryo passkey (`ACC/client.ts:85-95`). The check runs **before** the hint is replaced, so "Pick another" restores the previous account.
  - Handle and avatar are cached per address on this phone when the profile loads (new key), so Welcome can show them offline.
- **States:**

  | State | Copy |
  |---|---|
  | No passkey on this phone | "No Senryo passkey here" + Create account (`ACC/copy.ts:35-39`, `AuthFailure.tsx:53-55`) |
  | Face ID changed | "Face ID changed" + confirm with passkey (`ACC/copy.ts:62-66`) |
  | Wrong passkey on unlock | "That passkey opens a different account" (`ACC/copy.ts:57-61`) |
  | Timed out / interrupted | "That took too long" / "Interrupted" + Try again |
  | Profile loading | Name skeleton; address until it loads |
- **After:** hint written; push registration owed for this account is sent at the next unlock (`M/lib/notifications/push.ts:118-123`).
- **Today → gap:**
  - Returning Welcome shows "Continue · 0x12…ab", "Open Home, locked", "Another account" (`WelcomeActions.tsx:40-75`) → avatar + @handle, one primary, one text action.
  - Sign-in adopts whatever account opens, silently (`ACC/client.ts:85-95`, `M/app/welcome.tsx:27`). This is the backup-passkey trap (defect 7). Split `signIn` into open → check → adopt.
  - No "Signed in as" moment (`welcome.tsx:27` goes straight to Home).
  - The hint has no handle (`ACC/platform/types.ts:20-28`).
  - **UNDEFINED:** "empty" needs the holdings read (B1) on both networks; until B1 ships, "empty" = no profile and zero AUSD/USDC/MON.
- **Acceptance:**
  - [ ] Reinstall → I have an account → same address, positions and P$ as before; skeletons, never $0.
  - [ ] Pick a passkey for an unused account → "empty account" sheet → Pick another → the right account opens.
  - [ ] Returning user sees avatar + @handle; cancel Face ID → Home, locked.

### A4 Unlock and lock
- **Promise:** One Face ID opens trading for a while; it locks itself when you leave or stop.
- **Entry points:** the slide of any money action while locked · Session sheet (session chip) · "Unlock" in locked states (`M/app/account/profile.tsx:79-86`, `M/features/markets/AlertsScreen.tsx:104-117`).
- **Steps:**
  1. Slide while locked → one Face ID read → the session starts → the action signs.
  2. The session runs until TTL, idle, background, Lock now, or a switch to Mainnet.
  3. In the last minute the chip reads "Locks in 0:59" with a warn haptic (`ACC/constants.ts:29-30`).
  4. Away from the app, the switcher shows the seal plate (`M/features/auth/PrivacyPlate.tsx:14-29`).
- **Rules (confirmation levels):**

  | Action | Practice | Mainnet |
  |---|---|---|
  | Open under $50 | Session | Session |
  | Open $50 or more | Session (Face ID off by default) | Face ID |
  | Over $250 a trade, $1,000 a session, 10× equity, 20 a minute | Passkey step-up | Passkey step-up |
  | Reduce, close, cancel a trigger, repay card debt | Never capped (`ACC/policy/evaluate.ts:95-98`) | Same |
  | Swap, approve, pool deposit ≤ $250 | Session | Session |
  | Send to others, card limits, phrase, looser security | Always step-up (`evaluate.ts:118-124`) | Same |

  Evidence: `evaluate.ts:49-87`. A step-up is a fresh pinned passkey ceremony with a one-shot signer (`ACC/client.ts:134-148`).
- **States:**

  | State | Copy |
  |---|---|
  | Face ID cancelled | Silent; the slide springs back |
  | Face ID locked out | "Face ID locked · use passcode" |
  | Step-up sheet | Intent title + "Confirm with passkey" (`M/app/(sheets)/step-up.tsx:66-84`) |
  | Over the session limit | "Above your session limit" (`ACC/copy.ts:83-87`) |
  | Rate limit | "Lots of orders in a minute" (`ACC/copy.ts:88-89`) |
- **After:** nothing persists; usage resets with each session.
- **Today → gap:**
  - Over-cap trades failed instead of stepping up (defect 1, `evaluate.ts:70-81`). **In progress** in this worktree (uncommitted): `M/features/trade/confirm-level.ts:28-40` and `M/features/trade/useTicket.ts:120-130` route them to `account.stepUp`.
  - The Session sheet is prose + a KeyValue panel (`M/app/(sheets)/session.tsx:48-59`) → rows: who, "Unlocked · locks 14:32", Lock now / Unlock, Use another account, Sign out.
  - The step-up footer is a sentence (`step-up.tsx:71`).
  - The unlock sound has no file (`M/feedback/sound.ts:14-20`; G5).
- **Acceptance:**
  - [ ] Practice P$100 at 5× (P$500) → slide → passkey step-up → opens.
  - [ ] Background the app → the switcher shows the plate → return → the next slide asks Face ID.
  - [ ] Security → Session length 60 min → passkey asked; 5 min → saved at once.

### A5 Switch account
- **Promise:** Use a different Senryo account on this phone in two taps.
- **Entry points:** Session sheet → Use another account · returning Welcome → Use another account.
- **Steps:**
  1. Sheet: "Switch account?" · ⓘ "This phone keeps one account." · **Choose passkey** / Cancel.
  2. Passkey picker → the same address → toast "Already using @kai"; a different one → A3's checks → "Signed in as @other" → Home in the same mode.
  3. The previous account comes back the same way.
- **Rules:**
  - One hint per phone; sign-in replaces it (`ACC/client.ts:85-95`). The old session locks (`ACC/session/manager.ts:92-93`).
  - Push rebinds to the new account at its next unlock (`push.ts:118-123`; `API/routes/engagement.ts:121-130`).
  - Pending operations are keyed by chain + address, so the old account's stay on the phone and show again when it returns.
  - Setup never starts on a switch.
- **States:** cancelled → nothing changed; failure → shared copy; offline → allowed, profile and balances load later.
- **After:** Activity, positions and inbox show the new account.
- **Today → gap:** "Switch" runs `signIn` with no confirmation and no checks (`session.tsx:82-88`; Welcome `WelcomeActions.tsx:63-73`). The plan marked this UNDEFINED; it is now defined here.
- **Acceptance:**
  - [ ] Switch to account B → Home shows B; switch back → A's positions and pending items return.
  - [ ] Push for A no longer arrives after B unlocks.

### A6 Recover
- **Promise:** Get back in on any device, and leave with your keys if you choose.
- **Entry points:** Settings → Recovery · the "No Senryo passkey here" failure → "Use a backup passkey" · web welcome.
- **Steps:**
  1. **Passkey sync** row: "iCloud Keychain" / "Google Password Manager" + ⓘ "Synced passkeys open this account on your other devices."
  2. **Backup passkey** row: "Not added" or "Added · 2 Oct" → **Add** → senryo.xyz/account in the in-app browser (WebCrypto + recovery file) → returns via `senryo://account/recovery`.
     - With none added: a Recovery banner, plus a one-time Home card "Add a backup passkey" after the first Mainnet deposit.
  3. **Export recovery phrase** (Advanced): step-up "Show your recovery phrase" → 24 words, screenshots blocked, hidden after 60 s or on background, never copied (`M/features/auth/PhraseGrid.tsx:1-5`, `M/lib/constants/auth.ts:14`).
  4. **Recover on a new phone:** Use a backup passkey → vault fetched (`GET /v1/vault/:credentialId`) → second prompt → the hint is stored in vault mode (`ACC/platform/types.ts:23-26`, `ACC/client.ts:211-216`).
- **Rules:** the phrase imports into any standard wallet at the same address (`M/app/account/recovery.tsx:97-100`). Export always steps up (`recovery.tsx:35-46`).
- **States:**

  | State | Copy |
  |---|---|
  | Guest | "Create an account first" + Create account (`recovery.tsx:48-57`) |
  | Step-up cancelled | Nothing shown |
  | No backup for that passkey | "No backup for this passkey" (`W/components/auth/recover-sheet.tsx:22`) |
  | Senryo unreachable | "Use your recovery file" (web) |
- **After:** backup row shows "Added"; Activity unaffected.
- **Today → gap:**
  - Three prose panels (`recovery.tsx:62-104`) → three rows + ⓘ.
  - No backup status read (the list route exists: `GET /v1/vault` list, `API/routes/storage.ts:112`).
  - Mobile has no backup-passkey sign-in; web does (`W/components/auth/welcome-actions.tsx:126-133`) (defect 7).
  - **UNDEFINED:** whether iOS/Android expose passkey-sync state to apps. Until research says yes, the sync row names the provider only.
- **Acceptance:**
  - [ ] Recovery → Export → passkey → words show; screenshot blocked; hidden after 60 s.
  - [ ] Add a backup on the web → the row reads "Added".

### A7 Edit profile
- **Promise:** Change how people see you, per network, in one page.
- **Entry points:** own profile → avatar / Edit · Home card "Pick a username" · own profile chip "Make public on Mainnet" (opens on Visibility).
- **Steps:** portrait strip (12 authored portraits, no uploads; `M/features/profile/ProfileEditor.tsx:7`) → Name → @username (live states) → Bio with counter → Visibility per network: "List my profile", "Share my trades" → **Save** pinned (enabled only when changed and the username is valid).
- **Rules:**
  - Name ≤ 32, bio ≤ 160 (`AC/social.ts:16-17`); blocked words refused (`API/social/profiles.ts:59-61`).
  - A released username is held 30 days for its owner (`AC/social.ts:12-13`). At most 5 released names held per 30 days (`API/social/constants.ts:152`, `API/social/profiles.ts:65-74`).
  - Trades are shared only from a listed profile; unlisting turns them off (`M/features/profile/VisibilitySettings.tsx:1-7`).
  - Editing needs an unlocked session (`M/app/account/profile.tsx:20-24`).
- **States:** loading → three field skeletons (`profile.tsx:70-77`) · locked → "Unlock to edit" + Unlock · failed → "Couldn't load · Retry" · save: "Just taken" / "Too many changes · try in 3 d" / "Not allowed" · saved → "Saved" toast.
- **After:** profile, leaderboard and feed show the change; the old name is held.
- **Today → gap:** built (`ProfileEditor.tsx`). Trim the sentences (`VisibilitySettings.tsx:34-57`) to rows + ⓘ.
- **Acceptance:**
  - [ ] Change the username → the old one is "On hold" for another account.
  - [ ] Unlist Mainnet → Mainnet trades switch off with it.

### A8 Mode switch
- **Promise:** Move between Practice and Mainnet deliberately, never by accident.
- **Entry points:** mode pill (`M/components/shell/ModeCapsule.tsx:35`) · Settings → Mode · a link or push for the other network (`M/lib/deep-link.ts:46-57`) · "Switch to Practice" on pre-launch Mainnet screens.
- **Steps:**
  1. Pill → sheet with two rows: Monad mark · **Practice** · "P$1,240.50" · check; Monad mark · **Mainnet** · "$212.10".
  2. Practice → switches at once; the sheet closes.
  3. Mainnet → the row opens: "Real money from here." + **Slide to use real money** → the session locks → Mainnet.
  4. From a link: the same sheet with one line "This link is for Mainnet"; the link opens after the switch (`M/app/(sheets)/network.tsx:28-39`).
- **Rules:** positions on the other network are untouched. Switching to Mainnet locks the session so the Mainnet Face ID floor applies (`M/features/network/NetworkPicker.tsx:43-49`); switching to Practice does not (`:36-42`). Partial totals show "≈" (`:57-61`). The choice persists (`M/lib/storage.ts:23-24`).
- **States:** balance loading → row without an amount · unknown → "—" · partial → "≈ $212.10" + ⓘ · offline → still switchable.
- **After:** every screen re-reads the new network.
- **Today → gap:** title "Choose your money" + a sentence (`network.tsx:18-22`); a confirm block with a title, a sentence and two buttons (`NetworkPicker.tsx:75-84`) → one sentence + slide (§0.7, Part A9). Settings page title "Practice or real" (`M/app/account/mode.tsx:9`) → "Mode". Pre-launch copy is prose (`M/features/network/PrelaunchMainnet.tsx:24-31`).
- **Acceptance:**
  - [ ] Pill → Mainnet → slide → Mainnet; the next trade asks Face ID.
  - [ ] Open a Mainnet push while in Practice → the sheet asks first, then opens the screen.

### A9 Sign out and delete data
- **Promise:** Leave this phone, or remove everything Senryo holds about you, and see exactly what happened.
- **Entry points:** Settings → Sign out (bottom) · Session sheet → Sign out · Settings → Delete my data.
- **Steps:**
  - **Sign out:** sheet "Sign out of @kai?" · ⓘ "Your passkey signs you back in." · **Sign out** / Cancel → returning Welcome.
  - **Delete:** page with three compact lists (Senryo's servers · This phone · What stays) → **Delete my data** → passkey step-up → "Deleting…" → results with a count per item, and any part that failed with **Retry**.
- **Rules:**
  - Sign out ends the session and removes the hint and the unlock item (`ACC/client.ts:180-185`); it stops pushes when unlocked (`M/lib/account/provider.tsx:141-147`, `push.ts:94-112`).
  - Server delete today: social data + encrypted prefs (`M/lib/account/remote.ts:98-105`, `M/features/profile/DeleteScope.tsx:13-22`). **Add:** price alerts, push tokens, vault blobs (route exists, `API/routes/storage.ts:126-131`), inbox watches, and the account link on analytics events (`API/routes/engagement.ts:100-113`).
  - Username held 30 days. Onchain history stays (`DeleteScope.tsx:35-40`).
  - Offline: the phone part completes; the server part is queued and retried at the next sign-in with that passkey.
- **States:** "Deleting…" · "Data deleted" · "Phone cleared · server pending" + Retry · step-up cancelled → nothing deleted.
- **After:** Welcome; results page shows counts.
- **Today → gap:**
  - Sign out has no confirmation (`session.tsx:90-96`).
  - Delete uses a two-tap confirm, no step-up (`M/app/account/delete-data.tsx:140-152`).
  - Server leftovers (defect 10): alerts (no delete-all in `engagement.ts:52-87`); push tokens only disabled, and only while unlocked (`engagement.ts:141-147`, `provider.tsx:144`); vault blobs; inbox watches (expire by retention only).
  - The privacy notice omits these (`packages/config/src/legal.ts:77-88`; defect 10).
  - Phone keys left behind: eligibility, card intro, markets, watchlist clock (`M/lib/storage.ts:29-40` vs `delete-data.tsx:28-35`).
- **Acceptance:**
  - [ ] Delete with an alert and push on → results list alerts and push removed; the API holds no rows for the address.
  - [ ] Airplane mode → delete → "Phone cleared · server pending" → sign in later → the server part completes.

### A10 Settings
- **Promise:** Every account and app choice in one plain list.
- **Entry points:** own profile → gear (`M/app/(tabs)/you/index.tsx:59`). A guest sees Preferences and About only (`M/features/profile/YouSections.tsx:141`).
- **Layout** (grouped list, coloured icon squares, title + trailing value; no subtitles):
  - **Account:** Wallet & address ("0x12…ab") · Security ("30 min") · Recovery ("Add backup") · Mode ("Practice") · Blocked & muted.
  - **Preferences:** Appearance ("System") · Sounds & haptics · Notifications ("On") · Hide balances (switch) · Replay welcome.
  - **About:** Status · Help · Terms · Privacy.
  - Delete my data · **Sign out**.
  - Footer "Senryo 1.0 (12)"; long-press → Diagnostics.
- **Child pages:**
  - **Wallet & address:** avatar + @handle, QR, grouped address, Copy · Share circles; network rows (Monad mark, chain id, explorer); "Signed in with passkey"; saved destinations (B13).
  - **Blocked & muted:** two tabs; rows avatar + @handle + Unblock / Unmute (`GET /v1/blocks`, `/v1/mutes`: `AC/routes/moderation.ts:50-56,78-86`).
  - **Hide balances:** amounts show "••••" on Home, Assets and Card; long-press the Home hero to toggle.
  - **Appearance:** System · Dark · Light (the theme already follows the system when unset: `M/theme/index.tsx:17-27`).
- **Rules:** browsing needs no Face ID (`M/app/account/settings.tsx:5`). Tightening applies at once; loosening asks for the passkey (`M/app/account/security.tsx:65-82`, `ACC/session/manager.ts:194`).
- **States:** guest rows hidden; each child page owns its loading/empty/error.
- **Today → gap:**
  - Rows carry subtitles over 32 characters ("Price alerts, activity and delivery preferences", `YouSections.tsx:90`) and lucide icons (`YouSections.tsx:9-23,38`).
  - Missing: Blocked & muted (defect 11), Sign out, Hide balances, Help/FAQ (Help is "About & sources", `M/app/account/help.tsx:58`), System appearance (`M/app/account/preferences.tsx:14-17`).
  - Diagnostics is a row (`YouSections.tsx:115`) → long-press.
  - Wallet page: "Share watch link" with no chainId (`M/features/auth/IdentityPanel.tsx:29,107-112`; defect 7).
- **Acceptance:**
  - [ ] Every row opens its page; no row has a subtitle.
  - [ ] Block someone from their profile → they appear in Blocked & muted → Unblock works.
  - [ ] Hide balances → Home, Assets and Card show "••••".

### A11 Eligibility and terms
- **Promise:** Agree once before money moves; confirm your region once before real-money trading.
- **Entry points:** setup step 4 · the first money action (trade, add money, send, withdraw, swap, pool, card) for an address with no terms record on this phone · the first Mainnet trade (region).
- **Steps:**
  1. **Terms sheet** over the current screen: "Before you start" · three rows with ⓘ (Your passkey is your account · Leverage can lose it all · Practice money has no value) · checkbox "I agree to the Terms and Privacy" · Continue → the action resumes.
  2. **Region check** (Mainnet, first trade): "Trading with real money" · one checkbox row "I'm not in a restricted region" + ⓘ with the list · Continue → the ticket.
  3. **Server geo block:** the ticket's first blocker "Not available in your region" + Practice (`packages/core/src/blockers.ts:60`). Deposits and withdrawals of own funds stay open.
- **Rules:**
  - Terms version per address (`packages/config/src/legal.ts:8`, `M/features/legal/acknowledged.ts:18-24`); a new version asks again.
  - Region version + list (`M/features/legal/eligibility.ts:11,14-24,38-47`). The server's `/v1/geo` stays the primary block; Practice is never gated (`eligibility.ts:1-6`).
  - Geo unknown does not block in the app (`blockers.ts:60` checks `=== false`).
- **States:** unchecked → Continue quiet · confirming → short spinner (`M/app/(sheets)/eligibility.tsx:20-21,96-101`) · blocked → blocker + "Use Practice".
- **After:** terms and region versions stored for the address on this phone.
- **Today → gap:**
  - `hasAcknowledgedTerms` has no caller (`acknowledged.ts:18`) and the blocker chain has no terms code (`blockers.ts:15-27`): terms are never enforced (defect 6). Signed-in accounts never see them (`progress.ts:3-4`).
  - The region row is one long sentence (`eligibility.tsx:78-81`) → ⓘ.
  - Contradiction: the inbox watch route geo-gates Mainnet deposits (`API/routes/inbox.ts:5,19`) against "deposits never gated". It is moot once the inbox leaves Receive (§0.7 #2).
- **Acceptance:**
  - [ ] Sign in on a fresh phone → first Long → terms sheet → agree → the ticket opens.
  - [ ] Mainnet first trade → region sheet once; the second trade doesn't ask.
