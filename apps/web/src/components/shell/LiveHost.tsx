"use client";
/**
 * Keeps the one live stream in step with the tab (the phone's `LiveHost`, D-272/D-280): the app holds the stream while
 * it is mounted; a hidden tab lets it close after its linger and a visible one reopens it; the user's topic follows
 * the API session for the signed-in account; their events keep the queries true; the sound engine warms when idle.
 */
import { useLive } from "@senryo/live/react";
import { useLiveSync } from "@senryo/query";
import { useEffect } from "react";
import { apiSessionScope, onApiSession } from "@/lib/account/api";
import { useAccount } from "@/lib/account/provider";
import { preloadFeedback } from "@/lib/feedback";

export function LiveHost() {
  const live = useLive();
  const address = useAccount().hint?.address;
  useLiveSync(live, address);

  useEffect(() => live.stream.acquire(), [live]);
  useEffect(() => preloadFeedback(), []);

  useEffect(() => {
    const onVisibility = () => live.stream.setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [live]);

  useEffect(() => {
    const follow = (scope = apiSessionScope()) =>
      live.setUser(scope && address && scope.toLowerCase() === address.toLowerCase() ? address : null);
    follow();
    return onApiSession(follow);
  }, [live, address]);

  return null;
}
