"use client";

import { Plus } from "lucide-react";
import { useRef } from "react";

const ITEMS = [
  ["How it works", "#how"],
  ["Practice", "#practice"],
  ["Proof", "#proof"],
  ["Questions", "#questions"],
  ["Make your first call", "#start"],
] as const;

/** Native disclosure semantics, with dismissal after selecting a destination or pressing Escape. */
export function LandingMenu({ className }: { className?: string | undefined }) {
  const disclosure = useRef<HTMLDetailsElement>(null);
  return (
    <details
      ref={disclosure}
      className={className}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.currentTarget.open = false;
        event.currentTarget.querySelector("summary")?.focus();
      }}
    >
      <summary>
        Menu <Plus size={16} aria-hidden />
      </summary>
      <nav aria-label="Mobile navigation">
        {ITEMS.map(([label, href]) => (
          <a
            key={href}
            href={href}
            onClick={() => {
              if (disclosure.current) disclosure.current.open = false;
            }}
          >
            {label}
          </a>
        ))}
      </nav>
    </details>
  );
}
