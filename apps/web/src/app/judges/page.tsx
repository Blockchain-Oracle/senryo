import { readFileSync } from "node:fs";
import { join } from "node:path";
import { WEB_ORIGIN } from "@senryo/config";
import type { Metadata } from "next";
import { Markdown } from "@/components/public/markdown";
import { PublicHeader } from "@/components/public/public-header";
import { REPO } from "@/lib/constants/brand";

export const metadata: Metadata = {
  title: "Judge guide",
  description:
    "The fastest way through Senryo: Practice in five minutes, the stateless test, Mainnet on Perpl, watch mode.",
};

/** The guide's place in the repo; `next build` and `next dev` run from apps/web (the Dockerfile builds the whole repo). */
const GUIDE_DIR = "docs";
const GUIDE = join(process.cwd(), "..", "..", GUIDE_DIR, "judges.md");

/**
 * /judges — the judge guide (F90 "Judge? Start here"). `docs/judges.md` stays the one source: this server component
 * reads it at build (and per request in dev), so the page can't drift from the repo and nothing of it ships as JS.
 */
export default function JudgesPage() {
  const source = readFileSync(GUIDE, "utf8");
  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-16">
      <PublicHeader current="judges" />
      <article className="pt-8">
        <Markdown source={source} links={{ site: WEB_ORIGIN, repo: REPO.url, branch: REPO.branch, dir: GUIDE_DIR }} />
      </article>
    </main>
  );
}
