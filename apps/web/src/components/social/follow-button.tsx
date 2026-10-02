"use client";

/**
 * Follow / Following (flow book F3; the phone's FollowButton): the filled button invites, the quiet one says it is done;
 * a click toggles at once and holds its width while the write is in flight. Following moves no money. A guest is sent
 * to create an account; a locked session brings the api session up first (one passkey prompt, on this click only); a
 * block reads "Blocked" on the button and the 1,000 cap "Limit reached".
 */
import type { Address } from "@senryo/account";
import { ApiError } from "@senryo/api-client";
import { useFollowList, useFollowState, useFollowToggle } from "@senryo/query";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { known } from "@/components/ui/reading";
import { ROUTES } from "@/lib/constants/routes";
import { sameAddress, socialErrorCopy } from "@/lib/social/format";
import { useSessionGate } from "@/lib/social/session-gate";

const WIDTH = "min-w-28 rounded-full font-sans";

export function FollowButton({ other }: { other: Address }) {
  const gate = useSessionGate();
  const { address: me, session } = gate;
  const asked = gate.status === "ready";
  const state = known(useFollowState(me, asked ? other : undefined, session));
  const mine = known(useFollowList(!asked ? me : undefined, "following").reading);
  const write = useFollowToggle(me, session);
  const [answer, setAnswer] = useState<boolean>();
  const [capped, setCapped] = useState(false);
  if (sameAddress(me, other)) return null;
  if (gate.status === "guest")
    return (
      <Button asChild size="sm" className={WIDTH}>
        <Link href={ROUTES.welcome}>Follow</Link>
      </Button>
    );
  const listed = mine?.some((entry) => sameAddress(entry.address, other));
  const following = answer ?? state?.following ?? listed ?? false;
  if (state?.blocked)
    return (
      <Button size="sm" variant="secondary" disabled className={WIDTH}>
        Blocked
      </Button>
    );
  if (capped && !following)
    return (
      <Button size="sm" variant="secondary" disabled className={WIDTH}>
        Limit reached
      </Button>
    );
  const toggle = () => {
    // The write itself brings the api session up (one passkey prompt when locked, on this click only).
    if (!session) return;
    write.mutate(
      { other, follow: !following },
      {
        onSuccess: (next) => setAnswer(next.following),
        onError: (error) => {
          if (error instanceof ApiError && error.code === "FOLLOW_LIMIT") return setCapped(true);
          toast.warning(following ? "Couldn’t unfollow" : "Couldn’t follow", {
            description: socialErrorCopy(error, "Try again"),
          });
        },
      },
    );
  };
  return (
    <Button
      size="sm"
      variant={following ? "secondary" : "default"}
      disabled={write.isPending}
      aria-pressed={following}
      onClick={toggle}
      className={WIDTH}
    >
      {write.isPending ? <Loader2 className="animate-spin" /> : null}
      {following ? "Following" : "Follow"}
    </Button>
  );
}
