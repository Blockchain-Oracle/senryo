# F — Social (people, profiles, feed)

Capability cards F1–F7 from the plan (§0.4 "Person"/"Post", §0.5 rules, §0.6 F, §0.7 #11 and #14, §0.9 "Feed / People / Own profile / Other trader", Part 1 defects 7, 10, 11 and 12). Paths are relative to the repo root; line numbers are at `96411ec` on `claude/premium-takeover`. `UNDEFINED` = not settled by code or docs; each one is a research task, not a question for the user.

**Not verified, stated first.**
- Nothing here has been walked on a device in this pass.
- The Fomo study cited (`docs/design/reference-study-2026-09-30/03-fomo.md`) exists only in the main checkout, not in this worktree.
- Fomo shows like, reply, share and follow as affordances, but **their opened results are not captured** (`03-fomo.md:105`). The behaviour below is Senryo's own decision, not a copy.

## Visibility per mode (applies to every card)

**One address, two networks.** The account has the same address on Practice (10143) and Mainnet (143). Each network has its own two switches (`apps/mobile/src/features/profile/VisibilitySettings.tsx:1-7,28-40`; `services/api/src/social/profiles.ts:114-136`):
- **Listed:** the profile can be found, followed and ranked there.
- **Share trades:** fills appear in the feed, on the profile and in market Holders. They require Listed (`profiles.ts:126-136`).

**Defaults on first save:**
- Practice listed + sharing; Mainnet off (`packages/api-client/src/social.ts:27-36`).
- The setup must show this choice explicitly (decision 11). Today it doesn't: setup saves `{ handle }` only, so the defaults apply silently (`apps/mobile/src/app/setup/handle.tsx:77-78`, **defect 7**).

**Read-time visibility.**
- Switching off hides the account's rows at once (`services/api/src/social/feed.ts:7-14`, `services/api/src/social/holders.ts:11-17`).
- Turning sharing on restarts its clock: fills from before are never published (`profiles.ts:140-155`, `feed.ts:91`).

**Unlisted reads as unknown.**
- Both answer 404, so `@handle` resolves only where listed (`profiles.ts:190-193`).
- The page says "This profile isn't public on this network" and offers that network's explorer (`apps/mobile/src/features/social/TraderProfile.tsx:219-235`).

**Stated plainly, once.** Wherever visibility is set (the setup handle step, Edit profile, the "Make public" chip), an ⓘ says: **"Same address on Practice and Mainnet. Onchain activity is public."**
- Watch mode can read any address (`apps/web/src/components/screens/watch-screen.tsx:4-5`).
- "Delete my data" keeps onchain history, which is public and permanent (`services/api/src/social/delete-data.ts:6-13`).

**Setup step 1 (A2), after the handle field.** A **"Show my trades"** row with **Practice** (on) and **Mainnet** (off) chips + that ⓘ. Saving sends all four flags.

## Decisions (settled here; numbered into D-237… at execution)

- **F-D1. Every post instance gets every post verb.** Trade events get like · reply · share · report, the same as theses (symmetry, §0.4 "Post").
  - Today likes and replies attach only to `posts` (`apps/mobile/src/features/social/Engagement.tsx:4`; `services/api/src/social/posts.ts:106-115,223-241`).
  - Anchor them on `feed_events.id`. **UNDEFINED:** the schema change (a likes/replies FK to the feed event, or a lazily created anchor post).
- **F-D2. Taps on a trade row.** The row body opens **the market**; the avatar and name open the trader; **Trade this** sits on open/increase rows whose position is still open. Theses open their thread.
- **F-D3. What "Trade this" prefills.**
  - It prefills market + side, plus leverage when the payload carries it. It never prefills the amount and never trades automatically (C11).
  - `FeedTrade` has no leverage field (`feed.ts:31-50`), so the ticket uses the market's default until the payload adds it (**UNDEFINED**: the source of leverage — margin isn't indexed in the payload).
- **F-D4. One period model.** 24h / 7d / 30d / All, default **7d** (the API default, `apps/mobile/src/features/social/leaderboard-copy.ts:10-18`). It applies to the leaderboard, the own profile and others' profiles alike.
  - The hero is realized PnL after fees, funding and borrow (`social.ts:51-55`). It shows even below the floor; the floor only gates the rank.
  - The own profile adds the account-value chart on the same chips.
