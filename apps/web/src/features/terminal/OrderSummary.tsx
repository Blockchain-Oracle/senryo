"use client";
/** A summary row in the order sheet: its name on the left, the figure on the right in tabular figures. */
import type { ReactNode } from "react";

export function SummaryRow({ k, v }: { k: string; v: ReactNode }) {
  return (
    <>
      <dt className="text-text-3">{k}</dt>
      <dd className="tnum text-right font-semibold">{v}</dd>
    </>
  );
}
