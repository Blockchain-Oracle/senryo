import type { Metadata } from "next";
import { Suspense } from "react";
import { AssetScreen } from "@/components/money/asset-screen";

export const metadata: Metadata = { title: "Asset" };

/** `?address=` is read on the client; the static export pre-renders the shell. */
export default function AssetPage() {
  return (
    <Suspense>
      <AssetScreen />
    </Suspense>
  );
}
