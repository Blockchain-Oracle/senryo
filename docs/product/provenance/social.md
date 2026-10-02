# Provenance — Social (F1–F7)

21st.dev first (brief rule): each new component was searched with `npx -y @21st-dev/cli search "<what>" --type c`,
the best match pulled with `get <id>`, and its behaviour ported to React Native (Reanimated 4). No web library was
added. Searched 2 Oct 2026.

| Component (file) | Search | Source | Ported | Deviations |
|---|---|---|---|---|
| Search field (`features/search/SearchField.tsx`) | "expandable search input" | 7904 Expandable Search Bar (arunachalam) · 10571 Expanding Search Dock (moumensoliman) | The collapsed → expanded width on a spring (stiffness 260, damping 26, from 7904), the leading search glyph, expand on focus and collapse when left empty (10571), the clear control scaling in once there is text. | Fomo F31's bottom pill instead of an icon-only rest state: at rest it is narrower than the dock (F31 measures 44 pt in from each edge), focused it reaches the dock's width. "Paste" sits inside while empty (F31). No blur. Reduced Motion snaps. |
| Like (`features/social/LikeBurst.tsx`) | "like button heart animation" | 23534 Like Burst (ddoemonn) | The outline → filled cross-fade with the filled heart springing from 0.55 (stiffness 520, damping 34, mass 0.45); eight sparks on fixed hashed angles (Knuth multiplier, 13–22 pt), 440 ms on `[0.23, 1, 0.32, 1]`, delays ≤ 50 ms, replayed per new like. | Native SF/Material heart glyph instead of an SVG path; sparks in the link colour; the count and the optimistic write stay in `Engagement` (the like rolls back with `fail` on refusal). Reduced Motion drops the sparks. Also considered 1695 Heart Button, 10627 Heart Favorite. |
| Post verbs (`features/social/Engagement.tsx`) | "social feed post", "tweet card" | 2652 SocialPostCard (ruixen.ui) | The verb row's anatomy: like with count, reply (comment) with count, share. | No card, border, glass or bookmark (rows, not boxes; Fomo F15). Considered 27909 Post Card, 28430/25288 Tweet Card — all boxed. |
| Leaderboard medals (`features/social/Leaderboard.tsx`) | "leaderboard row", "leaderboard", "ranking list medal" | 30672 Leaderboard Table (arihantcodes) | The 24 pt numbered medal disc for the first three, a quiet number from fourth. | Filled gold / silver / raised discs from the palette (no tinted rings); no table chrome, streaks or movement arrows. Considered 6548, 29468, 13057 (podium) — none fit Fomo F29's rows. |
| Underline tabs, period chips | "segmented underline tabs" | 24956 Underline Tabs (cnippet-dev) | — | Not ported: the kit's `UnderlineTabs` and `PeriodChips` already implement F09/F16 and are reused. |
| Profile header (`features/social/TraderIdentity.tsx`) | "profile header", "user profile stats" | 781 Telegram Profile Header, 9890/4314 Profile Card | — | Searched, none fit: they are cards; the header follows Fomo F16 and the own profile's order. |
| Follow / Send buttons | "follow button", "share button" | 26650 Follow Button Group, 10388 Social Share Button | — | Searched, none fit: the kit `Button` (56/12, 44/10) carries Follow, Send and Trade this. |
| Blocked & muted rows (`features/social/BlockedMuted.tsx`) | "blocked users list" | 25159, 28596, 9167, 24862 | — | Searched, none fit (data tables, accordions); rows reuse `PersonRow`. |

No new marks were added: avatars are the authored portrait set (`components/identity/Avatar`), markets use
`EntityMark` with the registry's engine and Perpl market ids.
