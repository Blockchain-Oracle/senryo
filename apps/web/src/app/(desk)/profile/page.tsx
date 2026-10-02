import type { Metadata } from "next";
import { OwnProfile } from "@/components/social/own-profile";

export const metadata: Metadata = { title: "You" };

export default function ProfilePage() {
  return <OwnProfile />;
}
