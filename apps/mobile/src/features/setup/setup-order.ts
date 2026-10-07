/** Persisted legacy accounts retain their remaining order; new accounts accept terms before permissions. */
export const SETUP_STEPS = ["handle", "follow", "money", "terms", "face-id", "notifications", "done"] as const;
export type SetupStep = (typeof SETUP_STEPS)[number];
const LEGACY_STEPS: readonly SetupStep[] = ["handle", "follow", "money", "face-id", "notifications", "done", "terms"];

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
