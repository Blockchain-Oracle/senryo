import type { Metadata } from "next";
import {
  DM_Sans,
  Geist_Mono,
  Inter,
  JetBrains_Mono,
  Space_Grotesk,
  Space_Mono,
  Instrument_Serif,
} from "next/font/google";
import "./globals.css";
import "./directions.css";

const dmsans = DM_Sans({ variable: "--font-dmsans", subsets: ["latin"] });
const geistmono = Geist_Mono({ variable: "--font-geistmono", subsets: ["latin"] });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const jbmono = JetBrains_Mono({ variable: "--font-jbmono", subsets: ["latin"] });
const spacegrotesk = Space_Grotesk({ variable: "--font-spacegrotesk", subsets: ["latin"] });
const spacemono = Space_Mono({ variable: "--font-spacemono", subsets: ["latin"], weight: ["400", "700"] });
const instrument = Instrument_Serif({ variable: "--font-instrument", subsets: ["latin"], weight: ["400"], style: ["normal", "italic"] });

export const metadata: Metadata = {
  title: "Metropolis design directions",
  description: "Scratch preview of 21st.dev components composed into four directions",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const fonts = [dmsans, geistmono, inter, jbmono, spacegrotesk, spacemono, instrument].map((f) => f.variable).join(" ");
  return (
    <html lang="en" className={`${fonts} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
