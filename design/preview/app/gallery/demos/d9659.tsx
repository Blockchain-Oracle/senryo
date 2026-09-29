"use client"

import { SegmentedProgress } from "@/components/ui/progress-bar"

export default function Page() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8 w-full">
      <div className="w-full max-w-md">
        <SegmentedProgress />
      </div>
    </div>
  )
}
