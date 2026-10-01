/**
 * The card's real controls, on the account's onchain spend allowance (CardModule):
 * - `freeze()` revokes it (D-039): in session scope, since it only ever lowers what the card can spend;
 * - `setLimit(daily)` signs a new `SpendAllowance` (a card setting: behind a fresh passkey check, one-shot signer) and
 *   sends `setSpendAllowance` with it, for `ALLOWANCE_DAYS` from now.
 * Both report through one trace; the snapshot refreshes when it finalizes.
 */
import type { AccountSnapshot } from "@senryo/chain";
import { positionCount } from "@senryo/config";
import {
  keys,
  readAllowanceNonce,
  revokeSpendAllowanceRequest,
  setSpendAllowanceRequest,
  spendAllowanceTypedData,
  useQueryEnv,
  useSendTrace,
} from "@senryo/query";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useEnsureGas } from "~/features/trade/useGasTopUp";
import { useAccount } from "~/lib/account/provider";
import { sharedRead, stepUpSender, userSender } from "~/lib/account/sender";
import { requestStepUp } from "~/lib/account/step-up";
import { usd } from "~/lib/money";

/** A new limit lasts this long before it has to be signed again. */
export const ALLOWANCE_DAYS = 30n;
const SECONDS_PER_DAY = 86_400n;
const MS_PER_SECOND = 1000n;

export function useCardAllowance(snapshot: AccountSnapshot | undefined) {
  const env = useQueryEnv();
  const account = useAccount();
  const trace = useSendTrace("card-allowance");
  const gas = useEnsureGas();
  const queryClient = useQueryClient();
  const address = account.hint?.address;
  /** What the trace is about, so its result line can say it. */
  const [last, setLast] = useState<{ kind: "freeze" } | { kind: "limit"; dailyUsd6: bigint }>();
  const positions = snapshot ? positionCount(snapshot.positionBitmap) : 0;
  const refresh = () =>
    address ? queryClient.invalidateQueries({ queryKey: keys.account(env.chainId, address) }) : undefined;

  const freeze = async () => {
    const client = account.client;
    if (!client || !address) return;
    const request = revokeSpendAllowanceRequest(env.chainId, positions);
    setLast({ kind: "freeze" });
    const result = await trace.run(userSender(client, address, account.settings.faceId), request, {
      preflight: gas.preflight(request),
    });
    if (result?.final?.stage === "finalized") await refresh();
  };

  const setLimit = async (dailyUsd6: bigint) => {
    if (!account.client || !address) return;
    const expiry = BigInt(Date.now()) / MS_PER_SECOND + ALLOWANCE_DAYS * SECONDS_PER_DAY;
    setLast({ kind: "limit", dailyUsd6 });
    const result = await requestStepUp(
      {
        title: `Let Kinpaku spend up to ${usd(dailyUsd6, 0)} a day`,
        detail: `For ${ALLOWANCE_DAYS} days, and only from Free to spend: never from what your positions need. Card limits always ask for a fresh passkey check.`,
        confirmLabel: "Set limit with passkey",
      },
      () =>
        account.stepUp(async (signer) => {
          if (!signer.signTypedData) throw new Error("Signer cannot sign typed data");
          const nonce = await readAllowanceNonce(sharedRead(env.chainId), env.chainId, address);
          const signature = await signer.signTypedData(
            spendAllowanceTypedData(env.chainId, address, dailyUsd6, expiry, nonce),
          );
          const request = setSpendAllowanceRequest(env.chainId, address, dailyUsd6, expiry, signature, positions);
          return trace.run(stepUpSender(signer), request, { preflight: gas.preflight(request) });
        }),
    );
    if (result?.final?.stage === "finalized") await refresh();
  };

  const stage = trace.events.at(-1)?.stage;
  /** The finalized result in words, or undefined while nothing has finalized. */
  const done =
    !trace.running && stage === "finalized" && last
      ? last.kind === "freeze"
        ? "Frozen · finalized. The card can’t spend until you set a new limit."
        : `Limit set to ${usd(last.dailyUsd6, 0)} a day · finalized.`
      : undefined;
  return { trace, freeze, setLimit, done, ready: account.client !== undefined };
}
