import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { ThemeProvider } from "@/components/shell/theme-provider";
import { BRAND } from "@/lib/constants/brand";
import { inter, interDisplay, notoSansJp } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: BRAND.title, template: `%s · ${BRAND.name}` },
  description: BRAND.description,
  applicationName: BRAND.name,
  icons: { icon: "/icon.svg", apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "dark light",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${interDisplay.variable} ${notoSansJp.variable} dark`}
      suppressHydrationWarning
    >
      <body className="min-h-dvh">
        {/* The account runtime lives where accounts are used: the app's layout and the landing's sign-in island. */}
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
