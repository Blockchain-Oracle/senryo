"use client";
/**
 * A load that failed says so and offers Try again (D4, the owner's review: a screen never only says it failed, or
 * that it "retries on its own"). Try again asks again for whatever is in error on the page — every active query that
 * failed — so a screen needs no key plumbing.
 */
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { tapFeedback } from "@/lib/feedback";

export function LoadFailed({ text }: { text: string }) {
  const client = useQueryClient();
  return (
    <div className="flex flex-wrap items-center gap-3" role="status">
      <p className="text-body text-text-2">{text}</p>
      <Button
        variant="secondary"
        onClick={() => {
          tapFeedback();
          void client.refetchQueries({ type: "active", predicate: (q) => q.state.status === "error" });
        }}
      >
        Try again
      </Button>
    </div>
  );
}
