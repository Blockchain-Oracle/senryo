# Every route has an owner

Generated from the current checkout with `rg --files` on 5 October. This is an exhaustive route and source-family census, not a claim that each route or line has been manually tested. Source index: [source-index.csv](source-index.csv).

| Native or web entry | Direct feature/service imports |
|---|---|
| `apps/mobile/src/app/(sheets)/account-required.tsx` | `@senryo/identity/native` · `~/features/auth/AuthFlowSheet` · `~/features/auth/useAuthFlow` · `~/features/setup/progress` |
| `apps/mobile/src/app/(sheets)/add-money.tsx` | `@senryo/chain` · `@senryo/config` · `@senryo/identity` · `~/features/fund/CardPanel` · `~/features/fund/ChainPanel` · `~/features/fund/PracticePanel` · `~/features/fund/SheetPanel` · `~/features/markets/LeverageBadge` |
| `apps/mobile/src/app/(sheets)/balance-details.tsx` | `~/features/portfolio/BalanceDetails` |
| `apps/mobile/src/app/(sheets)/card-payment.tsx` | `~/features/card/PaymentDetail` · `~/features/markets/QuietLine` |
| `apps/mobile/src/app/(sheets)/card-reveal.tsx` | `~/features/card/CardFace` · `~/features/card/useCardService` · `~/features/card/useCardSummary` |
| `apps/mobile/src/app/(sheets)/compose-thesis.tsx` | `@senryo/query` · `~/features/social/ComposeThesis` · `~/features/social/useSocialAccount` |
| `apps/mobile/src/app/(sheets)/eligibility.tsx` | `~/features/legal/eligibility` · `~/features/setup/InfoTip` |
| `apps/mobile/src/app/(sheets)/leaderboard-info.tsx` | `~/features/social/LeaderboardInfo` · `~/features/social/leaderboard-copy` |
| `apps/mobile/src/app/(sheets)/network.tsx` | `@senryo/config` · `~/features/network/NetworkPicker` |
| `apps/mobile/src/app/(sheets)/receipt.tsx` | `@senryo/query` · `~/features/activity/useIndexedReceipt` · `~/features/activity/feed-format` · `~/features/activity/Receipt` · `~/features/portfolio/QuietLine` |
| `apps/mobile/src/app/(sheets)/receive.tsx` | `~/features/fund/ReceiveCard` |
| `apps/mobile/src/app/(sheets)/risk-explainer.tsx` | Entry/redirect/shared controls; owning route source |
| `apps/mobile/src/app/(sheets)/session.tsx` | `~/features/auth/AuthFlowSheet` · `~/features/auth/SessionPanel` · `~/features/auth/SwitchConfirm` · `~/features/auth/useAuthFlow` · `~/features/profile/SignOutConfirm` |
| `apps/mobile/src/app/(sheets)/social-actions.tsx` | `@senryo/account` · `~/features/social/SocialActions` |
| `apps/mobile/src/app/(sheets)/step-up.tsx` | `@senryo/account` · `~/features/auth/AuthCard` |
| `apps/mobile/src/app/(sheets)/terms.tsx` | `~/features/legal/AgreeRow` · `~/features/legal/acknowledged` · `~/features/setup/InfoTip` · `~/features/setup/progress` |
| `apps/mobile/src/app/(sheets)/voucher.tsx` | `@senryo/account` · `~/features/setup/SetupField` · `~/features/setup/useVoucher` |
| `apps/mobile/src/app/(tabs)/card/allowance.tsx` | `~/features/card/CardLimit` |
| `apps/mobile/src/app/(tabs)/card/auth/[id].tsx` | `~/features/card/PaymentDetail` |
| `apps/mobile/src/app/(tabs)/card/get.tsx` | `~/features/card/GetCard` |
| `apps/mobile/src/app/(tabs)/card/index.tsx` | `~/features/card/CardTab` |
| `apps/mobile/src/app/(tabs)/card/intro.tsx` | `~/features/card/CardFace` · `~/features/card/CardHero` · `~/features/card/constants` |
| `apps/mobile/src/app/(tabs)/card/repay.tsx` | `~/features/card/RepayCard` |
| `apps/mobile/src/app/(tabs)/card/wallet.tsx` | `~/features/card/WalletRow` |
| `apps/mobile/src/app/(tabs)/home/index.tsx` | `~/features/auth/AccountStrip` · `~/features/home/GuestHome` · `~/features/home/HomeGroups` · `~/features/home/HomeHeader` · `~/features/home/TopTrades` · `~/features/notifications/NotificationsBell` · `~/features/portfolio/RiskBanner` |
| `apps/mobile/src/app/(tabs)/markets/[market]/alert.tsx` | `@senryo/config` · `~/features/markets/AlertEditor` · `~/features/markets/constants` |
| `apps/mobile/src/app/(tabs)/markets/[market]/index.tsx` | `~/features/trade/TradeScreen` |
| `apps/mobile/src/app/(tabs)/markets/[market]/ticket.tsx` | `~/features/trade/TicketScreen` |
| `apps/mobile/src/app/(tabs)/markets/discover/[id].tsx` | `~/features/markets/DiscoveryDetail` |
| `apps/mobile/src/app/(tabs)/markets/index.tsx` | `~/features/markets/MarketsScreen` |
| `apps/mobile/src/app/(tabs)/markets/predict/[provider]/[id].tsx` | `@senryo/api-client` · `~/features/predictions/PredictionDetail` |
| `apps/mobile/src/app/(tabs)/markets/search.tsx` | `~/features/search/SearchScreen` |
| `apps/mobile/src/app/(tabs)/markets/tokens/[token]/index.tsx` | `@senryo/config` · `@senryo/query` |
| `apps/mobile/src/app/(tabs)/markets/tokens/[token]/trade.tsx` | `~/features/tokens/TokenTicket` |
| `apps/mobile/src/app/(tabs)/social/index.tsx` | `@senryo/api-client` · `@senryo/query` · `~/features/social/Feed` · `~/features/social/NewActivity` · `~/features/social/useSocialAccount` |
| `apps/mobile/src/app/(tabs)/social/people.tsx` | `~/features/social/People` |
| `apps/mobile/src/app/(tabs)/social/post/[id].tsx` | `~/features/social/Thread` |
| `apps/mobile/src/app/(tabs)/social/search.tsx` | `~/features/search/SearchScreen` |
| `apps/mobile/src/app/(tabs)/you/index.tsx` | `~/features/profile/ProfileHeader` · `~/features/profile/ProfileResult` · `~/features/profile/ProfileTabs` · `~/features/profile/QuietState` |
| `apps/mobile/src/app/+native-intent.tsx` | Entry/redirect/shared controls; owning route source |
| `apps/mobile/src/app/+not-found.tsx` | Entry/redirect/shared controls; owning route source |
| `apps/mobile/src/app/account/blocked.tsx` | `~/features/social/BlockedMuted` |
| `apps/mobile/src/app/account/delete-data.tsx` | `@senryo/account` · `@senryo/api-client` · `@senryo/query` · `~/features/profile/DeleteScope` · `~/features/profile/QuietState` |
| `apps/mobile/src/app/account/diagnostics.tsx` | `~/features/auth/DiagnosticsPanel` |
| `apps/mobile/src/app/account/follows.tsx` | `@senryo/account` · `@senryo/query` · `~/features/profile/PersonRow` · `~/features/profile/QuietState` · `~/features/social/useSocialAccount` |
| `apps/mobile/src/app/account/help.tsx` | `@senryo/api-client` · `@senryo/identity` · `~/features/profile/SectionHeading` · `~/features/setup/InfoTip` |
| `apps/mobile/src/app/account/identity.tsx` | `~/features/auth/IdentityPanel` |
| `apps/mobile/src/app/account/index.tsx` | Entry/redirect/shared controls; owning route source |
| `apps/mobile/src/app/account/mode.tsx` | `~/features/network/NetworkPicker` |
| `apps/mobile/src/app/account/notifications.tsx` | `@senryo/account` · `~/features/profile/QuietState` · `~/features/profile/SectionHeading` |
| `apps/mobile/src/app/account/preferences.tsx` | `~/features/profile/SectionHeading` |
| `apps/mobile/src/app/account/privacy.tsx` | `@senryo/config` · `~/features/legal/LegalPage` |
| `apps/mobile/src/app/account/profile.tsx` | `~/features/profile/ProfileEditor` · `~/features/profile/QuietState` · `~/features/profile/useOwnProfile` |
| `apps/mobile/src/app/account/recovery.tsx` | `@senryo/api-client` · `@senryo/config` · `~/features/auth/PhraseGrid` · `~/features/profile/format` · `~/features/profile/QuietState` · `~/features/profile/SectionHeading` · `~/features/profile/SettingsRow` · `~/features/setup/InfoTip` · `~/features/social/useSocialAccount` |
| `apps/mobile/src/app/account/security.tsx` | `@senryo/account` · `@senryo/core` · `~/features/auth/AuthFlowSheet` · `~/features/auth/SessionPanel` · `~/features/auth/SwitchConfirm` · `~/features/auth/useAuthFlow` · `~/features/profile/QuietState` · `~/features/profile/SectionHeading` · `~/features/setup/InfoTip` |
| `apps/mobile/src/app/account/settings.tsx` | `~/features/profile/SettingsList` |
| `apps/mobile/src/app/account/sounds.tsx` | `~/features/sounds/SoundPicker` |
| `apps/mobile/src/app/account/terms.tsx` | `@senryo/config` · `~/features/legal/LegalPage` |
| `apps/mobile/src/app/activity.tsx` | `@senryo/config` · `@senryo/query` · `~/features/activity/FeedRow` · `~/features/activity/Receipt` · `~/features/activity/useFeed` · `~/features/home/HomeParts` · `~/features/money/useMoneyAssets` · `~/features/portfolio/QuietLine` · `~/features/positions/OrdersLink` |
| `apps/mobile/src/app/alerts.tsx` | `~/features/notifications/NotificationsScreen` |
| `apps/mobile/src/app/asset/[chainId]/[address].tsx` | `~/features/asset/AssetDetail` |
| `apps/mobile/src/app/fund/bridge.tsx` | `~/features/fund/BridgeIn` · `~/features/fund/bridge-assets` · `~/features/portfolio/QuietLine` |
| `apps/mobile/src/app/fund/deposit/[id].tsx` | Entry/redirect/shared controls; owning route source |
| `apps/mobile/src/app/fund/index.tsx` | Entry/redirect/shared controls; owning route source |
| `apps/mobile/src/app/fund/qr/[family].tsx` | Entry/redirect/shared controls; owning route source |
| `apps/mobile/src/app/fund/swap.tsx` | `~/features/swap/SwapView` |
| `apps/mobile/src/app/fund/wallet.tsx` | Entry/redirect/shared controls; owning route source |
| `apps/mobile/src/app/index.tsx` | `~/features/setup/progress` |
| `apps/mobile/src/app/lp.tsx` | `~/features/lp/LpScreen` · `~/features/lp/PoolDisclosures` · `~/features/trade/SideBar` |
| `apps/mobile/src/app/notifications.tsx` | `~/features/notifications/NotificationsScreen` |
| `apps/mobile/src/app/orders.tsx` | `~/features/positions/OrdersScreen` |
| `apps/mobile/src/app/perpl/withdraw.tsx` | `~/features/perpl/PerplWithdraw` |
| `apps/mobile/src/app/positions/[id].tsx` | `@senryo/config` · `~/features/perpl/market` · `~/features/perpl/PerplPositionDetail` · `~/features/portfolio/QuietLine` · `~/features/positions/PositionDetail` |
| `apps/mobile/src/app/setup/done.tsx` | `@senryo/identity/native` · `@senryo/query` · `~/features/setup/SetupScreen` · `~/features/setup/useSetupNav` |
| `apps/mobile/src/app/setup/face-id.tsx` | `@senryo/identity/native` · `~/features/setup/PrimerScreen` · `~/features/setup/useSetupNav` |
| `apps/mobile/src/app/setup/follow.tsx` | `@senryo/account` · `@senryo/query` · `~/features/setup/FollowRow` · `~/features/setup/SetupScreen` · `~/features/setup/useSetupNav` |
| `apps/mobile/src/app/setup/handle.tsx` | `@senryo/api-client` · `@senryo/query` · `~/features/profile/handle-copy` · `~/features/profile/ShowTrades` · `~/features/profile/VisibilitySettings` · `~/features/setup/InfoTip` · `~/features/setup/SetupField` · `~/features/setup/SetupScreen` · `~/features/setup/suggest-handle` · `~/features/setup/useSetupNav` |
| `apps/mobile/src/app/setup/money.tsx` | `@senryo/query` · `~/features/setup/PracticeMoneyCard` · `~/features/setup/SetupScreen` · `~/features/setup/useSetupNav` · `~/features/setup/VoucherField` |
| `apps/mobile/src/app/setup/notifications.tsx` | `@senryo/identity/native` · `~/features/setup/PrimerScreen` · `~/features/setup/useSetupNav` |
| `apps/mobile/src/app/status.tsx` | Entry/redirect/shared controls; owning route source |
| `apps/mobile/src/app/watch/[address]/[list].tsx` | `@senryo/account` · `~/features/social/FollowListScreen` |
| `apps/mobile/src/app/watch/[address]/index.tsx` | `~/features/social/TraderProfile` · `~/features/social/WatchEntry` |
| `apps/mobile/src/app/watch/[address]/post/[id].tsx` | `~/features/social/Thread` |
| `apps/mobile/src/app/welcome.tsx` | `~/features/auth/AuthFlowSheet` · `~/features/auth/SwitchConfirm` · `~/features/auth/useAuthFlow` · `~/features/auth/WelcomeActions` · `~/features/onboarding/Story` · `~/features/setup/progress` |
| `apps/mobile/src/app/withdraw/cash-out.tsx` | Entry/redirect/shared controls; owning route source |
| `apps/mobile/src/app/withdraw/index.tsx` | `~/features/portfolio/QuietLine` · `~/features/withdraw/DestinationStep` · `~/features/withdraw/WithdrawFlow` |
| `apps/mobile/src/app/withdraw/send.tsx` | `~/features/portfolio/QuietLine` · `~/features/send/SendFlow` |
| `apps/web/src/app/(desk)/account/page.tsx` | `@/components/settings/settings-screen` |
| `apps/web/src/app/(desk)/activity/page.tsx` | `@/components/activity/activity-screen` |
| `apps/web/src/app/(desk)/add-money/page.tsx` | `@/components/money/add-money-screen` |
| `apps/web/src/app/(desk)/asset/page.tsx` | `@/components/money/asset-screen` |
| `apps/web/src/app/(desk)/bridge-in/page.tsx` | `@/components/bridge/bridge-in-screen` |
| `apps/web/src/app/(desk)/card/page.tsx` | `@/components/card/card-screen` |
| `apps/web/src/app/(desk)/fund/page.tsx` | `@/components/shell/redirect` |
| `apps/web/src/app/(desk)/home/page.tsx` | `@/components/home/home-screen` |
| `apps/web/src/app/(desk)/markets/page.tsx` | `@/components/screens/markets-screen` |
| `apps/web/src/app/(desk)/notifications/page.tsx` | `@/components/notifications/notifications-screen` |
| `apps/web/src/app/(desk)/pool/page.tsx` | `@/components/pool/pool-screen` |
| `apps/web/src/app/(desk)/portfolio/page.tsx` | `@/components/shell/redirect` |
| `apps/web/src/app/(desk)/position/page.tsx` | `@/components/trade/position-screen` |
| `apps/web/src/app/(desk)/profile/page.tsx` | `@/components/social/own-profile` |
| `apps/web/src/app/(desk)/receive/page.tsx` | `@/components/money/receive-screen` |
| `apps/web/src/app/(desk)/send/page.tsx` | `@/components/money/move-flow` |
| `apps/web/src/app/(desk)/setup/page.tsx` | `@/components/setup/setup-screen` |
| `apps/web/src/app/(desk)/social/page.tsx` | `@/components/social/social-screen` |
| `apps/web/src/app/(desk)/swap/page.tsx` | `@/components/swap/swap-screen` |
| `apps/web/src/app/(desk)/trade/[market]/page.tsx` | `@senryo/config` · `@/components/screens/trade/trade-screen` |
| `apps/web/src/app/(desk)/watch/page.tsx` | `@/components/screens/watch-screen` · `@/components/shell/column` · `@/components/ui/skeleton` |
| `apps/web/src/app/(desk)/withdraw/page.tsx` | `@/components/money/move-flow` |
| `apps/web/src/app/judges/page.tsx` | `@senryo/config` · `@/components/public/markdown` · `@/components/public/public-header` |
| `apps/web/src/app/page.tsx` | `@/components/auth/welcome-actions` · `@/components/public/landing-menu` |
| `apps/web/src/app/privacy/page.tsx` | `@senryo/config` · `@/components/legal/legal-document` |
| `apps/web/src/app/stats/page.tsx` | `@/components/public/public-header` · `@/components/stats/stats-screen` · `@/components/ui/skeleton` |
| `apps/web/src/app/terms/page.tsx` | `@senryo/config` · `@/components/legal/legal-document` |

