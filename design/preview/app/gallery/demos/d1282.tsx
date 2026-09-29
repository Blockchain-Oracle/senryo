"use client";
import { NumberTicker } from "@/components/ui/number-ticker"

function NumberTickerDemo() {
  return (
    <p className="whitespace-pre-wrap text-8xl font-medium tracking-tighter text-black dark:text-white">
      <NumberTicker value={100} />
    </p>
  )
}

function NumberTickerWithDecimal() {
  return (
    <p className="whitespace-pre-wrap text-8xl font-medium tracking-tighter text-black dark:text-white">
      <NumberTicker value={5.67} decimalPlaces={2} />
    </p>
  )
}



export default function __All(){return <div className="flex w-full flex-col items-center gap-6"><NumberTickerDemo /><NumberTickerWithDecimal /></div>}
