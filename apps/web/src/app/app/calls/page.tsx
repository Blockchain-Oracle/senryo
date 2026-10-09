import type { Metadata } from "next";
import { CallsScreen } from "@/features/calls/CallsScreen";

export const metadata: Metadata = { title: "Calls" };

export default function CallsPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <h1 className="font-semibold text-page-title">Calls</h1>
      <CallsScreen />
    </div>
  );
}
