/**
 * Review → slide → outcome for a move on Monad (B7 step 3–4, B8 step 4; rules 5, 11): the asset's mark → the
 * recipient, the full address in groups, the exact amount, the network fee (sponsored in Practice), the steps when the
 * trading part is pulled or MON for the fee is swapped in first ("Network fee · Send"), any warning as a row; then the slide (one passkey step-up follows). Once signed the same
 * sheet is the outcome — facts from the reviewed intent, never the latest balance — and while it's unknown nothing
 * new can start.
 */
import { type OperationRecord, stepsLine } from "@senryo/query";
import { StyleSheet, Text, View } from "react-native";
import { Avatar } from "~/components/identity/Avatar";
import { Button } from "~/components/kit/Button";
import { SlideToConfirm } from "~/components/trade/SlideToConfirm";
import { groupedAddress } from "~/features/fund/ReceiveCard";
import { AssetMark } from "~/features/money/AssetMark";
import { exactAmount } from "~/features/money/format";
import { MoneyOutcome, MoveLine, ReviewRow, ReviewRows } from "~/features/money/Review";
import type { MoneyOperationRunner, PlannedStep } from "~/features/money/useMoneyOperation";
import { tokenAmount } from "~/features/tokens/format";
import type { TraceWords } from "~/features/trade/TradeTrace";
import { shortAddress } from "~/lib/format";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";
import type { ReviewedMove } from "./move";

/** The outcome's facts from the journal's reviewed intent (≤ 3 rows). */
export function IntentFacts({ record }: { record: OperationRecord | undefined }) {
  const i = record?.reviewedIntent;
  if (!i) return null;
  const decimals = Number.parseInt(i.decimals ?? "", 10);
  const amount = i.amount && !Number.isNaN(decimals) ? tokenAmount(BigInt(i.amount), decimals, i.symbol) : i.symbol;
  return (
    <>
      {amount ? <ReviewRow label="Amount" value={amount} /> : null}
      {i.recipient ? <ReviewRow label="To" value={i.recipientLabel ?? shortAddress(i.recipient)} /> : null}
      {i.network ? <ReviewRow label="Network" value={i.network} /> : null}
    </>
  );
}

export function MoveReview({
  move,
  steps,
  runner,
  avatar,
  fee,
  feeTopUp,
  practice,
  network,
  warnings,
  block,
  busy,
  words,
  onConfirm,
  onReviewAgain,
  onDone,
  onLeave,
}: {
  move: ReviewedMove | undefined;
  /** The prepared steps (a network-fee swap first when MON is short, B11); default: the move's own. */
  steps?: readonly PlannedStep[] | undefined;
  runner: MoneyOperationRunner;
  avatar: string | null;
  fee: string | undefined;
  feeTopUp?: string | undefined;
  practice: boolean;
  network: string;
  warnings: readonly string[];
  block: string | undefined;
  busy: boolean;
  words: TraceWords;
  onConfirm: () => void;
  onReviewAgain?: (() => void) | undefined;
  onDone: () => void;
  onLeave: () => void;
}) {
  const { color } = useTheme();
  if (runner.trace.running || runner.trace.events.length > 0 || !move) {
    return (
      <MoneyOutcome
        runner={runner}
        words={words}
        facts={<IntentFacts record={runner.trace.record} />}
        onDone={onDone}
        onLeave={onLeave}
      />
    );
  }
  const exact = exactAmount(move.asset, move.amount);
  const [line1, line2] = groupedAddress(move.to);
  return (
    <View style={styles.stack}>
      <MoveLine
        from={<AssetMark asset={move.asset} size={SIZE.avatarLg} />}
        to={<Avatar avatar={avatar} address={move.to} size={SIZE.avatarLg} />}
        fromLabel={exact}
        toLabel={move.label}
      />
      <ReviewRows>
        <ReviewRow label="To" value={`${line1}\n${line2}`} />
        <ReviewRow label="Amount" value={exact} />
        <ReviewRow label="Network fee" value={practice ? "Sponsored" : (fee ?? "Estimating")} />
        {feeTopUp ? <ReviewRow label="Fee top-up first" value={feeTopUp} /> : null}
        {(steps ?? move.steps).length > 1 ? <ReviewRow label="Steps" value={stepsLine(steps ?? move.steps)} /> : null}
        <ReviewRow label="Network" value={network} />
        {warnings.map((w) => (
          <ReviewRow key={w} label="Check" value={w} tone="warn" />
        ))}
      </ReviewRows>
      {block ? (
        <Text accessibilityLiveRegion="polite" style={[TYPE.rowDetail, styles.center, { color: color.down }]}>
          {block}
        </Text>
      ) : null}
      {block && onReviewAgain ? <Button label="Review again" onPress={onReviewAgain} disabled={busy} /> : null}
      <SlideToConfirm
        label={move.kind === "send" ? "Slide to send" : "Slide to withdraw"}
        tone="primary"
        busy={busy}
        disabled={block !== undefined}
        resetKey={move.key}
        onConfirm={onConfirm}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: SPACE.lg },
  center: { textAlign: "center" },
});
