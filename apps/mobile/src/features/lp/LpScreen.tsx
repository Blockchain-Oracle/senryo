/**
 * The pool (flow book D1/D2; plan §0.9 Pool): the pool's mark and your investment as the one hero, the APR chip with
 * its real window (ⓘ: its source), a stat strip (Pool value · In use · Cap left), Deposit / Redeem into keypad sheets,
 * pending redemptions as rows that count down ("Claim in 14h 02m", "Ready · Claim", "Claim opens Mon 23:05 UTC"), and
 * the disclosures as compact ⓘ rows. After a slide the page is the outcome surface. The practice faucet is gone:
 * deposits come from the trading balance (withdrawn to self) or wallet AUSD.
 */
import type { LpRedeemView } from "@senryo/chain";
import { durationUntil, utcSlotLabel } from "@senryo/core";
import { ids } from "@senryo/identity";
import type { OperationRecord } from "@senryo/query";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { EntityMark } from "~/components/identity/EntityMark";
import { AmountHero } from "~/components/kit/AmountHero";
import { Button } from "~/components/kit/Button";
import { Screen } from "~/components/kit/Screen";
import { ReadingView } from "~/components/kit/states";
import { ChevronRight, Info } from "~/components/kit/symbols";
import { Facts } from "~/features/trade/TicketReceipt";
import { fire } from "~/feedback/fire";
import { ROUTES } from "~/lib/constants/routes";
import { pct, usd } from "~/lib/money";
import { useNetwork } from "~/lib/network";
import { BUTTON, CONTROL_FONT_SCALE, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { DepositSheet } from "./DepositSheet";
import { InfoSheet, PoolDisclosures } from "./PoolDisclosures";
import { PoolOutcome } from "./PoolOutcome";
import { ClaimSheet, RedeemSheet, sharesValueOf } from "./RedeemSheet";
import { useClaimWindow } from "./useClaimWindow";
import { useLp } from "./useLp";

const MS_PER_SECOND = 1000n;
const APR_INFO = {
  title: "APR",
  body: "Last 7 days of fees the pool kept and traders' results, annualised from its indexed events. Past, not promised.",
};

/** The outcome's words from the operation it narrates. */
function outcomeWords(record: OperationRecord | undefined) {
  const amount = record?.reviewedIntent.amount;
  if (record?.plannedActions.includes("lpDeposit"))
    return { pending: "Depositing", success: amount ? `Deposited ${usd(BigInt(amount))}` : "Deposited" };
  if (record?.kind === "lpRequestRedeem") return { pending: "Requesting", success: "Redemption requested" };
  return { pending: "Claiming", success: "Claimed" };
}

export function LpScreen() {
  const { color } = useTheme();
  const network = useNetwork();
  const lp = useLp();
  const window = useClaimWindow();
  const [sheet, setSheet] = useState<"deposit" | "redeem" | undefined>();
  const [claim, setClaim] = useState<LpRedeemView | undefined>();
  const [info, setInfo] = useState<{ title: string; body: string } | undefined>();
  const nowSec = BigInt(Date.now()) / MS_PER_SECOND;

  if (!lp.address) {
    return (
      <Screen>
        <PoolMark />
        <Text style={[TYPE.stepTitle, { color: color.ink }]}>Earn from the pool</Text>
        <Button label="Create account" onPress={() => router.push(ROUTES.accountRequired)} />
      </Screen>
    );
  }
  return (
    <View style={styles.fill}>
      {lp.trace.events.length > 0 ? (
        <Screen contentStyle={styles.outcome}>
          <PoolOutcome
            lp={lp}
            words={outcomeWords(lp.trace.record)}
            onDone={() => lp.trace.reset()}
            onLeave={() => router.back()}
          />
        </Screen>
      ) : (
        <Screen contentStyle={styles.stack}>
          <ReadingView reading={lp.vault} loading="plate" loadingLabel="Reading the pool">
            {(v) => {
              const apr = lp.apr.status === "fresh" || lp.apr.status === "stale" ? lp.apr.value : undefined;
              const capLeft = v.tvlCap > v.totalAssets ? v.tvlCap - v.totalAssets : 0n;
              return (
                <>
                  <View style={styles.hero}>
                    <PoolMark />
                    <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowDetail, { color: color.text3 }]}>
                      Your investment
                    </Text>
                    <AmountHero text={usd(v.sharesValue + v.pendingValue)} />
                    <Pressable
                      onPress={() => {
                        fire("tick");
                        setInfo(APR_INFO);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={apr ? `APR ${pct(apr.bps)}, last ${apr.days} days` : "APR not known yet"}
                      style={[styles.apr, { backgroundColor: color.upWash }]}
                    >
                      <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.chipLabel, { color: color.up }]}>
                        {apr ? `APR ${pct(apr.bps)} · ${apr.days}d` : "APR —"}
                      </Text>
                      <Info size={SIZE.iconSm} strokeWidth={SIZE.iconStroke} color={color.up} />
                    </Pressable>
                  </View>
                  <Facts
                    facts={[
                      { label: "Pool value", value: usd(v.totalAssets, 0) },
                      { label: "In use", value: lp.utilisationBps === undefined ? "—" : pct(lp.utilisationBps) },
                      { label: "Cap left", value: usd(capLeft, 0) },
                    ]}
                  />
                  <View style={styles.actions}>
                    <Button label="Deposit" style={styles.flex} onPress={() => setSheet("deposit")} />
                    {v.shares > 0n ? (
                      <Button
                        label="Redeem"
                        variant="secondary"
                        style={styles.flex}
                        onPress={() => setSheet("redeem")}
                      />
                    ) : null}
                  </View>
                  {v.pending.length > 0 ? (
                    <View>
                      <Text accessibilityRole="header" style={[TYPE.rowTitle, { color: color.ink }]}>
                        Redemptions
                      </Text>
                      {v.pending.map((r) => {
                        const ready = r.claimableAt <= nowSec;
                        const status = !ready
                          ? `Claim ${durationUntil(r.claimableAt, nowSec)}`
                          : v.allMarketsOpen
                            ? "Ready · Claim"
                            : window.opensAt
                              ? `Claim opens ${utcSlotLabel(window.opensAt)}`
                              : "Waiting for prices";
                        return (
                          <Pressable
                            key={String(r.requestId)}
                            onPress={() => {
                              fire("tick");
                              setClaim(r);
                            }}
                            accessibilityRole="button"
                            accessibilityLabel={`Redemption of about ${usd(sharesValueOf(r.shares, v))}, ${status}`}
                            style={({ pressed }) => [styles.row, pressed ? { backgroundColor: color.card } : null]}
                          >
                            <Text style={[TYPE.rowAmount, styles.flex, { color: color.ink }]}>
                              ≈ {usd(sharesValueOf(r.shares, v))}
                            </Text>
                            <Text
                              style={[TYPE.rowDetail, { color: ready && v.allMarketsOpen ? color.up : color.text3 }]}
                            >
                              {status}
                            </Text>
                            <ChevronRight size={SIZE.iconSm} strokeWidth={SIZE.iconStroke} color={color.text3} />
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : null}
                  {!v.requestsComplete ? <Text style={[TYPE.meta, { color: color.warn }]}>Updating…</Text> : null}
                  <PoolDisclosures onInfo={setInfo} />
                  <Text style={[TYPE.meta, { color: network.key === "testnet" ? color.practice : color.mainnet }]}>
                    {network.key === "testnet" ? "Practice · Paper money" : "Mainnet · Real money"}
                  </Text>
                </>
              );
            }}
          </ReadingView>
        </Screen>
      )}
      {/* Sheets live at the root so they cover the page, and stay mounted through the outcome (the review guard). */}
      {lp.snapshot ? (
        <>
          <DepositSheet open={sheet === "deposit"} onClose={() => setSheet(undefined)} lp={lp} pool={lp.snapshot} />
          <RedeemSheet open={sheet === "redeem"} onClose={() => setSheet(undefined)} lp={lp} pool={lp.snapshot} />
          <ClaimSheet request={claim} onClose={() => setClaim(undefined)} lp={lp} pool={lp.snapshot} />
        </>
      ) : null}
      <InfoSheet info={info} onClose={() => setInfo(undefined)} />
    </View>
  );
}

/** The pool's mark: Senryo's own (the pool is its LP vault). */
export function PoolMark() {
  const { color } = useTheme();
  return (
    <View style={styles.mark}>
      <EntityMark id={ids.venue("senryo")} size={SIZE.avatarMd} decorative />
      <Text style={[TYPE.rowTitle, { color: color.ink }]}>Senryo pool</Text>
    </View>
  );
}

/** Rounded rect corner of the APR chip: the leverage-badge plate grown to chip height. */
const CHIP_RADIUS = BUTTON.radius.sm;

const styles = StyleSheet.create({
  fill: { flex: 1 },
  stack: { gap: SPACE.xl },
  outcome: { gap: SPACE.xl },
  hero: { gap: SPACE.xs },
  mark: { flexDirection: "row", alignItems: "center", gap: SPACE.sm, paddingBottom: SPACE.sm },
  apr: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: SPACE.xs,
    paddingHorizontal: SPACE.sm,
    height: SIZE.chipHeight,
    borderRadius: CHIP_RADIUS,
    marginTop: SPACE.xs,
  },
  actions: { flexDirection: "row", gap: SPACE.md },
  flex: { flex: 1 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    minHeight: SIZE.touch + SPACE.sm,
    paddingHorizontal: SPACE.sm,
    marginHorizontal: -SPACE.sm,
    borderRadius: BUTTON.radius.md,
  },
});
