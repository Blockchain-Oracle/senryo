import { isChainId, networkOf } from "@senryo/config";

const SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;
const WEB = /^https?:\/\/[^/]+/i;

/** The in-app path of a system URL: `https://senryo.xyz/a/b` → `/a/b`, `senryo://a/b` → `/a/b`, `/a/b` as is. */
function inAppPath(base: string): string {
  if (WEB.test(base)) return base.replace(WEB, "") || "/";
  if (SCHEME.test(base)) return `/${base.replace(SCHEME, "")}`;
  return base.startsWith("/") ? base : `/${base}`;
}

/**
 * Where a deep link or push tap goes (S8.22, F41/F49). A link that names its network (`?chainId=143`) never opens in
 * the other mode silently:
 * - no chainId → untouched;
 * - same network or an unknown chain → its in-app path (chainId removed);
 * - the other network → the mode selector with that network requested, continuing to the path only after a
 *   deliberate switch.
 */
export function linkTarget(path: string, activeChainId: number): string {
  const [base = "/", query = ""] = path.split("?", 2);
  const params = new URLSearchParams(query);
  const raw = params.get("chainId");
  if (raw === null) return path;
  params.delete("chainId");
  const rest = params.toString();
  const target = `${inAppPath(base)}${rest ? `?${rest}` : ""}`;
  const chainId = Number(raw);
  if (!isChainId(chainId) || chainId === activeChainId) return target;
  return `/network?to=${networkOf(chainId).key}&next=${encodeURIComponent(target)}`;
}
