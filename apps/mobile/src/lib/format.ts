const TWO_DIGITS = 2;

/** 14:02 in the device's local time (the stale stamp and activity rows). */
export function clockTime(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(TWO_DIGITS, "0")}:${String(d.getMinutes()).padStart(TWO_DIGITS, "0")}`;
}

/** 0x7a3F…8e42 */
export function shortAddress(address: string, head = 6, tail = 4): string {
  return address.length <= head + tail ? address : `${address.slice(0, head)}…${address.slice(-tail)}`;
}
