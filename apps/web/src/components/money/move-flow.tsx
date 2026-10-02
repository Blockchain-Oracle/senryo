"use client";

/**
 * Send any asset to a person or address, or withdraw it to your own address or exchange, on Monad (flow book B7 / B8;
 * the phone's SendFlow and WithdrawFlow): recipient → asset + exact amount → review → slide + passkey → outcome. Picking
 * someone runs the checks — a typo or a deposit inbox blocks, your own address goes to Withdraw, a contract or a first
 * send warns. A dollar asset's free trading part is pulled when the wallet alone is short (one operation), MON keeps
 * its fee reserve, an @handle is re-resolved and everything re-checked right before the passkey signs, and it never
 * sends twice. The page stays mounted from the first step to the receipt, so its review guard holds.
 */
import { isDeployed } from "@senryo/chain";
import { formatUnits, parseUnits } from "@senryo/core";
import { useAccountRisk, useQueryEnv } from "@senryo/query";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { WithdrawToChain } from "@/components/bridge/withdraw-chain";
import { PageHeader } from "@/components/kit/page-header";
import { SEND_WORDS, type TraceWords } from "@/components/kit/trace-words";
import { Column } from "@/components/shell/column";
import { Button } from "@/components/ui/button";
import { known } from "@/components/ui/reading";
import { Skeleton } from "@/components/ui/skeleton";
import { useAccount } from "@/lib/account/provider";
import { useTermsAccepted } from "@/lib/account/terms";
import { ACTIVE_NETWORK } from "@/lib/constants/auth";
import { ROUTES, setupHref } from "@/lib/constants/routes";
import { type MoneyAsset, spendableOf } from "@/lib/money/assets";
import { amountOf, valueText } from "@/lib/money/format";
import { moveOperation, type ReviewedMove, reviewMove } from "@/lib/money/move";
import { usePeople } from "@/lib/money/people";
import { RECIPIENT_WORDS, useRecipientCheck } from "@/lib/money/recipient";
import { useMoneyAssets } from "@/lib/money/use-money-assets";
import { useMoneyOperation } from "@/lib/money/use-money-operation";
import { useReviewGuard } from "@/lib/review-guard";
import { AssetMark } from "./asset-mark";
import { AssetPicker } from "./asset-picker";
import { MoveReview } from "./move-review";
import { type PickedRecipient, RecipientStep } from "./recipient-step";

type Kind = "send" | "withdraw";
type Step = "to" | "amount" | "picker" | "review";

const WITHDRAW_WORDS: TraceWords = {
  ...SEND_WORDS,
  thing: "withdrawal",
  again: "withdraw it again",
  pending: "Withdrawing",
  success: "Withdrawn",
};

const MARK_PICK = 28;

function AmountStep({
  asset,
  warnings,
  checking,
  blocked,
  onAsset,
  onReview,
}: {
  asset: MoneyAsset;
  warnings: readonly string[];
  checking: boolean;
  blocked: string | undefined;
  onAsset: () => void;
  onReview: (amount: bigint) => void;
}) {
  const [text, setText] = useState("");
  const available = spendableOf(asset);
  const parsed = parseUnits(text === "" ? "0" : text, asset.decimals);
  const amount = parsed.ok ? parsed.value : 0n;
  const locked = asset.trading - asset.tradingFree;
  const over = amount > available;
  const problem = blocked ?? (checking ? "Checking the address" : over ? "More than available" : undefined);
  return (
    <div className="grid gap-5">
      <button
        type="button"
        onClick={onAsset}
        className="mx-auto flex items-center gap-2 rounded-full bg-raised-2 py-1.5 pr-3 pl-1.5 text-row hover:bg-row-pressed"
      >
        <AssetMark asset={asset} size={MARK_PICK} />
        {asset.symbol}
        <ChevronDown className="size-4 text-text-2" aria-hidden />
      </button>
      <div className="grid justify-items-center gap-1">
        <input
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          aria-label={`Amount in ${asset.symbol}`}
          value={text}
          onChange={(e) => {
            const next = e.target.value.replace(/[^\d.]/g, "");
            if (parseUnits(next === "" ? "0" : next, asset.decimals).ok || next.endsWith(".")) setText(next);
          }}
          className="w-full bg-transparent text-center font-display text-display-margin outline-none tnum placeholder:text-text-3"
        />
        <p className="text-meta text-text-2">
          Available {amountOf(asset, available)}
          <button
            type="button"
            onClick={() => setText(formatUnits(available, asset.decimals, asset.decimals, { grouping: false }))}
            className="ml-2 text-link hover:underline"
          >
            Max
          </button>
        </p>
        {locked > 0n ? (
          <Link href={ROUTES.home} className="text-meta text-text-3 hover:underline">
            {amountOf(asset, locked)} in trades ›
          </Link>
        ) : null}
        {asset.native ? <p className="text-meta text-text-3">Keeps 10 MON for fees</p> : null}
      </div>
      {warnings.map((w) => (
        <p key={w} className="text-center text-meta text-warn">
          {w}
        </p>
      ))}
      {problem && amount > 0n ? <p className="text-center text-meta text-down">{problem}</p> : null}
      <Button size="xl" disabled={amount === 0n || problem !== undefined} onClick={() => onReview(amount)}>
        Review
      </Button>
    </div>
  );
}

