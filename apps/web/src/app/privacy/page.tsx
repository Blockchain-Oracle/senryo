import { PRIVACY } from "@senryo/config";
import type { Metadata } from "next";
import { LegalDocumentPage } from "@/components/legal/legal-document";

export const metadata: Metadata = { title: PRIVACY.title, description: PRIVACY.intro };

/** /privacy — the privacy notice; the URL the App Store and Google Play listings name. */
export default function PrivacyPage() {
  return <LegalDocumentPage doc={PRIVACY} other={{ href: "/terms", label: "Terms of use" }} />;
}
