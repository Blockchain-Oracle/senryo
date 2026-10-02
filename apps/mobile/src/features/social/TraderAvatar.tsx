/**
 * A trader's avatar, everywhere a person is shown (feed, people, profile, search, Holders, recipients): the profile's
 * authored portrait, or the stable default their address picks from the authored set (S1b.3) — never initials or an
 * invented face. Decorative: the row around it names the trader. One component (it used to be two, in Social and in
 * Search); it takes either a public identity (`trader`) or the parts (`avatar`, `address`).
 */
import { shortAddress } from "@senryo/core";
import { View } from "react-native";
import { Avatar } from "~/components/identity/Avatar";
import { portrait } from "~/features/profile/portrait";
import { SIZE } from "~/theme";

/** The parts of a public identity a row needs (`socialIdentitySchema`; a recent search keeps the first three). */
export interface TraderIdentity {
  address: string;
  handle: string | null;
  displayName: string | null;
  /** Their chosen portrait id; without one (or from an older recent search) the address picks the stable default. */
  avatar?: string | null;
}

/** What a trader is called in a list: their display name, else their @handle, else the short address. */
export function traderName(trader: TraderIdentity): string {
  return trader.displayName ?? (trader.handle ? `@${trader.handle}` : shortAddress(trader.address));
}

/** The line under the name: the @handle when the name is a display name, else the short address. */
export function traderDetail(trader: TraderIdentity): string {
  return trader.displayName && trader.handle ? `@${trader.handle}` : shortAddress(trader.address);
}

type Who = { trader: TraderIdentity } | { avatar?: string | null; address?: string };

export function TraderAvatar(props: Who & { size?: number }) {
  const size = props.size ?? SIZE.avatarMd;
  const avatar = "trader" in props ? props.trader.avatar : props.avatar;
  const address = "trader" in props ? props.trader.address : props.address;
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Avatar {...portrait(avatar, address)} size={size} />
    </View>
  );
}
