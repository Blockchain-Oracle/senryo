/**
 * The search pill (Markets, the terminal's market picker): the icon and a borderless field on the muted plate — the
 * phone's `SearchField`.
 */
import { Search } from "lucide-react";

export function SearchField({
  value,
  onChange,
  placeholder = "Search markets",
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="flex h-12 items-center gap-3 rounded-full bg-secondary px-4">
      <Search aria-hidden className="size-4.5 shrink-0 text-text-3" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-full w-full min-w-0 bg-transparent font-medium text-body outline-none placeholder:text-text-3"
      />
    </label>
  );
}
