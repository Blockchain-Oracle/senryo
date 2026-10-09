import type { Metadata } from "next";
import { Setup } from "@/features/setup/Setup";

export const metadata: Metadata = { title: "Set up" };

export default function SetupPage() {
  return <Setup />;
}