## Source-family totals

| Owner | Files |
|---|---|
| `apps/mobile/components/charts` | 5 |
| `apps/mobile/components/identity` | 7 |
| `apps/mobile/components/kit` | 18 |
| `apps/mobile/components/sheet` | 6 |
| `apps/mobile/components/shell` | 17 |
| `apps/mobile/components/toast` | 1 |
| `apps/mobile/components/trade` | 8 |
| `apps/mobile/features/activity` | 8 |
| `apps/mobile/features/asset` | 4 |
| `apps/mobile/features/auth` | 17 |
| `apps/mobile/features/card` | 23 |
| `apps/mobile/features/fund` | 11 |
| `apps/mobile/features/home` | 8 |
| `apps/mobile/features/legal` | 5 |
| `apps/mobile/features/lp` | 10 |
| `apps/mobile/features/markets` | 33 |
| `apps/mobile/features/money` | 26 |
| `apps/mobile/features/network` | 5 |
| `apps/mobile/features/notifications` | 6 |
| `apps/mobile/features/onboarding` | 4 |
| `apps/mobile/features/perpl` | 24 |
| `apps/mobile/features/portfolio` | 14 |
| `apps/mobile/features/positions` | 14 |
| `apps/mobile/features/predictions` | 10 |
| `apps/mobile/features/profile` | 23 |
| `apps/mobile/features/search` | 4 |
| `apps/mobile/features/send` | 6 |
| `apps/mobile/features/setup` | 12 |
| `apps/mobile/features/social` | 36 |
| `apps/mobile/features/sounds` | 1 |
| `apps/mobile/features/swap` | 7 |
| `apps/mobile/features/tokens` | 5 |
| `apps/mobile/features/trade` | 33 |
| `apps/mobile/features/withdraw` | 10 |
| `apps/mobile/foundation` | 151 |
| `apps/web/components/activity` | 1 |
| `apps/web/components/auth` | 8 |
| `apps/web/components/bridge` | 4 |
| `apps/web/components/card` | 1 |
| `apps/web/components/home` | 4 |
| `apps/web/components/identity` | 4 |
| `apps/web/components/kit` | 8 |
| `apps/web/components/legal` | 1 |
| `apps/web/components/money` | 14 |
| `apps/web/components/notifications` | 1 |
| `apps/web/components/pool` | 2 |
| `apps/web/components/public` | 4 |
| `apps/web/components/screens` | 13 |
| `apps/web/components/settings` | 2 |
| `apps/web/components/setup` | 1 |
| `apps/web/components/shell` | 10 |
| `apps/web/components/social` | 12 |
| `apps/web/components/stats` | 4 |
| `apps/web/components/swap` | 1 |
| `apps/web/components/trade` | 6 |
| `apps/web/components/ui` | 33 |
| `apps/web/foundation` | 120 |
| `contracts/core` | 12 |
| `contracts/interfaces` | 1 |
| `contracts/libraries` | 5 |
| `contracts/lp` | 1 |
| `contracts/oracle` | 5 |
| `contracts/periphery` | 5 |
| `contracts/testnet` | 5 |
| `indexer/handlers` | 11 |
| `indexer/lib` | 12 |
| `packages/account` | 36 |
| `packages/api-client` | 29 |
| `packages/chain` | 40 |
| `packages/config` | 15 |
| `packages/contracts` | 20 |
| `packages/core` | 15 |
| `packages/identity` | 35 |
| `packages/indexer-client` | 13 |
| `packages/query` | 56 |
| `packages/tokens` | 7 |
| `services/api` | 93 |
| `services/card` | 27 |
| `services/common` | 29 |
| `services/keeper` | 19 |

Total: 1317 source files and 114 page/sheet/redirect entries. Generated outputs, third-party dependencies, private configuration, reference recordings and vendored contract libraries are excluded.

The product and acceptance map is [current-product.md](../../../product/current-product.md). Pending runtime coverage remains in [the work register](../../../plan/reference-followthrough-2026-10-04.md).
