/**
 * The card's onchain controls (CardModule), on one trace:
 * - `freeze()` revokes the spend allowance (E-D3, D-039): session scope, since it only lowers what the card can spend;
 * - `setLimit(daily)` signs a new `SpendAllowance` for `ALLOWANCE_DAYS` (a card setting: behind a fresh passkey check,
 *   one-shot signer) and sends `setSpendAllowance` with it.
 * Both resolve with the trace result (undefined when the passkey sheet was dismissed); the snapshot refreshes when one
 * finalizes. The reviewed intent (limit, expiry, account) is recorded on the operation and never changes after review.
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
  const trace = useSendTrace(`card-allowance:${env.chainId}:${account.hint?.address ?? "guest"}`);
  const gas = useEnsureGas();
  const queryClient = useQueryClient();
  const address = account.hint?.address;
  const positions = snapshot ? positionCount(snapshot.positionBitmap) : 0;
  const refresh = () =>
    address ? queryClient.invalidateQueries({ queryKey: keys.account(env.chainId, address) }) : undefined;

  const freeze = async () => {
    const client = account.client;
    if (!client || !address) return undefined;
    const request = revokeSpendAllowanceRequest(env.chainId, positions);
    const result = await trace.run(userSender(client, address, account.settings.faceId), request, {
      preflight: gas.preflight(request),
      reviewedIntent: { dailyUsd6: "0", account: address },
    });
    if (result?.final?.stage === "finalized") await refresh();
    return result;
  };

  const setLimit = async (dailyUsd6: bigint, guard: () => void) => {
    if (!account.client || !address) return undefined;
    const expiry = BigInt(Date.now()) / MS_PER_SECOND + ALLOWANCE_DAYS * SECONDS_PER_DAY;
    const result = await requestStepUp(
      {
        title: `Set a ${usd(dailyUsd6, 0)} daily limit`,
        detail: `For ${ALLOWANCE_DAYS} days, from your free balance only.`,
        confirmLabel: "Set limit with passkey",
      },
      () =>
        account.stepUp(async (signer) =>
          trace.run(
            stepUpSender(signer),
            async () => {
              if (!signer.signTypedData) throw new Error("Signer cannot sign typed data");
              guard();
              const nonce = await readAllowanceNonce(sharedRead(env.chainId), env.chainId, address);
              const signature = await signer.signTypedData(
                spendAllowanceTypedData(env.chainId, address, dailyUsd6, expiry, nonce),
              );
              return setSpendAllowanceRequest(env.chainId, address, dailyUsd6, expiry, signature, positions);
            },
            {
              builderAction: "setSpendAllowance",
              preflight: (request) => gas.preflight(request)(),
              revalidate: guard,
              reviewedIntent: { dailyUsd6: dailyUsd6.toString(), expiry: expiry.toString(), account: address },
            },
          ),
        ),
    );
    if (result?.final?.stage === "finalized") await refresh();
    return result;
  };

  return { trace, freeze, setLimit, ready: account.client !== undefined };
}
