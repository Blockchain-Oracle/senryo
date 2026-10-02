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
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { ChildSheet } from "~/components/sheet/ChildSheet";
import { AssetPicker } from "~/features/money/AssetPicker";
import { useAmountInput } from "~/features/money/amount";
import { type MoneyAsset, spendableOf } from "~/features/money/assets";
import { amountOf } from "~/features/money/format";
import { RECIPIENT_WORDS, useRecipientCheck } from "~/features/money/recipient";
import { useMoneyAssets } from "~/features/money/useMoneyAssets";
import { useMoneyOperation } from "~/features/money/useMoneyOperation";
import { SEND_WORDS } from "~/features/withdraw/words";
import { useAccount } from "~/lib/account/provider";
import { ROUTES, withdrawRoute } from "~/lib/constants/routes";
import { useNetwork } from "~/lib/network";
import { useReviewGuard } from "~/lib/review-guard";
import { STORAGE_KEYS, storage } from "~/lib/storage";
import { SPACE, TYPE, useTheme } from "~/theme";
import { AmountStep } from "./AmountStep";
import { MoveReview } from "./MoveReview";
import { feeEstimate, moveOperation, type ReviewedMove, reviewMove } from "./move";
import { usePeople } from "./people";
import { type PickedRecipient, RecipientStep } from "./RecipientStep";

const FEE_STALE_MS = 15_000;

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
  const [recipient, setRecipient] = useState<PickedRecipient>();
  const [assetKey, setAssetKey] = useState(initialAsset);
  const [sheet, setSheet] = useState<"amount" | "picker" | "review" | undefined>();
  const [reviewed, setReviewed] = useState<ReviewedMove>();
  const [block, setBlock] = useState<string>();
  const [busy, setBusy] = useState(false);
  const check = useRecipientCheck(me, recipient?.address, known);
  const guard = useReviewGuard(reviewed?.key ?? "");
  const practice = network.key === "testnet";
  const asset =
    (assetKey ? money.find(assetKey) : undefined) ??
    (recipient?.payment?.token ? money.find(recipient.payment.token) : undefined) ??
    money.assets[0];
  const fee = useQuery({
    queryKey: ["send-fee", reviewed?.key ?? ""],
    queryFn: () => feeEstimate(env, me, reviewed as ReviewedMove),
    enabled: reviewed !== undefined && !practice,
    staleTime: FEE_STALE_MS,
  });

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
    setSheet("amount");
  };
  const review = (a: MoneyAsset, amount: bigint) => {
    if (!recipient) return;
    setBlock(undefined);
    setReviewed(
      reviewMove(env.chainId, "send", a, amount, recipient.address, recipient.handle, recipient.label, bitmap),
    );
    setSheet("review");
  };
  const confirm = async () => {
    if (!reviewed) return;
    setBusy(true);
    try {
      const op = moveOperation(env, me, reviewed, network.name, known, guard);
      const fees = await runner.checkFees(op);
      if (!fees.ok) {
        setBlock("Add MON for fees");
        return;
      }
      await runner.run(op);
    } catch (error) {
      setBlock(error instanceof Error ? error.message.split("\n")[0] : "Couldn’t prepare the send");
    } finally {
      setBusy(false);
    }
  };
  const done = () => {
    runner.reset();
    setReviewed(undefined);
    setSheet(undefined);
    setRecipient(undefined);
  };
  const toTrades = () => {
    storage.set(STORAGE_KEYS.homeTab, "positions");
    router.navigate(ROUTES.home);
  };

  return (
    <View style={styles.fill}>
      <RecipientStep people={people} loading={loading} initial={initialTo ?? ""} onPick={pick} />
      <ChildSheet
        open={sheet === "amount"}
        onClose={() => setSheet(undefined)}
        title={`Send to ${recipient?.label ?? ""}`}
      >
        {verdict?.block ? (
          <View style={styles.blocked}>
            <Text style={[TYPE.rowTitle, styles.center, { color: color.down }]}>{RECIPIENT_WORDS[verdict.block]}</Text>
            {verdict.block === "self" ? (
              <Button label="Withdraw instead" onPress={() => router.replace(withdrawRoute(asset?.key))} />
            ) : null}
          </View>
        ) : asset ? (
          <AmountBody
            key={asset.key}
            asset={asset}
            warnings={warnings}
            checking={check.isLoading}
            prefill={recipient?.payment?.amount}
            onAsset={() => setSheet("picker")}
            onTrades={toTrades}
            onReview={(amount) => review(asset, amount)}
          />
        ) : (
          <Text style={[TYPE.rowDetail, styles.center, { color: color.text3 }]}>Nothing to send yet</Text>
        )}
      </ChildSheet>
      <ChildSheet open={sheet === "picker"} onClose={() => setSheet("amount")} title="Asset">
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
            setSheet("amount");
          }}
        />
      </ChildSheet>
      <ChildSheet
        open={sheet === "review"}
        onClose={() => (runner.trace.running ? undefined : setSheet(reviewed ? "amount" : undefined))}
        title={runner.trace.events.length > 0 ? "Send" : "Review"}
      >
        <MoveReview
          move={reviewed}
          runner={runner}
          avatar={recipient?.avatar ?? null}
          fee={fee.data}
          practice={practice}
          network={network.name}
          warnings={warnings}
          block={block}
          busy={busy}
          words={SEND_WORDS}
          onConfirm={() => void confirm()}
          onDone={done}
          onLeave={() => router.back()}
        />
      </ChildSheet>
    </View>
  );
}

function AmountBody({
  asset,
  warnings,
  checking,
  prefill,
  onAsset,
  onTrades,
  onReview,
}: {
  asset: MoneyAsset;
  warnings: readonly string[];
  checking: boolean;
  prefill: bigint | undefined;
  onAsset: () => void;
  onTrades: () => void;
  onReview: (amount: bigint) => void;
}) {
  const available = spendableOf(asset);
  const input = useAmountInput(asset.decimals, asset.priceUsd18, available, prefill);
  const locked = asset.trading - asset.tradingFree;
  return (
    <AmountStep
      asset={asset}
      input={input}
      available={available}
      locked={locked > 0n ? { text: `${amountOf(asset, locked)} in trades`, onPress: onTrades } : undefined}
      warnings={warnings}
      blocked={checking ? "Checking the address" : undefined}
      onAsset={onAsset}
      onReview={() => onReview(input.amount)}
    />
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  blocked: { gap: SPACE.lg, paddingVertical: SPACE.lg },
  center: { textAlign: "center" },
});
