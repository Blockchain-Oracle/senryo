import type { LegalDocument } from "@senryo/config";
import Link from "next/link";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { BRAND } from "@/lib/constants/brand";

/**
 * A legal page on the web (the app's own text from @senryo/config, so the store listings' policy URL and the app can
 * never disagree): the wordmark home, the title and its date, the plain-language intro, then each section.
 */
export function LegalDocumentPage({ doc, other }: { doc: LegalDocument; other: { href: string; label: string } }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-6 pt-6 pb-16">
      <div className="flex items-center justify-between">
        <Link href="/" className="font-bold font-mono text-num-sm tracking-tight">
          {BRAND.wordmark}
        </Link>
        <ThemeToggle />
      </div>
      <article className="mt-12 space-y-8">
        <header className="space-y-2">
          <h1 className="font-mono font-semibold text-num-lg tracking-tight">{doc.title}</h1>
          <p className="text-caption text-muted-foreground">Updated {doc.updated}</p>
          <p className="text-body text-muted-foreground">{doc.intro}</p>
        </header>
        {doc.sections.map((s) => (
          <section key={s.heading} className="space-y-2">
            <h2 className="font-semibold text-body">{s.heading}</h2>
            <p className="text-body text-muted-foreground leading-relaxed">{s.body}</p>
          </section>
        ))}
      </article>
      <footer className="mt-16 text-caption text-muted-foreground">
        <Link href={other.href} className="underline underline-offset-4">
          {other.label}
        </Link>
      </footer>
    </main>
  );
}