- **F-D5. When Send appears on a profile.** Only when the profile is public on this network and there is no block either way (`services/api/src/social/follows.ts:14-27` gives `blocked`). Never on your own profile (that is Receive).
- **F-D6. Canonical links.**
  - Profile: `${WEB_ORIGIN}/watch?address=<0x…>&chainId=<id>`.
  - Post: `…&post=<id>`.
  - The web keeps its query form (static export, `apps/web/src/app/(desk)/watch/page.tsx:8`). The app remaps it to `/watch/<0x…>[/post/<id>]`.
- **F-D7. Blocked & muted list.** Settings → **Blocked & muted**, with two underline tabs, Muted · Blocked.
- **F-D8. Follow is shown only where the target is listed.** The API accepts a target listed on *either* network (`follows.ts:39,44`). The UI never offers Follow on a 404 profile, so the behaviour stays per network.
- **F-D9. Social pushes (G1).** New follower (on), replies and likes (on), followed trader opened (off). Today's channels are fills, liquidation, deposits, card and price alerts only (`packages/api-client/src/routes/engagement.ts:49`).

---

### F1 Find people
- **Promise:** find a trader by name, by result, or from what you're already looking at.
- **Entry points:**
  - Social → **People** (Leaderboard, Recommended, Following/Followers);
  - Search (Traders tab);
  - Market → **Holders** ("Following" chip, `apps/mobile/src/features/markets/MarketHolders.tsx:52`);
  - feed avatar/name (`apps/mobile/src/features/social/FeedRow.tsx:43-46`);
  - Home **Weekly Top Trades** (`apps/mobile/src/features/home/TopTrades.tsx:69`);
  - setup step 2 "Follow top traders";
  - any profile's follower counts.
- **Steps:**
  1. **People:**
     - **Leaderboard** first: period chips 24h · **7d** · 30d · All, scope All · Following. Rows show rank/medal, avatar, name, coloured PnL and an asset cluster (≤3), Fomo F29 (`03-fomo.md:32,101`).
     - "Your rank" plate pinned.
     - ⓘ metric sheet.
  2. **Recommended:** ≤10 traders with a blue **Follow** and a reason line "+$1,240 · 30d" (`social.ts:58-59`; `apps/mobile/src/features/social/Friends.tsx:155-171`).
  3. **Following · Followers:** a row each, opening the lists (`apps/mobile/src/app/watch/[address]/[list].tsx`).
  4. **Search** (Fomo F31, `03-fomo.md:33`):
     - tabs All · Tokens · Perps · Traders; recents;
     - a bottom field "Name, @handle or address" with Paste;
     - trader rows: avatar, name, @handle, 7d PnL → profile.
- **Rules:**
  - Search: handle prefix or exact address, only profiles visible on this network. Blocked accounts (either way) are left out; muted ones still show, since search is a lookup (`services/api/src/social/search.ts:15-17,69`; `posts.ts:44-46`). Max 64 characters, 20 results (`social.ts:81-83`), 60/min (`services/api/src/social/constants.ts:262`).
  - Leaderboard math:
    - 24h rolling; 7d/30d are UTC days including today (`constants.ts:199-202`);
    - rebuilt every 60 s; top 50 by default (`constants.ts:197-198`).
  - Floor (`constants.ts:207-212`): 24h 3 trades / $100; 7d 5 / $500; 30d and All 10 / $1,000. Below it: "Not ranked", never 0 (`apps/mobile/src/features/social/YourRank.tsx:57-66`).
  - Holders: engine markets only; accounts that share trades on this network; cached 5 s (`holders.ts:11-17`, `constants.ts:234`).
  - Top Trades: opened notional ≥ $100 and a positive result (`constants.ts:227`).
- **States:**

