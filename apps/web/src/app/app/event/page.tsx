import type { Metadata } from "next";
import { Suspense } from "react";
import { EventDetail } from "@/features/events/EventDetail";

export const metadata: Metadata = { title: "Event" };

/** One yes/no question (`?id=`): the call, the rule, and each committee member's signed answer. */
export default function EventPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <Suspense>
        <EventDetail />
      </Suspense>
    </div>
  );
}
