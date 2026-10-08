/** Reviewed executable facts must belong to the current account, chain and foreground review. */
export function assertReviewedSource(
  intent: Readonly<Record<string, string>>,
  account: string,
  chainId: number,
  generation: string,
): void {
  if (
    intent.sourceAccount?.toLowerCase() !== account.toLowerCase() ||
    intent.sourceChainId !== String(chainId) ||
    intent.reviewGeneration !== generation
  )
    throw new Error("Source or app state changed. Review again.");
}

export interface WalletSnapshot {
  scope: string;
  balances: ReadonlyMap<string, bigint>;
}
/** Discovery seeds unknown tokens. Replace all balances atomically, including decreases. */
export function walletSnapshot(
  previous: WalletSnapshot | undefined,
  scope: string,
  assets: readonly { key: string; wallet: bigint }[],
  freshComplete: boolean,
): { snapshot: WalletSnapshot | undefined; changed: boolean } {
  if (!freshComplete) return { snapshot: previous?.scope === scope ? previous : undefined, changed: false };
  const before = previous?.scope === scope ? previous.balances : undefined;
  const changed = assets.some((a) => before?.has(a.key) && before.get(a.key) !== a.wallet);
  return { snapshot: { scope, balances: new Map(assets.map((a) => [a.key, a.wallet])) }, changed };
}

/** Bridge execution never introduces a new quote or approval after review. */
export function assertBridgeExecution(expiresAt: number | null, nowMs: number, requestCount?: number): void {
  const MS_PER_SECOND = 1000;
  if (expiresAt !== null && expiresAt * MS_PER_SECOND <= nowMs)
    throw new Error("Bridge quote expired · review remaining steps again");
  if (requestCount !== undefined && requestCount !== 1)
    throw new Error("Bridge approval changed · review remaining steps again");
}

/** A lease remembers every scope change, including A→B→A, and foreground interruptions. */
export function createReviewLease(initial: string) {
  let intent = initial;
  let revision = 0;
  let mounted = true;
  return {
    update(next: string) {
      if (next !== intent) {
        intent = next;
        revision += 1;
      }
    },
    interrupt() {
      revision += 1;
    },
    mount() {
      mounted = true;
    },
    unmount() {
      mounted = false;
    },
    capture() {
      const captured = revision;
      const key = `${intent}:${captured}`;
      return Object.assign(
        () => {
          if (!mounted || captured !== revision) throw new Error("Details or app state changed. Review again.");
        },
        { key },
      );
    },
  };
}

/** Native address actions must catch rejections and suppress late destination feedback. */
export async function settleDestinationAction(work: () => Promise<unknown>, current: () => boolean) {
  try {
    await work();
    return { ok: true, current: current() };
  } catch {
    return { ok: false, current: current() };
  }
}

/** Authorization requires successful fee facts for this exact prepared review, with no pending refetch. */
export function requireReviewedFee(
  reviewId: string | undefined,
  facts: { id: string; fee: string } | undefined,
  pending: boolean,
): void {
  if (!reviewId || !facts || facts.id !== reviewId || !facts.fee || pending)
    throw new Error("Wait for the complete network fee, then review again.");
}

/** Only the runner that owns an approval keeps its original route lease. */
export function moneyReviewRoute(path: string, running: boolean, origin: string, approval: string): string {
  return path === approval && running ? origin : path;
}
