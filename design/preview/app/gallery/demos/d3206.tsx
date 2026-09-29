"use client";
import { Button } from "@/components/ui/button";
import Image from "next/image";

import { LiquidCard } from "@/components/ui/liquid-glass-card";

export default function DemoOne() {
  return (
    <div className="">
      <LiquidCard className="w-full  min-w-[350px] p-2">
        <div className="relative overflow-hidden">
          <Image
            src="https://cdn.21st.dev/assets/localized/56517931228105a9b6e458e721a27d4cb2623922468783ccad45b818b0a71273.svg"
            alt="Your Image"
            height={700}
            width={700}
            className="h-[420px] w-full rounded-sm object-cover"
          />
          <Image
            src="https://cdn.21st.dev/assets/mirror/25/25554f6d4d8dbfe745a93f73833f6123f99d82914510127f9c182f6b1e8ab122.jpg"
            alt="Your Image"
            height={300}
            width={300}
            className="absolute top-36 left-1/2 z-10 h-[200px] w-[200px] -translate-x-1/2 -translate-y-1/2 rounded-md border-4 object-cover shadow-xl transition-all duration-500 hover:scale-105"
          />

          <div className="absolute bottom-0 left-0 w-full rounded-b-md bg-gradient-to-t from-black/80 to-transparent p-8">
            <div>
              <h1 className="text-2xl text-white">Subscribe</h1>
              <p className="text-sm text-white/80">
                Subscribe to a plan, get access to Dashboard, and start listing
                your requests.
              </p>
              <Button className="mt-3">Learn More</Button>
            </div>
          </div>
        </div>
      </LiquidCard>
    </div>
  );
}
