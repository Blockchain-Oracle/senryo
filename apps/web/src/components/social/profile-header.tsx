"use client";

/**
 * Who a trader is (flow book F2 steps 2–3; Fomo F16, the phone's TraderIdentity and own ProfileHeader): a 64 px avatar,
 * name, @handle with "Follows you", the bio, "3 Following · 12 Followers", the meta line (mode · joined), then — for
 * someone else — Follow · Send (Send opens the send flow with their @handle; it is re-resolved before signing), and —
 * for you — Edit · Settings. Share copies the profile link with its network.
 */
import type { PublicProfile } from "@senryo/api-client";
import { MAINNET_CHAIN_ID, networkOf, WEB_ORIGIN } from "@senryo/config";
import { useFollowState, useQueryEnv } from "@senryo/query";
import { Check, Send, Settings, Share2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/identity/avatar";
import { Button } from "@/components/ui/button";
import { known } from "@/components/ui/reading";
import { ACTIVE_NETWORK } from "@/lib/constants/auth";
import { ROUTES, sendToHref, watchHref } from "@/lib/constants/routes";
import { handleOf, monthYear, nameOf, sameAddress } from "@/lib/social/format";
import { useSessionGate } from "@/lib/social/session-gate";
import { FollowButton } from "./follow-button";

const PROFILE_AVATAR = 64;

export function ShareProfile({ address, chainId }: { address: string; chainId: number }) {
  const [copied, setCopied] = useState(false);
  const url = `${WEB_ORIGIN}${watchHref(address, chainId)}`;
  return (
    <button
      type="button"
      aria-label="Share this profile"
      title="Share this profile"
      onClick={() => {
        if (navigator.share) void navigator.share({ url }).catch(() => undefined);
        else void navigator.clipboard?.writeText(url).then(() => setCopied(true));
      }}
      className="inline-flex size-9 items-center justify-center rounded-full bg-raised-2 hover:bg-row-pressed"
    >
      {copied ? <Check className="size-4" /> : <Share2 className="size-4" />}
    </button>
  );
}

export function ProfileHeader({ profile }: { profile: PublicProfile }) {
  const env = useQueryEnv();
  const gate = useSessionGate();
  const own = sameAddress(profile.address, gate.address);
  const relation = known(
    useFollowState(gate.address, gate.status === "ready" && !own ? profile.address : undefined, gate.session),
  );
  const joined = monthYear(profile.createdAt);
  const mode = networkOf(env.chainId).modeLabel;
  return (
    <section className="grid gap-3">
      <div className="flex items-start justify-between gap-3">
        <Avatar avatar={profile.avatar} address={profile.address} size={PROFILE_AVATAR} />
        <ShareProfile address={profile.address} chainId={env.chainId} />
      </div>
      <div>
        <h1 className="text-sheet-title">{nameOf(profile)}</h1>
        <p className="flex items-center gap-2 text-row text-text-3">
          {handleOf(profile)}
          {relation?.followsYou ? (
            <span className="rounded-xs bg-raised-2 px-1.5 text-label text-text-2">Follows you</span>
          ) : null}
        </p>
      </div>
      {profile.bio ? <p className="line-clamp-4 text-row text-text-2">{profile.bio}</p> : null}
      <p className="text-row text-text-2">
        <span className="text-foreground">{profile.following}</span> Following ·{" "}
        <span className="text-foreground">{profile.followers}</span>{" "}
        {profile.followers === 1 ? "Follower" : "Followers"}
      </p>
      <p className="flex items-center gap-2 text-meta text-text-3">
        <span
          className={
            env.chainId === MAINNET_CHAIN_ID
              ? "rounded-xs bg-mainnet-surface px-1.5 text-mainnet"
              : "rounded-xs bg-practice-surface px-1.5 text-practice"
          }
        >
          {mode}
        </span>
        {joined ? `Joined ${joined}` : null}
      </p>
      {own ? (
        <div className="flex gap-2">
          <Button asChild size="sm" variant="secondary" className="rounded-full font-sans">
            <Link href={ROUTES.setup}>Edit profile</Link>
          </Button>
          <Button asChild size="sm" variant="secondary" className="rounded-full font-sans">
            <Link href={ROUTES.account}>
              <Settings />
              Settings
            </Link>
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <FollowButton other={profile.address} />
          {/* Sends run on this site's network; a profile opened for the other network offers none. */}
          {relation?.blocked || env.chainId !== ACTIVE_NETWORK.chainId ? null : (
            <Button asChild size="sm" variant="secondary" className="rounded-full font-sans">
              <Link href={sendToHref(profile.handle ? `@${profile.handle}` : profile.address)}>
                <Send />
                Send
              </Link>
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
