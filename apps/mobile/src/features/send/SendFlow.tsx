/**
 * Send any asset to a person or an address on Monad (flow book B7; plan §0.9 "Send"; Phantom grammar). The page is
 * the recipient step; the amount, the asset picker and the review are child sheets over it, so this screen — and its
 * review guard — stays mounted from the first tap to the receipt. Picking someone runs the checks: a typo or a
 * deposit inbox blocks, your own address goes to Withdraw, a contract or a first send warns. The send pulls a dollar
 * asset's free trading part when the wallet alone is short, keeps MON's fee reserve, re-resolves an @handle and
 * re-checks everything before the passkey signs, and never sends twice.
 */
import { isDeployed } from "@senryo/chain";
import { useAccountRisk, useQueryEnv } from "@senryo/query";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { ChildSheet } from "~/components/sheet/ChildSheet";
import { AssetPicker } from "~/features/money/AssetPicker";
import { useAmountInput } from "~/features/money/amount";
import { type MoneyAsset, spendableOf } from "~/features/money/assets";
import { amountOf } from "~/features/money/format";
import { RECIPIENT_WORDS, useRecipientCheck } from "~/features/money/recipient";
import { useMoneyAssets } from "~/features/money/useMoneyAssets";
import { useMoneyOperation, usePreparedOperation } from "~/features/money/useMoneyOperation";
import { useReviewedFee } from "~/features/money/useReviewedFee";
import { SEND_WORDS } from "~/features/withdraw/words";
import { useAccount } from "~/lib/account/provider";
import { ROUTES, withdrawRoute } from "~/lib/constants/routes";
import { useNetwork } from "~/lib/network";
import { useReviewGuard } from "~/lib/review-guard";
import { STORAGE_KEYS, storage } from "~/lib/storage";
import { SPACE, TYPE, useTheme } from "~/theme";
import { MoveReview } from "./MoveReview";
import { feeEstimate, moveOperation, type ReviewedMove, reviewMove } from "./move";
import { usePeople } from "./people";
import { type PickedRecipient, RecipientStep } from "./RecipientStep";
import { SendIntro } from "./SendIntro";
import { SendWorkspace } from "./SendWorkspace";

const DEFAULT_ASSET_DECIMALS = 18;

