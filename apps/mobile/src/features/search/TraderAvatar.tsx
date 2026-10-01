import { StyleSheet, Text, View } from "react-native";
import { shortAddress } from "~/lib/format";
import { RADIUS, TYPE, useTheme } from "~/theme";

/** The parts of a public identity a row needs (`socialIdentitySchema`; a recent search keeps the same three). */
export interface TraderIdentity {
  address: string;
  handle: string | null;
  displayName: string | null;
}

/** What a trader is called: their display name, else their @handle, else the short address. */
export function traderName(trader: TraderIdentity): string {
  return trader.displayName ?? (trader.handle ? `@${trader.handle}` : shortAddress(trader.address));
}

/** The line under the name: the @handle when the name is a display name, else the short address. */
export function traderDetail(trader: TraderIdentity): string {
  return trader.displayName && trader.handle ? `@${trader.handle}` : shortAddress(trader.address);
}

const ADDRESS_PREFIX = "0x";
const HEX_INITIALS = 2;

/**
 * A trader's avatar disc. The authored portrait set is not in the app yet (J8), so this is a neutral filled disc with
 * the trader's initial — or the first two hex digits of an address-only account — never an invented portrait.
 */
export function TraderAvatar({ trader, size }: { trader: TraderIdentity; size: number }) {
  const { color } = useTheme();
  const named = trader.displayName ?? trader.handle;
  const initials = named
    ? named.trim().charAt(0).toUpperCase()
    : trader.address.slice(ADDRESS_PREFIX.length, ADDRESS_PREFIX.length + HEX_INITIALS).toUpperCase();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.disc, { width: size, height: size, backgroundColor: color.raised2 }]}
    >
      <Text allowFontScaling={false} style={[TYPE.rowStrong, { color: color.text2 }]}>
        {initials}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  disc: { borderRadius: RADIUS.pill, alignItems: "center", justifyContent: "center" },
});
