/**
 * The props an `Avatar` takes for a person: their chosen portrait id and their address, from which the authored set
 * picks a stable default when they haven't chosen (S1b.3, `components/identity/Avatar`). The address is left out when
 * there is none (`exactOptionalPropertyTypes`). Spread it: `<Avatar {...portrait(avatar, address)} size={…} />`.
 */
export function portrait(
  avatar: string | null | undefined,
  address: string | undefined,
): { avatar: string | null } | { avatar: string | null; address: string } {
  return address ? { avatar: avatar ?? null, address } : { avatar: avatar ?? null };
}
