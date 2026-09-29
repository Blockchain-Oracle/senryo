"use client";
import { useEffect } from "react"
import { Demo } from "@/components/ui/candle-chart"

export default function DemoOne() {
  // open the preview in dark by default; the sandbox theme toggle still works
  return (
    <div className="w-full">
      <Demo />
    </div>
  )
}
