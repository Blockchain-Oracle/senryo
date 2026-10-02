"use client";

/**
 * Compose a thesis (flow book F4 step 5; the phone's ComposeThesis): up to 280 characters with an optional market,
 * posted on this network. Only a listed profile can post — the API answers NOT_LISTED otherwise, and the line says how
 * to fix it (setup, where the handle and visibility live).
 */
import { engineMarketsOn } from "@senryo/config";
import { useCreatePost, useQueryEnv } from "@senryo/query";
import Link from "next/link";
import { useState } from "react";
import { ROUTES } from "@/lib/constants/routes";
import { socialErrorCopy } from "@/lib/social/format";
import { useSessionGate } from "@/lib/social/session-gate";
import { cn } from "@/lib/utils";
import { Composer } from "./engagement";

export function ComposeThesis() {
  const env = useQueryEnv();
  const gate = useSessionGate();
  const create = useCreatePost(gate.session);
  const [market, setMarket] = useState<number>();
  const [error, setError] = useState<string>();
  const [notListed, setNotListed] = useState(false);
  if (gate.status === "guest") return null;
  return (
    <section aria-label="Post a thesis" className="grid gap-2 pb-2">
      <div className="flex flex-wrap gap-1">
        {engineMarketsOn(env.chainId).map((m) => (
          <button
            key={m.id}
            type="button"
            aria-pressed={market === m.id}
            onClick={() => setMarket(market === m.id ? undefined : m.id)}
            className={cn(
              "h-7 rounded-full px-3 text-meta",
              market === m.id ? "bg-foreground text-background" : "bg-raised-2 text-text-2 hover:text-foreground",
            )}
          >
            {m.symbol}
          </button>
        ))}
      </div>
      <Composer
        placeholder="Your thesis"
        busy={create.isPending}
        error={error}
        onPost={async (text) => {
          setError(undefined);
          setNotListed(false);
          try {
            await create.mutateAsync({
              kind: "thesis",
              text,
              ...(market !== undefined ? { marketId: `ours-${market}` } : {}),
            });
            return true;
          } catch (e) {
            const copy = socialErrorCopy(e, "Couldn’t post · try again");
            setNotListed(copy.startsWith("Make your profile public"));
            setError(copy);
            return false;
          }
        }}
      />
      {notListed ? (
        <Link href={ROUTES.setup} className="text-meta text-link hover:underline">
          Set a handle and show your trades ›
        </Link>
      ) : null}
    </section>
  );
}
