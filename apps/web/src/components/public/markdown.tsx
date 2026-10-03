/**
 * A small Markdown renderer for the repo's own guides (build time only: a server component, so none of it ships to the
 * browser). It covers what the guides use — ATX headings with anchors, paragraphs, ordered and bullet lists, fenced
 * code, quotes, rules and pipe tables; inline code, bold, italic, links and bare URLs — and renders anything else as a
 * plain paragraph. The source is trusted repo content and becomes React elements, never raw HTML.
 * Links: same-site URLs become in-app paths, repo-relative paths open the file on GitHub, the rest open in a new tab.
 */
import Link from "next/link";
import type { ReactNode } from "react";

export interface LinkContext {
  /** The app's own origin (`https://senryo.xyz`): links to it stay in the app. */
  site: string;
  /** The repository's web URL (`https://github.com/<org>/<repo>`). */
  repo: string;
  /** The guide's folder in the repo (`docs`), for resolving relative links. */
  dir: string;
  branch: string;
}

type Block =
  | { kind: "heading"; at: number; level: number; text: string }
  | { kind: "paragraph"; at: number; text: string }
  | { kind: "list"; at: number; ordered: boolean; start: number; items: string[] }
  | { kind: "code"; at: number; text: string }
  | { kind: "quote"; at: number; text: string }
  | { kind: "rule"; at: number }
  | { kind: "table"; at: number; head: string[]; rows: string[][] };

