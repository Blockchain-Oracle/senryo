import { durationUntil, ONE_USD6, RISK } from "@senryo/core";
import { collateralId } from "@senryo/identity";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { MarkedLine } from "~/components/identity/MarkedLine";
import { Button } from "~/components/kit/Button";
import { Segmented } from "~/components/kit/Segmented";
import { KeyValue, Panel, SectionLabel } from "~/components/kit/Surface";
import { EmptyState, ReadingView } from "~/components/kit/states";
import { ACTIVE_NETWORK } from "~/lib/constants/auth";
import { pct, usd } from "~/lib/money";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { LP_DEPOSIT_CHIPS_USD, LP_REDEEM_STEPS_BPS } from "./constants";
import { useLp } from "./useLp";

const MS_PER_SECOND = 1000n;
const RISKS = [
  "You are the counterparty: traders' profits are paid from the pool, their losses and most fees go to it.",
  "Redeeming takes 24 h and claims only while every market is open — it protects against weekend gaps.",
  "The value can go down. The APR is last week's result, not a promise.",
] as const;

/** F24/F25 (D2): pool value, cap, utilisation and historical APR, your share, risks, deposit, redeem, claims. */
export function LpScreen() {
  const { color } = useTheme();
  const lp = useLp();
  const [depositUsd6, setDepositUsd6] = useState<bigint>(LP_DEPOSIT_CHIPS_USD[1] * ONE_USD6);
  const [redeemBps, setRedeemBps] = useState<bigint>(LP_REDEEM_STEPS_BPS[2]);
  const busy = lp.trace.running;
  const failed = lp.trace.events.some((e) => e.stage === "failed" || e.stage === "reverted");
  const nowSec = BigInt(Date.now()) / MS_PER_SECOND;

  if (!lp.address) {
    return <EmptyState why="Create an account to provide liquidity" detail="The pool is open to every account." />;
  }
  return (
    <ReadingView reading={lp.vault} loading="plate" loadingLabel="Reading the pool">
      {(v) => {
        const maxIn = v.walletAusd < v.maxDeposit ? v.walletAusd : v.maxDeposit;
        const share = v.totalAssets > 0n ? (v.sharesValue * RISK.BPS) / v.totalAssets : 0n;
        const aprValue = lp.apr.status === "fresh" || lp.apr.status === "stale" ? lp.apr.value : undefined;
        return (
          <View style={styles.stack}>
            <Panel style={styles.panel}>
              <SectionLabel>POOL · {ACTIVE_NETWORK.modeLabel.toUpperCase()}</SectionLabel>
              <KeyValue label="VALUE" value={usd(v.totalAssets)} />
              <KeyValue label="CAP" value={usd(v.tvlCap, 0)} />
              <KeyValue label="UTILISATION" value={lp.utilisationBps === undefined ? "—" : pct(lp.utilisationBps)} />
              <KeyValue label="APR · LAST 7D" value={aprValue === undefined ? "not enough history" : pct(aprValue)} />
              <KeyValue label="YOUR sLP" value={`${usd(v.sharesValue)} · ${pct(share)}`} />
            </Panel>

            <Panel style={styles.panel}>
              <SectionLabel>RISKS</SectionLabel>
              {RISKS.map((r) => (
                <Text key={r} style={[TYPE.caption, { color: color.inkMuted }]}>
                  · {r}
                </Text>
              ))}
            </Panel>

            <Panel style={styles.panel}>
              <SectionLabel>DEPOSIT AUSD</SectionLabel>
              <MarkedLine
                id={collateralId(ACTIVE_NETWORK.chainId, "AUSD")}
                label="AUSD in your wallet"
                size={SIZE.markToken}
                value={usd(v.walletAusd)}
              />
              <Segmented
                options={[
                  ...LP_DEPOSIT_CHIPS_USD.map((c) => ({ value: String(c * ONE_USD6), label: `$${c}` })),
                  { value: "max", label: "MAX" },
                ]}
                value={depositUsd6 === maxIn && maxIn > 0n ? "max" : String(depositUsd6)}
                onChange={(val) => setDepositUsd6(val === "max" ? maxIn : BigInt(val))}
                label="Deposit amount"
              />
              {v.walletAusd === 0n && ACTIVE_NETWORK.modeLabel === "Practice" ? (
                <Button label="Get practice AUSD" variant="outline" disabled={busy} onPress={() => void lp.faucet()} />
              ) : null}
              <Button
                label={busy ? "Working…" : `Deposit ${usd(depositUsd6)}`}
                loading={busy}
                disabled={busy || depositUsd6 <= 0n || depositUsd6 > maxIn || !lp.ready}
                onPress={() => void lp.deposit(depositUsd6)}
              />
              {v.maxDeposit === 0n ? (
                <Text style={[TYPE.caption, { color: color.warn }]}>
                  The pool is at its cap; deposits reopen as it shrinks.
                </Text>
              ) : null}
            </Panel>

            <Panel style={styles.panel}>
              <SectionLabel>REDEEM</SectionLabel>
              <Segmented
                options={LP_REDEEM_STEPS_BPS.map((b) => ({ value: String(b), label: b >= RISK.BPS ? "All" : pct(b) }))}
                value={String(redeemBps)}
                onChange={(val) => setRedeemBps(BigInt(val))}
                label="How much to redeem"
              />
              <Button
                label="Request redeem · claim in 24 h"
                variant="outline"
                disabled={busy || v.shares === 0n || !lp.ready}
                onPress={() => void lp.requestRedeem(redeemBps)}
              />
              {v.pending.map((r) => {
                const ready = r.claimableAt <= nowSec;
                return (
                  <View key={String(r.requestId)} style={styles.pending}>
                    <Text style={[TYPE.numSm, { color: color.ink, flex: 1 }]}>
                      #{String(r.requestId)} · {ready ? "ready" : durationUntil(r.claimableAt, nowSec)}
                    </Text>
                    <Button
                      label="Claim"
                      size="sm"
                      block={false}
                      disabled={busy || !ready || !v.allMarketsOpen}
                      onPress={() => void lp.claim(r.requestId)}
                    />
                  </View>
                );
              })}
              {v.pending.length > 0 && !v.allMarketsOpen ? (
                <Text style={[TYPE.caption, { color: color.warn }]}>
                  Claims open when every market is open (weekend-gap protection).
                </Text>
              ) : null}
            </Panel>
            {failed ? (
              <Text style={[TYPE.caption, { color: color.down }]}>That didn't go through; nothing changed.</Text>
            ) : null}
          </View>
        );
      }}
    </ReadingView>
  );
}

const styles = StyleSheet.create({
  stack: { gap: SPACE.lg },
  panel: { padding: SPACE.md, gap: SPACE.sm },
  pending: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
});
