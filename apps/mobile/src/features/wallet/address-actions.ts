import * as Clipboard from "expo-clipboard";
import { useEffect, useRef, useState } from "react";
import { Linking, Share } from "react-native";
import { COPIED_MS } from "~/lib/constants/auth";

async function settle(work: () => Promise<unknown>, current: () => boolean) {
  try {
    await work();
    return { ok: true, current: current() };
  } catch {
    return { ok: false, current: current() };
  }
}

/** Clipboard/native completions only update the destination that started them. */
export function useAddressActions(scope: string, address: string, message: string) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string>();
  const feedbackScope = useRef(scope);
  const live = useRef({ scope, mounted: true, serial: 0 });
  live.current.scope = scope;
  useEffect(() => {
    live.current.mounted = true;
    setCopied(false);
    setError(undefined);
    return () => {
      live.current.mounted = false;
      live.current.serial += 1;
    };
  }, [scope]);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);
  const act = async (kind: "copy" | "share" | "explorer", url?: string) => {
    const serial = ++live.current.serial;
    const current = () => live.current.mounted && live.current.scope === scope && live.current.serial === serial;
    setError(undefined);
    const result = await settle(async () => {
      if (kind === "copy") await Clipboard.setStringAsync(address);
      else if (kind === "share") await Share.share({ message });
      else if (url) await Linking.openURL(url);
    }, current);
    if (!result.current) return;
    feedbackScope.current = scope;
    if (result.ok && kind === "copy") setCopied(true);
    if (!result.ok)
      setError(
        `Couldn’t ${kind === "explorer" ? "open explorer" : kind === "share" ? "open share sheet" : "copy address"}. Try again.`,
      );
  };
  return {
    copied: copied && feedbackScope.current === scope,
    error: feedbackScope.current === scope ? error : undefined,
    copy: () => void act("copy"),
    share: () => void act("share"),
    explorer: (url: string) => void act("explorer", url),
  };
}