| Where | Shows |
|---|---|
| Board loading | row skeletons |
| Board not computed | "Board updating" · Retry |
| Nobody ranked | "No ranked traders yet" |
| You below floor | "Not ranked · 5 trades to rank" |
| You unlisted | "Not ranked · Make public" |
| Recommended empty | "Suggestions appear as people trade" |
| Search empty | "No traders found" |
| Offline | stale stamp |

- **After:** tapping a person opens F2; Follow from any row (F3).
- **Today → gap:**
  - People defaults to "Following" with the Leaderboard behind a chip (`apps/mobile/src/app/(tabs)/social/index.tsx:29-32,49`); §0.9 puts the Leaderboard first.
  - The Following scope of the leaderboard is unused (`apps/mobile/src/features/social/Leaderboard.tsx:40`).
  - Search lives only at `/markets/search` (`apps/mobile/src/app/(tabs)/markets/search.tsx:1-5`) and has no Tokens tab: its kinds are All, Markets and Traders (`apps/mobile/src/features/search/SearchScreen.tsx:26-30,56-58`).
  - Several empty states are sentences (`Leaderboard.tsx:73`, `Friends.tsx:171`).
- **Acceptance:**
  - [ ] Social → People opens on the Leaderboard at 7d; switching periods changes the rows and "Your rank".
  - [ ] Following scope ranks only you + the people you follow.
  - [ ] Search "@ka" lists listed traders on this network only; a Mainnet-unlisted trader is absent on Mainnet and present on Practice.
  - [ ] Market Holders → Following chip shows only followed holders who share trades.

### F2 Profile (own and others)
- **Promise:** one person page shows who they are, how they've done over a period, and what they hold. The same numbers appear everywhere.
- **Entry points:**
  - **Own:** the You tab.
  - **Others:** `/watch/<address|handle>` (`apps/mobile/src/app/watch/[address]/index.tsx:10-15`), opened from any person row, the feed, Holders, search, Top Trades or a shared link (F7).
- **Steps — layout, top to bottom (Fomo F16, `03-fomo.md:23`):**
  1. **Header circles:**
     - own: Share · History · Settings (`apps/mobile/src/app/(tabs)/you/index.tsx:44-63`);
     - others: Share · ⋯ (report / mute / block).
  2. **Identity:** avatar 64 (own: tap to edit), name, @handle, "Follows you" tag (others), bio (≤160), "**3** Following · **12** Followers" (each opens its list), meta line: mode badge · "Joined Sep 2026".
  3. **Actions:**
     - own: **Edit profile**; if unlisted here, a chip **Make public on Mainnet** (opens Visibility with the ⓘ);
     - others: **Follow** (F3) · **Send** (F6).
  4. **Period PnL hero:** chips 24h · **7d** · 30d · All, then a big coloured signed amount, then one line "Rank 12 · 34 trades" or "Not ranked · 34 trades". Own: the account-value chart under it, on the same chips.
  5. **Underline tabs Positions · Trades:**
     - **Positions** (others: only when sharing): mark, ticker + side + leverage, size · entry, PnL; each row opens the market and shows **Trade this** (C11).
     - **Trades:** this person's trade events and theses, as feed rows (F4).
- **Rules:**
  - Profiles are served per network; unlisted and unknown are indistinguishable (`profiles.ts:190-220`).
  - Field limits:
    - handle `[a-z0-9_]{4,20}`, held 30 days after release, 5 changes per window (`social.ts:6-14`, `constants.ts:151-152`);
    - name ≤32 and bio ≤160 (`social.ts:16-17`);
    - content filter and reserved names (`profiles.ts:45-63`).
  - Period hero source:
    - own: the leaderboard's `you` standing, which has a value even below the floor (`packages/api-client/src/routes/leaderboard.ts:41-49,66`);
    - others: the same standing **per address** (new route, F-D4).
    - No trades in the period → "No trades · 7d" (never $0).
  - Own Trades read the account's own indexed fills, private ones included, marked "Private" when sharing is off. Others' Trades read the public feed by actor (`TraderProfile.tsx:197-217`).
  - Positions of others: hidden when they don't share ("Trades private on Mainnet", `apps/mobile/src/features/social/TraderPositions.tsx:34`).
- **States:**

