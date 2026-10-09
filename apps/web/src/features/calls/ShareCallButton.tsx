"use client";
/**
 * Share a finished call (the phone's `ShareCallButton`): the card drawn as a PNG (`share-card.ts`) and handed to the
 * system share sheet with its link where the browser can share files; otherwise the image downloads and the link is
 * copied. The mark and the seal are rendered off-screen here and serialised for the canvas.
 */
import type { ShareCall } from "@senryo/calls";
import { ids, marketId } from "@senryo/identity";
import { QR } from "@senryo/tokens";
import { Share2 } from "lucide-react";
import QRCode from "qrcode";
import { useRef, useState } from "react";
import { EntityMark } from "@/components/identity/entity-mark";
import { Button } from "@/components/ui/button";
import { fire } from "@/lib/feedback";
import { notify } from "@/lib/notify";
import { drawShareCard, imageFrom, svgImage } from "./share-card";

const MARK = 40;
const SEAL = 44;
const QR_PX = 228;
const QR_MARGIN = 0;

export function ShareCallButton({ card }: { card: ShareCall }) {
  const marks = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  const share = async () => {
    fire("press", { cue: "tap" });
    setBusy(true);
    try {
      const box = marks.current;
      const styles = getComputedStyle(document.documentElement);
      const v = (name: string) => styles.getPropertyValue(name).trim();
      const sans = `${v("--font-inter") || "Inter"}, system-ui`;
      const qr = await imageFrom(
        await QRCode.toDataURL(card.url, { width: QR_PX, margin: QR_MARGIN, color: { dark: QR.ink, light: QR.paper } }),
      );
      const blob = await drawShareCard(card, {
        mark: await svgImage(box?.querySelector('[data-mark="market"] svg') ?? null),
        seal: await svgImage(box?.querySelector('[data-mark="seal"] svg') ?? null),
        qr,
        sans,
        jp: `${v("--font-noto-jp") || "Noto Sans JP"}, ${sans}`,
        up: v("--chart-up"),
        down: v("--chart-down"),
        action: v("--primary"),
      });
      const file = new File([blob], `senryo-${card.symbol.toLowerCase()}-call.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: card.call,
          text: `${card.result} on ${card.call}`,
          url: card.url,
        });
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
      await navigator.clipboard?.writeText(card.url).catch(() => undefined);
      notify({ title: "Card saved", description: "The link is copied too." });
    } catch (error) {
      if ((error as Error).name !== "AbortError")
        notify({ title: "Couldn't share the card", description: (error as Error).message, tone: "warning" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div ref={marks} aria-hidden className="pointer-events-none fixed -left-[9999em] top-0">
        <span data-mark="market">
          <EntityMark id={marketId(card.symbol)} size={MARK} decorative />
        </span>
        <span data-mark="seal">
          <EntityMark id={ids.brand("senryo")} size={SEAL} variant="symbol" decorative />
        </span>
      </div>
      <Button size="xl" variant="secondary" onClick={() => void share()} disabled={busy}>
        <Share2 aria-hidden />
        {busy ? "Drawing the card…" : "Share this call"}
      </Button>
    </>
  );
}
