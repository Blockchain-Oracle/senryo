"use client";

/**
 * Like · reply · share on any feed row (flow book F4; the phone's Engagement): a trade row takes every post verb
 * through its trade post, created on first use (F-D1). Like toggles at once with the new count; Reply opens the thread
 * under the row with the composer (280 characters); Share copies the link. A guest is sent to create an account; a
 * locked session brings the api session up on the click (one passkey prompt).
 */
import type { FeedItem } from "@senryo/api-client";
import { POST_MAX_CHARS } from "@senryo/api-client";
import { useCreatePost, useLikeToggle, useThread, useTradePost } from "@senryo/query";
import { Heart, Loader2, MessageCircle, Share2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar } from "@/components/identity/avatar";
import { QuietLine } from "@/components/kit/list-row";
import { Button } from "@/components/ui/button";
import { known } from "@/components/ui/reading";
import { MARK_SMALL } from "@/lib/constants/brand";
import { ROUTES } from "@/lib/constants/routes";
import { nameOf, socialErrorCopy, timeAgo } from "@/lib/social/format";
import { useSessionGate } from "@/lib/social/session-gate";
import { cn } from "@/lib/utils";

const ACTION =
  "inline-flex items-center gap-1 rounded-full px-2 py-1 text-meta text-text-2 hover:text-foreground disabled:opacity-40";

export function Composer({
  placeholder,
  busy,
  error,
  onPost,
}: {
  placeholder: string;
  busy: boolean;
  error: string | undefined;
  onPost: (text: string) => Promise<boolean>;
}) {
  const [text, setText] = useState("");
  const left = POST_MAX_CHARS - text.length;
  return (
    <form
      className="grid gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim() === "" || left < 0) return;
        void onPost(text.trim()).then((ok) => ok && setText(""));
      }}
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        rows={2}
        className="w-full resize-none rounded-md bg-raised-2 p-3 text-row outline-none placeholder:text-text-3 focus-visible:ring-2 focus-visible:ring-ring"
      />
      <div className="flex items-center justify-between gap-2">
        <span className={cn("text-meta tnum", left < 0 ? "text-down" : "text-text-3")}>{left}</span>
        <Button
          type="submit"
          size="sm"
          className="rounded-full font-sans"
          disabled={busy || text.trim() === "" || left < 0}
        >
          {busy ? <Loader2 className="animate-spin" /> : null}
          Post
        </Button>
      </div>
      {error ? <p className="text-meta text-down">{error}</p> : null}
    </form>
  );
}

function Thread({ postId }: { postId: string }) {
  const gate = useSessionGate();
  const thread = useThread(postId);
  const create = useCreatePost(gate.session);
  const [error, setError] = useState<string>();
  const value = known(thread);
  return (
    <div className="grid gap-2 border-border/60 border-l-2 pl-3">
      {value ? (
        value.replies.length === 0 ? (
          <QuietLine>No replies yet</QuietLine>
        ) : (
          value.replies.map((r) => (
            <div key={r.id} className="flex gap-2">
              <Avatar avatar={r.author.avatar} address={r.author.address} size={MARK_SMALL} />
              <div className="min-w-0">
                <p className="text-meta text-text-2">
                  {nameOf(r.author)} · {timeAgo(r.createdAt)}
                </p>
                <p className="break-words text-row">{r.text}</p>
              </div>
            </div>
          ))
        )
      ) : thread.status === "failed" ? (
        <QuietLine>Thread not available</QuietLine>
      ) : (
        <QuietLine>Loading replies…</QuietLine>
      )}
      {gate.status === "guest" ? null : (
        <Composer
          placeholder="Reply"
          busy={create.isPending}
          error={error}
          onPost={async (text) => {
            setError(undefined);
            try {
              await create.mutateAsync({ kind: "reply", parentId: postId, text });
              return true;
            } catch (e) {
              setError(socialErrorCopy(e, "Couldn’t reply · try again"));
              return false;
            }
          }}
        />
      )}
    </div>
  );
}

/** The engagement line under a feed row: like (with count), reply (opens the thread), share. */
export function Engagement({ item }: { item: FeedItem }) {
  const router = useRouter();
  const gate = useSessionGate();
  const like = useLikeToggle(gate.session);
  const anchor = useTradePost();
  const counts = item.post
    ? { postId: item.post.id, likes: item.post.likes, replies: item.post.replies, likedByMe: item.post.likedByMe }
    : (item.engagement ?? { postId: null, likes: 0, replies: 0, likedByMe: false });
  const [liked, setLiked] = useState<{ liked: boolean; likes: number }>();
  const [threadId, setThreadId] = useState<string>();
  const [open, setOpen] = useState(false);
  const shownLiked = liked?.liked ?? counts.likedByMe;
  const shownLikes = liked?.likes ?? counts.likes;
  const target = counts.postId ? { post: counts.postId } : { tradeRow: item.id };
  const needAccount = () => {
    if (gate.status !== "guest") return false;
    router.push(ROUTES.welcome);
    return true;
  };
  const toggleReplies = async () => {
    if (open) return setOpen(false);
    const id =
      counts.postId ?? threadId ?? (gate.status === "guest" ? undefined : (await anchor.mutateAsync(item.id)).id);
    if (!id) return needAccount();
    setThreadId(id);
    setOpen(true);
  };
  return (
    <div className="grid gap-2">
      <div className="-ml-2 flex items-center gap-1">
        <button
          type="button"
          aria-pressed={shownLiked}
          aria-label={shownLiked ? "Unlike" : "Like"}
          disabled={like.isPending}
          onClick={() => {
            if (needAccount()) return;
            like.mutate(
              { target, like: !shownLiked },
              { onSuccess: (s) => setLiked({ liked: s.liked, likes: s.likes }) },
            );
          }}
          className={cn(ACTION, shownLiked && "text-down")}
        >
          <Heart className={cn("size-4", shownLiked && "fill-current")} aria-hidden />
          {shownLikes > 0 ? shownLikes : null}
        </button>
        <button
          type="button"
          aria-expanded={open}
          aria-label="Replies"
          disabled={anchor.isPending}
          onClick={() => void toggleReplies().catch(() => undefined)}
          className={ACTION}
        >
          <MessageCircle className="size-4" aria-hidden />
          {counts.replies > 0 ? counts.replies : null}
        </button>
        <button
          type="button"
          aria-label="Share"
          onClick={() => {
            const url = `${window.location.origin}${ROUTES.social}`;
            if (navigator.share) void navigator.share({ url, text: item.post?.text ?? "" }).catch(() => undefined);
            else void navigator.clipboard?.writeText(url);
          }}
          className={ACTION}
        >
          <Share2 className="size-4" aria-hidden />
        </button>
      </div>
      {open && threadId ? <Thread postId={threadId} /> : null}
    </div>
  );
}
