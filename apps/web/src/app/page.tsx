import { ids } from "@senryo/identity";
import { WelcomeActions } from "@/components/auth/welcome-actions";
import { EntityMark } from "@/components/identity/entity-mark";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { BRAND, WELCOME_SEAL_SIZE } from "@/lib/constants/brand";

const POINTS = ["Gold, FX and crypto · long or short", "Any token on Monad", "Practice money to start"] as const;

/**
 * Welcome (flow book A1–A3; the phone's first launch without the story): the real seal, the name, three short lines
 * and the fixed actions — Create account (primary), I have an account, Look around. The brand block pre-renders; the
 * passkey actions hydrate on the client.
 */
export default function Welcome() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pt-4 pb-10">
      <div className="flex justify-end">
        <ThemeToggle />
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 py-10 text-center">
        <EntityMark id={ids.brand("senryo")} size={WELCOME_SEAL_SIZE} variant="symbol" decorative />
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
