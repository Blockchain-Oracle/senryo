import { Button } from "@/components/ui/button";
import { CircleAlert, RefreshCw } from "lucide-react";

export default function ErrorBlock({ title = "Something went wrong", body = "An unexpected error occurred while processing your request. Please try again, and contact support if the problem persists.", reference = "7OVR-4F2A9", retry = "Try Again", support = "Contact Support", className = "" }: { title?: string; body?: string; reference?: string; retry?: string; support?: string; className?: string } = {}) {
  return (
    <section className={`flex w-full flex-col items-center justify-center gap-6 bg-background px-6 py-12 text-center text-foreground ${className}`}>
      <div className="flex size-16 items-center justify-center rounded-[var(--radius)] border border-border bg-muted/30">
        <CircleAlert
          className="size-8 text-muted-foreground"
          aria-hidden="true"
        />
      </div>

      <div className="flex flex-col items-center gap-2">
        <h1 className="text-2xl font-bold tracking-tight font-display">
          {title}
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          {body}
        </p>
      </div>

      <div className="flex flex-col items-center gap-2 sm:flex-row">
        <Button className="w-full sm:w-auto">
          <RefreshCw aria-hidden="true" />
          {retry}
        </Button>
        <Button variant="outline" asChild className="w-full sm:w-auto">
          <a href="#">{support}</a>
        </Button>
      </div>

      <p className="font-mono text-xs text-muted-foreground">
        Reference: {reference}
      </p>
    </section>
  );
}
