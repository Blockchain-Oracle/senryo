import Link from "next/link";
import { WelcomeActions } from "@/components/auth/welcome-actions";
import { QUIET_LINK } from "@/components/public/styles";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { BRAND, WELCOME_SEAL_SIZE } from "@/lib/constants/brand";
import { ROUTES } from "@/lib/constants/routes";

const POINTS = ["Gold, FX and crypto · long or short", "Any token on Monad", "Practice money to start"] as const;

/**
 * Welcome (flow book A1–A3; the phone's first launch without the story): the real seal, the name, three short lines
 * and the fixed actions — Create account (primary), I have an account, Look around. The brand block pre-renders; the
 * passkey actions hydrate on the client. The top line carries the two public pages as quiet text (F90 "Judge? Start
 * here", D-022 Stats); they don't prefetch, so the landing bundle stays as it was.
 */
export default function Welcome() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pt-4 pb-10">
      <div className="flex items-center justify-between gap-3">
        <Link href={ROUTES.judges} prefetch={false} className={QUIET_LINK}>
          Judge? Start here ›
        </Link>
        <div className="flex items-center gap-1">
          <Link href={ROUTES.stats} prefetch={false} className={QUIET_LINK}>
            Stats
          </Link>
          <ThemeToggle />
        </div>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 py-10 text-center">
        {/* The seal as a static asset (brand/senryo-seal.svg, served from /brand): the first paint carries no art table. */}
        {/* biome-ignore lint/performance/noImgElement: a static export has no image optimizer */}
        <img src="/brand/seal.svg" alt="" width={WELCOME_SEAL_SIZE} height={WELCOME_SEAL_SIZE} />
        <h1 className="font-display text-page-title">
          {BRAND.name} <span className="text-text-3">{BRAND.kanji}</span>
        </h1>
        <ul className="grid gap-1 text-row text-text-2">
          {POINTS.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </div>
      <WelcomeActions />
    </main>
  );
}
