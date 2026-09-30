"use client";

// Adapted from the D2 preview (design/preview/components/adapted/use-qr.ts) for the 21st QR Code Generator (#6838).
// QR ink/paper are fixed black-on-white tokens (scanners need the contrast) — never theme colours.
import { QR } from "@senryo/tokens";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import type { QRCodeResult } from "@/components/ui/qr-code-generator";

const DEFAULT_QR_PX = 300;
const QR_MARGIN_MODULES = 1;

export function useQr(data: string, size = DEFAULT_QR_PX): QRCodeResult | null {
  const [qr, setQr] = useState<QRCodeResult | null>(null);
  useEffect(() => {
    let live = true;
    QRCode.toDataURL(data, {
      width: size,
      margin: QR_MARGIN_MODULES,
      errorCorrectionLevel: "M",
      color: { dark: QR.ink, light: QR.paper },
    })
      .then((output) => {
        if (live) setQr({ data, size, output });
      })
      .catch((error: unknown) => console.error("QR generation failed", error));
    return () => {
      live = false;
    };
  }, [data, size]);
  return qr;
}
