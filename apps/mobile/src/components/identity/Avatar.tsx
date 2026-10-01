import { NATIVE_ART } from "@senryo/identity/native";
import { StyleSheet, View } from "react-native";
import { RADIUS, SIZE, useTheme } from "~/theme";

/** The twelve authored portraits (brand/art/avatars), in their published order. */
export const AVATAR_IDS = Object.keys(NATIVE_ART)
  .filter((key) => key.startsWith("avatar-"))
  .sort();

const HEX_RADIX = 16;
/** The last byte of an address picks its default portrait. */
const ADDRESS_TAIL = 2;

/** The portrait an account shows until its owner picks one: stable for the address, one of the twelve. */
export function defaultAvatar(address: string | undefined): string | undefined {
  if (!address || AVATAR_IDS.length === 0) return undefined;
  const byte = Number.parseInt(address.slice(-ADDRESS_TAIL), HEX_RADIX);
  return AVATAR_IDS[(Number.isNaN(byte) ? 0 : byte) % AVATAR_IDS.length];
}

/**
 * A person's avatar (FT066; S1b.3): the profile's chosen portrait, or the account's stable default from the authored
 * set of twelve — never a letter, a colour hash or a fake photo. The art is a full square clipped to a disc.
 */
export function Avatar({
  avatar,
  address,
  size = SIZE.avatarMd,
}: {
  /** The profile's authored avatar id, when it has one. */
  avatar?: string | null;
  address?: string;
  size?: number;
}) {
  const { color } = useTheme();
  const id = avatar && NATIVE_ART[avatar] ? avatar : defaultAvatar(address);
  const Art = id ? NATIVE_ART[id]?.symbol : undefined;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.disc, { width: size, height: size, backgroundColor: color.raised2 }]}
    >
      {Art ? <Art width={size} height={size} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  disc: { borderRadius: RADIUS.pill, overflow: "hidden" },
});
