/**
 * The icon vocabulary: SF Symbol (iOS) and Material Symbol (Android) per role. Tab symbols are the spec's
 * (client.md: chart.line.uptrend.xyaxis, list.bullet.rectangle, arrow.left.arrow.right, creditcard, arrow.down.to.line).
 */
export const ICONS = {
  portfolio: { sf: "chart.line.uptrend.xyaxis", sfSelected: "chart.line.uptrend.xyaxis", md: "monitoring" },
  markets: { sf: "list.bullet.rectangle", sfSelected: "list.bullet.rectangle.fill", md: "view_list" },
  trade: { sf: "arrow.left.arrow.right", sfSelected: "arrow.left.arrow.right", md: "swap_horiz" },
  card: { sf: "creditcard", sfSelected: "creditcard.fill", md: "credit_card" },
  fund: { sf: "arrow.down.to.line", sfSelected: "arrow.down.to.line", md: "download" },
  bell: { sf: "bell", sfSelected: "bell.fill", md: "notifications" },
  account: { sf: "person.crop.circle", sfSelected: "person.crop.circle.fill", md: "account_circle" },
  offline: { sf: "wifi.slash", sfSelected: "wifi.slash", md: "wifi_off" },
  chevron: { sf: "chevron.right", sfSelected: "chevron.right", md: "chevron_right" },
  faceId: { sf: "faceid", sfSelected: "faceid", md: "fingerprint" },
  shield: { sf: "checkmark.shield", sfSelected: "checkmark.shield.fill", md: "verified_user" },
} as const;

export type IconName = keyof typeof ICONS;
