"use client";
import { useEffect } from "react"
import { SwapTicket } from "@/components/ui/swap-ticket"

export default function DemoOne() {
  // open the preview dark by default; the sandbox theme toggle still works
  return (
    <div className="flex min-h-[520px] w-full items-center justify-center p-6">
      <div className="w-full max-w-[360px]">
        <SwapTicket />
      </div>
    </div>
  )
}
