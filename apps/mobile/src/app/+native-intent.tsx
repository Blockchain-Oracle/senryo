import { incomingLink } from "~/lib/incoming-link";

/** Deep links and push taps (S8.22): routed through `linkTarget` against the selected network. Never throws. */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    return incomingLink(path);
  } catch {
    return path;
  }
}
