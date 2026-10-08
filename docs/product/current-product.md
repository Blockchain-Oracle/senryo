# Senryo: current product and evidence

**7 October design continuation:** the user selected the supplied UGLYCASH flows for a complete mobile revamp, including backgrounds and contextual Face ID, and added Tradash as the live-behavior/sound reference. The [approved plan](../plan/uglycash-revamp-2026-10-07.md), [current status snapshot](../design/reference-study-2026-10-07-uglycash/project-status.md) and [flow study](../design/reference-study-2026-10-07-uglycash/README.md) supersede conflicting visual choices below. The user approved the plan with “lgtm”. The first foundation/Home/privacy/contextual-Face-ID slice is being implemented; [validation record](../design/reviews/2026-10-07-uglycash-foundation.md). The rest of the roadmap and physical-device acceptance remain open. Senryo's product/account/security contracts and retained work remain.

This brief incorporates the user's 5 October correction. It is the starting point for design and public copy. The detailed flow book remains the intended journey contract; its “today” descriptions were written against older revisions. Use the current [work register](../plan/reference-followthrough-2026-10-04.md) and validation records to assess implementation, not an old checklist or recording.

**Senryo is a mobile app for accessible pair trading on Monad, predictions, money flows and Kinpaku.** One passkey account connects its wallet and trading experience. Social discovery lets people find traders and follow public activity. Practice is the entry point. The website introduces the mobile app; the browser implementation is a companion. Meme-coin speculation is not the product pitch. Token compatibility and safe handling of existing holdings remain supported without turning them into the core offering.

## User journeys and source owners

| Journey | Native owner | Shared/service/contract owner | Current evidence and next gate |
|---|---|---|---|
| Welcome, guest, create/sign-in, restore, session, mode | `features/auth`, `features/setup`, `lib/account`, `account/*`, shell/deep links | `packages/account`, API auth/storage, config/legal | Actual passkey timing repair accepted on simulator. Fresh install, restored device, physical authentication and accessibility remain open |
| Home and balance breakdown | `features/home`, `features/portfolio` | query/chain portfolio and account/risk snapshots, holdings API/indexer | Slush hierarchy with actual balances; money capacities must not be double-counted. Own-account and stale/partial snapshot acceptance remain distinct |
| Pair discovery and trading | `features/markets`, `features/ticket`, `features/trading`, positions/orders/activity | config markets, chain operations, query, core risk, keeper, `SenryoCore` and periphery | Engine pairs: XAU, XAG and EUR/GBP/JPY/CHF/CAD against USD. Practice exists; live API advertises only Practice money capability. Perpl crypto discovery is distinct from verified execution |
| Predictions | `features/predictions`, Markets/Predict, Watchlist/Search | query/API-client predictions; API Polymarket and Castora adapters | Binary public discovery/history on Polygon; numerical contests on Monad. Both currently view-only. Orders/positions/sell/entry/claims/settlement remain retained integration work |
| Receive, send, swap, add money, bridge, cash-out | `features/money`, fund/withdraw routes, action fan | chain exact-approval builders and journal; API anyasset/topup; provider adapters | Monad wallet receive and transaction details exist. Practice swaps support AUSD/USDC. Native Ramp buying SDK exists; actual funding and swap execution checks remain open at the existing agreement gate |
| Activity, details and receipts | activity/withdraw, `components/sheet/TransactionSheet`, receipts | durable operations and indexer history | Drawer separates details, receipt and explorer. Branded withdrawal/card PDFs were rendered in prior simulator acceptance. Physical save/share acceptance remains open |
| Kinpaku card | `features/card`, Card tab and sheets | `services/card`, Lithic sandbox, shared notification ledger, core/card module | Sandbox issuance, bounded allowance, freeze/unfreeze, reveal/Hide accepted on simulator. Production card approval, spending and Wallet provisioning remain unavailable |
| Pool | `features/lp`, Home Investments | chain pool/query, LP vault, indexer/keeper | Actual Practice pool reads accepted; full deposit/redeem/request/claim/interruption and Mainnet gates remain |
| Social, friends, profiles, moderation | `features/social`, `features/profile`, watch routes | API social/services and private owner routes, query/indexer | Both networks' public/private read states accepted in prior simulator pass. Visibility, moderation, relationship changes and cross-device acceptance stay explicit |
| Notifications and alerts | notifications/inbox/preferences, market alerts | keeper jobs, API/outbox, shared notifications, push registration | Inbox and saved Practice alert accepted; physical APNs/FCM delivery, trigger/tap and momentum notifications remain |
| Settings, privacy, security, recovery, help, status | account routes, shell/kit/theme | account policy, encrypted storage, API data lifecycle, config/legal | Source exists; deletion/recovery, accessibility and physical-device checks remain separate |
| Browser, stats, judge guide, distribution | `apps/web`, docs/release records | same shared packages; deployment/config and stores | Browser remains a companion. TestFlight runtime 0.3.0 build 7 is the recorded beta. No verified public TestFlight join link; no App Store production claim |

