"use client";
import { RetroButton } from "@/components/ui/retro-button"

function RetroButtonDemo() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-wrap justify-center items-center max-w-[26em] gap-4">
        <RetroButton>Record</RetroButton>
        <RetroButton variant="darkGray">Sound</RetroButton>
        <RetroButton variant="white">Erase</RetroButton>
        <RetroButton variant="lightGray">Shift</RetroButton>
        <RetroButton variant="gray">Play</RetroButton>
      </div>
    </div>
  )
}


export default function __All(){return <div className="flex w-full flex-col items-center gap-6"><RetroButtonDemo /></div>}
