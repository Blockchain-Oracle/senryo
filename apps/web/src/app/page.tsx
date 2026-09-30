import { ArrowRight, Fingerprint } from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { Button } from "@/components/ui/button";
import { BRAND } from "@/lib/constants/brand";
import { ROUTES } from "@/lib/constants/routes";

const POINTS = [
  ["ONE BALANCE", "Free to trade · Free to spend · Locked — risk-accounted, never double-counted."],
  ["GOLD · SILVER · CRYPTO", "Perps at the oracle price on Monad; crypto via Perpl."],
  ["KINPAKU 金箔", "A card that spends what's free, never your margin."],
] as const;

/** Welcome (F01). Passkey sign-in is wired in S6; this is the static entry point. */
export default function Welcome() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pt-6 pb-10">
      <div className="flex items-center justify-between">
        <span className="font-bold font-mono text-num-sm tracking-tight">{BRAND.wordmark}</span>
        <ThemeToggle />
      </div>

      <div className="flex flex-1 flex-col justify-center gap-8 py-12">
        <div
          aria-hidden
          className="flex size-24 items-center justify-center rounded-lg bg-gold font-bold text-background text-num-hero"
        >
          千
        </div>
        <div className="space-y-3">
          <h1 className="font-mono font-semibold text-num-lg tracking-tight">
            {BRAND.name} <span className="text-muted-foreground">{BRAND.kanji}</span>
          </h1>
          <p className="max-w-sm text-body text-muted-foreground">{BRAND.description}</p>
        </div>
        <dl className="divide-y divide-border border-border border-y">
          {POINTS.map(([k, v]) => (
            <div key={k} className="py-3">
              <dt className="font-mono text-label text-primary tracking-[0.14em]">{k}</dt>
              <dd className="mt-1 text-caption text-muted-foreground">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="space-y-3">
        <Button size="lg" className="w-full" disabled aria-describedby="passkey-note">
          <Fingerprint />
          Continue with passkey
        </Button>
        <p
          id="passkey-note"
          className="text-center font-mono text-micro text-muted-foreground uppercase tracking-[0.12em]"
        >
          Passkey sign-in arrives with the account stage
        </p>
        <Button asChild variant="outline" size="lg" className="w-full">
          <Link href={ROUTES.markets}>
            Look around first
            <ArrowRight />
          </Link>
        </Button>
      </div>
    </main>
  );
}
