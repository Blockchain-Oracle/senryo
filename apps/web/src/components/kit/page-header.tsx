"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const CIRCLE =
  "inline-flex size-9 items-center justify-center rounded-full bg-raised-2 text-foreground transition-colors hover:bg-row-pressed focus-visible:outline-2 focus-visible:outline-ring";

/**
 * A pushed page's header (Fomo grammar): a Back circle, the centred title, and up to two utility circles on the right.
 * `back` is the parent path; without one, Back goes to the previous page.
 */
export function PageHeader({
  title,
  back,
  right,
  className,
}: {
  title?: ReactNode;
  back?: string;
  right?: ReactNode;
  className?: string;
}) {
  const router = useRouter();
  return (
    <header className={cn("grid grid-cols-[2.25rem_1fr_auto] items-center gap-2 pt-4 pb-2", className)}>
      {back ? (
        <Link href={back} aria-label="Back" className={CIRCLE}>
          <ChevronLeft className="size-5" />
        </Link>
      ) : (
        <button type="button" aria-label="Back" onClick={() => router.back()} className={CIRCLE}>
          <ChevronLeft className="size-5" />
        </button>
      )}
      <h1 className="truncate text-center text-sheet-title">{title}</h1>
      <div className="flex min-w-9 justify-end gap-2">{right}</div>
    </header>
  );
}

/** A 36 px utility circle for a header (share, alert, settings). */
export function UtilityCircle({
  label,
  children,
  href,
  onClick,
}: {
  label: string;
  children: ReactNode;
  href?: string;
  onClick?: () => void;
}) {
  if (href)
    return (
      <Link href={href} aria-label={label} title={label} className={CIRCLE}>
        {children}
      </Link>
    );
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className={CIRCLE}>
      {children}
    </button>
  );
}

/** A tab page's title row (Home has none; Markets, Card, Social and You do). */
export function TabTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between pt-5 pb-2">
      <h1 className="text-page-title">{children}</h1>
      {right ? <div className="flex gap-2">{right}</div> : null}
    </div>
  );
}