| State | Shows |
|---|---|
| Loading | avatar disc + 3 skeleton lines (`TraderProfile.tsx:242-257`) |
| Not public here | "Not public on Mainnet" · Explorer |
| Error | reason + Retry |
| No trades | "No trades · 7d" |
| Private trades | "Trades private on Mainnet" |
| No positions | "No open positions" |
| Own unlisted | chip "Make public on Mainnet" |
| Mainnet before deploy | "Trading opens soon" (`TraderPositions.tsx:42`) |

- **After:** Share (F7); Follow (F3); Send (F6); the ⋯ actions (F5); Trade this → ticket (C11).
- **Today → gap:**
  - **Defect 12:** the own profile shows an equity chart titled "Trading performance" with 1H / 24H / 1W / 1M / All (`apps/mobile/src/features/portfolio/TradingPerformance.tsx:13-19,36`), while others show realized PnL 24h / 7d / 30d / All (`apps/mobile/src/features/social/TraderStanding.tsx:23-28`).
  - Others' PnL is found only inside the top-50 board, so anyone else reads "Not on the board" (`TraderStanding.tsx:26-28,56-62`).
  - No **Send** on others: the header has Share + ⋯, and the identity has Follow only (`TraderProfile.tsx:73-101,129-131`).
  - Positions explicitly never open a ticket (`TraderPositions.tsx:4`), so there is no Trade this.
  - The own profile still carries `StarterCard` and `RecentActivity` (`you/index.tsx:78-84`).
  - The unlisted state is a sentence (`apps/mobile/src/features/profile/ProfileHeader.tsx:178`).
- **Acceptance:**
  - [ ] Own and another trader at 7d show the same PnL as their leaderboard row; switching to 30d changes all three together.
  - [ ] A trader below the floor shows their PnL with "Not ranked".
  - [ ] An own Mainnet-unlisted profile shows "Make public on Mainnet"; tapping it opens Visibility with the shared-address ⓘ.
  - [ ] Another trader who doesn't share: no positions, "Trades private on Mainnet".
  - [ ] A position row → market; Trade this → ticket on that side.

### F3 Follow
- **Promise:** one tap to follow or unfollow; your feed and board follow along.
- **Entry points:**
  - profile **Follow**;
  - Recommended rows;
  - setup step 2 (checked list + Continue);
  - follower/following lists;
  - Holders rows.
- **Steps:**
  1. Tap **Follow** (blue): it becomes "Following" (quiet plate, width held while the write is in flight; `apps/mobile/src/features/social/FollowButton.tsx:1-8,21-22`) + haptic.
  2. Tap **Following** → unfollow at once (reversible; no confirm).
  3. **Lists:**
     - own: You → counts → Following / Followers (`apps/mobile/src/app/account/follows.tsx`);
     - others: `/watch/<addr>/followers|following` (`[list].tsx:10-22`).
- **Rules:**
  - Account-level rows, shown per network only for listed accounts; this covers counts and "Follows you" (`follows.ts:8-27,74-111`).
  - The API refuses:
    - following yourself (`follows.ts:34`);
    - a target with no public profile (`follows.ts:39,44`; see F-D8);
    - a block either way (403 `BLOCKED`, `follows.ts:45-46`);
    - more than 1,000 follows (`social.ts:23`, `follows.ts:48-49`).
  - Follows are idempotent, 60 writes/min (`constants.ts:159`). Lists page 30, max 100 (`social.ts:24-25`).
  - A guest's tap → account sheet, resuming the follow (A1). A locked user → Face ID for a session (`apps/mobile/src/features/social/useSocialAccount.ts`).
  - A block is shown on the button ("Blocked"), not discovered on tap (`FollowButton.tsx:4`).
  - Following never copies trades (`Friends.tsx:4`).
- **States:** "Follow" · "Following" · busy (spinner, same width) · "Blocked" · "Limit reached" (1,000) · failure toast "Couldn't follow · Retry".
- **After:**
  - Following feed and board scope include them.
  - Their counts update.
  - A new-follower push and inbox entry for them (**new**, F-D9; no channel today).
