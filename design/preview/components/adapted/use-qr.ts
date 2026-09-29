"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import type { QRCodeResult } from "@/components/ui/qr-code-generator";

export function useQr(data: string, size = 300, dark = "#000000", light = "#ffffff") {
  const [qr, setQr] = useState<QRCodeResult | null>(null);
  useEffect(() => {
    QRCode.toDataURL(data, { width: size, margin: 1, color: { dark, light } }).then((output) => setQr({ data, size, output }));
  }, [data, size, dark, light]);
  return qr;
}
