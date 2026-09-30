// 21st: felipemenezes098/sign-in-4 + verify-identity-3 — https://21st.dev/@felipemenezes098/components/sign-in-4
// (D2 preview copies, written from `21st get` because `21st add` fails on their shadcn/button dependency). The shared
// structure — glyph tile, title, one balanced line, action stack, trust footer — is kept; D2 re-tokenized: hairline
// card, 4 px radius, no shadow, mono title/labels, glyph tile tinted by tone (primary / gold / down).
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type GlyphTone = "primary" | "gold" | "down" | "muted";

const GLYPH: Record<GlyphTone, string> = {
  primary: "border-primary/30 bg-primary/10 text-primary",
  gold: "border-gold/40 bg-gold/10 text-gold",
  down: "border-down/40 bg-down/10 text-down",
  muted: "border-border bg-muted text-muted-foreground",
};

export function AuthCard({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("w-full rounded-lg border border-border bg-card text-card-foreground", className)} {...props} />
  );
}

export function AuthCardHeader({
  glyph,
  tone = "primary",
  badge,
  title,
  children,
}: {
  glyph: ReactNode;
  tone?: GlyphTone;
  /** A small status mark on the glyph (verify-identity-3's spinner badge). */
  badge?: ReactNode;
  title: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="grid justify-items-center gap-2 px-6 pt-6 pb-4 text-center">
      <div
        className={cn(
          "relative mb-2 flex size-14 items-center justify-center rounded-lg border [&_svg]:size-7",
          GLYPH[tone],
        )}
      >
        {glyph}
        {badge ? (
          <span className="absolute -right-1.5 -bottom-1.5 flex size-5 items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground [&_svg]:size-3">
            {badge}
          </span>
        ) : null}
      </div>
      <h2 className="font-mono font-semibold text-num-sm tracking-tight">{title}</h2>
      {children ? <div className="max-w-xs text-balance text-caption text-muted-foreground">{children}</div> : null}
    </div>
  );
}

export function AuthCardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-3 px-6 pb-5", className)} {...props} />;
}

export function AuthCardFooter({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-center gap-1.5 border-border border-t px-6 py-3 font-mono text-micro text-muted-foreground uppercase tracking-[0.12em] [&_svg]:size-3.5">
      {children}
    </div>
  );
}
