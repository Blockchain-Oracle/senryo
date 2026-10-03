"use client";

/**
 * "Save as…" after a withdrawal to a new address (flow book B8 after, B13; the phone's SaveDestination): one field for
 * its name ("Coinbase") and Save; the destination then leads the Withdraw list, with its exchange's mark when the name
 * says which.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DESTINATION_NAME_MAX } from "@/lib/money/destinations";

export function SaveDestination({ onSave }: { onSave: (name: string) => void }) {
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);
  if (saved) return <p className="text-center text-meta text-up">Saved as {name.trim()}</p>;
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onSave(name.trim());
        setSaved(true);
      }}
    >
      <Input
        value={name}
        maxLength={DESTINATION_NAME_MAX}
        onChange={(e) => setName(e.target.value)}
        placeholder="Save as · e.g. Coinbase"
        aria-label="Name this destination"
      />
      <Button type="submit" variant="secondary" disabled={!name.trim()}>
        Save
      </Button>
    </form>
  );
}
