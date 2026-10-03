/**
 * Redeem and claim (flow book D2): request 25 / 50 / 100 % of your sLP — the review names the shares, their value now,
 * "Claim from Fri 14:02 UTC" and "Can't be cancelled" — with one slide (in session, uncapped); then, once a request is
 * ready and every market is open, claim it with one slide. The value is the pool's at claim time, so it is "≈". Both
 * slides close the sheet and the pool page shows the outcome.
 */
import type { LpRedeemView, LpSnapshot } from "@senryo/chain";
import { DECIMALS, formatUnits, RISK, utcSlotLabel } from "@senryo/core";
import { LP_SHARE_DECIMALS } from "@senryo/query";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { ChipRow } from "~/components/kit/ChipRow";
import { ChildSheet } from "~/components/sheet/ChildSheet";
import { SlideToConfirm } from "~/components/trade/SlideToConfirm";
import { DetailRow } from "~/features/markets/Disclosure";
import { useOutcome } from "~/features/trade/OutcomeNote";
import { pct, usd } from "~/lib/money";
import { useNetwork } from "~/lib/network";
import { useReviewGuard } from "~/lib/review-guard";
import { SPACE } from "~/theme";
import { LP_REDEEM_STEPS_BPS } from "./constants";
import type { useLp } from "./useLp";

type Lp = ReturnType<typeof useLp>;
const MS_PER_SECOND = 1000n;

/** A share count's value at the pool's conservative price. */
export const sharesValueOf = (shares: bigint, pool: LpSnapshot) =>
  pool.totalSupply > 0n ? (shares * pool.totalAssets) / pool.totalSupply : 0n;

export function RedeemSheet({
  open,
  onClose,
  lp,
  pool,
}: {
  open: boolean;
  onClose: () => void;
  lp: Lp;
  pool: LpSnapshot;
}) {
  const network = useNetwork();
  const [stepBps, setStepBps] = useState<bigint>(RISK.BPS);
  const shares = stepBps >= RISK.BPS ? pool.shares : (pool.shares * stepBps) / RISK.BPS;
  const guard = useReviewGuard([network.chainId, lp.address, shares].join(":"));
  const { unresolved } = useOutcome(lp.trace.events);
  const busy = lp.trace.running || unresolved;
  const claimFrom = BigInt(Date.now()) / MS_PER_SECOND + RISK.LP_REDEEM_DELAY;
  return (
    <ChildSheet open={open} onClose={onClose} title="Redeem" subtitle="From the Senryo pool">
      <View style={styles.chips}>
        <ChipRow
          options={LP_REDEEM_STEPS_BPS.map((b) => ({ value: String(b), label: pct(b) }))}
          value={String(stepBps)}
          onChange={(v) => setStepBps(BigInt(v))}
          label="How much to redeem"
        />
      </View>
      <View>
        <DetailRow label="Shares" value={`${formatUnits(shares, LP_SHARE_DECIMALS, DECIMALS.cents)} sLP`} />
        <DetailRow label="Value now" value={`≈ ${usd(sharesValueOf(shares, pool))}`} />
        <DetailRow label="Claim from" value={utcSlotLabel(claimFrom)} />
        <DetailRow label="Cancel" value="Can't be cancelled" />
      </View>
      <SlideToConfirm
        label={shares <= 0n ? "Nothing to redeem" : "Slide to request"}
        disabled={shares <= 0n || busy || !lp.ready}
        busy={busy}
        resetKey={[network.chainId, lp.address, shares].join("|")}
        onConfirm={() => {
          onClose();
          void lp.requestRedeem(shares, guard);
        }}
      />
    </ChildSheet>
  );
}

export function ClaimSheet({
  request,
  onClose,
  lp,
  pool,
}: {
  request: LpRedeemView | undefined;
  onClose: () => void;
  lp: Lp;
  pool: LpSnapshot;
}) {
  const network = useNetwork();
  const { unresolved } = useOutcome(lp.trace.events);
  const busy = lp.trace.running || unresolved;
  const nowSec = BigInt(Date.now()) / MS_PER_SECOND;
  const ready = request !== undefined && request.claimableAt <= nowSec && pool.allMarketsOpen;
  return (
    <ChildSheet open={request !== undefined} onClose={onClose} title="Claim" subtitle="To your wallet">
      {request ? (
        <View>
          <DetailRow label="Shares" value={`${formatUnits(request.shares, LP_SHARE_DECIMALS, DECIMALS.cents)} sLP`} />
          <DetailRow label="You get" value={`≈ ${usd(sharesValueOf(request.shares, pool))}`} />
        </View>
      ) : null}
      <SlideToConfirm
        label={ready ? "Slide to claim" : "Not claimable now"}
        disabled={!ready || busy || !lp.ready}
        busy={busy}
        resetKey={[network.chainId, lp.address, request?.requestId ?? ""].join("|")}
        onConfirm={() => {
          if (!request) return;
          onClose();
          void lp.claim(request.requestId);
        }}
      />
    </ChildSheet>
  );
}

const styles = StyleSheet.create({
  chips: { marginHorizontal: -SPACE.lgPlus },
});
