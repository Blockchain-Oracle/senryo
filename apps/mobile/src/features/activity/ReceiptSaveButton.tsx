import { useState } from "react";
import { Button } from "~/components/kit/Button";
import { notify } from "~/lib/notify";

export function ReceiptSaveButton({ save }: { save: () => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  return (
    <Button
      label="Save receipt"
      loading={saving}
      onPress={() => {
        if (saving) return;
        setSaving(true);
        void save()
          .catch(() => notify({ title: "Couldn’t save receipt", description: "Try again", tone: "warning" }))
          .finally(() => setSaving(false));
      }}
    />
  );
}
