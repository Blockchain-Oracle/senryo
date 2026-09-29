"use client";
import { Gauge } from "@/components/ui/gauge-1";

export default function DemoOne() {
  return <Gauge
        value={81}
        size={200}
        gradient={true} 
        primary="success"
        tickMarks={true}
        label="Progress"
        transition={{ length: 1200, delay: 200 }}
      />;
}
