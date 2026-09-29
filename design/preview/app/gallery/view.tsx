"use client";
import { Component, type ReactNode } from "react";
import { GROUPS } from "./registry";

class Boundary extends Component<{ children: ReactNode }, { err?: string }> {
  state: { err?: string } = {};
  static getDerivedStateFromError(e: Error) { return { err: e.message }; }
  render() { return this.state.err ? <div className="p-4 text-xs text-red-500">render error: {this.state.err}</div> : this.props.children; }
}

export function GalleryView({ group, dark }: { group: string; dark: boolean }) {
  const items = GROUPS[group] ?? [];
  return (
    <div className={dark ? "dark" : ""}>
      <main className="mx-auto min-h-screen w-full max-w-[390px] bg-background text-foreground">
        <header className="sticky top-0 z-50 border-b bg-background/90 px-4 py-3 backdrop-blur">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">21st candidates · {group} · {dark ? "dark" : "light"}</p>
        </header>
        {items.map(({ id, name, author, dl, C }) => (
          <section key={id} className="border-b">
            <div className="flex items-baseline justify-between px-4 pt-3 text-[11px] text-muted-foreground">
              <span className="font-semibold text-foreground">{name}</span>
              <span>@{author} · #{id} · {dl} installs</span>
            </div>
            <div className="relative flex max-h-[720px] min-h-[120px] items-center justify-center overflow-hidden px-2 py-3 [&_.h-screen]:h-auto [&_.min-h-screen]:min-h-0">
              <Boundary><C /></Boundary>
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
