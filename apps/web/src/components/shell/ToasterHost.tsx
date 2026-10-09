"use client";
/** Mounts the toaster when the browser is idle or a toast is waiting (`lib/notify.ts`); never in the first load. */
import { type ComponentType, useEffect, useState } from "react";
import { onToasterWanted, toasterMounted } from "@/lib/notify";
import { onIdle } from "@/lib/shell/idle";

type ToasterProps = { position: "top-center" };

export function ToasterHost() {
  const [Toaster, setToaster] = useState<ComponentType<ToasterProps> | null>(null);
  useEffect(() => {
    let done = false;
    const load = () => {
      if (done) return;
      done = true;
      void import("@/components/ui/sonner").then((m) => setToaster(() => m.Toaster));
    };
    const offIdle = onIdle(load);
    const offWanted = onToasterWanted(load);
    return () => {
      offIdle();
      offWanted();
    };
  }, []);
  useEffect(() => {
    if (!Toaster) return;
    // The toaster subscribes in its own effect; announce on the next frame so no early toast is missed.
    const id = requestAnimationFrame(() => toasterMounted());
    return () => cancelAnimationFrame(id);
  }, [Toaster]);
  return Toaster ? <Toaster position="top-center" /> : null;
}
