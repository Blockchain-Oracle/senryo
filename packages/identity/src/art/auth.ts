/**
 * The passkey glyph for every passkey surface (create, sign-in, step-up, recovery, security). Google's Material Symbols
 * "passkey" (Apache-2.0), kept byte-for-byte; drawn in the surrounding ink by `EntityGlyph` (one flat colour).
 *
 * The FIDO Alliance icon was researched first (D-170) and is not used, because no route to it carries a usable grant:
 * - passkeys.dev (github.com/passkeydeveloper/passkeys.dev, LICENSE): "Creative Commons Attribution-NonCommercial-
 *   NoDerivatives 4.0 … You may only link to this content. Copying, distributing, or modifying the content is not
 *   permitted." The repo holds only passkeys.dev's own logos (static/img/logos/pdd-*), not the FIDO icon.
 * - The same org's whatarepasskeys.info holds public/images/passkey-icons/passkey-icon-2024-{black,white}-nobox.svg; its
 *   CC BY 4.0 covers the site's "written copy, FAQ answers, comparisons … scoring data", and can't license FIDO's mark.
 *   Its white file carries a C2PA manifest stating an AI tool "may have created or modified the file contents".
 *   tools.passkeys.dev (MIT code) has passkey-icon-2024-color-box.svg, a raster wrapped in SVG (`<image>`).
 * - FIDO itself distributes the files from https://fidoalliance.org/passkey-download/ under the "FIDO Passkey Icon Usage
 *   Agreement for Passwordless Sign-In" (https://fidoalliance.org/get-the-passkey-icon/): "By completing the form on the
 *   following page, you are agreeing to this Agreement" (name, email, company), and "3.6 No right to create
 *   modifications or derivatives of any FIDO Trademarks is granted herein."
 * Material Symbols carries an unconditional licence and the same person-and-key meaning, so it is the shipped glyph.
 * FIDO's public Passkey Icon Usage Guidelines still set the presentation (≥ 24 px, one flat colour, ≥ 3:1 contrast,
 * free space ≥ the key's width, a text label beside it, aria-hidden when labelled), since they describe the passkey
 * affordance users already know.
 */
import type { ArtSource } from "../types.ts";

/** google/material-design-icons, pinned; `scripts/fetch-marks.ts` fetches its other glyphs (crude oil) at the same commit. */
export const MATERIAL_COMMIT = "bd8cb85bd4bad964fe6918f79665bb40c3a8efef";

export const AUTH_ART: readonly ArtSource[] = [
  {
    key: "passkey",
    owner: "Google — Material Symbols (github.com/google/material-design-icons)",
    provenance: "first-party",
    pageUrl: "https://fonts.google.com/icons?selected=Material+Symbols+Rounded:passkey",
    licence:
      "Apache License 2.0 (https://github.com/google/material-design-icons/blob/master/LICENSE). README: \"We have made these icons available for you to incorporate into your products under the Apache License Version 2.0 … Feel free to remix and re-share these icons and documentation in your products. We'd love attribution in your app's about screen, but it's not required.\" The licence text ships beside the file (sources/passkey/LICENSE-material-design-icons.txt, §4a); credited in About & sources.",
    retrieved: "2026-10-01",
    usage:
      'Presentation per FIDO\'s Passkey Icon Usage Guidelines (https://fidoalliance.org/wp-content/uploads/2023/12/FIDO-Passkey_Icon_Usage_Guidelines-August2022.pdf, p.5/13/14/16): "a single flat color with no gradients or textures", "minimum size of 24 × 24 px", contrast "at least 3:1", free space "at least as wide as the key", vertically centred with its text label, aria-hidden when labelled; never skewed, rotated, stretched, outlined or shadowed; never part of Senryo\'s own brand.',
    variants: {
      symbol: {
        path: "packages/identity/sources/passkey/material-symbols-rounded-passkey-24px.svg",
        url: `https://raw.githubusercontent.com/google/material-design-icons/${MATERIAL_COMMIT}/symbols/web/passkey/materialsymbolsrounded/passkey_24px.svg`,
        minPx: 24,
        sha256: "27a87be2f975b2f858d2d549065d932767e976443ac0880d9a3f5e86995948ef",
        viewBox: "0 -960 960 960",
        insetPermille: 42,
        surface: "any",
        shape: "free",
        tintable: true,
      },
    },
  },
];
