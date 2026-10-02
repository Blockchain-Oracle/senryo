import type { Metadata } from "next";
import { SocialScreen } from "@/components/social/social-screen";

export const metadata: Metadata = { title: "Social" };

export default function SocialPage() {
  return <SocialScreen />;
}
