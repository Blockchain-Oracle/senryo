import { addressOf, contractCall, erc20Abi, externalCall } from "@senryo/chain";
import { positionCount, positionGasLimit } from "@senryo/config";
import { collateralId } from "@senryo/identity";
import {
  type CollateralSymbol,
  collateralTokenOf,
  operationKey,
  traceOutcome,
  useAccountRisk,
  useQueryEnv,
  useSendTrace,
  useWalletCollateral,
} from "@senryo/query";
import { useState } from "react";
import { Text, View } from "react-native";
import { MarkedLine } from "~/components/identity/MarkedLine";
import { Segmented } from "~/components/kit/Segmented";
import { HoldToConfirm } from "~/components/trade/HoldToConfirm";
import { OperationSummary } from "~/components/trade/OperationSummary";
import { useEnsureGas } from "~/features/trade/useGasTopUp";
import { AmountEntry } from "~/features/withdraw/AmountEntry";
import { useAmountDraft } from "~/features/withdraw/amount-draft";
import { useAccount } from "~/lib/account/provider";
import { stepUpSender, userSender } from "~/lib/account/sender";
import { requestStepUp } from "~/lib/account/step-up";
import { usd } from "~/lib/money";
import { useReviewGuard } from "~/lib/review-guard";
import { validateMoney } from "~/lib/validate-money";
import { SPACE, TYPE, useTheme } from "~/theme";

const TOKENS = [
  { value: "AUSD", label: "AUSD" },
  { value: "USDC", label: "USDC" },
] as const;
export function WalletFunding() {
  const { color } = useTheme();
  const env = useQueryEnv();
  const account = useAccount();
  const address = account.hint?.address;
  const wallet = useWalletCollateral(address);
  const risk = useAccountRisk(address);
  const [error, setError] = useState<string>();
  const [symbol, setSymbol] = useState<CollateralSymbol>("AUSD");
  const balances = wallet.status === "fresh" || wallet.status === "stale" ? wallet.value : undefined;
  const snapshot = risk.status === "fresh" || risk.status === "stale" ? risk.value : undefined;
  const draft = useAmountDraft(balances?.[symbol] ?? 0n, `wallet-funding:${env.chainId}:${address}:${symbol}`);
  const trace = useSendTrace(operationKey(env.chainId, address, "wallet-to-trading"));
  const gas = useEnsureGas();
  const guard = useReviewGuard([env.chainId, address, symbol, draft.amount].join(":"));
  const send = async () => {
    if (!address || !snapshot || !account.client || draft.amount <= 0n || draft.over) return;
    const amount = draft.amount;
    const token = collateralTokenOf(env.chainId, symbol);
    const core = addressOf(env.chainId, "SenryoCore");
    const allowance = await env.read.readContract({
      address: token,
      abi: erc20Abi,
      functionName: "allowance",
      args: [address, core],
    });
    guard();
    const needsApproval = allowance < amount;
    const validate = async () => {
      guard();
      await validateMoney(env, address, "wallet", symbol, amount);
      guard();
    };
    const intent = { amount: amount.toString(), symbol, source: "wallet", recipient: address, destination: "trading" };
    const move = async (sender: ReturnType<typeof userSender>) => {
      let operationId: string | undefined;
      if (needsApproval) {
        const request = externalCall(token, erc20Abi, "approve", [core, amount], "approve");
        const approved = await trace.run(sender, request, {
          preflight: gas.preflight(request),
          revalidate: validate,
          reviewedIntent: intent,
          plannedActions: ["approve", "deposit"],
        });
        if (approved?.final?.stage !== "finalized") return;
        operationId = approved.operationId;
      }
      const request = contractCall(env.chainId, "SenryoCore", "deposit", [token, amount], "deposit", {
        gasCap: positionGasLimit("deposit", positionCount(snapshot.positionBitmap)),
      });
      await trace.run(sender, request, {
        preflight: gas.preflight(request),
        revalidate: validate,
        reviewedIntent: intent,
        operationId,
      });
    };
    if (needsApproval)
      await requestStepUp(
        {
          title: `Move ${usd(amount)} ${symbol} into trading`,
          detail: "Approve this amount, then move it from your wallet to your own trading account.",
          confirmLabel: "Confirm with passkey",
        },
        () => account.stepUp((signer) => move(stepUpSender(signer))),
      );
    else await move(userSender(account.client, address, account.settings.faceId));
  };
  return (
    <View style={{ gap: SPACE.lg }}>
      <Segmented options={TOKENS} value={symbol} onChange={setSymbol} label="Asset to move" />
      <MarkedLine
        id={collateralId(env.chainId, symbol)}
        label={`${symbol} · Your wallet`}
        value={balances ? usd(balances[symbol]) : "Reading…"}
      />
      <AmountEntry draft={draft} max={balances?.[symbol] ?? 0n} symbol={symbol} label="Amount to move into trading" />
      <Text style={[TYPE.rowDetail, { color: color.text3 }]}>Wallet → Your trading account</Text>
      <HoldToConfirm
        label="Move into trading"
        resetKey={[env.chainId, address, symbol, draft.amount].join(":")}
        disabled={
          !snapshot ||
          !account.client ||
          draft.amount <= 0n ||
          draft.over ||
          trace.running ||
          traceOutcome(trace.events) === "unknown"
        }
        onConfirm={() => {
          setError(undefined);
          void send().catch(() => setError("The transfer could not be prepared. Review the balance and try again."));
        }}
      />
      {error ? (
        <Text accessibilityRole="alert" style={[TYPE.rowDetail, { color: color.warn }]}>
          {error}
        </Text>
      ) : null}
      <OperationSummary record={trace.record} />
    </View>
  );
}
