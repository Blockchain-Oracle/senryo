"use client";
/**
 * The Proof feed (`/proof/`, S7.7): every window anyone called in, newest first — the market, its lane and time, how
 * it closed against its line and how many calls rode it — each opening the window's proof. Public, no account.
 */
import { windowRow } from "@senryo/calls";
import { marketId } from "@senryo/identity";
import { useWindows } from "@senryo/query";
import Link from "next/link";
import { EntityMark } from "@/components/identity/entity-mark";
import { PublicQuery } from "@/components/public/public-query";

const MARK = 32;

function Feed({ chainId }: { chainId: number }) {
  const q = useWindows(undefined);
  if (q.status === "error") return <p className="text-body text-text-2">The proof feed didn't load.</p>;
  const windows = q.data?.pages.flatMap((p) => p.windows) ?? [];
  if (q.status === "pending") return <div aria-busy className="h-64 animate-pulse rounded-lg bg-skeleton" />;
  if (windows.length === 0) return <p className="text-body text-text-2">No window has calls yet.</p>;
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col">
        {windows.map((w) => {
          const row = windowRow(w);
          return (
            <li key={w.windowId}>
              <Link
                href={`/proof/w/?id=${w.windowId}&chainId=${chainId}`}
                className="flex min-h-16 items-center gap-3 rounded-md px-2 hover:bg-secondary focus-visible:outline-2 focus-visible:outline-ring"
              >
                <EntityMark id={marketId(w.symbol)} size={MARK} decorative />
                <span className="flex min-w-0 flex-col">
                  <span className="font-semibold text-row">{row.title}</span>
                  <span className="truncate text-meta text-text-3">{row.detail}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {q.hasNextPage ? (
        <button
          type="button"
          onClick={() => void q.fetchNextPage()}
          disabled={q.isFetchingNextPage}
          className="self-start rounded-full bg-secondary px-4 py-2 font-semibold text-button-compact"
        >
          {q.isFetchingNextPage ? "Loading…" : "Older windows"}
        </button>
      ) : null}
    </div>
  );
}

export function ProofFeed() {
  return <PublicQuery loading="Loading the proof feed…">{(chainId) => <Feed chainId={chainId} />}</PublicQuery>;
}