- **Today → gap:** no new-follower push (`engagement.ts:49`). Otherwise built.
- **Acceptance:**
  - [ ] Follow from Recommended → the Following feed shows their next trade.
  - [ ] Unfollow → gone from the Following feed and the Following board.
  - [ ] Block them, then open their profile: "Blocked", and Follow is refused.
  - [ ] As a guest, Follow → account sheet → after create, the follow is done.

### F4 Feed
- **Promise:** see what traders do and think, and act on it in one tap.
- **Entry points:**
  - Social tab → **Feed** (default);
  - market detail → Feed tab (`apps/mobile/src/features/markets/MarketFeed.tsx`);
  - profile → Trades;
  - "New activity" pill;
  - push (reply, like).
- **Steps:**
  1. **Global · Following** underline tabs (Fomo F15, `03-fomo.md:22`). Global leads with the Weekly Top Trades strip.
  2. **Row:**
     - avatar 40;
     - name + verb tag (Opened / Increased / Closed / Liquidated / Thesis) + age;
     - a position chip: market mark, side, size, coloured PnL on closes;
     - text (theses);
     - like · reply · share; ⋯;
     - trade rows add **Trade this**.
  3. **Taps (F-D2):**
     - row → market (trades) or thread (theses);
     - avatar or name → profile;
     - **Trade this** → ticket prefilled (F-D3).
  4. **Thread** (`/social/post/[id]`): the thesis, then replies oldest first, with the reply composer pinned at the bottom.
  5. **Compose** (round utility):
     - text ≤280 with a counter;
     - "About a market" chips over **all** markets (engine + Perpl);
     - attach my position (optional);
     - **Post** → the row appears at the top.
  6. **⋯** → Report / Mute / Block (others) or Delete (own post), via the F5 sheet.
- **Rules:**
  - Following needs a session (401 otherwise, `feed.ts:85-89`) and shows only followed actors (`feed.ts:93-94`).
  - Global = every visible actor on this network. Fills appear only while sharing, and only after sharing began (`feed.ts:91,103-104`).
  - With a session: blocked either way, muted actors and posts you reported are filtered out (`feed.ts:14,106`; `posts.ts:46-63`).
  - Kinds are `fill | position | thesis`. Open, close, liquidate and invert are `position` (`constants.ts:190-191`).
  - The poller runs every 3 s, and "New activity" fires at most once per 2 s (`constants.ts:180,193`). Pages are 30, max 100 (`social.ts:46-47`).
  - Posting:
    - needs a listed profile on this network (403 `NOT_LISTED`, `posts.ts:157-159`);
    - text passes the filter (`posts.ts:139-141`);
    - an attached position must be your own on this network (`posts.ts:143-154`);
    - 30 posts/hour (`constants.ts:239-240`).
  - Replies are one level, the parent is a visible thesis, and no block may be in place (`posts.ts:106-115`; `social.ts:64`).
  - Like/unlike is idempotent; a block either way → 403 (`posts.ts:223-241`).
  - Deleting a thesis takes its replies, likes and feed row with it (`posts.ts:216-220`). Your own trade events can't be deleted (they are onchain); turning sharing off hides them (`feed.ts:9-10`).
  - Report reasons: spam, scam, harassment, hate, sexual, violence, impersonation, other (+ note ≤280) (`social.ts:67-77`). A reported post is hidden for the reporter. Weighted ≥3 trusted reports enter review (`constants.ts:241-245`).
  - Trade this blockers come from C3: a closed market shows the reopen time; a read-only market is locked; a Perpl market is "Mainnet only" in Practice; an opposite side open → "You're long P$300 · Close it first ›".
- **States:**

| State | Shows |
|---|---|
| Loading | 4 row skeletons (`apps/mobile/src/features/social/Feed.tsx:126-148`) |
| Global empty | "No public trades yet" |
| Following, guest | "Follow traders" · Create account |
| Following, locked | "Unlock to see Following" · Unlock |
| Following empty | "Follow traders" · Find people |
| Error | reason + Retry |
| Stale | stamp |
| New rows | pill "New activity" |
| Post refused | "Make your profile public to post" · Settings |
| Rate limit | "Posting limit · try in 12 min" |