export function SendFlow({ initialAsset, initialTo }: { initialAsset?: string; initialTo?: string }) {
  const { color } = useTheme();
  const env = useQueryEnv();
  const network = useNetwork();
  const me = useAccount().hint?.address as `0x${string}`;
  const money = useMoneyAssets();
  const { people, known, loading } = usePeople(me);
  const runner = useMoneyOperation(`send:${env.chainId}:${me.toLowerCase()}`);
  const risk = useAccountRisk(isDeployed(env.chainId, "SenryoCore") ? me : undefined, "latest");
  const bitmap = risk.status === "fresh" || risk.status === "stale" ? risk.value.positionBitmap : 0;
  const [introduced, setIntroduced] = useState(initialTo !== undefined);
  const [recipientDraft, setRecipientDraft] = useState(initialTo ?? "");
  const [recipient, setRecipient] = useState<PickedRecipient>();
  const [assetKey, setAssetKey] = useState(initialAsset);
  const [sheet, setSheet] = useState<"amount" | "recipient" | "picker" | "review" | undefined>();
  const reviewSerial = useRef(0);
  const [reviewed, setReviewed] = useState<ReviewedMove>();
  const [block, setBlock] = useState<string>();
  const [busy, setBusy] = useState(false);
  const check = useRecipientCheck(me, recipient?.address, known);
  const guard = useReviewGuard(`${runner.reviewKey}:${sheet}:${reviewed?.key ?? ""}`);
  const practice = network.key === "testnet";
  const asset =
    (assetKey ? money.find(assetKey) : undefined) ??
    (recipient?.payment?.token ? money.find(recipient.payment.token) : undefined) ??
    money.assets[0];
  const draft = useAmountInput(
    asset?.decimals ?? DEFAULT_ASSET_DECIMALS,
    asset?.priceUsd18 ?? null,
    asset ? spendableOf(asset) : 0n,
  );
  useEffect(() => {
    draft.reset();
  }, [asset?.key]);
  useEffect(() => {
    const payment = recipient?.payment;
    if (payment?.amount && (!payment.token || payment.token.toLowerCase() === asset?.key))
      draft.fillUnits(payment.amount);
  }, [recipient?.payment, asset?.key]);
  // B11: the network fee is planned with the review — MON on hand, or a "~$0.50 → MON" step first in Details.
  const prepared = usePreparedOperation(runner, reviewed ? `${guard.key}:${reviewed.key}` : undefined, () =>
    reviewed ? moveOperation(env, me, reviewed, network.name, known, guard) : undefined,
  );
  const plan = prepared.data;
  const steps = plan?.ok ? plan.op.steps : reviewed?.steps;
  const fee = useReviewedFee(plan?.ok ? plan.op : undefined, prepared.isFetching, practice, (steps) =>
    feeEstimate(env, me, steps),
  );

  useEffect(() => {
    if (!runner.trace.running && runner.trace.events.length === 0) {
      setReviewed(undefined);
      setSheet((current) => (current === "review" ? undefined : current));
    }
  }, [runner.reviewKey]);

  // A send restored from the journal (the app was killed after the slide) opens straight on its outcome.
  useEffect(() => {
    if (runner.trace.events.length > 0 || runner.trace.running) setSheet("review");
  }, [runner.trace.events.length, runner.trace.running]);

  const verdict = check.data;
  const warnings = [
    ...(verdict?.warnings ?? []).map((w) => RECIPIENT_WORDS[w]),
    ...(asset && !asset.verified ? ["Unverified token · send anyway?"] : []),
    ...(recipient?.payment?.chainId !== undefined && recipient.payment.chainId !== env.chainId
      ? [`Code is for chain ${recipient.payment.chainId}`]
      : []),
  ];
  const pick = (r: PickedRecipient) => {
    setRecipient(r);
    if (r.payment?.token) setAssetKey(r.payment.token.toLowerCase());
    setSheet(undefined);
  };
  const review = (a: MoneyAsset, amount: bigint) => {
    if (!recipient) return;
    setBlock(undefined);
    const move = reviewMove(
      env.chainId,
      "send",
      a,
      amount,
      recipient.address,
      recipient.handle,
      recipient.label,
      bitmap,
    );
    setReviewed({ ...move, key: `${runner.reviewKey}:${++reviewSerial.current}:${move.key}` });
    setSheet("review");
  };
  const confirm = async () => {
    if (!reviewed) return;
    setBusy(true);
    try {
      guard();
      const op = fee.require();
      await runner.run(op);
    } catch (error) {
      setBlock(error instanceof Error ? error.message.split("\n")[0] : "Couldn’t prepare the send");
    } finally {
      setBusy(false);
    }
  };
  const done = () => {
    const completed = runner.trace.record?.outcome === "completed";
    runner.reset();
    setReviewed(undefined);
    setSheet(undefined);
    if (completed) {
      setRecipient(undefined);
      draft.reset();
    }
  };

  return (
    <View style={styles.fill}>
      {!introduced && runner.trace.events.length === 0 && !runner.trace.running ? (
        <SendIntro network={network.name} onContinue={() => setIntroduced(true)} />
      ) : asset ? (
        <SendWorkspace
          asset={asset}
          input={draft}
          recipient={recipient?.label}
          network={network.name}
          warnings={recipient ? warnings : []}
          block={
            recipient && verdict?.block
              ? RECIPIENT_WORDS[verdict.block]
              : recipient && check.isLoading
                ? "Checking the address"
                : undefined
          }
          onTrades={() => {
            storage.set(STORAGE_KEYS.homeTab, "positions");
            router.navigate(ROUTES.home);
          }}
          onAsset={() => setSheet("picker")}
          onRecipient={() => setSheet("recipient")}
          onReview={() => review(asset, draft.amount)}
        />
      ) : (
        <Text style={[TYPE.rowDetail, styles.center, { color: color.text3 }]}>Nothing to send yet</Text>
      )}
      {verdict?.block === "self" ? (
        <Button label="Withdraw instead" onPress={() => router.replace(withdrawRoute(asset?.key))} />
      ) : null}
      <ChildSheet open={sheet === "recipient"} onClose={() => setSheet(undefined)} title="Send to">
        <RecipientStep
          people={people}
          loading={loading}
          initial={initialTo ?? ""}
          value={recipientDraft}
          onChange={setRecipientDraft}
          onPick={pick}
        />
      </ChildSheet>
      <ChildSheet open={sheet === "picker"} onClose={() => setSheet(undefined)} title="Asset">
        <AssetPicker
          assets={money.assets}
          other={money.other}
          selectedKey={asset?.key}
          reasonFor={(a) =>
            spendableOf(a) > 0n ? undefined : a.native && a.wallet > 0n ? "Keeps 10 MON for fees" : "None to send"
          }
          detailFor={(a) => `Available ${amountOf(a, spendableOf(a))}`}
          onPick={(a) => {
            setAssetKey(a.key);
            setSheet(undefined);
          }}
        />
      </ChildSheet>
      <ChildSheet
        open={sheet === "review"}
        onClose={() => (runner.trace.running ? undefined : setSheet(undefined))}
        title={runner.trace.events.length > 0 ? "Send" : "Review"}
      >
        <MoveReview
          move={reviewed}
          steps={steps}
          runner={runner}
          avatar={recipient?.avatar ?? null}
          fee={fee.fee}
          feeTopUp={plan?.ok ? plan.op.reviewedIntent.networkFee : undefined}
          practice={practice}
          network={network.name}
          warnings={warnings}
          block={
            block ??
            fee.block ??
            (prepared.isError ? "Couldn’t prepare the send. Review again." : undefined) ??
            (plan && !plan.ok ? plan.block : undefined)
          }
          busy={busy || prepared.isPending || prepared.isFetching || fee.busy}
          words={SEND_WORDS}
          onReviewAgain={() => asset && review(asset, draft.amount)}
          onConfirm={() => void confirm()}
          onDone={done}
          onLeave={() => router.back()}
        />
      </ChildSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  blocked: { gap: SPACE.lg, paddingVertical: SPACE.lg },
  center: { textAlign: "center" },
});
