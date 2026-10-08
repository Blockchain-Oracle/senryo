/**
 * Withdraw any asset (flow book B8–B10; plan §0.9 "Withdraw"): the page lists every holding (step 1); where to,
 * the amount and the review are child sheets over it, so the screen and its review guard stay mounted to the receipt.
 * Monad: to a saved destination or a new address (paste / scan), checked like a send (a typo or an inbox blocks), one
 * passkey for [pull from trades]? → transfer, then "Save as…". Another chain: the asset's routes (or "Swap to USDC
 * and withdraw" as one operation), the quote, one passkey, the timeline. Bank: pending Ramp's off-ramp key.
 */
import { isDeployed } from "@senryo/chain";
import { assertBridgeExecution, stepsLine, useAccountRisk, useQueryEnv } from "@senryo/query";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { ChildSheet } from "~/components/sheet/ChildSheet";
import { PositionRowsSkeleton } from "~/features/home/HomeParts";
import { AssetRow } from "~/features/money/AssetRow";
import { useAmountInput } from "~/features/money/amount";
import { type MoneyAsset, spendableOf } from "~/features/money/assets";
import { amountOf } from "~/features/money/format";
import { RECIPIENT_WORDS, useRecipientCheck } from "~/features/money/recipient";
import { Scanner } from "~/features/money/Scanner";
import { useMoneyAssets } from "~/features/money/useMoneyAssets";
import { useMoneyOperation, usePreparedOperation } from "~/features/money/useMoneyOperation";
import { QuietLine } from "~/features/portfolio/QuietLine";
import { AmountStep } from "~/features/send/AmountStep";
import { MoveReview } from "~/features/send/MoveReview";
import { checkSource, feeEstimate, moveOperation, type ReviewedMove, reviewMove } from "~/features/send/move";
import { usePeople } from "~/features/send/people";
import { useAccount } from "~/lib/account/provider";
import { ROUTES } from "~/lib/constants/routes";
import { useNetwork } from "~/lib/network";
import { useReviewGuard } from "~/lib/review-guard";
import { STORAGE_KEYS, storage } from "~/lib/storage";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { ChainReview, type ChainTarget, useChainPlan } from "./ChainReview";
import { type ChainPlan, chainOperation, chainSteps } from "./chain-withdraw";
import { DestinationStep, type DestinationTab } from "./DestinationStep";
import { useDestinations } from "./destinations";
import { SaveDestination } from "./SaveDestination";
import { WITHDRAW_WORDS } from "./words";

type Sheet = "to" | "amount" | "review" | "chain" | undefined;
type Dest =
  | { kind: "monad"; address: `0x${string}`; label: string }
  | { kind: "chain"; target: Omit<ChainTarget, "amount" | "asset"> };

const DEFAULT_ASSET_DECIMALS = 18;
const MS_PER_SECOND = 1000;

