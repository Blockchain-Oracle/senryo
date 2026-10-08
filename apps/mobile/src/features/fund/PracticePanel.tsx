/**
 * "Get practice money" (B15; Fomo F21 child panel; real venues Stage 1): one "Get test money" row — the one-time
 * starter claim (gas + FX practice dollars) when it's still owed, then 10,000 test AUSD for crypto on Perpl, sent by
 * the sponsor with no Face ID and no gas — then the daily FX top-up and a code. Each row's second line is its state.
 */

import { PERPL_COLLATERAL_DECIMALS, PERPL_TESTNET_FAUCET_CNS } from "@senryo/config";
import { collateralId } from "@senryo/identity";
import { ActivityIndicator } from "react-native";
import { MarkCluster } from "~/components/identity/MarkCluster";
import { Check, Gift } from "~/components/kit/symbols";
import { SheetRow } from "~/components/sheet/SheetRow";
import { failureWords } from "~/features/trade/TradeTrace";
import type { StarterPhase } from "~/lib/account/use-starter";
import { usd } from "~/lib/money";
import { useNetwork } from "~/lib/network";
import { SIZE, useTheme } from "~/theme";
import { type TestFundsPhase, usePerplTestFunds } from "./usePerplTestFunds";
import { usePracticeMoney } from "./usePracticeMoney";

const SEC_PER_HOUR = 3600n;
const SEC_PER_MIN = 60n;

const DECIMAL_BASE = 10n;
const TEST_AUSD = Number(PERPL_TESTNET_FAUCET_CNS / DECIMAL_BASE ** BigInt(PERPL_COLLATERAL_DECIMALS)).toLocaleString(
  "en-US",
);
const TITLE = "Get test money";

const claimWorking = (phase: StarterPhase) =>
  phase.kind === "signing" || phase.kind === "sending" || phase.kind === "settling";

function testMoneyLine(funds: TestFundsPhase, claim: StarterPhase): { title: string; detail: string } {
  if (claimWorking(claim) || funds.kind === "sending" || funds.kind === "settling")
    return { title: TITLE, detail: "Adding…" };
  switch (funds.kind) {
    case "done":
      return { title: `${TEST_AUSD} AUSD added`, detail: "In your wallet · for crypto" };
    case "failed":
      if (funds.code === "RATE_LIMITED")
        return {
          title: "Today’s test money is in",
          detail: funds.retryAfterSec ? waitText(BigInt(funds.retryAfterSec)) : "More tomorrow",
        };
      if (funds.code === "NOT_NEEDED") return { title: "You have test AUSD", detail: "In your wallet" };
      if (funds.code === "RELAYER_BUSY") return { title: TITLE, detail: "Faucet busy · try again in a minute" };
      return { title: TITLE, detail: "Didn’t go through · try again" };
    default:
      return { title: TITLE, detail: `${TEST_AUSD} AUSD for crypto · gas included` };
  }
}

function waitText(sec: bigint): string {
  if (sec >= SEC_PER_HOUR) return `Next in ${sec / SEC_PER_HOUR} h`;
  return `Next in ${(sec + SEC_PER_MIN - 1n) / SEC_PER_MIN} min`;
}

export function PracticePanel({ onCode }: { onCode: () => void }) {
  const { color } = useTheme();
  const network = useNetwork();
  const p = usePracticeMoney();
  const funds = usePerplTestFunds();
  const { phase } = p.starter;
  const working = claimWorking(phase) || funds.busy;
  const owed = phase.kind === "idle" || (phase.kind === "failed" && phase.code !== "ALREADY_CLAIMED");
  const line = testMoneyLine(funds.phase, phase);
  const fundsDone = funds.phase.kind === "done";
  // The starter claim (gas + FX practice dollars) rides along while it's owed; the test AUSD comes every day.
  const getTestMoney = async () => {
    if (owed && p.starter.ready) await p.starter.claim();
    await funds.request();
  };
  const ausd = <MarkCluster ids={[collateralId(network.chainId, "AUSD")]} size={SIZE.markCell} />;
  const faucetDone = p.faucetOutcome === "finalized";
  const faucetFailed = p.faucetOutcome !== undefined && p.faucetOutcome !== "finalized";
  const failed = p.faucetEvents.find((e) => e.stage === "failed");
  const faucetDetail = p.faucetRunning
    ? "Adding…"
    : faucetDone
      ? "In your Assets"
      : faucetFailed
        ? p.faucetOutcome === "unknown"
          ? "Checking the network"
          : failureWords(failed?.error, "top-up")
        : p.waitSec > 0n
          ? waitText(p.waitSec)
          : `${p.faucetAmount !== undefined ? usd(p.faucetAmount) : "Practice dollars"} to your wallet`;
  return (
    <>
      <SheetRow
        index={0}
        title={line.title}
        detail={line.detail}
        trailing={
          working ? (
            <ActivityIndicator color={color.practice} />
          ) : fundsDone ? (
            <Check size={SIZE.icon} strokeWidth={SIZE.iconStroke} color={color.up} />
          ) : (
            ausd
          )
        }
        disabled={working || fundsDone || !funds.available}
        onPress={() => (phase.kind === "pending" ? p.starter.recheck() : void getTestMoney())}
      />
      {p.faucetAvailable ? (
        <SheetRow
          index={1}
          title={faucetDone ? "Topped up" : "Daily FX top-up"}
          detail={faucetDetail}
          trailing={
            p.faucetRunning ? (
              <ActivityIndicator color={color.practice} />
            ) : faucetDone ? (
              <Check size={SIZE.icon} strokeWidth={SIZE.iconStroke} color={color.up} />
            ) : (
              ausd
            )
          }
          disabled={p.faucetRunning || faucetDone || p.waitSec > 0n || p.faucetOutcome === "unknown"}
          onPress={p.topUp}
        />
      ) : null}
      <SheetRow
        index={2}
        title="Redeem a code"
        detail="Adds practice money"
        trailing={<Gift size={SIZE.icon} strokeWidth={SIZE.iconStroke} color={color.gold} />}
        onPress={onCode}
      />
    </>
  );
}
