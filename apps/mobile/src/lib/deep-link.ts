import { isChainId, networkOf } from "@senryo/config";
import { DEFAULT_MARKET, marketRoute, ROUTES } from "~/lib/constants/routes";

const SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;
const WEB = /^https?:\/\/[^/]+/i;

/** The in-app path of a system URL: `https://senryo.xyz/a/b` → `/a/b`, `senryo://a/b` → `/a/b`, `/a/b` as is. */
export function inAppPath(base: string): string {
  if (WEB.test(base)) return base.replace(WEB, "") || "/";
  if (SCHEME.test(base)) return `/${base.replace(SCHEME, "")}`;
  return base.startsWith("/") ? base : `/${base}`;
}

/**
 * Paths from before the S1b.7 shell (D-176), and the web app's own paths (S11b keeps them until its layouts move):
 * the old Portfolio tab is Home, Trade became market detail (the ticket opens from it), Fund became the add-money hub,
 * Account is the You tab. A link written for the old app still lands on the right screen.
 */
const LEGACY_PATHS: ReadonlyArray<readonly [RegExp, (match: RegExpMatchArray) => string]> = [
  [/^\/portfolio\/?$/, () => ROUTES.home],
  [/^\/trade\/?$/, () => marketRoute(DEFAULT_MARKET)],
  [/^\/trade\/([^/]+)\/?$/, (m) => marketRoute(decodeURIComponent(m[1] ?? DEFAULT_MARKET).toUpperCase())],
  [/^\/fund\/?$/, () => ROUTES.homeAddMoney],
  [/^\/account\/?$/, () => ROUTES.you],
];

/** The current in-app path for an old one (any URL form, query kept); anything else is returned unchanged. */
export function currentPath(path: string): string {
  const [base = "/", query] = path.split("?", 2);
  const local = inAppPath(base);
  for (const [pattern, to] of LEGACY_PATHS) {
    const match = local.match(pattern);
    if (match) return `${to(match)}${query ? `?${query}` : ""}`;
  }
  return path;
}

/**
 * Where a deep link or push tap goes (S8.22, F41/F49), after old paths are remapped (S1b.7). A link that names its
 * network (`?chainId=143`) never opens in the other mode silently:
 * - no chainId → its (remapped) path;
 * - same network or an unknown chain → its in-app path (chainId removed);
 * - the other network → the mode selector with that network requested, continuing to the path only after a
 *   deliberate switch.
 */
export function linkTarget(path: string, activeChainId: number): string {
  const [base = "/", query = ""] = path.split("?", 2);
  const params = new URLSearchParams(query);
  const raw = params.get("chainId");
  if (raw === null) return currentPath(path);
  params.delete("chainId");
  const rest = params.toString();
  const target = currentPath(`${inAppPath(base)}${rest ? `?${rest}` : ""}`);
  const chainId = Number(raw);
  if (!isChainId(chainId) || chainId === activeChainId) return target;
  return `/network?to=${networkOf(chainId).key}&next=${encodeURIComponent(target)}`;
}
