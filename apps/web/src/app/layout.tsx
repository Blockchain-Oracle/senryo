import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import type { ReactNode } from "react";
import { StepUpProvider } from "@/components/auth/step-up";
import { ThemeProvider } from "@/components/shell/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { AccountProvider } from "@/lib/account/provider";
import { BRAND } from "@/lib/constants/brand";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const jbMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jbmono", display: "swap" });

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
    <html lang="en" className={`${inter.variable} ${jbMono.variable} dark`} suppressHydrationWarning>
      <body className="min-h-dvh">
        <ThemeProvider>
          <AccountProvider>
            <StepUpProvider>{children}</StepUpProvider>
          </AccountProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
