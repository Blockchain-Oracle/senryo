"use client";
/**
 * The receipt as an image (D-331, D-352): Share and Save export the same image (`slip-png.ts`) — Save downloads it,
 * Share hands it to the system sheet with its link where the browser can share files (otherwise it downloads and
 * copies the link). While balances are hidden both wait, and privacy is checked again just before the image leaves
 * (D-329). The market mark is rendered off-screen (`node`) and serialised for the canvas.
 */
import type { TradeSlip } from "@senryo/calls";
import { marketId } from "@senryo/identity";
import { QR } from "@senryo/tokens";
import { type ReactNode, useRef, useState } from "react";
import { EntityMark } from "@/components/identity/entity-mark";
import { fire } from "@/lib/feedback";
import { notify } from "@/lib/notify";
import { privacyOn, usePrivacy } from "@/lib/shell/privacy";
import { drawSlip, imageFrom, svgImage } from "./slip-png";

const MARK = 24;
const QR_PX = 216;
const QR_MARGIN = 0;

const BLOCKED = { title: "Balances are hidden", description: "Show balances to share or save this receipt." };

export function useSlipImage(slip: TradeSlip): {
  node: ReactNode;
  busy: "save" | "share" | null;
  share: () => void;
  save: () => void;
} {
  const marks = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<"save" | "share" | null>(null);
  const hidden = usePrivacy();

  const image = async (): Promise<File> => {
    const styles = getComputedStyle(document.documentElement);
    const v = (name: string) => styles.getPropertyValue(name).trim();
    const sans = `${v("--font-inter") || "Inter"}, system-ui`;
    const { toDataURL } = await import("qrcode");
    const qr = await imageFrom(
      await toDataURL(slip.url, { width: QR_PX, margin: QR_MARGIN, color: { dark: QR.ink, light: QR.paper } }),
    );
    const blob = await drawSlip(slip, {
      mark: await svgImage(marks.current?.querySelector("svg") ?? null),
      qr,
      sans,
      display: `${v("--font-display") || sans}, ${sans}`,
    });
    return new File([blob], `senryo-${slip.folio.replace(/\W+/g, "-").toLowerCase()}.png`, { type: "image/png" });
  };

  const download = (file: File) => {
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const run = async (kind: "save" | "share") => {
    fire("press", { cue: "tap" });
    if (hidden) return notify(BLOCKED);
    setBusy(kind);
    try {
      const file = await image();
      // Balances hidden while it was drawing: the image never leaves.
      if (privacyOn()) return notify(BLOCKED);
      if (kind === "share" && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: slip.title, url: slip.url });
        return;
      }
      download(file);
      if (kind === "share") {
        await navigator.clipboard?.writeText(slip.url).catch(() => undefined);
        notify({ title: "Receipt saved", description: "The link is copied too." });
      } else notify({ title: "Downloaded" });
    } catch (error) {
      if ((error as Error).name !== "AbortError")
        notify({ title: "Couldn't make the image", description: (error as Error).message, tone: "warning" });
    } finally {
      setBusy(null);
    }
  };

  const node = (
    <div ref={marks} aria-hidden className="pointer-events-none fixed -left-[9999em] top-0">
      <EntityMark id={marketId(slip.symbol)} size={MARK} decorative />
    </div>
  );
  return { node, busy, share: () => void run("share"), save: () => void run("save") };
}
