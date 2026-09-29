"use client";
import { useState } from "react"
import { Slider } from "@/components/ui/slider-number-flow"

export function SliderDemo() {
  const [value, setValue] = useState([50])

  return (
    <div className="flex items-center justify-center p-8">
      <Slider 
        value={value}
        onValueChange={setValue}
        min={0}
        max={100}
        step={1}
        aria-label="Volume"
      />
    </div>
  )
}
export default SliderDemo;
