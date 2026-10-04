# Senryo website revamp — Refero, 4 October 2026

## Brief and authority

Designing Senryo's public website for people exploring a Monad wallet and market product. The primary action is to start in Practice or browse the actual app. Preserve Senryo's seal, gold-leaf Kinpaku artwork, approved illustrations, existing passkey/create/sign-in/recovery flows, routes and legal documents. Do not imply production card spending, enabled Mainnet trading, returns, user counts or prediction execution.

The user explicitly requested Refero and delegated the creative revamp. The prior instruction delegates design recommendations and implementation sequencing to Codex. This pass uses that authority to choose and build the direction below; it does not create another worktree or expand money capabilities. Refero's connected tools answered successfully using existing access; no purchase or subscription change was needed. Production website publication is a separate final decision after the local result can be reviewed.

## Research and alternatives

Three visual angles were searched: premium dark fintech/product typography, expressive mobile-product marketing, and Phantom wallet branding. Full styles reviewed:

- [Phantom](https://phantom.app), Refero style `e0754053-53b1-4f31-9692-fd6768e82adb`: paper-white/lavender, plum text, light display typography, rounded sections and controlled action emphasis.
- [Fey](https://www.fey.com), Refero style `bbc8d444-1624-4d01-baba-64e3325f6481`: dark, contained product/data presentation; neutral actions, compact financial detail and restrained borders.
- [Empower](https://empower.me), Refero style `14edc470-fa1c-47f9-9efa-d44194be4aec`: dark/light contrast, assertive display typography and yellow action backgrounds.

Concrete screens inspected (metadata and actual thumbnail images):

- [Family homepage](https://refero.design/pages/9828d7e9-733f-4254-98fa-8a7e040b8171): own illustrations, short product explanation, clear next action, and media/text sequence.
- [Vivid payments](https://refero.design/pages/1a23bbd5-516d-4301-99b3-a51e5d3d9766): specific task copy, product-led images and readable feature sections. Its banking/fee claims do not transfer to Senryo.

| Approach | Trade-off | Decision |
|---|---|---|
| Light lavender product story, Phantom foundation | Friendly introduction; lets Senryo's dark/gold artwork carry contrast and keeps Practice approachable | Selected under the user's creative delegation |
| Dark financial product gallery, Fey foundation | Strong for experienced traders, but close to the current dark app and less distinct as an introduction | Retain only the disciplined framing of financial/product media |
| Dark/light poster, Empower foundation | Memorable and bold; yellow/type system competes with Senryo's existing gold artwork and violet interaction identity | Rejected for this product |

## Reference lock

Primary: Phantom's light, spacious, rounded visual language. Preserve paper-white canvas, pale lavender hero, deep plum copy, light-weight large sans headlines, 24–32px section radii, pill actions and minimal shadows. Adapt text-left/media-right composition from the inspected wallet/payment screens. Borrow Family's use of owned illustrations and specific product journeys. Fey contributes only restrained product-media framing; do not import its palette, dense typography or accent tokens into the whole page.

Media: use the actual approved Senryo market and balance illustrations, existing Kinpaku card image and official identity-registry avatars. These are product illustrations, not screenshots or proof of balances, transactions or performance. No private account screenshots, partner endorsement strip, invented testimonials, fake market prices or stock lifestyle photography.

Tokens: page `#fdfcfe`, hero/primary action `#e2dffe`, primary ink `#3c315b`, supporting ink dark enough for normal-text contrast, dark card/entry section adapted from Senryo's own lacquer tokens. Gold stays in the actual brand/card artwork. Inter regular for light display, medium for actions, existing licensed/self-hosted font assets. Existing app tokens keep their meanings; marketing rules are scoped to the landing page.

Reject: generic three-card feature grid, ungrounded gradients, invented app UI, decorative italic headline fragments, oversized terminal/data boards, beige/olive averaging and logo substitution.

## Decision ledger

| Decision | Source | Role and reason |
|---|---|---|
| Paper/lavender and plum | Phantom full style + Senryo's violet action identity | Light introduction and primary action emphasis; no gold CTA system |
| Large regular sans heading | Phantom display role | Clear readable product statement; use existing Inter rather than an unlicensed reference font |
| Rounded, spacious product sections | Phantom + Vivid screen | Lead with wallet/markets, then people/card, avoiding a repeated generic feature grid |
| Owned 3D illustrations | Family screen + user-approved Senryo art | Make real Senryo entities/marks integral; preserve approved art |
| Gold card on lacquer | Existing Kinpaku asset + bounded Fey media framing | Product identity, explicitly sandbox; no live spending promise |
| Actual app links and existing welcome actions | Owning routes/account source | Keep browsing/create/sign-in/recovery and existing account guards |
| Native HTML question disclosures | Refero concrete FAQ pattern + craft accessibility guidance | Keyboard/touch interaction with little additional JavaScript |
| Practice-first copy and state boundaries | Current validation/config + user priorities | Paper funds have no cash value; prediction execution and production card issuance remain unfinished |

## Build and validation target

Build the public `/` introduction as a server-rendered/static-export-compatible page with scoped CSS. Keep application routes and authentication controls functioning. Existing recovery flow and host restrictions remain. Product, Practice and question anchors work on mobile and desktop. Use semantic links/details, visible focus, touch targets, reserved image dimensions, lazy below-fold imagery and reduced-motion handling for any transitions.

Validate the rendered production export on desktop and phone-width browser views against the lock, click section/FAQ/app links and exercise keyboard focus. Run affected typecheck, scoped lint/format and a static export. Record any unverified native/production/account actions separately. No product feature is accepted merely because its marketing section looks correct.