- **After:**
  - like → count moves at once, rolled back on failure (`Engagement.tsx:36-69`);
  - reply → thread + a push to the author (F-D9);
  - share → F7;
  - Trade this → ticket → normal trade flow (C3).
- **Today → gap:**
  - Feed/People is a segmented control with Global/Following chips (`apps/mobile/src/app/(tabs)/social/index.tsx:21-28,66-77`), not underline tabs.
  - A trade row opens the trader, not the market (`FeedRow.tsx:3-5,47-51`).
  - Like and reply exist only on theses (`FeedRow.tsx:106-110`, `Engagement.tsx:4`).
  - There is **no share** anywhere in the feed or threads, and **no Trade this**.
  - Compose offers engine markets only (`apps/mobile/src/features/social/ComposeThesis.tsx:43`).
- **Acceptance:**
  - [ ] Practice, two accounts: A opens XAU long → B's Global shows "Opened" within ~5 s with the "New activity" pill.
  - [ ] B taps Trade this → the ticket is on XAU Long with the amount empty.
  - [ ] B likes and replies to A's trade row and to a thesis; A gets both pushes.
  - [ ] B mutes A → A's rows leave B's feed; A is unaware.
  - [ ] A deletes a thesis → its replies disappear for B.
  - [ ] An unlisted account tries to post → "Make your profile public to post".

### F5 Mute and block management
- **Promise:** silence or cut off anyone, and undo it from one list.
- **Entry points:** ⋯ on a profile or post (`apps/mobile/src/features/social/SocialActions.tsx:227-268`); Settings → **Blocked & muted** (new, A10).
- **Steps:**
  1. **⋯ → Mute / Block** → confirm (title + one line + button) → done ("@kai muted").
  2. **Settings → Blocked & muted:** underline tabs Muted · Blocked. Rows show avatar, name, @handle and **Unmute** / **Unblock** → confirm → the row leaves.
- **Rules:**
  - Mute hides their posts and trades from your feed and Holders; it is private, they aren't told, and their profile stays open (`posts.ts:46-63`, `holders.ts:15-16`).
  - Block:
    - removes follows both ways in the same transaction (`services/api/src/social/relations.ts:8-13,31-32`);
    - refuses follow, like and reply both ways (`follows.ts:45-46`; `posts.ts:106-115,230-233`);
    - drops each from the other's feed (`feed.ts:14`);
    - hides Send (F-D5).
  - Unblocking doesn't restore follows (`SocialActions.tsx:131-137`).
  - Caps: 5,000 each; lists page 100 (`constants.ts:250-252`). Routes: `GET /v1/blocks`, `GET /v1/mutes` and their toggles (`packages/api-client/src/routes/moderation.ts:30-89`).
  - "Delete my data" removes your own blocks and mutes and keeps other people's blocks of you (`delete-data.ts:6-13,35-36`).
- **States:** list skeleton · "Nobody muted" · "Nobody blocked" · error + Retry · row busy.
- **After:** the feed refetches; unblock → Follow is available again (not automatic).
- **Today → gap:**
  - **Defect 11:** there is no list screen. `app/account/` has no blocked/muted route, so undo is only possible from the person's own profile (`SocialActions.tsx:113,129`).
  - The confirm bodies are full sentences (`SocialActions.tsx:105-148`); trim them to one line.
- **Acceptance:**
  - [ ] Mute A from a post → Settings → Muted lists A → Unmute → A's rows return.
  - [ ] Block B, who followed you → the follow is gone both ways; B appears under Blocked; Unblock → Follow is shown again.

### F6 Send money from a profile
- **Promise:** pay a person you can see, without typing an address.
- **Entry points:** other trader → **Send** circle; Send flow → recipient search → Following avatars (B7).
- **Steps:**
  1. **Send** → B7 opens with the recipient filled in: avatar, @handle and the full address shown.
  2. **Asset** (any holding, marks, balances) + exact amount (units ↔ $, Max net of the fee reserve).
  3. **Review:** avatar, @handle, short address, amount, network fee.
  4. **Slide** + passkey → status → "Sent" sound → receipt.
