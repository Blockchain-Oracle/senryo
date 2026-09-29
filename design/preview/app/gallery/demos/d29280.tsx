"use client";
import UpstashRatelimit from "@/components/ui/upstash-ratelimit";

export default function UpstashRatelimitDemo() {
  return (
    <div className="flex w-full max-w-sm items-center justify-center p-8">
      <UpstashRatelimit
        limit={10}
        remaining={6}
        reset={Date.now() + 45000}
        success={true}
        className="w-full"
      />
    </div>
  );
}
