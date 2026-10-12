"use client";
import type { ReactNode } from "react";

/**
 * A toast (the phone's `notify`): sonner's, mounted by the app shell once the browser is idle (`ToasterHost`), so it
 * is not in any page's first load. A toast asked for before then loads it and waits for it to mount. Warnings carry
 * the warning tone; an action is one plain verb ("Sign in"). A trade's run is one toast by id (R5.11, `tradeToast`):
 * "loading" while it is on its way, then replaced in place.
 */
let ready: (() => void) | null = null;
const mounted = new Promise<void>((resolve) => {
  ready = resolve;
});

/** The toaster says it is listening (`ToasterHost`). */
export function toasterMounted(): void {
  ready?.();
}

/** Ask the shell to mount the toaster now (a toast is waiting). */
const wanted = new Set<() => void>();
export function onToasterWanted(listener: () => void): () => void {
  wanted.add(listener);
  return () => {
    wanted.delete(listener);
  };
}

export interface Notice {
  title: string;
  description?: string;
  tone?: "info" | "warning" | "loading";
  action?: { label: string; onClick: () => void };
  /** One toast per id: a second with the same id replaces it. */
  id?: string;
  /** Stays until acted on or dismissed (a new version is waiting). */
  persistent?: true;
  /** A leading mark (a result's market, R2.8). */
  icon?: ReactNode;
}

export function notify({ title, description, tone = "info", action, id, persistent, icon }: Notice): void {
  const options = {
    ...(description ? { description } : {}),
    ...(action ? { action: { label: action.label, onClick: action.onClick } } : {}),
    ...(id ? { id } : {}),
    ...(persistent ? { duration: Number.POSITIVE_INFINITY } : {}),
    ...(icon ? { icon } : {}),
  };
  for (const w of wanted) w();
  void Promise.all([import("sonner"), mounted]).then(([{ toast }]) => {
    if (tone === "warning") toast.warning(title, options);
    else if (tone === "loading") toast.loading(title, options);
    else toast(title, options);
  });
}

/** Take a toast down by its id (a trade whose signature was cancelled). */
export function dismissToast(id: string): void {
  void Promise.all([import("sonner"), mounted]).then(([{ toast }]) => toast.dismiss(id));
}