- **Rules:**
  - A sends to someone else is always a passkey step-up (rule 11).
  - The handle is resolved on this network, which only works for listed profiles (`apps/mobile/src/features/withdraw/useRecipient.ts:1-5`). It is **re-resolved before broadcast** (B7).
  - Shown only per F-D5:
    - public here;
    - no block either way;
    - not yourself (yourself → Withdraw).
  - Practice sends P$; Mainnet sends wallet assets; capability locks follow B7 (`apps/mobile/src/app/withdraw/send.tsx:23-24`).
  - An unknown outcome never resends (rule 5).
- **States:** "Send to @kai" · "@kai isn't public here" (Send hidden) · B7's states.
- **After:**
  - Activity "Sent 20 AUSD to @kai";
  - a push and inbox entry for the recipient (money arrived, G1);
  - @kai joins Recents.
- **Today → gap:**
  - There is no Send on a profile (`TraderProfile.tsx:73-101,129-131`).
  - The send route takes no recipient parameter (`send.tsx:17-26`).
  - Dollars only, no scanner (**defect 5**, B7).
- **Acceptance:**
  - [ ] From @kai's profile → Send → 5 AUSD → passkey → @kai's Activity shows the arrival with a push.
  - [ ] @kai unlists → Send disappears from their profile.
  - [ ] Block @kai → Send is hidden.

### F7 Share
- **Promise:** every person, trade and receipt can be shared as a link or image that opens the right screen in the right mode.
- **Entry points:**
  - profile Share circle (own and others);
  - feed row share;
  - thread share;
  - position / trade outcome Share (`apps/mobile/src/features/trade/TicketReceipt.tsx:210`);
  - receipt sheet Share;
  - Wallet & address → Share.
- **Steps:**
  1. **Share** → the system share sheet with the link (+ a rendered trade-card image for trades and positions).
  2. **Receiver:**
     - with the app: the universal link → `/watch/<addr>` (or `/post/<id>`);
     - if the link's chainId isn't the active network → the mode sheet first, continuing only after a deliberate switch (`apps/mobile/src/lib/deep-link.ts:38-56`);
     - without the app: the web `/watch?address=…`, in the link's network.
- **Rules:**
  - The canonical form is in F-D6. Every share link carries `chainId`.
  - The mobile remap `/watch?address=X[&post=Y]` → `/watch/X[/post/Y]` lives with the others in `LEGACY_PATHS` (`deep-link.ts:19-25`).
  - Links arriving before welcome or setup are held and resumed (`apps/mobile/src/lib/incoming-link.ts:14-19`).
  - The web reads `chainId` and, when it differs from its network, shows the other network's data or a switch. **UNDEFINED:** whether one web build serves both networks.
  - Trade-card image: mark, ticker, side, leverage, PnL %, @handle, mode label (Practice cards say "Practice"). **UNDEFINED:** the snapshot library (runtime 0.2.0 lists "share/snapshot").
  - **UNDEFINED:** whether the AASA / Android intent filters include `/watch`.
- **States:** share sheet; receiver: profile, "Not public on Mainnet" (F2), or mode sheet "This link is for Mainnet".
- **After:** nothing is recorded (no share counts).
- **Today → gap (defect 7, watch link route + chainId):**
  - Shares build `${WEB_ORIGIN}/watch/?address=…&chainId=…` (`you/index.tsx:51`, `TraderProfile.tsx:83`). The app has only `/watch/[address]` (`watch/[address]/index.tsx`), and `deep-link.ts` has no `/watch?address=` remap, so the link lands on Not found in the app.
  - `IdentityPanel` omits `chainId` (`apps/mobile/src/features/auth/IdentityPanel.tsx:29,111`).
  - The web ignores `chainId` and uses `ACTIVE_NETWORK` (`watch-screen.tsx:65,83`).
  - There is no share on feed rows or threads.
- **Acceptance:**
  - [ ] Share own profile on Practice → open the link on a phone with the app on Mainnet → the mode sheet → switch → the profile.
  - [ ] The same link in a desktop browser → the web watch page of that address on Practice.
  - [ ] Share a thesis → the link opens that thread in the app.
  - [ ] Share a closed position → the image shows PnL and "Practice".
