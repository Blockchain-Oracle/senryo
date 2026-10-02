"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The one row (Part A rule 5, "rows, not boxes"): a leading mark, a title with at most one short subtitle, and a trailing
 * value with an optional second line. A link or an action makes the whole row the target; otherwise it is static.
 */
export function ListRow({
  leading,
  title,
  subtitle,
  value,
  detail,
  detailClassName,
  href,
  onClick,
  trailing,
  className,
}: {
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  value?: ReactNode;
  detail?: ReactNode;
  detailClassName?: string | undefined;
  href?: string | undefined;
  onClick?: (() => void) | undefined;
  trailing?: ReactNode;
  className?: string;
}) {
  const body = (
    <>
      {leading ? <span className="shrink-0">{leading}</span> : null}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-row text-foreground">{title}</span>
        {subtitle ? <span className="block truncate text-meta text-text-2">{subtitle}</span> : null}
      </span>
      {value !== undefined || detail !== undefined ? (
        <span className="shrink-0 text-right">
          {value !== undefined ? <span className="block text-row text-foreground tnum">{value}</span> : null}
          {detail !== undefined ? (
            <span className={cn("block text-meta text-text-2 tnum", detailClassName)}>{detail}</span>
          ) : null}
        </span>
      ) : null}
      {trailing}
    </>
  );
  const shell = cn(
    "-mx-2 flex min-h-16 items-center gap-3 rounded-md px-2 py-2 text-left outline-none",
    (href || onClick) && "transition-colors hover:bg-row-pressed focus-visible:ring-2 focus-visible:ring-ring",
    className,
  );
  if (href)
    return (
      <Link href={href} className={shell}>
        {body}
      </Link>
    );
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={cn(shell, "w-[calc(100%+1rem)]")}>
        {body}
      </button>
    );
  return <div className={shell}>{body}</div>;
}

/** A one-line quiet state with its next action ("Couldn't load · Retry", "No positions · Markets"). */
export function QuietLine({
  children,
  action,
  className,
}: {
  children: ReactNode;
  action?: { label: string; href?: string; onClick?: () => void } | undefined;
  className?: string;
}) {
  return (
    <p className={cn("py-3 text-meta text-text-2", className)}>
      {children}
      {action ? (
        <>
          {" · "}
          {action.href ? (
            <Link href={action.href} className="text-link hover:underline">
              {action.label}
            </Link>
          ) : (
            <button type="button" onClick={action.onClick} className="text-link hover:underline">
              {action.label}
            </button>
          )}
        </>
      ) : null}
    </p>
  );
}

/** A label + value line for review and Details (no table boxes on primary screens). */
export function DetailRow({
  label,
  value,
  tone,
}: {
  label: ReactNode;
  value: ReactNode;
  tone?: "up" | "down" | "warn" | undefined;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 text-meta">
      <span className="text-text-2">{label}</span>
      <span
        className={cn(
          "text-right text-foreground tnum",
          tone === "up" && "text-up",
          tone === "down" && "text-down",
          tone === "warn" && "text-warn",
        )}
      >
        {value}
      </span>
    </div>
  );
}
