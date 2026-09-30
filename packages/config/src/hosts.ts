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
 * user's Apple Developer team (Individual, from `eas credentials -p ios`, 2026-09-30); the Android signing SHA-256 is
 * not a constant — the `.well-known` generator reads it from `~/.config/senryo/android.env` once EAS has a keystore.
 */
export const APPLE_TEAM_ID = "86C6ZFJ6V6";
export const IOS_BUNDLE_ID = "xyz.senryo.app";
export const ANDROID_PACKAGE = "xyz.senryo.app";

/** Files served by nginx on the rpId host (runbook §6). */
export const WELL_KNOWN = {
  appleAppSiteAssociation: "/.well-known/apple-app-site-association",
  assetLinks: "/.well-known/assetlinks.json",
} as const;
