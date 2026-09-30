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

/** Files served by nginx on the rpId host (runbook §6). */
export const WELL_KNOWN = {
  appleAppSiteAssociation: "/.well-known/apple-app-site-association",
  assetLinks: "/.well-known/assetlinks.json",
} as const;
