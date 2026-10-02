import { anySetupPending } from "~/features/setup/progress";
import { inAppPath, linkTarget } from "~/lib/deep-link";
import { activeNetwork } from "~/lib/network";
import { STORAGE_KEYS, storage } from "~/lib/storage";
export const PENDING_LINK = "senryo.pending-link.v1";
export function incomingNeedsAccount(path: string) {
  const base = inAppPath(path.split("?")[0] ?? "/");
  return (
    /^\/(receive|withdraw|send|swap|lp|voucher|balance-details)(\/|$)/.test(base) ||
    /^\/account\/(identity|recovery|security|delete|profile)(\/|$)/.test(base) ||
    /^\/card\/(allowance|reveal|auth|wallet)(\/|$)/.test(base)
  );
}
export function incomingLink(path: string): string {
  if (!storage.getBoolean(STORAGE_KEYS.welcomed) || anySetupPending() || incomingNeedsAccount(path)) {
    storage.set(PENDING_LINK, path);
    return "/";
  }
  return linkTarget(path, activeNetwork().chainId);
}
