import { durationUntil, ONE_USD6, RISK } from "@senryo/core";
import { collateralId } from "@senryo/identity";
import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { MarkedLine } from "~/components/identity/MarkedLine";
import { Button } from "~/components/kit/Button";
import { Segmented } from "~/components/kit/Segmented";
import { Panel } from "~/components/kit/Surface";
import { ReadingView } from "~/components/kit/states";
import { ROUTES } from "~/lib/constants/routes";
import { pct, usd } from "~/lib/money";
import { useNetwork } from "~/lib/network";
import { HERO_FONT_SCALE, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { LP_DEPOSIT_CHIPS_USD, LP_REDEEM_STEPS_BPS } from "./constants";
import { useLp } from "./useLp";

const MS_PER_SECOND = 1000n;
const RISK_COPY =
  "The pool is the other side of every trade: traders' profits are paid from it, and their losses and most fees go to it. Its value can fall. The APR is last week's result, not a promise. Redeeming takes 24 hours and claims only while every market is open, which protects the pool from weekend gaps.";

/**
 * The LP vault (J10; F24/F25 in the Home style): your share of the pool as the page's figure (or what the pool is for,
 * when you hold none), the pool's facts as quiet label-over-value cells, the risk in one plain paragraph, then deposit
 * and redeem with their pending claims. The sends are unchanged (`useLp`); approve-then-deposit still shares one trace,
 * so the result line describes the last step that ran.
 */
export function LpScreen() {
  const network = useNetwork();
  const { color } = useTheme();
  const lp = useLp();
  const [depositUsd6, setDepositUsd6] = useState<bigint>(LP_DEPOSIT_CHIPS_USD[1] * ONE_USD6);
  const [redeemBps, setRedeemBps] = useState<bigint>(LP_REDEEM_STEPS_BPS[2]);
  const busy = lp.trace.running;
  const last = lp.trace.events.at(-1)?.stage;
  const failed = last === "failed" || last === "reverted";
  const finalized = !busy && last === "finalized";
  const nowSec = BigInt(Date.now()) / MS_PER_SECOND;
  const practice = network.key === "testnet";

  if (!lp.address) {
    return (
      <View style={styles.guest}>
        <Text style={[TYPE.stepTitle, styles.center, { color: color.ink }]}>Earn from the pool’s fees</Text>
        <Text style={[TYPE.body, styles.center, { color: color.text2 }]}>{RISK_COPY}</Text>
        <Button label="Create account" block={false} onPress={() => router.push(ROUTES.accountRequired)} />
      </View>
    );
  }
  return (
    <ReadingView reading={lp.vault} loading="plate" loadingLabel="Reading the pool">
      {(v) => {
        const maxIn = v.walletAusd < v.maxDeposit ? v.walletAusd : v.maxDeposit;
        const share = v.totalAssets > 0n ? (v.sharesValue * RISK.BPS) / v.totalAssets : 0n;
        const aprValue = lp.apr.status === "fresh" || lp.apr.status === "stale" ? lp.apr.value : undefined;
        const holds = v.shares > 0n;
        return (
          <View style={styles.stack}>
            <View style={styles.hero}>
              <Text style={[TYPE.rowDetail, { color: practice ? color.practice : color.mainnet }]}>
                {practice ? "Practice · Paper money" : "Mainnet · Real money"} · {network.name}
              </Text>
              {holds ? (
                <>
                  <Text style={[TYPE.rowDetail, { color: color.text3 }]}>Your share</Text>
                  <Text
                    maxFontSizeMultiplier={HERO_FONT_SCALE}
                    adjustsFontSizeToFit
                    numberOfLines={1}
                    style={[TYPE.displayBalance, { color: color.ink }]}
                  >
                    {usd(v.sharesValue)}
                  </Text>
                  <Text style={[TYPE.rowDetail, { color: color.text2 }]}>{pct(share)} of the pool</Text>
                </>
              ) : (
                <>
                  <Text style={[TYPE.stepTitle, { color: color.ink }]}>Earn from the pool’s fees</Text>
                  <Text style={[TYPE.rowDetail, { color: color.text2 }]}>
                    Deposit AUSD and share in what traders pay, and in what they lose.
                  </Text>
                </>
              )}
            </View>

            <View style={styles.grid}>
              <Cell label="Pool value" value={usd(v.totalAssets)} />
              <Cell label="Cap" value={usd(v.tvlCap, 0)} />
              <Cell label="In use by traders" value={lp.utilisationBps === undefined ? "—" : pct(lp.utilisationBps)} />
              <Cell label="APR · last 7 days" value={aprValue === undefined ? "Not enough history" : pct(aprValue)} />
            </View>

            <Text style={[TYPE.body, { color: color.text2 }]}>{RISK_COPY}</Text>

            <Panel style={styles.panel}>
              <Text accessibilityRole="header" style={[TYPE.rowTitle, { color: color.ink }]}>
                Deposit
              </Text>
              <MarkedLine
                id={collateralId(network.chainId, "AUSD")}
                label={practice ? "AUSD · test token" : "AUSD"}
                size={SIZE.markToken}
                value={`${usd(v.walletAusd)} available`}
              />
              <Segmented
                options={[
                  ...LP_DEPOSIT_CHIPS_USD.map((c) => ({ value: String(c * ONE_USD6), label: usd(c * ONE_USD6, 0) })),
                  { value: "max", label: "Max" },
                ]}
                value={depositUsd6 === maxIn && maxIn > 0n ? "max" : String(depositUsd6)}
                onChange={(val) => setDepositUsd6(val === "max" ? maxIn : BigInt(val))}
                label="Deposit amount"
              />
              {v.walletAusd === 0n && practice ? (
                <Button
                  label="Get practice AUSD"
                  variant="secondary"
                  disabled={busy}
                  onPress={() => void lp.faucet()}
                />
              ) : null}
              <Button
                label={busy ? "Working…" : `Deposit ${usd(depositUsd6)}`}
                loading={busy}
                disabled={busy || depositUsd6 <= 0n || depositUsd6 > maxIn || !lp.ready}
                onPress={() => void lp.deposit(depositUsd6)}
              />
              {v.maxDeposit === 0n ? (
                <Text style={[TYPE.rowDetail, { color: color.warn }]}>
                  The pool is at its cap; deposits reopen as it shrinks.
                </Text>
              ) : null}
            </Panel>

            {holds || v.pending.length > 0 ? (
              <Panel style={styles.panel}>
                <Text accessibilityRole="header" style={[TYPE.rowTitle, { color: color.ink }]}>
                  Redeem
                </Text>
                {holds ? (
                  <>
                    <Segmented
                      options={LP_REDEEM_STEPS_BPS.map((b) => ({
                        value: String(b),
                        label: b >= RISK.BPS ? "All" : pct(b),
                      }))}
                      value={String(redeemBps)}
                      onChange={(val) => setRedeemBps(BigInt(val))}
                      label="How much to redeem"
                    />
                    <Button
                      label="Request · claim in 24 h"
                      variant="secondary"
                      disabled={busy || !lp.ready}
                      onPress={() => void lp.requestRedeem(redeemBps)}
                    />
                  </>
                ) : null}
                {v.pending.map((r) => {
                  const ready = r.claimableAt <= nowSec;
                  return (
                    <View key={String(r.requestId)} style={styles.pending}>
                      <View style={styles.flex}>
                        <Text style={[TYPE.row, { color: color.ink }]}>Request {String(r.requestId)}</Text>
                        <Text style={[TYPE.rowDetail, { color: ready ? color.up : color.text3 }]}>
                          {ready ? "Ready to claim" : `Claimable in ${durationUntil(r.claimableAt, nowSec)}`}
                        </Text>
                      </View>
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
                  <Text style={[TYPE.rowDetail, { color: color.warn }]}>
                    Claims open when every market is open (weekend-gap protection).
                  </Text>
                ) : null}
              </Panel>
            ) : null}
            {failed ? (
              <Text accessibilityRole="alert" style={[TYPE.rowDetail, { color: color.down }]}>
                That didn’t go through; nothing changed.
              </Text>
            ) : finalized ? (
              <Text accessibilityLiveRegion="polite" style={[TYPE.rowDetail, { color: color.up }]}>
                Done · finalized. The pool updates in a moment.
              </Text>
            ) : null}
          </View>
        );
      }}
    </ReadingView>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  const { color } = useTheme();
  return (
    <View style={styles.cell} accessible accessibilityLabel={`${label} ${value}`}>
      <Text style={[TYPE.rowDetail, { color: color.text3 }]}>{label}</Text>
      <Text style={[TYPE.rowPrice, { color: color.ink }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

/** Two cells per row: a fixed share each, so values line up in columns. */
const CELL_SHARE = "47%";

const styles = StyleSheet.create({
  stack: { gap: SPACE.xl },
  guest: { alignItems: "center", gap: SPACE.lg, paddingTop: SPACE.xxl },
  center: { textAlign: "center" },
  hero: { gap: SPACE.xs },
  grid: { flexDirection: "row", flexWrap: "wrap", rowGap: SPACE.lg, columnGap: SPACE.lg },
  cell: { width: CELL_SHARE, gap: SPACE.xxs },
  panel: { padding: SPACE.lg, gap: SPACE.md },
  pending: { flexDirection: "row", alignItems: "center", gap: SPACE.md },
  flex: { flex: 1, gap: SPACE.xxs },
});
