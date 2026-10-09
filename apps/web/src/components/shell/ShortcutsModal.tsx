"use client";
// The keyboard map (Mitoshi S22 `ShortcutsModal.tsx`, from Baku/roy-chain's help menu, as a centred modal): every row
// is a shortcut that exists. A lazy island; `?` opens it from anywhere.
import { Modal } from "@/components/ui/modal";
import { EVERYTHING_KEY, RAIL } from "./nav";

const ROWS: readonly (readonly [string, string])[] = [
  ["⌘ K", "Search markets, places and actions"],
  ["/", "Search"],
  ...RAIL.map((item, i) => [String(i + 1), `Go to ${item.label}`] as const),
  [EVERYTHING_KEY, "Everything"],
  ["?", "This list"],
  ["esc", "Close a drawer or a dialog"],
];

export function ShortcutsModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Keyboard shortcuts">
      <dl className="shortcut-list">
        {ROWS.map(([keys, what]) => (
          <div key={keys} className="shortcut-row">
            <dt>{what}</dt>
            <dd>
              <kbd>{keys}</kbd>
            </dd>
          </div>
        ))}
      </dl>
    </Modal>
  );
}
