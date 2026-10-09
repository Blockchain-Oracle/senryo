"use client";
/**
 * A toast (the phone's `notify`): sonner's, mounted by the app shell once the browser is idle (`ToasterHost`), so it
 * is not in any page's first load. A toast asked for before then loads it and waits for it to mount. Warnings carry
 * the warning tone; an action is one plain verb ("Sign in").
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
  tone?: "info" | "warning";
  action?: { label: string; onClick: () => void };
}

export function notify({ title, description, tone = "info", action }: Notice): void {
  const options = {
    ...(description ? { description } : {}),
    ...(action ? { action: { label: action.label, onClick: action.onClick } } : {}),
  };
  for (const w of wanted) w();
  void Promise.all([import("sonner"), mounted]).then(([{ toast }]) => {
    if (tone === "warning") toast.warning(title, options);
    else toast(title, options);
  });
}
