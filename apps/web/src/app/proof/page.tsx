import type { Metadata } from "next";
import { PublicHeader } from "@/components/public/public-header";
import { ProofFeed } from "@/features/proof/ProofFeed";

export const metadata: Metadata = {
  title: "Proof",
  description: "Every window with calls: the prints that decided it, on chain, and a way to check them yourself.",
};

/** The Proof feed: every window anyone called in, newest first (S7.7). */
export default function ProofPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-6 px-4 pb-16">
      <PublicHeader />
      <div className="flex flex-col gap-2">
        <h1 className="font-semibold text-page-title">Proof</h1>
        <p className="text-body text-text-2">
          Every window with calls and the two prices that decided it — each posted on chain with Pyth's signed proof.
          Open one to re-check it yourself.
        </p>
      </div>
      <ProofFeed />
    </main>
  );
}
