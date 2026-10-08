/**
 * `getSigner()` — the scoped viem `LocalAccount` `packages/chain` signs with. It wraps Mera's `toViemAccount` so that
 * every signature first passes `Policy` (decoded from the real calldata / typed data). Locked → one unlock prompt that
 * doubles as the D-037 confirmation; in scope + gate → one Face ID; out of scope → `OutOfScopeError` (the UI runs a
 * step-up). Raw-hash signing and 7702 authorizations never happen in session.
 */
import { toViemAccount } from "@category-labs/mera/viem";
import type { Address, LocalAccount } from "viem";
import { toAccount } from "viem/accounts";
import { OutOfScopeError } from "../errors.ts";
import { evaluateTransaction, recordUsage } from "../policy/evaluate.ts";
import { evaluateMessage, evaluateTypedData } from "../policy/typed-data.ts";
import type { PolicyContext, Verdict } from "../policy/types.ts";
import type { LiveSession, SessionManager } from "./manager.ts";

export const UNLOCK_PROMPT = "Unlock trading";
export const STEP_UP_PROMPT = "Approve with Face ID";

export interface SignerDeps {
  manager: SessionManager;
  address: Address;
  /** Live policy reads (query cache). Called per signature so caps follow the latest balances. */
  context: () => PolicyContext;
  /** Unlock with one prompt showing `prompt` (native biometric read / web pinned passkey). */
  unlock: (prompt: string) => Promise<void>;
  /** The D-037 gate for a live session (native biometric read / web passkey assertion). */
  confirm: (prompt: string) => Promise<void>;
  now: () => number;
}

/** Resolves a verdict into a live session: throws out-of-scope, unlocks (counts as confirm) or confirms. */
async function authorize(deps: SignerDeps, verdict: Verdict): Promise<LiveSession> {
  if (verdict.kind === "reject") throw new OutOfScopeError(verdict.reason, verdict.stepUp);
  const prompt = verdict.kind === "confirm" ? verdict.prompt : UNLOCK_PROMPT;
  let live = deps.manager.live();
  if (!live) {
    await deps.unlock(prompt);
    live = deps.manager.live();
  } else if (verdict.kind === "confirm") {
    await deps.confirm(prompt);
  }
  if (!live || live.address !== deps.address) throw new OutOfScopeError("out-of-scope", false);
  return live;
}

function usageOf(deps: SignerDeps) {
  return deps.manager.live()?.usage ?? { spentUsd6: 0n, signedAt: [] };
}

export function createScopedSigner(deps: SignerDeps): LocalAccount {
  return toAccount({
    address: deps.address,
    async sign() {
      throw new OutOfScopeError("raw-hash", false);
    },
    async signAuthorization() {
      throw new OutOfScopeError("delegation", true);
    },
    async signTransaction(transaction, options) {
      const verdict = evaluateTransaction(
        {
          chainId: transaction.chainId,
          to: transaction.to,
          data: transaction.data,
          value: transaction.value,
          authorizationList: "authorizationList" in transaction ? transaction.authorizationList : undefined,
        },
        deps.context(),
        usageOf(deps),
        deps.now(),
      );
      await authorize(deps, verdict);
      return deps.manager.use(async (s) => {
        const signed = await toViemAccount(s.session).signTransaction(transaction, options);
        s.usage = recordUsage(s.usage, verdict, deps.now());
        return signed;
      });
    },
    async signMessage({ message }) {
      await authorize(deps, evaluateMessage(message, deps.context(), deps.now()));
      return deps.manager.use((s) => toViemAccount(s.session).signMessage({ message }));
    },
    async signTypedData(typedData) {
      await authorize(deps, evaluateTypedData(typedData as Parameters<typeof evaluateTypedData>[0], deps.context()));
      return deps.manager.use((s) => toViemAccount(s.session).signTypedData(typedData));
    },
  });
}
