"use client";
import PartitionBar, {
  PartitionBarSegment,
  PartitionBarSegmentTitle,
  PartitionBarSegmentValue,
} from "@/components/ui/partition-bar";

export default function PartitionBarDemo() {
  return (
    <div className="w-full max-w-md">
      <PartitionBar size="md">
        <PartitionBarSegment num={3}>
          <PartitionBarSegmentTitle>Apples</PartitionBarSegmentTitle>
          <PartitionBarSegmentValue>30%</PartitionBarSegmentValue>
        </PartitionBarSegment>

        <PartitionBarSegment num={7} variant="secondary">
          <PartitionBarSegmentTitle>Oranges</PartitionBarSegmentTitle>
          <PartitionBarSegmentValue>70%</PartitionBarSegmentValue>
        </PartitionBarSegment>
      </PartitionBar>
    </div>
  );
}
