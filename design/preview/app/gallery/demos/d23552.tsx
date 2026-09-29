"use client";

import { SegmentedControl } from "@/components/ui/segmented-control";
import { useState } from "react";

const RANGES = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "quarter", label: "Quarter" },
];

export default function SegmentedControlDemo() {
  const [range, setRange] = useState("day");

  return (
    <div className="flex w-full justify-center">
      <SegmentedControl
        label="Report range"
        options={RANGES}
        value={range}
        onValueChange={setRange}
      />
    </div>
  );
}
