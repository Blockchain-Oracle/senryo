"use client";

// 21st: user_xn1cklas/qr-code-generator (#6838) — https://21st.dev/@user_xn1cklas/components/qr-code-generator
// D2: hairline card (no shadcn Card dependency), full-width by default, QR plate on fixed paper token, capped at 10rem.
import { CheckIcon, DownloadIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface QRCodeResult {
  data: string;
  size: number;
  /** data: URL of the rendered PNG */
  output: string;
}

type QRCodeDisplayProps = {
  data?: QRCodeResult | null;
  isLoading?: boolean;
  error?: string | null;
  title?: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  /** File name for "Save QR". */
  fileName?: string;
  className?: string;
};

const PREVIEW_CHARS = 50;
const SAVED_FLASH_MS = 1200;

const truncate = (text: string) => (text.length > PREVIEW_CHARS ? `${text.slice(0, PREVIEW_CHARS)}…` : text);

export function QRCodeDisplay({
  data,
  isLoading,
  error,
  title = "QR Code",
  description,
  footer,
  fileName = "senryo-deposit-qr.png",
  className,
}: QRCodeDisplayProps) {
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleDownload = async () => {
    if (!data?.output) return;
    setDownloading(true);
    setLocalError(null);
    try {
      const blob = await (await fetch(data.output)).blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setDownloaded(true);
      setTimeout(() => setDownloaded(false), SAVED_FLASH_MS);
    } catch (e) {
      console.error("Failed to download QR code:", e);
      setLocalError("Couldn't save the QR image. Copy the address instead.");
    } finally {
      setDownloading(false);
    }
  };

  const shownError = error ?? localError;

  return (
    <section
      className={cn("w-full overflow-hidden rounded-lg border border-border bg-card text-card-foreground", className)}
    >
      <header className="space-y-1 border-border border-b p-4">
        <h3 className="font-semibold text-title leading-none tracking-tight">{title}</h3>
        <p className="text-body text-muted-foreground">
          {description ?? (data?.data ? truncate(data.data) : "Waiting for an address")}
        </p>
      </header>

      <div className="flex flex-col items-center gap-4 p-4">
        {isLoading && (
          <>
            <div className="aspect-square w-full max-w-40 animate-pulse rounded-lg bg-muted" />
            <div className="h-4 w-28 animate-pulse rounded-xs bg-muted" />
          </>
        )}

        {!isLoading && shownError && (
          <p className="text-body text-down" role="status" aria-live="assertive">
            {shownError}
          </p>
        )}

        {!isLoading && !shownError && !data && <p className="text-body text-muted-foreground">No address yet.</p>}

        {!isLoading && !shownError && data && (
          <>
            <div className="w-full max-w-48 rounded-lg bg-qr-paper p-3">
              <img
                src={data.output}
                alt={`QR code for ${truncate(data.data)}`}
                width={data.size}
                height={data.size}
                decoding="async"
                className="h-auto w-full"
              />
            </div>
            {footer}
          </>
        )}

        <Button
          onClick={handleDownload}
          disabled={isLoading || downloading || !data?.output}
          className="w-full"
          aria-busy={downloading}
          aria-label={downloaded ? "QR code saved" : downloading ? "Saving QR code" : "Save QR code as PNG"}
        >
          {downloaded ? <CheckIcon /> : <DownloadIcon />}
          {downloaded ? "Saved" : downloading ? "Saving…" : "Save QR"}
        </Button>
      </div>
    </section>
  );
}

export default QRCodeDisplay;
