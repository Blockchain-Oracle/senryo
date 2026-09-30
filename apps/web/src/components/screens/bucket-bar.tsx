import {
  PartitionBar,
  PartitionBarSegment,
  PartitionBarSegmentTitle,
  PartitionBarSegmentValue,
} from "@/components/ui/partition-bar";
import { BALANCE } from "@/lib/sample";

const PERCENT = 100n;

/** Whole-percent share of the total (bigint maths; the bar only needs integers). */
function share(part: bigint): number {
  const whole = BALANCE.total6 > 0n ? (part * PERCENT) / BALANCE.total6 : 0n;
  return Number(whole);
}

const SEGMENTS = [
  { key: "TRADE", value: BALANCE.freeToTrade6, variant: "default" },
  { key: "SPEND", value: BALANCE.freeToSpend6, variant: "secondary" },
  { key: "LOCK", value: BALANCE.locked6, variant: "outline" },
] as const;

/** D2 bucket proportion bar (Partition Bar #26545). */
export function BucketBar({ className }: { className?: string }) {
  return (
    <div className={className}>
      <PartitionBar size="sm" aria-label="Balance split">
        {SEGMENTS.map((s) => {
          const pct = share(s.value);
          return (
            <PartitionBarSegment key={s.key} num={pct} variant={s.variant}>
              <PartitionBarSegmentTitle>{s.key}</PartitionBarSegmentTitle>
              <PartitionBarSegmentValue>{pct}%</PartitionBarSegmentValue>
            </PartitionBarSegment>
          );
        })}
      </PartitionBar>
    </div>
  );
}
