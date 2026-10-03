"use client";

/**
 * Scan a QR (flow book B7 "Scan"; G6: camera if allowed, else Paste). The rear camera through `getUserMedia`; each
 * frame is read by the browser's own `BarcodeDetector` where it exists (Chrome on macOS / Android / ChromeOS), and
 * otherwise by jsQR 1.4.0 (Apache-2.0, no dependencies), loaded only when needed. The first code that is an address or
 * an EIP-681 payment link closes the scanner; anything else says so and keeps looking. A refused or missing camera says
 * so in one line — Paste always works.
 */
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { parsePayment, type ScannedPayment } from "@/lib/money/qr-payload";

const SCAN_EVERY_MS = 250;
const NOT_A_CODE_MS = 1_500;

interface Detector {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}
type DetectorCtor = new (options: { formats: string[] }) => Detector;

/** The platform's QR detector, or undefined (Safari, Firefox, Chrome on Windows/Linux). */
async function nativeDetector(): Promise<Detector | undefined> {
  const Ctor = (globalThis as { BarcodeDetector?: DetectorCtor & { getSupportedFormats?: () => Promise<string[]> } })
    .BarcodeDetector;
  if (!Ctor) return undefined;
  const formats = (await Ctor.getSupportedFormats?.().catch(() => [])) ?? [];
  return formats.includes("qr_code") ? new Ctor({ formats: ["qr_code"] }) : undefined;
}

export function Scanner({ onScan, onClose }: { onScan: (p: ScannedPayment) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [note, setNote] = useState<string>();
  const done = useRef(false);

  useEffect(() => {
    let stream: MediaStream | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;
    let live = true;
    const canvas = document.createElement("canvas");
    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      } catch {
        setNote("Camera off · use Paste");
        return;
      }
      const el = video.current;
      if (!live || !el) return;
      el.srcObject = stream;
      await el.play().catch(() => undefined);
      const native = await nativeDetector();
      const decodeWithJsQr = native ? undefined : (await import("jsqr")).default;
      timer = setInterval(async () => {
        if (done.current || el.readyState < el.HAVE_ENOUGH_DATA) return;
        let raw: string | undefined;
        if (native) {
          raw = (await native.detect(el).catch(() => []))[0]?.rawValue;
        } else if (decodeWithJsQr) {
          canvas.width = el.videoWidth;
          canvas.height = el.videoHeight;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (!ctx) return;
          ctx.drawImage(el, 0, 0);
          const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
          raw = decodeWithJsQr(frame.data, frame.width, frame.height)?.data;
        }
        if (!raw) return;
        const payment = parsePayment(raw);
        if (!payment) {
          setNote("Not an address");
          setTimeout(() => setNote(undefined), NOT_A_CODE_MS);
          return;
        }
        done.current = true;
        onScan(payment);
      }, SCAN_EVERY_MS);
    };
    void start();
    return () => {
      live = false;
      clearInterval(timer);
      for (const track of stream?.getTracks() ?? []) track.stop();
    };
  }, [onScan]);

  return (
    <div className="relative overflow-hidden rounded-md bg-background">
      <video ref={video} muted playsInline className="aspect-square w-full object-cover" aria-label="Camera" />
      <div aria-hidden className="pointer-events-none absolute inset-[18%] rounded-lg border-2 border-foreground/70" />
      <button
        type="button"
        aria-label="Close scanner"
        onClick={onClose}
        className="absolute top-2 right-2 grid size-9 place-items-center rounded-full bg-background/80"
      >
        <X className="size-4" />
      </button>
      <p aria-live="polite" className="absolute inset-x-0 bottom-2 text-center text-meta text-foreground">
        {note ?? "Point at a Monad address QR"}
      </p>
    </div>
  );
}
