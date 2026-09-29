"use client";
import dynamic from "next/dynamic";
import type { Screen } from "@/components/directions/common";

const DIRS = {
  d1: dynamic(() => import("@/components/directions/d1").then((m) => m.D1), { ssr: false }),
  d3: dynamic(() => import("@/components/directions/d3").then((m) => m.D3), { ssr: false }),
  d4: dynamic(() => import("@/components/directions/d4").then((m) => m.D4), { ssr: false }),
  d2: dynamic(() => import("@/components/directions/d2").then((m) => m.D2), { ssr: false }),
} as Record<string, React.ComponentType<{ screen: Screen; alt: boolean }>>;

export function View({ dir, screen, alt }: { dir: string; screen: string; alt: boolean }) {
  const C = DIRS[dir];
  if (!C) return <p className="p-6">Unknown direction {dir}</p>;
  return <C screen={screen as Screen} alt={alt} />;
}
