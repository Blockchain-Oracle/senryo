/** Public, versioned operation context. Signed bytes and credentials belong to the transaction journal/account. */
export interface OperationStep {
  action: string;
  hash?: string;
  outcome: "preparing" | "pending" | "completed" | "reverted" | "abandoned" | "not-sent";
  blockNumber?: string;
  blockHash?: string;
  request?: Record<string, string>;
  facts?: { event: string; contract: string; values: Record<string, string> }[] | undefined;
}
export interface OperationRecord {
  version: 1;
  id: string;
  key: string;
  account: string;
  chainId: number;
  kind: string;
  plannedActions: string[];
  outcome: "preparing" | "pending" | "completed" | "partial" | "not-sent" | "reverted" | "abandoned";
  reviewedIntent: Record<string, string>;
  steps: OperationStep[];
  createdAt: number;
  updatedAt: number;
}
export interface OperationStorage {
  get(key: string): string | undefined;
  set(key: string, value: string): void;
  keys?(): readonly string[];
}
/** Derive the whole journey from every step, including recovery of an earlier transaction. */
export function operationOutcome(
  steps: readonly OperationStep[],
  plannedActions: readonly string[],
): OperationRecord["outcome"] {
  const unresolved = steps.some((step) => step.outcome === "pending" || step.outcome === "preparing");
  if (unresolved) return steps.every((step) => step.outcome === "preparing") ? "preparing" : "pending";
  const completed = steps.filter((step) => step.outcome === "completed");
  const failed = steps.findLast((step) => ["not-sent", "reverted", "abandoned"].includes(step.outcome));
  // Retrying one unfinished step is explicit. A completed retry supersedes that action's earlier failure.
  const unfinished =
    failed &&
    !steps
      .slice(steps.indexOf(failed) + 1)
      .some(
        (step) =>
          step.action === failed.action && step.request?.leg === failed.request?.leg && step.outcome === "completed",
      );
  if (unfinished) return completed.length ? "partial" : (failed.outcome as "not-sent" | "reverted" | "abandoned");
  const remaining = [...plannedActions];
  for (const step of completed) {
    const index = remaining.indexOf(step.action);
    if (index >= 0) remaining.splice(index, 1);
  }
  return remaining.length === 0 ? "completed" : "pending";
}
let storage: OperationStorage | undefined;
let validateScope: ((chainId: number, account: string) => void) | undefined;
export function configureOperationScopeValidator(validate: (chainId: number, account: string) => void): void {
  validateScope = validate;
}
export function assertOperationScope(chainId: number, account: string): void {
  validateScope?.(chainId, account);
}

const records = new Map<string, OperationRecord>();
const subscribers = new Set<(record: OperationRecord, live: boolean) => void>();
const PREFIX = "senryo.operation.v1:";
export function configureOperationStorage(adapter: OperationStorage): void {
  storage = adapter;
}
export function readOperation(key: string): OperationRecord | undefined {
  const cached = records.get(key);
  if (cached) return cached;
  try {
    const raw = storage?.get(PREFIX + key);
    if (!raw) return undefined;
    const record = JSON.parse(raw) as OperationRecord;
    if (
      record.version !== 1 ||
      (record.key !== key && record.id !== key) ||
      !Array.isArray(record.steps) ||
      !Array.isArray(record.plannedActions) ||
      typeof record.account !== "string" ||
      typeof record.chainId !== "number" ||
      !record.reviewedIntent
    )
      return undefined;
    records.set(key, record);
    return record;
  } catch {
    return undefined;
  }
}
export function writeOperation(record: OperationRecord, live = true): void {
  // Persist before notifying: a UI update is never evidence that a financial intent was durably recorded.
  storage?.set(PREFIX + record.key, JSON.stringify(record));
  storage?.set(PREFIX + record.id, JSON.stringify(record));
  records.set(record.key, record);
  records.set(record.id, record);
  for (const subscriber of subscribers) subscriber(record, live);
}
export function subscribeOperations(listener: (record: OperationRecord, live: boolean) => void): () => void {
  subscribers.add(listener);
  return () => {
    subscribers.delete(listener);
  };
}
export function operationKey(chainId: number, account: string | undefined, kind: string): string {
  return `${chainId}:${account?.toLowerCase() ?? "guest"}:${kind}`;
}

/** Enumerate public operations for money history and indexer-lag recovery, scoped to this account/network. */
export function operationsFor(chainId: number, account: string): OperationRecord[] {
  const candidates = [...records.values()];
  for (const key of storage?.keys?.() ?? []) {
    if (!key.startsWith(PREFIX)) continue;
    const record = readOperation(key.slice(PREFIX.length));
    if (record) candidates.push(record);
  }
  const unique = new Map<string, OperationRecord>();
  for (const record of candidates) {
    if (record.chainId !== chainId || record.account !== account.toLowerCase()) continue;
    const current = unique.get(record.id);
    if (!current || current.updatedAt <= record.updatedAt) unique.set(record.id, record);
  }
  return [...unique.values()].sort((a, b) => b.updatedAt - a.updatedAt);
}
