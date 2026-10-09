"use client";
// Mounts the drawer the URL names (`?d=<name>`, D-190): Back closes it, a link opens it. Each drawer is a lazy island
// preloaded when the browser is idle — never first-load JS. Everything is here now; the wallet, Receive, Withdraw,
// settings and one-tap drawers join with S6.7.
import { type ComponentType, Suspense, useCallback, useEffect, useState } from "react";
import { closeDrawer, DRAWERS, useDrawerParam } from "@/lib/shell/drawer-param";
import { onIdle } from "@/lib/shell/idle";
import type { EverythingDrawerProps } from "./EverythingDrawer";

let everything: Promise<ComponentType<EverythingDrawerProps>> | null = null;
const loadEverything = () => {
  everything ??= import("./EverythingDrawer").then((m) => m.EverythingDrawer);
  return everything;
};

function Host() {
  const open = useDrawerParam();
  const [Everything, setEverything] = useState<ComponentType<EverythingDrawerProps> | null>(null);
  const load = useCallback(() => void loadEverything().then((C) => setEverything(() => C)), []);
  const wanted = open === DRAWERS.everything;
  useEffect(() => onIdle(load), [load]);
  useEffect(() => {
    if (wanted) load();
  }, [wanted, load]);
  if (!Everything) return null;
  return <Everything open={wanted} onOpenChange={(next) => (next ? undefined : closeDrawer())} />;
}

export function DrawerHost() {
  return (
    <Suspense fallback={null}>
      <Host />
    </Suspense>
  );
}
