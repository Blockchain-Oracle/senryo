/**
 * How a Perpl operation is confirmed (session-policy.md §3; flow book C4): the session signs approve → deposit → open
 * only while each stays in scope — the approve and the deposit ≤ $250 a move, the open's notional ≤ $250 at ≤ 10×,
 * everything within the session's $1,000 total. Above any of those the same reviewed operation is signed through one
 * passkey step-up, named on the slide before it is held. Reduce, close and withdraw always sign in session.
 */
import { type AccountClient, type Address, emptyUsage, evaluateSequence, type FaceIdMode } from "@senryo/account";
import type { TxRequest } from "@senryo/chain";
import type { ConfirmLevel } from "~/features/trade/confirm-level";
import { policyContext } from "~/lib/account/api";
import { PERPL_CHAIN } from "./market";

export interface PerplConfirmCheck {
  client: AccountClient | undefined;
  address: Address | undefined;
  faceId: FaceIdMode | undefined;
  /** The operation's requests in send order (the order built provisionally: the policy reads calldata, not blocks). */
  requests: readonly TxRequest[];
  marketLabel: string;
}

/** "session" when every step would sign in scope; "passkey" when one of them needs the step-up. */
export function perplConfirmLevel(check: PerplConfirmCheck): ConfirmLevel {
  const { client, address, requests } = check;
  if (!client || !address || requests.length === 0) return "session";
  const ctx = { ...policyContext(address, check.faceId)(), perplMarketLabel: () => check.marketLabel };
  // Perpl is mainnet only: judging it on another network would only ever say "wrong chain".
  if (ctx.chainId !== PERPL_CHAIN) return "session";
  const refusal = evaluateSequence(
    requests.map((r) => ({
      chainId: PERPL_CHAIN,
      to: r.to,
      data: r.data,
      value: r.value ?? 0n,
      authorizationList: undefined,
    })),
    ctx,
    client.session.live()?.usage ?? emptyUsage(),
    Date.now(),
  );
  return refusal ? "passkey" : "session";
}
