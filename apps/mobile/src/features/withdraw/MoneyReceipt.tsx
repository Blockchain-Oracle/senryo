/**
 * The receipt of one executed send or withdrawal (review S01/S06): the request exactly as it was signed — amount,
 * token, destination, network, money — frozen when it went out, over its trace and the shared outcome. While the
 * outcome is unknown the screen offers no new draft (a second send could pay twice); once it settles, "Send another" /
 * "Withdraw again" starts a fresh, empty draft. A balance refresh never changes what this receipt says.
 */
import { MAINNET_CHAIN_ID } from "@senryo/config";
import { collateralId } from "@senryo/identity";
import type { OperationRecord, TraceEvent } from "@senryo/query";
import { StyleSheet, View } from "react-native";
import { MarkedLine } from "~/components/identity/MarkedLine";
import { KeyValue, Panel } from "~/components/kit/Surface";
import { useSettledOutcome } from "~/features/trade/send-outcome";
import { type TraceWords, TradeTrace } from "~/features/trade/TradeTrace";
import { usd } from "~/lib/money";
import { SIZE, SPACE } from "~/theme";

export interface ExecutedMove {
  amount: bigint;
  symbol: "AUSD" | "USDC";
  chainId: number;
  to: string;
  network: string;
  practice: boolean;
  source?: "wallet" | "trading";
}

/** Restore the reviewed facts, rather than deriving a receipt from the latest balance or draft. */
export function restoredMove(record: OperationRecord | undefined): ExecutedMove | undefined {
  const intent = record?.reviewedIntent;
  if (!record || !intent?.amount || !intent.recipient || (intent.symbol !== "AUSD" && intent.symbol !== "USDC"))
    return undefined;
  try {
    return {
      amount: BigInt(intent.amount),
      symbol: intent.symbol,
      chainId: record.chainId,
      to: intent.recipient,
      network: record.chainId === MAINNET_CHAIN_ID ? "Monad" : "Monad Testnet",
      practice: record.chainId !== MAINNET_CHAIN_ID,
      source: intent.source === "wallet" ? "wallet" : "trading",
    };
  } catch {
    return undefined;
  }
}

export function MoneyReceipt({
  move,
  record,
  events,
  running,
  words,
  onAgain,
  onLeave,
}: {
  move: ExecutedMove;
  record?: OperationRecord | undefined;
  events: readonly TraceEvent[];
  running: boolean;
  words: TraceWords;
  /** Back to a draft: `fresh` after it went through (an empty one), else the same draft to try again. */
  onAgain: (fresh: boolean) => void;
  onLeave: () => void;
}) {
  const outcome = useSettledOutcome(events);
  const actual = record?.steps
    .flatMap((step) => step.facts ?? [])
    .find(
      (fact) =>
        fact.event === "Withdrawn" ||
        (fact.event === "Transfer" && fact.values.to?.toLowerCase() === record.reviewedIntent.recipient?.toLowerCase()),
    );
  const actualAmount = outcome === "finalized" ? (actual?.values.amount ?? actual?.values.value) : undefined;
  return (
    <View style={styles.stack}>
      <Panel style={styles.rows}>
        <MarkedLine
          id={collateralId(move.chainId, move.symbol)}
          label={move.symbol}
          value={usd(actualAmount ? BigInt(actualAmount) : move.amount)}
          size={SIZE.markToken}
        />
        <KeyValue label="From" value={move.source === "wallet" ? "Your wallet" : "Your trading account"} />
        <KeyValue label="To" value={move.to} />
        <KeyValue label="Network" value={move.network} />
        <KeyValue label="Money" value={move.practice ? "Practice · paper money" : "Mainnet · real money"} />
      </Panel>
      <TradeTrace
        record={record}
        events={events}
        running={running}
        outcome={outcome}
        onDone={() => onAgain(outcome === "finalized")}
        onLeave={onLeave}
        words={words}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: SPACE.lg },
  rows: { paddingHorizontal: SPACE.lg, paddingVertical: SPACE.sm, gap: SPACE.xs },
});
