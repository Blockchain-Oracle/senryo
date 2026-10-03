# Third-party notices

Senryo's own code is MIT ([`LICENSE`](LICENSE)). The items below are other people's work, used under their terms. Every
entry is recorded with its exact source, licence text and a content hash in the files named, so this page is a map,
not the record.

## Marks: tokens, networks, venues, providers, companies

Fetched by script, never by hand (`packages/identity/scripts/catalog.ts`, `fetch-marks.ts`); each mark's source URL,
licence wording and sha256 are in `packages/identity/src/art/generated/fetched.ts` and the first-party records in
`packages/identity/src/entities.ts`. A repo invariant (`identity-provenance`) fails the build if any mark lacks them.

| Source | Licence | Used for |
|---|---|---|
| [web3icons](https://github.com/0xa3k5/web3icons) | MIT | token, network and exchange marks |
| [Simple Icons](https://github.com/simple-icons/simple-icons) | CC0 1.0 | company marks behind equity markets; Apple Pay, Google Pay |
| [Monad token list](https://github.com/monad-crypto/token-list) | issuers' submitted logos (no repo licence) | spot tokens and XAUt0 |
| [lifinance/types](https://github.com/lifinance/types) | Apache 2.0 | Relay, Across, LI.FI, Circle CCTP, KyberSwap, Monorail |
| Hyperliquid app coin icons | venue-published instrument metadata | LIT, VVV, PUMP |
| [Wikimedia Commons](https://commons.wikimedia.org) | public domain (text logo) | iShares |
| [Material Symbols](https://github.com/google/material-design-icons) | Apache 2.0 | glyphs where no owner's mark exists (oil barrel) |
| Owners' own sites (sha256-pinned) | the owner's trademark | Ramp Network |

All marks remain their owners' trademarks. Senryo uses them nominatively, only to identify the asset, network, venue or
provider they belong to. No endorsement is implied.

## Fonts

Recorded in `packages/tokens/src/fonts.ts` (owner, source URL, sha256, licence); licence texts ship beside the files.

| Font | Licence |
|---|---|
| Inter / Inter Display 4.1 (The Inter Project Authors) | SIL Open Font License 1.1 |
| Noto Sans JP, subset (Adobe / Google) | SIL Open Font License 1.1 |
| Material Symbols (Google), Android utility icons | Apache 2.0 |

iOS utility icons are SF Symbols, drawn by the operating system through `expo-symbols` and not redistributed.

## Sounds

Original cues generated with ElevenLabs text-to-sound-effects from Senryo's own prompts; no system recordings or
third-party samples (`apps/mobile/assets/sounds/README.md`).

## UI components ported from 21st.dev

Community components from [21st.dev](https://21st.dev), ported to React Native (mobile) or adapted (web). Each port
names the author, the component id, what was taken and every deviation:
`apps/mobile/.21st/design.json`, `apps/web/.21st/design.json` and `docs/product/provenance/*.md`. Authors include
starc007 (slide action button), tom_ui (QR code), ssychui (swap ticket, market watchlist), sean0205 (stepper, progress),
ibelick (disclosure, tilt), radiumcoders (grid button), uvain (notification panel), ruixen.ui (notification button),
bankkroll (number pad), uiable (list group), originui (checkbox), haydenbleasel (pill), preetsuthar17 (selector chips),
santoshvarmaaddala (search bar), hari (transaction list), Codehagen (action button).

## Pre-existing code

Reused from the author's earlier project (Agari) and listed in the README under "Pre-existing code".

## Packages

npm, Foundry and Docker dependencies carry their own licences in their packages (`pnpm licenses list` prints them).
Smart-contract libraries are git submodules under `contracts/lib`: OpenZeppelin Contracts (MIT) and forge-std (MIT or
Apache 2.0, tests and scripts only).
