"use client";
// The keyboard map (Mitoshi S22 `ShortcutsModal.tsx`, from Baku/roy-chain's help menu, as a centred modal): every row
// is a shortcut that exists, with this platform's modifier (R6.8). A lazy island; `?` opens it from anywhere.
import { Modal } from "@/components/ui/modal";
import { useModKey } from "@/lib/platform";
import { EVERYTHING_KEY, RAIL } from "./nav";

const rows = (mod: string): readonly (readonly [string, string])[] => [
  [`${mod} K`, "Search Senryo"],
  ["/", "Search"],
  ["↵", "In search: open (a position opens with Cash out ready; search never trades)"],
  [`${mod} ↵`, "In search: the result's other action"],
  ...RAIL.map((item, i) => [String(i + 1), `Go to ${item.label}`] as const),
  [EVERYTHING_KEY, "Everything"],
  ["↑", "Call Up (on Trade)"],
  ["↓", "Call Down (on Trade)"],
  ["C", "Cash out (on Trade)"],
  ["?", "This list"],
  ["esc", "Close a drawer or a dialog"],
];

export function ShortcutsModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const ROWS = rows(useModKey());
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
