import { TERMS } from "@senryo/config";
import type { Metadata } from "next";
import { LegalDocumentPage } from "@/components/legal/legal-document";

export const metadata: Metadata = { title: TERMS.title, description: TERMS.intro };

/** /terms — the terms of use the app asks you to accept (J1), public for the store listings. */
export default function TermsPage() {
  return <LegalDocumentPage doc={TERMS} other={{ href: "/privacy", label: "Privacy" }} />;
}
