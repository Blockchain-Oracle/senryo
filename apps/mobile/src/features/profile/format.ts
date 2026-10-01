/** Profile text helpers (J9): dates as the reference writes them, and input cleaning that mirrors the API's rules. */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/** "Joined Sep 2026" (F16) from the profile's first save, in the device's time zone. */
export function joinedLabel(iso: string): string | undefined {
  const date = new Date(iso);
  const month = MONTHS[date.getMonth()];
  return month ? `Joined ${month} ${date.getFullYear()}` : undefined;
}

/** "31 Oct 2026" — the day a held username frees up. */
export function dayLabel(iso: string): string | undefined {
  const date = new Date(iso);
  const month = MONTHS[date.getMonth()];
  return month ? `${date.getDate()} ${month} ${date.getFullYear()}` : undefined;
}

/** Unicode control characters (category Cc): C0 up to U+001F, then DEL through the C1 block. */
const C0_LAST = 0x1f;
const DEL = 0x7f;
const C1_LAST = 0x9f;
const LINE_FEED = 0x0a;

function withoutControls(text: string, keepLineBreaks: boolean): string {
  let out = "";
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    const control = code <= C0_LAST || (code >= DEL && code <= C1_LAST);
    if (!control || (keepLineBreaks && code === LINE_FEED)) out += char;
  }
  return out;
}

/** The API stores no control characters (`PUT /v1/profile`): a pasted tab or line break never reaches a name. */
export function cleanLine(text: string): string {
  return withoutControls(text, false);
}

/** A bio may keep its line breaks; every other control character is dropped. */
export function cleanBio(text: string): string {
  return withoutControls(text, true);
}
