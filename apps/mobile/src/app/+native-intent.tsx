import { linkTarget } from "~/lib/deep-link";
import { activeNetwork } from "~/lib/network";

/** Deep links and push taps (S8.22): routed through `linkTarget` against the selected network. Never throws. */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    return linkTarget(path, activeNetwork().chainId);
  } catch {
    return path;
  }
}
