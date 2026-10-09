import Link from "next/link";
import { QUIET_LINK } from "@/components/public/styles";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { BRAND } from "@/lib/constants/brand";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils";

const PAGES = [{ id: "judges", label: "Judge guide", href: ROUTES.judges }] as const;

/**
 * The public pages' top line (outside the app shell, like the legal pages): the wordmark home, the two public pages
 * as quiet text links (the current one in ink), and the theme toggle.
 */
export function PublicHeader({ current }: { current?: (typeof PAGES)[number]["id"] }) {
  return (
    <header className="flex items-center justify-between gap-3 pt-4">
      {/* No prefetch: the welcome's payload preloads the seal art, which this page never shows (a console warning). */}
      <Link
        href={ROUTES.welcome}
        prefetch={false}
        className="rounded-xs font-bold font-mono text-num-sm tracking-tight focus-visible:outline-2 focus-visible:outline-ring"
      >
        {BRAND.wordmark}
      </Link>
      <nav aria-label="Public pages" className="flex items-center gap-1">
        {PAGES.map((p) => (
          <Link
            key={p.id}
            href={p.href}
            aria-current={p.id === current ? "page" : undefined}
            className={cn(QUIET_LINK, p.id === current && "text-foreground")}
          >
            {p.label}
          </Link>
        ))}
        <ThemeToggle />
      </nav>
    </header>
  );
}
