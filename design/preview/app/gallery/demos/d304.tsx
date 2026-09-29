"use client";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

function Component() {
  return (
    <div className="space-y-4 min-w-[300px]">
      <Label>Slider with solid thumb</Label>
      <Slider
        defaultValue={[25]}
        className="[&>:first-child>span]:opacity-70 [&>:last-child>span]:bg-primary"
        aria-label="Slider with solid thumb"
      />
    </div>
  );
}

export { Component };

export default Component;
