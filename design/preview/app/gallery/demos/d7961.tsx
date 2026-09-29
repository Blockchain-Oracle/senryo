"use client"

import SegmentedButtonGroup from "@/components/ui/segmented-button-group"
import { useState } from "react"

export default function SegmentedButtonGroupDemo() {
  const [period, setPeriod] = useState("Day")

  return (
    <div className="p-6 flex flex-col gap-4">
      <SegmentedButtonGroup
        options={["Day", "Week", "Month"]}
        selected={period}
        onChange={(value) => setPeriod(value)}
      />
      <p>Selected Period: {period}</p>

      <SegmentedButtonGroup
        options={["Low", "Medium", "High", "Critical"]}
        onChange={(value) => console.log("Priority selected:", value)}
      />
    </div>
  )
}