function Flow({ kind, me }: { kind: Kind; me: `0x${string}` }) {
  const env = useQueryEnv();
  const router = useRouter();
  const params = useSearchParams();
  const money = useMoneyAssets(me);
  const { people, known: knownAddresses } = usePeople(me);
  const runner = useMoneyOperation(`${kind}:${env.chainId}:${me.toLowerCase()}`);
  const risk = known(useAccountRisk(isDeployed(env.chainId, "SenryoCore") ? me : undefined, "latest"));
  const bitmap = risk?.positionBitmap ?? 0;
  const [step, setStep] = useState<Step>("to");
  /** Withdraw: to an address on Monad, or to another chain (B8 / B9). */
  const [dest, setDest] = useState<"monad" | "chain">("monad");
  const [recipient, setRecipient] = useState<PickedRecipient>();
  const [assetKey, setAssetKey] = useState(params.get("asset") ?? undefined);
  const [reviewed, setReviewed] = useState<ReviewedMove>();
  const [block, setBlock] = useState<string>();
  const [busy, setBusy] = useState(false);
  const check = useRecipientCheck(me, recipient?.address, knownAddresses);
  const guard = useReviewGuard(reviewed?.key ?? "");
  const asset = (assetKey ? money.find(assetKey) : undefined) ?? money.assets[0];
  const words = kind === "send" ? SEND_WORDS : WITHDRAW_WORDS;

  // A move restored from the journal (the page was reloaded after the slide) opens on its outcome.
  useEffect(() => {
    if (runner.trace.events.length > 0 || runner.trace.running) setStep("review");
  }, [runner.trace.events.length, runner.trace.running]);

  const verdict = check.data;
  const selfBlock = verdict?.block === "self";
  const blocked = verdict?.block
    ? selfBlock && kind === "withdraw"
      ? "That’s this account"
      : RECIPIENT_WORDS[verdict.block]
    : undefined;
  const warnings = [
    ...(verdict?.warnings ?? []).map((w) => RECIPIENT_WORDS[w]),
    ...(asset && !asset.verified ? ["Unverified token · send anyway?"] : []),
  ];
  const confirm = async () => {
    if (!reviewed) return;
    setBusy(true);
    setBlock(undefined);
    try {
      const op = moveOperation(env, me, reviewed, ACTIVE_NETWORK.name, knownAddresses, guard);
      // Mainnet pays its own fees: say so before the passkey is asked for (B11).
      const fees = await runner.checkFees(op);
      if (!fees.ok) {
        setBlock("Add MON for network fees");
        return;
      }
      await runner.run(op);
    } catch (error) {
      setBlock(error instanceof Error ? (error.message.split("\n")[0] ?? "") : "Couldn’t prepare it");
    } finally {
      setBusy(false);
    }
  };
  const title = kind === "send" ? "Send" : "Withdraw";
  const back = () => setStep(step === "review" ? "amount" : step === "picker" ? "amount" : "to");

  return (
    <>
      <PageHeader
        title={step === "to" ? (kind === "send" ? "Send to" : "Withdraw to") : step === "review" ? "Review" : title}
        {...(step === "to" ? { back: ROUTES.home } : {})}
        {...(step !== "to" && !runner.trace.running && runner.trace.events.length === 0
          ? {
              right: (
                <button type="button" onClick={back} className="text-meta text-link">
                  Back
                </button>
              ),
            }
          : {})}
      />
      {kind === "withdraw" && step === "to" ? (
        <fieldset aria-label="Withdraw to" className="grid grid-cols-2 gap-1 rounded-md bg-raised-2 p-1">
          {(["monad", "chain"] as const).map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={dest === d}
              onClick={() => setDest(d)}
              className={dest === d ? "h-10 rounded-sm bg-background text-row" : "h-10 rounded-sm text-row text-text-2"}
            >
              {d === "monad" ? "Monad" : "Another chain"}
            </button>
          ))}
        </fieldset>
      ) : null}
      {kind === "withdraw" && step === "to" && dest === "chain" ? (
        <WithdrawToChain me={me} />
      ) : step === "to" ? (
        <RecipientStep
          people={kind === "send" ? people : []}
          initial={params.get("to") ?? ""}
          placeholder={kind === "send" ? "Name, @handle or address" : "Your Monad address or exchange deposit"}
          onPick={(r) => {
            setRecipient(r);
            setStep("amount");
          }}
        />
      ) : step === "picker" ? (
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
            setStep("amount");
          }}
        />
      ) : step === "amount" ? (
        blocked ? (
          <div className="grid gap-4 py-6 text-center">
            <p className="text-row text-down">{blocked}</p>
            {selfBlock && kind === "send" ? (
              <Button asChild size="xl">
                <Link href={ROUTES.withdraw}>Withdraw instead</Link>
              </Button>
            ) : null}
          </div>
        ) : money.status === "loading" ? (
          <Skeleton className="h-48 w-full" />
        ) : asset ? (
          <>
            <p className="pb-2 text-center text-meta text-text-2">
              To {recipient?.label === recipient?.address ? `${recipient?.address.slice(0, 10)}…` : recipient?.label} ·{" "}
              {valueText(asset)}
            </p>
            <AmountStep
              key={asset.key}
              asset={asset}
              warnings={warnings}
              checking={check.isLoading}
              blocked={blocked}
              onAsset={() => setStep("picker")}
              onReview={(amount) => {
                if (!recipient) return;
                setBlock(undefined);
                setReviewed(
                  reviewMove(
                    env.chainId,
                    kind,
                    asset,
                    amount,
                    recipient.address,
                    recipient.handle,
                    recipient.label,
                    bitmap,
                  ),
                );
                setStep("review");
              }}
            />
          </>
        ) : (
          <p className="py-6 text-center text-meta text-text-2">Nothing to {kind} yet</p>
        )
      ) : reviewed ? (
        <MoveReview
          move={reviewed}
          runner={runner}
          avatar={recipient?.avatar ?? null}
          warnings={warnings}
          block={block}
          busy={busy}
          words={words}
          onConfirm={() => void confirm()}
          onDone={() => {
            runner.reset();
            setReviewed(undefined);
            router.push(ROUTES.home);
          }}
          onLeave={() => router.push(ROUTES.home)}
        />
      ) : (
        <p className="py-6 text-center text-meta text-text-2">Nothing to review</p>
      )}
    </>
  );
}

export function MoveFlow({ kind }: { kind: Kind }) {
  const account = useAccount();
  const me = account.hint?.address;
  const accepted = useTermsAccepted(me);
  return (
    <Column>
      {account.status === "loading" ? (
        <Skeleton className="mt-6 h-48 w-full" />
      ) : me && !accepted ? (
        <>
          <PageHeader title={kind === "send" ? "Send" : "Withdraw"} back={ROUTES.home} />
          <div className="grid gap-3 py-8 text-center">
            <p className="text-row">Agree to the terms first</p>
            <Button asChild size="xl">
              <Link href={setupHref(kind === "send" ? ROUTES.send : ROUTES.withdraw)}>Terms</Link>
            </Button>
          </div>
        </>
      ) : me ? (
        <Flow kind={kind} me={me} />
      ) : (
        <>
          <PageHeader title={kind === "send" ? "Send" : "Withdraw"} back={ROUTES.home} />
          <div className="grid gap-3 py-8 text-center">
            <p className="text-row">An account sends and withdraws</p>
            <Button asChild size="xl">
              <Link href={ROUTES.welcome}>Create account</Link>
            </Button>
          </div>
        </>
      )}
    </Column>
  );
}
