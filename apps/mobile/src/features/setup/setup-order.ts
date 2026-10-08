/**
 * The first run (pivot plan "Onboarding", S5.7): passkey → handle → terms (over Home) → test dollars (granted on
 * arrival) → the first call in the live terminal → one-tap calls → notifications → Face ID unlock (over Home). The
 * first call is the celebration; there is no separate "done" page. Older accounts mid-setup keep terms last.
 */
export const SETUP_STEPS = ["handle", "terms", "dollars", "first-call", "one-tap", "notifications", "face-id"] as const;
export type SetupStep = (typeof SETUP_STEPS)[number];
const LEGACY_STEPS: readonly SetupStep[] = [
  "handle",
  "dollars",
  "first-call",
  "one-tap",
  "notifications",
  "face-id",
  "terms",
];
/** Steps shown over Home rather than as a setup page. */
export const OVER_HOME: readonly SetupStep[] = ["terms", "face-id"];
/** Steps an older build stored that this order replaced: they resume at the step that took their place. */
export const RETIRED_STEPS: Readonly<Record<string, SetupStep>> = {
  follow: "dollars",
  money: "dollars",
  done: "face-id",
};

/** A repeated/stale callback cannot advance another step, including after completion. */
export function nextSetupStep(
  pending: SetupStep | undefined,
  completed: SetupStep,
  modern: boolean,
): SetupStep | undefined {
  if (pending !== completed) return pending;
  const order: readonly SetupStep[] = modern ? SETUP_STEPS : LEGACY_STEPS;
  return order[order.indexOf(completed) + 1];
}

/** Persisted records are untrusted input; malformed values cannot crash launch or mark setup complete. */
export function decodeSetupRecord(raw: string | undefined): Record<string, string> {
  try {
    const value: unknown = JSON.parse(raw ?? "{}");
    if (value === null || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
    );
  } catch {
    return {};
  }
}

export function modernSetupAccount(raw: string | undefined, address: string): boolean {
  try {
    const value: unknown = JSON.parse(raw ?? "{}");
    return (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      (value as Record<string, unknown>)[address.toLowerCase()] === true
    );
  } catch {
    return false;
  }
}
