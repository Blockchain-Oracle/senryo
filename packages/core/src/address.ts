const ADDRESS_HEAD = 6;
const ADDRESS_TAIL = 4;

/** `0x7a3F…8e42` — display only; never compare or store the short form. */
export function shortAddress(address: string, head = ADDRESS_HEAD, tail = ADDRESS_TAIL): string {
  return address.length <= head + tail ? address : `${address.slice(0, head)}…${address.slice(-tail)}`;
}
