import type { Metadata } from "next";
import { PublicHeader } from "@/components/public/public-header";
import { WindowPage } from "@/features/proof/WindowPage";

export const metadata: Metadata = {
  title: "A window's proof",
  description: "The two prices that decided a window, posted on chain, every band's verdict, and a way to re-check it.",
};

/** One window's proof, re-verifiable in the browser (S7.7, D-288). */
export default function ProofWindowPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-6 px-4 pb-16">
      <PublicHeader />
      <WindowPage />
    </main>
  );
}