The [source census](../design/reviews/2026-10-05-product-coverage/README.md) maps all 114 owned mobile/web entries and 1,317 source files across 80 families, including backend/shared/contracts/indexer. An inventory entry is not a manual line-by-line review or runtime acceptance. All retained roadmap items in the work register remain in scope, including Mainnet, provider execution, notifications, rewards/clans, content, platform accessibility and distribution.

## Design authority and Refero use

Native: **Slush Home/Card + Fomo Trading/Social + Phantom action fan**, using the supplied original reference study. Preserve Senryo's seal, approved art, authored avatars/marks, Living Lacquer tokens and native gesture/money safety contracts. The latest user instruction removes unnecessary duplication of fan actions. Home uses Activity/Orders/Withdraw; Card uses Freeze/Limit/Details. Add money remains accessible through the fan and contextual empty states.

Refero supplements specific native contracts, not generic inspiration:

- [Phantom selector](https://refero.design/screens/1088fef2-8852-4852-91ac-5bf20af52786): secondary market filters on demand; [Predict repair](../design/reviews/2026-10-04-predict-revamp.md).
- [UGLYCASH discovery](https://refero.design/screens/ed101814-46f4-4a36-8327-9487e097aa6b) and [detail](https://refero.design/screens/494ee0f2-6ac3-4fa8-ae78-47cfa9958e1f): readable question/identity/outcomes; no politics, sports or unsupported purchase controls imported.
- [Revolut card limit](https://refero.design/screens/961c6b8b-e85e-4092-8eb0-d9a870bae481): a named limit and consumption context; its monthly limit and banking terms do not replace Senryo's daily, expiring signed allowance.
- [Family transaction drawer](https://refero.design/screens/91536a9c-827b-4b01-b363-02d263b275cf): contextual transaction facts before secondary destinations. Keep Senryo's journal and branded receipt semantics.
- Refero Fuse flow 8732: balance → existing fan → receive method → QR/copy → return and updated balance. Preserve Senryo's correct network/address and only acknowledge actual arrival; no imported bank account or yield promise.
- Refero Cashcaded flow 14135: receipt → preview → native share → completion. Senryo receipt export is distinct from sending it to a recipient; no automatic external share or unrelated marketing tag.
- [Linear Mobile](https://refero.design/pages/131bf85a-a8d3-4bc3-a7ee-093bae1f0a2a) and [Family marketing](https://refero.design/pages/3f73dccf-1aca-4dd5-9221-d4b274028687): actual mobile media and installation/access hierarchy; [website amendment](../plan/refero-mobile-first-2026-10-05.md).

Exact Slush/Fomo searches did not return those apps in Refero. The user's supplied recordings are therefore still their authority. Refero reference metadata is sometimes interpretive; screenshots and actual product source take precedence.

## Claim boundary

“Built”, “passes source checks”, “accepted on simulator”, “installed on a phone”, “deployed”, and “verified with Mainnet funds” are separate facts. Never turn discovery prices into executable quotes, sandbox cards into spending availability, a started funding purchase into delivered money, or historical README plans into current service readiness. No fabricated prices, balances, positions, activity, testimonials, user counts or store links belong in the app or website.
