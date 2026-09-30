/**
 * Any host other than the rpId (or a subdomain) would create *different* accounts (Mera: "the rpId is the account"),
 * so ceremonies never run there — a preview URL or an IP says so and links to the real host.
 */
import { authFailureCopy } from "@senryo/account";
import { WEB_ORIGIN } from "@senryo/config";
import { ExternalLink, Globe } from "lucide-react";
import { AuthCard, AuthCardBody, AuthCardHeader } from "@/components/ui/auth-card";
import { Button } from "@/components/ui/button";

export function HostNotAllowed() {
  const copy = authFailureCopy("host-not-allowed", "web");
  return (
    <AuthCard role="alert">
      <AuthCardHeader glyph={<Globe />} tone="gold" title={copy.title}>
        {copy.body}
      </AuthCardHeader>
      <AuthCardBody>
        <Button asChild className="w-full">
          <a href={WEB_ORIGIN}>
            Open senryo.xyz
            <ExternalLink />
          </a>
        </Button>
      </AuthCardBody>
    </AuthCard>
  );
}
