"use client";
import { EmptyState } from "@/components/ui/interactive-empty-state";
import { AlertTriangle, WifiOff, ServerCrash, RefreshCw } from "lucide-react";

export default function Demo() {
  return (
    <div className="flex min-h-[400px] w-full items-center justify-center p-6">
      <EmptyState
        variant="error"
        title="Something went wrong"
        description="We couldn't load your data. Check your connection and try again."
        icons={[
          <WifiOff key="1" />,
          <AlertTriangle key="2" />,
          <ServerCrash key="3" />,
        ]}
        action={{
          label: "Try again",
          icon: <RefreshCw className="h-4 w-4" />,
          onClick: () => {},
        }}
      />
    </div>
  );
}
