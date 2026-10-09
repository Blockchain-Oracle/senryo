import { isChainId, networkOf } from "@senryo/config";
import { ROUTES } from "~/lib/constants/routes";

const SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;
const TICKET_ID = /^\d{1,20}$/;
const WEB = /^https?:\/\/[^/]+/i;

/** The in-app path of a system URL: `https://senryo.xyz/a/b` → `/a/b`, `senryo://a/b` → `/a/b`, `/a/b` as is. */
export function inAppPath(base: string): string {
  if (WEB.test(base)) return base.replace(WEB, "") || "/";
  if (SCHEME.test(base)) return `/${base.replace(SCHEME, "").replace(/^\/+/, "")}`;
  return base.startsWith("/") ? base : `/${base}`;
}

/**
 * Retired paths (D-256 pivot): the trading app's portfolio, trade, card and fund links land on Home or Markets; S5
 * maps `/m/<SYMBOL>-<cadence>` share links onto the terminal. A link written for the old app never dead-ends.
 */
const LEGACY_PATHS: ReadonlyArray<readonly [RegExp, (match: RegExpMatchArray) => string]> = [
  [/^\/(portfolio|fund|card|lp|orders|positions|withdraw|activity)(\/.*)?$/, () => ROUTES.home],
  [/^\/(trade|social|watch)(\/.*)?$/, () => ROUTES.markets],
  [/^\/account\/?$/, () => ROUTES.more],
];

/**
 * The current in-app path of any URL form (query kept): old paths are remapped, anything else becomes its in-app
 * path. A deferred link is pushed inside the app, never as the system URL itself.
 */
export function currentPath(path: string): string {
  const [base = "/", query] = path.split("?", 2);
  const local = inAppPath(base);
  const suffix = query ? `?${query}` : "";
  // The web's static export shares a call as `/call?id=<ticketId>` (`@senryo/calls` `callLink`); in the app it is its receipt.
  const call = local === "/call" ? new URLSearchParams(query ?? "").get("id") : null;
  if (call && TICKET_ID.test(call)) return `/calls/${call}`;
  for (const [pattern, to] of LEGACY_PATHS) {
    const match = local.match(pattern);
    if (match) {
      const target = to(match);
      return query ? `${target}${target.includes("?") ? "&" : "?"}${query}` : target;
    }
  }
  return `${local}${suffix}`;
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
  // Asset pages are public, read-only until a deliberate mode switch inside the page.
  const asset = target.match(/^\/asset\/(\d+)\/0x[a-fA-F0-9]{40}(?:[?/]|$)/);
  if (asset && Number(asset[1]) === chainId) return target;
  return `/network?to=${networkOf(chainId).key}&next=${encodeURIComponent(target)}`;
}
