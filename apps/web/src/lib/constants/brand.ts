/** Brand strings (D-003, D-049). The rpId/domain lives in packages/config once it exists (S6). */
export const BRAND = {
  name: "Senryo",
  kanji: "千両",
  wordmark: "SENRYO",
  title: "Senryo 千両 — call the next move",
  description:
    "Up or Down on live prices, a minute to an hour at a time, paid out on its own on Monad. Practice with free test dollars; a passkey is your account.",
  network: "MONAD",
} as const;

/** The public source (the judge guide's repo-relative links open here, on the default branch). */
export const REPO = { url: "https://github.com/Blockchain-Oracle/senryo", branch: "main" } as const;

/**
 * Top-bar seal edge (CSS px). brand/README.md: the full seal needs ≥ 32 device px (below that, use the favicon mark),
 * so the bar draws it at 32 and a 1× screen still gets the whole carving.
 */
export const SEAL_MARK_SIZE = 32;
/** The mode label's network mark (the phone's mode capsule). */
export const MODE_MARK_SIZE = 20;
/** Mark edges (CSS px; the phone's SIZE.markDetail / markToken / markHero). */
export const MARK_ROW = 40;
export const MARK_SMALL = 24;
export const MARK_HERO = 56;
/** The chain badge in the middle of a receive QR (the phone's BADGE). */
export const MARK_QR_BADGE = 34;
/** The welcome page's seal (CSS px). */
export const WELCOME_SEAL_SIZE = 96;
