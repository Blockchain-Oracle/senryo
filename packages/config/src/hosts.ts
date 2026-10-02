/**
 * Public hosts. The apex is the passkey relying-party id (D-049/D-100: senryo.xyz) — it *is* the account, so it is
 * frozen once the first account exists. Subdomains follow the deploy runbook §2 (A records `@`, `api`, `indexer`, `docs`).
 */
export const RP_ID = "senryo.xyz";

export const WEB_ORIGIN = `https://${RP_ID}`;
export const API_ORIGIN = `https://api.${RP_ID}`;
export const INDEXER_ORIGIN = `https://indexer.${RP_ID}`;
export const DOCS_ORIGIN = `https://docs.${RP_ID}`;

/** iOS associated domains for passkeys (webcredentials) and universal links (applinks). */
export const ASSOCIATED_DOMAINS = [`webcredentials:${RP_ID}`, `applinks:${RP_ID}`] as const;

/**
 * App identities the rpId host vouches for (AASA + assetlinks, S6). Public identifiers, not secrets. The Team ID is the
 * user's Apple Developer team (Individual, from `eas credentials -p ios`, 2026-09-30).
 */
export const APPLE_TEAM_ID = "86C6ZFJ6V6";
export const IOS_BUNDLE_ID = "xyz.senryo.app";
export const ANDROID_PACKAGE = "xyz.senryo.app";

/**
 * Every certificate that signs the Android app (assetlinks `sha256_cert_fingerprints`; a missing one makes passkeys
 * fail with `BadConfiguration`). [0] = EAS default keystore "Build Credentials fNFoZPe6lZ" (read from the dev APK's v2
 * signing block, build e8d03e99, 2026-09-30) — the direct APKs. [1] = Google Play App Signing (D-233): Play re-signs
 * what it installs, read from the Play Developer API `generatedApks` for versionCode 2 on 2026-10-02.
 */
export const ANDROID_CERT_SHA256S = [
  "E4:89:29:5E:DF:D5:56:E0:52:65:5C:16:AB:81:FE:FE:60:56:22:0E:2A:2A:D0:F4:24:24:B9:1F:D1:8E:B1:A5",
  "8E:E1:96:5B:E6:FC:72:7C:66:3B:7A:49:B0:8E:80:50:DD:78:1C:65:5B:A4:D6:95:62:43:DE:5F:2E:F8:5D:D4",
] as const;

/** Files served by nginx on the rpId host (runbook §6). */
export const WELL_KNOWN = {
  appleAppSiteAssociation: "/.well-known/apple-app-site-association",
  assetLinks: "/.well-known/assetlinks.json",
} as const;
