"use client";

// 21st: shadcn/sonner (#886). Re-tokenized: square D2 corners, hairline border, mono title, no shadow.
import { useTheme } from "next-themes";
import type { ComponentProps } from "react";
import { Toaster as Sonner } from "sonner";

type ToasterProps = ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { resolvedTheme } = useTheme();
  return (
    <Sonner
      theme={resolvedTheme === "light" ? "light" : "dark"}
      className="toaster group"
      visibleToasts={1}
      toastOptions={{
        classNames: {
          toast:
            "group toast rounded-lg group-[.toaster]:border group-[.toaster]:border-border group-[.toaster]:bg-popover group-[.toaster]:text-popover-foreground group-[.toaster]:shadow-none",
          title: "font-mono text-caption",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
