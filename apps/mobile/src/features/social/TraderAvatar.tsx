/**
 * A trader's avatar in Social: the profile's authored portrait, or the account's stable default (S1b.3). It hands
 * `avatar` and `address` to the shared `Avatar` seam as one spread, so this compiles against the neutral-disc seam
 * and lights up unchanged when the portrait seam (which reads `address`) is merged.
 */
import { Avatar } from "~/components/identity/Avatar";

export interface TraderAvatarProps {
  /** The profile's authored avatar id, when it has one. */
  avatar?: string | null;
  /** The account, for its default portrait. */
  address?: string;
  size?: number;
}

export function TraderAvatar(props: TraderAvatarProps) {
  return <Avatar {...props} />;
}
