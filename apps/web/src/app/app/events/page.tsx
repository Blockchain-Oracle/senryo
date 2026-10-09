import type { Metadata } from "next";
import { EventsScreen } from "@/features/events/EventsScreen";

export const metadata: Metadata = { title: "Events" };

export default function EventsPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <h1 className="font-semibold text-page-title">Events</h1>
      <EventsScreen />
    </div>
  );
}
