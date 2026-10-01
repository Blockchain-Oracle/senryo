import { View } from "react-native";
import { Avatar } from "~/components/identity/Avatar";
import { portrait } from "~/features/profile/portrait";
import { shortAddress } from "~/lib/format";

/** The parts of a public identity a row needs (`socialIdentitySchema`; a recent search keeps the first three). */
export interface TraderIdentity {
  address: string;
  handle: string | null;
  displayName: string | null;
  /** Their chosen portrait id; without one (or from an older recent search) the address picks the stable default. */
  avatar?: string | null;
}

/** What a trader is called: their display name, else their @handle, else the short address. */
export function traderName(trader: TraderIdentity): string {
  return trader.displayName ?? (trader.handle ? `@${trader.handle}` : shortAddress(trader.address));
}

/** The line under the name: the @handle when the name is a display name, else the short address. */
export function traderDetail(trader: TraderIdentity): string {
  return trader.displayName && trader.handle ? `@${trader.handle}` : shortAddress(trader.address);
}

/**
 * A trader's avatar: their authored portrait (S1b.3, the twelve), or the one their address picks when they haven't
 * chosen — the same disc their profile and the You tab show, never initials or an invented face. Decorative: the row
 * names the trader.
 */
export function TraderAvatar({ trader, size }: { trader: TraderIdentity; size: number }) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Avatar {...portrait(trader.avatar, trader.address)} size={size} />
    </View>
  );
}
