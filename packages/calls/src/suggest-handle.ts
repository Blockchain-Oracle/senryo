/**
 * A first handle to offer (Fomo F04 opens with a generated one): two short words and two digits picked from the
 * account's own address, so the same account always gets the same suggestion and it is valid by construction
 * (`[a-z0-9_]{4,20}`). It is only a suggestion — availability is still checked like any typed handle.
 */
const FIRST = ["calm", "bold", "keen", "swift", "quiet", "lucky", "steady", "bright", "amber", "silver"] as const;
const SECOND = ["koban", "crane", "maple", "lantern", "river", "ember", "harbor", "falcon", "cedar", "comet"] as const;
const HEX_RADIX = 16;
const BYTE_HEX = 2;
/** Skip "0x"; three bytes pick the two words and the number. */
const START = 2;
const NUMBER_MOD = 100;

export function suggestHandle(address: string | undefined): string {
  if (!address) return "";
  const byte = (i: number) =>
    Number.parseInt(address.slice(START + i * BYTE_HEX, START + (i + 1) * BYTE_HEX), HEX_RADIX);
  const first = FIRST[byte(0) % FIRST.length] ?? FIRST[0];
  const second = SECOND[byte(1) % SECOND.length] ?? SECOND[0];
  const number = String(byte(2) % NUMBER_MOD).padStart(BYTE_HEX, "0");
  return `${first}${second}${number}`;
}
