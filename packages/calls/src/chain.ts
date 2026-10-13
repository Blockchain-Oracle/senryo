/**
 * Up to three facts in one line, joined by " · " (D-346: no longer chains on an operational surface) — the type takes
 * three, never more; empty parts drop out. A fourth fact belongs on its own line or behind a disclosure.
 */
const DOT = " · ";

export const chain = (a: string, b?: string | null | false, c?: string | null | false): string =>
  [a, b, c].filter((p): p is string => Boolean(p)).join(DOT);
