/** biome-ignore-all lint/style/noMagicNumbers: Pinned provider numeric protocol enums and basis point boundary. */
/** PerplFoundation/api-docs 25ab6e2c75c8f84d0550da8c3be30af49ad631f2/types.md.
 * Server-managed admission, NOT an onchain trigger or permission bounded delegation.
 */
export const PERPL_PROTECTION_GATES = [
  "Explicit acceptance of persistent provider forwarding and account-wide API trade authority",
  "Provider-whitelisted enrollment origin and native smart-account signature compatibility",
  "Secure finite-expiry key enrollment, recovery and native key revocation",
  "Provider clarification of trigger expiry and verified reduction, sibling and reconnect behavior",
] as const;
export interface PerplConditionalSpec {
  rq: number;
  mkt: number;
  acc: number;
  t: 3 | 4 | 5;
  oid?: number;
  p: number;
  s: number;
  ms: number;
  fl: 0 | 4;
  tp?: number;
  tpc?: 1 | 2 | 3 | 4;
  lp?: number;
  lv: number;
  lb: 0;
}
export interface PerplProtectionReview {
  account: number;
  market: number;
  position: number;
  side: "long" | "short";
  lots: bigint;
  triggerPNS: bigint;
  limitPNS: bigint;
  slippageBps: number;
  source: "mark" | "last";
  kind: "sl" | "tp";
  leverageHundredths: number;
  /** App review ceiling, not a provider-enforced API-key authority bound. */
  feeEstimateCNS: bigint;
  feeCeilingCNS: bigint;
}
function exact(value: bigint | number): number {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n <= 0) throw new Error("Provider integer exceeds exact supported range.");
  return n;
}
/** Inputs are already venue-scaled integers; no floating point rescaling or future-position sizing. */
export function perplProtectionSpec(review: PerplProtectionReview, requestId: number): PerplConditionalSpec {
  if (review.feeEstimateCNS < 0n || review.feeEstimateCNS > review.feeCeilingCNS)
    throw new Error("Protection fee exceeds the reviewed ceiling.");
  const gte = (review.side === "long") === (review.kind === "tp");
  if (!Number.isSafeInteger(review.slippageBps) || review.slippageBps <= 0 || review.slippageBps > 10_000)
    throw new Error("Review an explicit bounded slippage.");
  return {
    rq: exact(requestId),
    mkt: exact(review.market),
    acc: exact(review.account),
    t: review.side === "long" ? 3 : 4,
    p: exact(review.limitPNS),
    s: exact(review.lots),
    ms: review.slippageBps,
    fl: 4,
    tp: exact(review.triggerPNS),
    tpc: review.source === "mark" ? (gte ? 3 : 4) : gte ? 1 : 2,
    lp: exact(review.position),
    lv: exact(review.leverageHundredths),
    lb: 0,
  };
}
export type PerplProtectionState =
  | "pending"
  | "untriggered"
  | "open"
  | "triggered"
  | "partial"
  | "filled"
  | "canceled"
  | "expired"
  | "failed"
  | "executed"
  | "unknown";
export interface PerplProtectionIntent {
  review: PerplProtectionReview;
  spec: PerplConditionalSpec;
  state: PerplProtectionState;
  replaces?: number;
}
/** Persist this exact spec BEFORE submit; an uncertain request retries rq unchanged after authenticated recovery. */
export function nextProtectionRequest(lastForwarded: number, persisted: number): number {
  return exact(Math.max(lastForwarded, persisted) + 1);
}
export function reconcileProtection(
  intent: PerplProtectionIntent,
  snapshot: {
    authenticated: boolean;
    account: number;
    request: number;
    status: number;
  },
): PerplProtectionIntent {
  if (!snapshot.authenticated || snapshot.account !== intent.spec.acc || snapshot.request !== intent.spec.rq)
    return { ...intent, state: "unknown" };
  const states: Record<number, PerplProtectionState> = {
    1: "pending",
    2: "open",
    3: "partial",
    4: "filled",
    5: "canceled",
    6: "expired",
    7: "failed",
    8: "untriggered",
    9: "triggered",
    10: "executed",
  };
  return { ...intent, state: states[snapshot.status] ?? "unknown" };
}
/** Admission is insufficient; old protection may retire only after authoritative new active state. */
export function mayRetireProtection(intent: PerplProtectionIntent): boolean {
  return intent.state === "untriggered" || intent.state === "open";
}
export function cancelProtectionSpec(
  intent: PerplProtectionIntent,
  orderId: number,
  requestId: number,
): PerplConditionalSpec {
  return {
    rq: exact(requestId),
    mkt: intent.spec.mkt,
    acc: intent.spec.acc,
    oid: exact(orderId),
    t: 5,
    p: 0,
    s: 0,
    ms: 0,
    fl: 0,
    lv: 0,
    lb: 0,
  };
}

export interface ProtectionStorage {
  get(key: string): string | undefined;
  set(key: string, value: string): void;
}
/** Public intent only. Caller scope MUST include deployment chain and owner account.
 * Credentials stay in native secure storage. Pending/unknown requests retain the same rq across relaunch.
 */
export class PerplProtectionJournal {
  constructor(
    private readonly storage: ProtectionStorage,
    private readonly scope: string,
  ) {}
  read(requestId?: number): PerplProtectionIntent | undefined {
    const raw = this.storage.get(requestId === undefined ? this.scope : `${this.scope}:${requestId}`);
    if (!raw) return;
    const parsed = JSON.parse(raw) as PerplProtectionIntent;
    const review = {
      ...parsed.review,
      lots: BigInt(parsed.review.lots),
      triggerPNS: BigInt(parsed.review.triggerPNS),
      limitPNS: BigInt(parsed.review.limitPNS),
      feeEstimateCNS: BigInt(parsed.review.feeEstimateCNS),
      feeCeilingCNS: BigInt(parsed.review.feeCeilingCNS),
    };
    const spec = perplProtectionSpec(review, parsed.spec.rq);
    if (JSON.stringify(spec) !== JSON.stringify(parsed.spec))
      throw new Error("Stored protection differs from reviewed request.");
    return { ...parsed, review, spec };
  }
  prepare(review: PerplProtectionReview, lastForwarded: number, replaces?: number): PerplProtectionIntent {
    const prior = this.read();
    if (prior && ["pending", "unknown", "triggered"].includes(prior.state))
      throw new Error("Reconcile the existing request before preparing another protection order.");
    const spec = perplProtectionSpec(review, nextProtectionRequest(lastForwarded, prior?.spec.rq ?? 0));
    const intent: PerplProtectionIntent = {
      review,
      spec,
      state: "pending",
      ...(replaces === undefined ? {} : { replaces }),
    };
    this.save(intent);
    return intent;
  }
  save(intent: PerplProtectionIntent): void {
    const raw = JSON.stringify(intent, (_, value: unknown) => (typeof value === "bigint" ? value.toString() : value));
    this.storage.set(`${this.scope}:${intent.spec.rq}`, raw);
    const latest = this.read();
    if (!latest || latest.spec.rq <= intent.spec.rq) this.storage.set(this.scope, raw);
  }
}
