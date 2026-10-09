"use client";
// Mounts the drawer the URL names (`?d=<name>`, D-190): Back closes it, a link opens it. Each drawer is a lazy island
// loaded when first asked for — Everything preloads while the browser is idle — and stays mounted afterwards so it
// can animate out.
import { type ComponentType, Suspense, useEffect, useState } from "react";
import { closeDrawer, DRAWERS, useDrawerParam } from "@/lib/shell/drawer-param";
import { onIdle } from "@/lib/shell/idle";
import type { DrawerProps } from "./drawers/types";

type Loader = () => Promise<ComponentType<DrawerProps>>;

const LOADERS: Record<string, Loader> = {
  [DRAWERS.everything]: () => import("./EverythingDrawer").then((m) => m.EverythingDrawer),
  [DRAWERS.account]: () => import("./drawers/AccountDrawer").then((m) => m.AccountDrawer),
  [DRAWERS.wallet]: () => import("./drawers/WalletDrawer").then((m) => m.WalletDrawer),
  [DRAWERS.receive]: () => import("./drawers/ReceiveDrawer").then((m) => m.ReceiveDrawer),
  [DRAWERS.withdraw]: () => import("./drawers/WithdrawDrawer").then((m) => m.WithdrawDrawer),
  [DRAWERS.settings]: () => import("./drawers/SettingsDrawer").then((m) => m.SettingsDrawer),
  [DRAWERS.oneTap]: () => import("./drawers/OneTapDrawer").then((m) => m.OneTapDrawer),
  [DRAWERS.call]: () => import("./drawers/CallDrawer").then((m) => m.CallDrawer),
};

const close = (next: boolean) => (next ? undefined : closeDrawer());

function Host() {
  const open = useDrawerParam();
  const [loaded, setLoaded] = useState<Record<string, ComponentType<DrawerProps>>>({});
  const load = (name: string) => {
    const loader = LOADERS[name];
    if (!loader) return;
    void loader().then((C) => setLoaded((all) => (all[name] ? all : { ...all, [name]: C })));
  };
  useEffect(() => onIdle(() => load(DRAWERS.everything)), []);
  useEffect(() => {
    if (open) load(open);
  }, [open]);
  return (
    <>
      {Object.entries(loaded).map(([name, Drawer]) => (
        <Drawer key={name} open={open === name} onOpenChange={close} />
      ))}
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
