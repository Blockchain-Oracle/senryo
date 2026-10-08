/**
 * The one navigation source (D-268): what the phone dock, the phone's More grid and the web rail list, as pure data.
 * Apps map `icon` to their own glyphs; every `path` must resolve to a route (invariant `nav-route-coverage`).
 * Phone dock: Home · Markets · [seal = Trade] · Calls · More.
 */
export type NavIcon =
  | "home"
  | "markets"
  | "seal"
  | "calls"
  | "more"
  | "profile"
  | "notifications"
  | "settings"
  | "receive"
  | "status";

export interface NavItem {
  key: string;
  label: string;
  icon: NavIcon;
  /** The app path (expo-router strips route groups). */
  path: string;
}

export const DOCK_NAV = [
  { key: "home", label: "Home", icon: "home", path: "/home" },
  { key: "markets", label: "Markets", icon: "markets", path: "/markets" },
  { key: "trade", label: "Trade", icon: "seal", path: "/trade" },
  { key: "calls", label: "Calls", icon: "calls", path: "/calls" },
  { key: "more", label: "More", icon: "more", path: "/more" },
] as const satisfies readonly NavItem[];

export type DockKey = (typeof DOCK_NAV)[number]["key"];

/** The More grid (phone) and the rail's secondary group (web), in order. */
export const MORE_NAV = [
  { key: "profile", label: "Profile", icon: "profile", path: "/account/profile" },
  { key: "receive", label: "Receive", icon: "receive", path: "/receive" },
  { key: "notifications", label: "Notifications", icon: "notifications", path: "/notifications" },
  { key: "settings", label: "Settings", icon: "settings", path: "/account/settings" },
  { key: "status", label: "Status", icon: "status", path: "/status" },
] as const satisfies readonly NavItem[];
