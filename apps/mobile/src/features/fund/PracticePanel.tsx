/**
 * "Get practice money" (B15; Fomo F21 child panel): the one-time claim, the daily top-up and a code, as three rows with
 * their state in the second line. Everything lands in Assets as the one AUSD row, so each says so once done.
 */

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
import { usePracticeMoney } from "./usePracticeMoney";

const SEC_PER_HOUR = 3600n;
const SEC_PER_MIN = 60n;

function claimLine(phase: StarterPhase, amount: string | undefined): { title: string; detail: string } {
  const get = amount ? `Get ${amount}` : "Get practice money";
  switch (phase.kind) {
    case "signing":
    case "sending":
    case "settling":
      return { title: get, detail: "Adding…" };
    case "pending":
      return { title: "Claim pending", detail: "Tap to check status" };
    case "done":
      return { title: `${usd(phase.creditUsd6)} added`, detail: "In your Assets" };
    case "claimed":
      return { title: "Claimed", detail: "In your Assets" };
    case "failed":
      return { title: get, detail: "Didn’t go through · try again" };
    case "checking":
    case "unchecked":
      return { title: get, detail: "Checking…" };
    default:
      return { title: get, detail: "Free · once" };
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
  const { phase } = p.starter;
  const working = phase.kind === "signing" || phase.kind === "sending" || phase.kind === "settling";
  const claimed = phase.kind === "claimed" || phase.kind === "done";
  const claim = claimLine(phase, p.claimAmount !== undefined ? usd(p.claimAmount) : undefined);
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
        title={claim.title}
        detail={claim.detail}
        trailing={
          working ? (
            <ActivityIndicator color={color.practice} />
          ) : claimed ? (
            <Check size={SIZE.icon} strokeWidth={SIZE.iconStroke} color={color.up} />
          ) : (
            ausd
          )
        }
        disabled={working || claimed || !p.starter.ready}
        onPress={() => (phase.kind === "pending" ? p.starter.recheck() : void p.starter.claim())}
      />
      {p.faucetAvailable ? (
        <SheetRow
          index={1}
          title={faucetDone ? "Topped up" : "Daily top-up"}
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
