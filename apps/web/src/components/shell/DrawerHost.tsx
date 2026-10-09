"use client";
// Mounts the drawer the URL names (`?d=<name>`, D-190): Back closes it, a link opens it. Each drawer is a lazy island —
// Everything preloads when the browser is idle; a receipt loads when asked for. The wallet, Receive, Withdraw, settings
// and one-tap drawers join with S6.7.
import { type ComponentType, Suspense, useCallback, useEffect, useState } from "react";
import { closeDrawer, DRAWERS, useDrawerArg, useDrawerParam } from "@/lib/shell/drawer-param";
import { onIdle } from "@/lib/shell/idle";
import type { CallDrawerProps } from "./CallDrawer";
import type { EverythingDrawerProps } from "./EverythingDrawer";

let everything: Promise<ComponentType<EverythingDrawerProps>> | null = null;
const loadEverything = () => {
  everything ??= import("./EverythingDrawer").then((m) => m.EverythingDrawer);
  return everything;
};
let call: Promise<ComponentType<CallDrawerProps>> | null = null;
const loadCall = () => {
  call ??= import("./CallDrawer").then((m) => m.CallDrawer);
  return call;
};

const close = (next: boolean) => (next ? undefined : closeDrawer());

function Host() {
  const open = useDrawerParam();
  const id = useDrawerArg("id");
  const [Everything, setEverything] = useState<ComponentType<EverythingDrawerProps> | null>(null);
  const [Call, setCall] = useState<ComponentType<CallDrawerProps> | null>(null);
  const load = useCallback(() => void loadEverything().then((C) => setEverything(() => C)), []);
  useEffect(() => onIdle(load), [load]);
  useEffect(() => {
    if (open === DRAWERS.everything) load();
    if (open === DRAWERS.call) void loadCall().then((C) => setCall(() => C));
  }, [open, load]);
  return (
    <>
      {Everything ? <Everything open={open === DRAWERS.everything} onOpenChange={close} /> : null}
      {Call ? <Call open={open === DRAWERS.call} id={id} onOpenChange={close} /> : null}
    </>
  );
}

export function DrawerHost() {
  return (
    <Suspense fallback={null}>
      <Host />
    </Suspense>
  );
}
