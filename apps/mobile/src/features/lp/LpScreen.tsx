import { durationUntil, RISK } from "@senryo/core";
import { collateralId } from "@senryo/identity";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { MarkedLine } from "~/components/identity/MarkedLine";
import { Button } from "~/components/kit/Button";
import { Panel } from "~/components/kit/Surface";
import { ReadingView } from "~/components/kit/states";
import { HoldToConfirm } from "~/components/trade/HoldToConfirm";
import { OperationSummary } from "~/components/trade/OperationSummary";
import { useOutcome } from "~/features/trade/OutcomeNote";
import { AmountEntry } from "~/features/withdraw/AmountEntry";
import { useAmountDraft } from "~/features/withdraw/amount-draft";
import { ROUTES } from "~/lib/constants/routes";
import { pct, usd } from "~/lib/money";
import { useNetwork } from "~/lib/network";
import { useReviewGuard } from "~/lib/review-guard";
import { HERO_FONT_SCALE, SIZE, SPACE, TYPE, useTheme } from "~/theme";
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
  const maxDeposit = lp.snapshot
    ? lp.snapshot.walletAusd < lp.snapshot.maxDeposit
      ? lp.snapshot.walletAusd
      : lp.snapshot.maxDeposit
    : 0n;
  const depositDraft = useAmountDraft(maxDeposit, `pool-deposit:${network.chainId}:${lp.address}`);
  const depositUsd6 = depositDraft.amount;
  const redeemDraft = useAmountDraft(lp.snapshot?.sharesValue ?? 0n, `pool-redeem:${network.chainId}:${lp.address}`);

  const depositGuard = useReviewGuard([network.chainId, lp.address, depositUsd6].join(":"));
  const redeemGuard = useReviewGuard([network.chainId, lp.address, redeemDraft.amount, redeemDraft.all].join(":"));
  const { unresolved } = useOutcome(lp.trace.events);
  // A signed LP send that isn't confirmed yet locks the page's actions too: repeating it could deposit twice.
  const busy = lp.trace.running || unresolved;
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
        const invested = v.sharesValue + v.pendingValue;
        return (
          <View style={styles.stack}>
            <View style={styles.hero}>
              <Text style={[TYPE.rowDetail, { color: practice ? color.practice : color.mainnet }]}>
                {practice ? "Practice · Paper money" : "Mainnet · Real money"} · {network.name}
              </Text>
              {invested > 0n ? (
                <>
                  <Text style={[TYPE.rowDetail, { color: color.text3 }]}>Your investment</Text>
                  <Text
                    maxFontSizeMultiplier={HERO_FONT_SCALE}
                    adjustsFontSizeToFit
                    numberOfLines={1}
                    style={[TYPE.displayBalance, { color: color.ink }]}
                  >
                    {usd(invested)}
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

            {v.pending.length ? (
              <View style={styles.panel}>
                <Text style={[TYPE.rowTitle, { color: color.ink }]}>Pending redemptions</Text>{" "}
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
                      <HoldToConfirm
                        label="Claim redemption"
                        resetKey={[network.chainId, lp.address, r.requestId].join(":")}
                        disabled={busy || !ready || !v.allMarketsOpen}
                        onConfirm={() => void lp.claim(r.requestId)}
                      />
                    </View>
                  );
                })}
                {v.pending.length > 0 && !v.allMarketsOpen ? (
                  <Text style={[TYPE.rowDetail, { color: color.warn }]}>
                    Claims open when every market is open (weekend-gap protection).
                  </Text>
                ) : null}
              </View>
            ) : null}

            <View style={styles.grid}>
              <Cell label="Pool value" value={usd(v.totalAssets)} />
              <Cell label="Cap" value={usd(v.tvlCap, 0)} />
              <Cell label="In use by traders" value={lp.utilisationBps === undefined ? "—" : pct(lp.utilisationBps)} />
              <Cell label="APR · last 7 days" value={aprValue === undefined ? "Not enough history" : pct(aprValue)} />
            </View>

            <Text style={[TYPE.rowDetail, { color: color.text2 }]}>
              Capital at risk · Redemptions wait 24 hours, then require all markets open. Redemption value can change.
            </Text>

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
              <AmountEntry draft={depositDraft} max={maxIn} symbol="AUSD" label="Deposit amount" />
              {v.walletAusd === 0n && practice ? (
                <Button
                  label="Get practice AUSD"
                  variant="secondary"
                  disabled={busy}
                  onPress={() => void lp.faucet()}
                />
              ) : null}
              <HoldToConfirm
                resetKey={[network.chainId, lp.address, depositUsd6].join(":")}
                label={busy ? "Preparing…" : `Deposit ${usd(depositUsd6)}`}
                disabled={busy || depositUsd6 <= 0n || depositUsd6 > maxIn || !lp.ready}
                onConfirm={() => void lp.deposit(depositUsd6, depositGuard)}
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
                    <AmountEntry
                      draft={redeemDraft}
                      max={v.sharesValue}
                      symbol="AUSD"
                      label="Redemption value (estimated)"
                    />
                    <HoldToConfirm
                      label="Request redemption"
                      resetKey={[network.chainId, lp.address, redeemDraft.amount].join(":")}
                      disabled={busy || !lp.ready || redeemDraft.amount <= 0n || redeemDraft.over}
                      onConfirm={() =>
                        void lp.requestRedeem(
                          v.sharesValue > 0n
                            ? redeemDraft.all
                              ? v.shares
                              : (redeemDraft.amount * v.shares) / v.sharesValue
                            : 0n,
                          redeemGuard,
                        )
                      }
                    />
                    <Text style={[TYPE.meta, { color: color.text3 }]}>
                      Shares move into escrow. Claim after 24 hours while every market is open; the amount received may
                      differ.
                    </Text>
                  </>
                ) : null}
              </Panel>
            ) : null}
            <OperationSummary record={lp.trace.record} />
            {!v.requestsComplete ? (
              <Text style={[TYPE.meta, { color: color.warn }]}>
                Pending requests are updating. Your investment may be partial until the indexer catches up.
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
  pending: { gap: SPACE.md },
  flex: { flex: 1, gap: SPACE.xxs },
});
