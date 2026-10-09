import type { Metadata } from "next";
import { PublicHeader } from "@/components/public/public-header";
import { PublicCall } from "@/features/calls/PublicCall";

export const metadata: Metadata = {
  title: "A call on Senryo",
  description: "A call on live prices: its result, every step with its transaction, and the window's proof.",
};

/** A shared call's public receipt (the share card's link). */
export default function CallPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-8 px-4 pb-16">
      <PublicHeader />
      <PublicCall />
    </main>
  );
}