export function WithdrawFlow({ initialAsset, initialTab }: { initialAsset?: string; initialTab?: DestinationTab }) {
  const { color } = useTheme();
  const env = useQueryEnv();
  const queries = useQueryClient();
  const network = useNetwork();
  const me = useAccount().hint?.address as `0x${string}`;
  const money = useMoneyAssets();
  const { known } = usePeople(me);
  const destinations = useDestinations(env.chainId, me);
  const monad = useMoneyOperation(`withdraw:${env.chainId}:${me.toLowerCase()}`);
  const bridge = useMoneyOperation(`withdraw-chain:${env.chainId}:${me.toLowerCase()}`);
  const risk = useAccountRisk(isDeployed(env.chainId, "SenryoCore") ? me : undefined, "latest");
  const bitmap = risk.status === "fresh" || risk.status === "stale" ? risk.value.positionBitmap : 0;
  const practice = network.key === "testnet";
  const [assetKey, setAssetKey] = useState(initialAsset);
  const [tab, setTab] = useState<DestinationTab>(initialTab ?? "monad");
  const [sheet, setSheet] = useState<Sheet>(initialAsset ? "to" : undefined);
  const [dest, setDest] = useState<Dest>();
  const reviewSerial = useRef(0);
  const [reviewed, setReviewed] = useState<ReviewedMove>();
  const [target, setTarget] = useState<ChainTarget>();
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState<string>();
  const [block, setBlock] = useState<string>();
  const [busy, setBusy] = useState(false);
  const asset = assetKey ? money.find(assetKey) : undefined;
  const draft = useAmountInput(
    asset?.decimals ?? DEFAULT_ASSET_DECIMALS,
    asset?.priceUsd18 ?? null,
    asset ? spendableOf(asset) : 0n,
  );
  useEffect(() => {
    draft.reset();
  }, [asset?.key]);
  const monadTo = dest?.kind === "monad" ? dest.address : undefined;
  const check = useRecipientCheck(me, monadTo, known);
  const [frozenChain, setFrozenChain] = useState<ChainPlan>();
  const livePlan = useChainPlan(sheet === "chain" ? target : undefined, me);
  const plan = frozenChain ?? livePlan;
  useEffect(() => {
    if (
      sheet === "chain" &&
      target &&
      typeof livePlan === "object" &&
      !frozenChain &&
      (livePlan.bridge.expiresAt === null || livePlan.bridge.expiresAt * MS_PER_SECOND > Date.now())
    )
      setFrozenChain(livePlan);
  }, [sheet, target, livePlan, frozenChain]);
  const targetKey = target
    ? [
        monad.reviewKey,
        reviewSerial.current,
        target.asset.key,
        target.amount,
        target.chain.chainId,
        target.recipient,
      ].join(":")
    : "";
  const guard = useReviewGuard(`${monad.reviewKey}:${sheet}:${sheet === "chain" ? targetKey : (reviewed?.key ?? "")}`);
  // B11: each review plans its network fee — MON on hand, or a "~$0.50 → MON" step first in Details.
  const preparedMove = usePreparedOperation(monad, reviewed ? `${guard.key}:${reviewed.key}` : undefined, () =>
    reviewed ? moveOperation(env, me, reviewed, network.name, known, guard) : undefined,
  );
  const chainReady = sheet === "chain" && typeof plan === "object" ? plan : undefined;
  const preparedChain = usePreparedOperation(
    bridge,
    chainReady
      ? `${guard.key}:${targetKey}:${chainReady.bridge.provider}:${chainReady.bridge.tracking.id}:${chainReady.bridge.expiresAt}:${chainReady.bridge.minReceived}:${chainReady.swap?.quote.router ?? ""}:${chainReady.swap?.quote.minOut ?? ""}`
      : undefined,
    async () => (chainReady ? chainOp(chainReady) : undefined),
  );
  const chainStepsPrepared = preparedChain.data?.ok ? preparedChain.data.op.steps : undefined;
  const chainFee = useQuery({
    queryKey: [
      "withdraw-chain-fee",
      guard.key,
      targetKey,
      preparedChain.data?.ok ? preparedChain.data.op.reviewedIntent.reviewId : "",
    ],
    queryFn: () => feeEstimate(env, me, chainStepsPrepared ?? []),
    enabled: chainStepsPrepared !== undefined && !practice,
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const moveSteps = preparedMove.data?.ok ? preparedMove.data.op.steps : reviewed?.steps;
  const fee = useQuery({
    queryKey: ["withdraw-fee", reviewed?.key ?? "", moveSteps?.length ?? 0],
    queryFn: () => feeEstimate(env, me, moveSteps ?? []),
    enabled: moveSteps !== undefined && !practice,
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  useEffect(() => {
    if (!monad.trace.running && monad.trace.events.length === 0) {
      setReviewed(undefined);
      setSheet((current) => (current === "review" || current === "chain" ? "amount" : current));
      setFrozenChain(undefined);
      setTarget(undefined);
    }
  }, [monad.reviewKey]);

  // A withdrawal restored from the journal (killed after the slide) opens on its outcome.
  useEffect(() => {
    if (monad.trace.events.length > 0 || monad.trace.running) setSheet("review");
    else if (bridge.trace.events.length > 0 || bridge.trace.running) setSheet("chain");
  }, [monad.trace.events.length, monad.trace.running, bridge.trace.events.length, bridge.trace.running]);

  const verdict = dest?.kind === "monad" ? check.data : undefined;
  const warnings = [
    ...(verdict?.warnings ?? []).map((w) => RECIPIENT_WORDS[w]),
    ...(asset && !asset.verified ? ["Unverified token"] : []),
  ];
  const toAmount = (next: Dest) => {
    setDest(next);
    setScanned(undefined);
    setBlock(undefined);
    setSheet("amount");
  };
  const review = (a: MoneyAsset, amount: bigint) => {
    setBlock(undefined);
    if (dest?.kind === "monad") {
      const move = reviewMove(env.chainId, "withdraw", a, amount, dest.address, null, dest.label, bitmap);
      setReviewed({ ...move, key: `${monad.reviewKey}:${++reviewSerial.current}:${move.key}` });
      setSheet("review");
    } else if (dest?.kind === "chain") {
      setFrozenChain(undefined);
      reviewSerial.current += 1;
      setTarget({ ...dest.target, asset: a, amount });
      setSheet("chain");
    }
  };
  /** The reviewed withdrawal to another chain as one operation (the source re-checked before its first step). */
  async function chainOp(p: ChainPlan) {
    const steps = await chainSteps(env, me, p, bitmap);
    const op = chainOperation(p, steps, network.name, async (step) => {
      guard();
      assertBridgeExecution(p.bridge.expiresAt, Date.now());
      if (step === 0) await checkSource(env, me, p.asset, p.amount);
      guard();
    });
    const split = p.asset.wallet < p.amount ? p.asset.wallet : p.amount;
    return { ...op, spends: { [p.asset.key]: split } };
  }
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (error) {
      setBlock(
        error instanceof Error ? (error.message.split("\n")[0] ?? "Couldn’t prepare it") : "Couldn’t prepare it",
      );
    } finally {
      setBusy(false);
    }
  };
  const confirmMonad = () =>
    run(async () => {
      if (!reviewed) return;
      const ready = preparedMove.data ?? (await preparedMove.refetch()).data;
      if (!ready?.ok) return setBlock(ready?.block ?? "Couldn’t prepare it");
      await monad.run(ready.op);
    });
  const confirmChain = (p: ChainPlan) =>
    run(async () => {
      const ready = preparedChain.data ?? (await bridge.prepare(await chainOp(p)));
      if (!ready.ok) return setBlock(ready.block);
      await bridge.run(ready.op);
    });
  const done = () => {
    monad.reset();
    bridge.reset();
    setReviewed(undefined);
    setTarget(undefined);
    setFrozenChain(undefined);
    setSheet(undefined);
  };
  const toTrades = () => {
    storage.set(STORAGE_KEYS.homeTab, "positions");
    router.navigate(ROUTES.home);
  };
  const savedTo = monadTo ? destinations.find(monadTo, env.chainId) : undefined;
  const finished = monad.trace.events.some((e) => e.stage === "finalized") && !monad.trace.running;

  return (
    <View style={styles.fill}>
      <ScrollView contentContainerStyle={styles.list}>
        {money.status === "loading" ? (
          <PositionRowsSkeleton rows={3} />
        ) : money.assets.length + money.other.length === 0 ? (
          <QuietLine action={{ label: "Add money", onPress: () => router.push(ROUTES.addMoney) }}>
            Nothing to withdraw
          </QuietLine>
        ) : (
          [...money.assets, ...money.other].map((a, i) => (
            <AssetRow
              key={a.key}
              asset={a}
              index={i}
              disabledReason={
                spendableOf(a) > 0n
                  ? undefined
                  : a.native && a.wallet > 0n
                    ? "Keeps 10 MON for fees"
                    : "None to withdraw"
              }
              onPress={() => {
                setAssetKey(a.key);
                setSheet("to");
              }}
            />
          ))
        )}
      </ScrollView>
      <ChildSheet open={sheet === "to"} onClose={() => setSheet(undefined)} title={`Withdraw ${asset?.symbol ?? ""}`}>
        {asset ? (
          <DestinationStep
            asset={asset}
            tab={tab}
            onTab={setTab}
            saved={destinations.list}
            scanned={scanned}
            onScan={() => setScanning(true)}
            practice={practice}
            onMonad={(address, label) => toAmount({ kind: "monad", address, label })}
            onChain={(chain, recipient, composed) =>
              toAmount({ kind: "chain", target: { chain, recipient, composed } })
            }
          />
        ) : null}
      </ChildSheet>
      <ChildSheet
        open={sheet === "amount"}
        onClose={() => setSheet("to")}
        title={dest?.kind === "chain" ? `To ${dest.target.chain.name}` : `To ${dest?.label ?? ""}`}
      >
        {verdict?.block ? (
          <Text style={[TYPE.rowTitle, styles.center, { color: color.down }]}>{RECIPIENT_WORDS[verdict.block]}</Text>
        ) : asset ? (
          <WithdrawAmount
            key={asset.key}
            asset={asset}
            input={draft}
            warnings={warnings}
            checking={dest?.kind === "monad" && check.isLoading}
            onAsset={() => setSheet(undefined)}
            onTrades={toTrades}
            onReview={(amount) => review(asset, amount)}
          />
        ) : null}
      </ChildSheet>
      <ChildSheet
        open={sheet === "review"}
        onClose={() => (monad.trace.running ? undefined : setSheet(reviewed ? "amount" : undefined))}
        title={monad.trace.events.length > 0 ? "Withdraw" : "Review"}
      >
        <MoveReview
          move={reviewed}
          steps={moveSteps}
          runner={monad}
          avatar={null}
          fee={fee.data}
          feeTopUp={preparedMove.data?.ok ? preparedMove.data.op.reviewedIntent.networkFee : undefined}
          practice={practice}
          network={network.name}
          warnings={warnings}
          block={block ?? (preparedMove.data && !preparedMove.data.ok ? preparedMove.data.block : undefined)}
          busy={busy || (preparedMove.isFetching && !practice)}
          words={WITHDRAW_WORDS}
          onReviewAgain={() => asset && review(asset, draft.amount)}
          onConfirm={() => void confirmMonad()}
          onDone={done}
          onLeave={() => router.back()}
        />
        {finished && monadTo && !savedTo ? (
          <SaveDestination onSave={(name) => destinations.save({ name, address: monadTo, chainId: env.chainId })} />
        ) : null}
      </ChildSheet>
      <ChildSheet
        open={sheet === "chain"}
        onClose={() => (bridge.trace.running ? undefined : setSheet(target ? "amount" : undefined))}
        title={bridge.trace.events.length > 0 ? "Withdraw" : "Review"}
      >
        <ChainReview
          target={target}
          plan={plan}
          runner={bridge}
          networkFee={practice ? "Sponsored" : chainFee.data}
          feeTopUp={preparedChain.data?.ok ? preparedChain.data.op.reviewedIntent.networkFee : undefined}
          steps={
            preparedChain.data?.ok && preparedChain.data.op.steps.length > 1
              ? stepsLine(preparedChain.data.op.steps)
              : undefined
          }
          block={block ?? (preparedChain.data && !preparedChain.data.ok ? preparedChain.data.block : undefined)}
          busy={busy || preparedChain.isFetching}
          onReviewAgain={() => {
            void queries.invalidateQueries({ queryKey: ["bridge", "quote"] });
            void queries.invalidateQueries({ queryKey: ["swap"] });
            setFrozenChain(undefined);
            setTarget(undefined);
            setSheet("amount");
          }}
          onConfirm={(p) => void confirmChain(p)}
          onDone={done}
          onLeave={() => router.back()}
        />
      </ChildSheet>
      {scanning ? (
        <Scanner
          onClose={() => setScanning(false)}
          onScan={(payment) => {
            setScanning(false);
            setScanned(payment.address);
          }}
        />
      ) : null}
    </View>
  );
}

function WithdrawAmount({
  asset,
  input,
  warnings,
  checking,
  onAsset,
  onTrades,
  onReview,
}: {
  asset: MoneyAsset;
  input: ReturnType<typeof useAmountInput>;
  warnings: readonly string[];
  checking: boolean;
  onAsset: () => void;
  onTrades: () => void;
  onReview: (amount: bigint) => void;
}) {
  const available = spendableOf(asset);
  const locked = asset.trading - asset.tradingFree;
  return (
    <AmountStep
      asset={asset}
      input={input}
      available={available}
      locked={locked > 0n ? { text: `${amountOf(asset, locked)} backs open trades`, onPress: onTrades } : undefined}
      warnings={warnings}
      blocked={checking ? "Checking the address" : undefined}
      onAsset={onAsset}
      onReview={() => onReview(input.amount)}
    />
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  list: { padding: SIZE.gutter, gap: SPACE.xxs },
  center: { textAlign: "center", paddingVertical: SPACE.lg },
});