const FENCE = /^\s{0,3}```/;
const HEADING = /^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/;
const RULE = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/;
const ITEM = /^\s{0,3}(?:[-*+]|(\d+)[.)])\s+(.*)$/;
const QUOTE = /^\s{0,3}>\s?(.*)$/;
const TABLE_SEPARATOR = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/;
const BLANK = /^\s*$/;
const INDENTED = /^\s+\S/;

const isTableStart = (line: string, next: string | undefined) =>
  line.includes("|") && next !== undefined && TABLE_SEPARATOR.test(next);

const startsBlock = (line: string, next: string | undefined) =>
  FENCE.test(line) ||
  HEADING.test(line) ||
  RULE.test(line) ||
  ITEM.test(line) ||
  QUOTE.test(line) ||
  isTableStart(line, next);

const cells = (line: string) =>
  line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());

/** Splits the source into blocks; `at` is the block's first line (a stable key). */
export function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    const at = i;
    if (BLANK.test(line)) {
      i++;
      continue;
    }
    if (FENCE.test(line)) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !FENCE.test(lines[i] ?? "")) body.push(lines[i++] ?? "");
      i++;
      blocks.push({ kind: "code", at, text: body.join("\n") });
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      blocks.push({ kind: "heading", at, level: heading[1]?.length ?? 1, text: heading[2] ?? "" });
      i++;
      continue;
    }
    if (RULE.test(line)) {
      blocks.push({ kind: "rule", at });
      i++;
      continue;
    }
    if (isTableStart(line, lines[i + 1])) {
      const head = cells(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && (lines[i] ?? "").includes("|") && !BLANK.test(lines[i] ?? ""))
        rows.push(cells(lines[i++] ?? ""));
      blocks.push({ kind: "table", at, head, rows });
      continue;
    }
    const first = ITEM.exec(line);
    if (first) {
      const ordered = first[1] !== undefined;
      const items: string[] = [first[2] ?? ""];
      i++;
      while (i < lines.length) {
        const next = lines[i] ?? "";
        const item = ITEM.exec(next);
        if (item && (item[1] !== undefined) === ordered && !INDENTED.test(next)) {
          items.push(item[2] ?? "");
        } else if (INDENTED.test(next)) {
          items[items.length - 1] = `${items.at(-1) ?? ""} ${next.trim()}`;
        } else break;
        i++;
      }
      blocks.push({ kind: "list", at, ordered, start: Number(first[1] ?? 1), items });
      continue;
    }
    if (QUOTE.test(line)) {
      const body: string[] = [];
      while (i < lines.length && QUOTE.test(lines[i] ?? "")) body.push(QUOTE.exec(lines[i++] ?? "")?.[1] ?? "");
      blocks.push({ kind: "quote", at, text: body.join(" ") });
      continue;
    }
    const body: string[] = [line.trim()];
    i++;
    while (i < lines.length && !BLANK.test(lines[i] ?? "") && !startsBlock(lines[i] ?? "", lines[i + 1])) {
      body.push((lines[i++] ?? "").trim());
    }
    blocks.push({ kind: "paragraph", at, text: body.join(" ") });
  }
  return blocks;
}

/** code · **bold** · __bold__ · *italic* · _italic_ · [text](href) · a bare http(s) URL (trailing punctuation left out). */
const INLINE =
  /`([^`]+)`|\*\*(.+?)\*\*|__(.+?)__|\*([^*\s](?:[^*]*[^*\s])?)\*|(?<!\w)_([^_\s](?:[^_]*[^_\s])?)_(?!\w)|\[([^\]]+)\]\(([^)\s]+)\)|(https?:\/\/[^\s<>()]*[^\s<>().,;:!?'"*])/g;

const LINK = "text-link underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring";

/** Where a guide link goes: an in-app path, or an external URL (repo files open on GitHub). */
export function resolveHref(href: string, ctx: LinkContext): { href: string; external: boolean } {
  if (href.startsWith("#")) return { href, external: false };
  if (href.startsWith(ctx.site)) return { href: href.slice(ctx.site.length) || "/", external: false };
  if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return { href, external: true };
  const path = new URL(href, `https://repo.invalid/${ctx.dir}/`).pathname;
  const kind = /\.[a-z0-9]+$/i.test(path) ? "blob" : "tree";
  return { href: `${ctx.repo}/${kind}/${ctx.branch}${path}`, external: true };
}

function Anchor({ href, ctx, children }: { href: string; ctx: LinkContext; children: ReactNode }) {
  const to = resolveHref(href, ctx);
  if (to.external)
    return (
      <a href={to.href} target="_blank" rel="noopener noreferrer" className={LINK}>
        {children}
      </a>
    );
  return (
    <Link href={to.href} prefetch={false} className={LINK}>
      {children}
    </Link>
  );
}

export function inline(text: string, ctx: LinkContext): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    const [whole, code, bold, bold2, em, em2, label, href, url] = m;
    const key = `${at}`;
    if (code !== undefined)
      out.push(
        <code key={key} className="rounded-xs bg-raised-2 px-1 py-0.5 font-mono text-[0.9em] text-foreground">
          {code}
        </code>,
      );
    else if (bold !== undefined || bold2 !== undefined)
      out.push(
        <strong key={key} className="font-semibold text-foreground">
          {inline(bold ?? bold2 ?? "", ctx)}
        </strong>,
      );
    else if (em !== undefined || em2 !== undefined) out.push(<em key={key}>{inline(em ?? em2 ?? "", ctx)}</em>);
    else if (label !== undefined && href !== undefined)
      out.push(
        <Anchor key={key} href={href} ctx={ctx}>
          {inline(label, ctx)}
        </Anchor>,
      );
    else if (url !== undefined)
      out.push(
        <Anchor key={key} href={url} ctx={ctx}>
          {url}
        </Anchor>,
      );
    last = at + whole.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** A heading's anchor id from its words: "6. Indexer (Envio)" → "6-indexer-envio". */
export function slug(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

const HEADING_CLASS: Record<number, string> = {
  1: "text-page-title",
  2: "mt-10 scroll-mt-6 text-section-title",
  3: "mt-6 scroll-mt-6 text-row font-semibold",
};
const PROSE = "mt-3 text-body text-text-2 leading-relaxed";

function renderBlock(b: Block, ctx: LinkContext): ReactNode {
  switch (b.kind) {
    case "heading": {
      const Tag = (["h1", "h2", "h3", "h4", "h5", "h6"] as const)[b.level - 1] ?? "h6";
      return (
        <Tag key={b.at} id={slug(b.text)} className={HEADING_CLASS[b.level] ?? HEADING_CLASS[3]}>
          {inline(b.text, ctx)}
        </Tag>
      );
    }
    case "paragraph":
      return (
        <p key={b.at} className={PROSE}>
          {inline(b.text, ctx)}
        </p>
      );
    case "list": {
      const items = b.items.map((item) => <li key={`${b.at}:${item}`}>{inline(item, ctx)}</li>);
      return b.ordered ? (
        <ol key={b.at} start={b.start} className={`${PROSE} grid list-decimal gap-2 pl-5 marker:text-text-3`}>
          {items}
        </ol>
      ) : (
        <ul key={b.at} className={`${PROSE} grid list-disc gap-2 pl-5 marker:text-text-3`}>
          {items}
        </ul>
      );
    }
    case "code":
      return (
        <pre key={b.at} className="mt-3 overflow-x-auto rounded-md bg-raised-2 p-4 font-mono text-meta text-foreground">
          <code>{b.text}</code>
        </pre>
      );
    case "quote":
      return (
        <blockquote key={b.at} className={`${PROSE} border-border border-l-2 pl-4`}>
          {inline(b.text, ctx)}
        </blockquote>
      );
    case "rule":
      return <hr key={b.at} className="my-8 border-border" />;
    case "table":
      return (
        <div key={b.at} className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-meta">
            <thead className="text-text-3">
              <tr>
                {b.head.map((h) => (
                  <th key={h} className="py-2 pr-4 font-normal">
                    {inline(h, ctx)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="text-text-2">
              {b.rows.map((row) => (
                <tr key={row.join("|")} className="border-border/60 border-t">
                  {b.head.map((h, c) => (
                    <td key={h} className="py-2 pr-4 align-top">
                      {inline(row[c] ?? "", ctx)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

/** The guide as React elements (server-rendered at build). */
export function Markdown({ source, links }: { source: string; links: LinkContext }) {
  return <>{parseBlocks(source).map((b) => renderBlock(b, links))}</>;
}
