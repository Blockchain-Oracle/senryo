# Provenance — Card tab and Notifications inbox

Searches run with `npx -y @21st-dev/cli search "<what>" --type c` on 2 Oct 2026; code read with `get <id>`. Every port is
behaviour and layout only, rebuilt in React Native (Reanimated 4, Gesture Handler, react-native-svg); no web library
was added.

| Component (file) | 21st source | What was ported | Deviations |
|---|---|---|---|
| `features/card/CardHero.tsx` (tilt) | ibelick/tilt, id 1448 | Pointer position → normalised −0.5…0.5 → `rotateX` / `rotateY` through springs, `perspective(1000)`, back to 0 on leave; the reversed variant (card leans toward the touch), rotation factor 10° | Pan gesture instead of mouse move; it activates only on a sideways drag and fails on a vertical one, so the page still scrolls. Added an ambient float (sway ±7° + 6 pt rise over the 8 s ambient loop) for the unissued card, the existing settle-in and light band, and `dim` for the frozen card. Reduce Motion: still. |
| `features/card/ActionCircle.tsx` | Codehagen/action-button, id 1051 | The busy state stacks the label and the spinner in one grid slot, so the control never changes size while its action runs | A 56 pt disc + label under it (D-196) instead of a text button; glyphs from `components/kit/symbols`. Searched "quick actions icon buttons with labels" (felipemenezes098 23699, ruixen.ui 7909): dropdown / text buttons, none fit the circle grammar. |
| `features/card/CardFace.tsx` | searched "credit card" (ravikatiyar162 5276, educalvolpz 29187, yura 24331) | Nothing ported: 5276's hover flip is not a phone interaction; the Kinpaku art stays Senryo's own raster | The ready card enters with Reanimated `FlipInEasyY` (the card "turns" to show •••• last4, E1 step 6). |
| `app/(tabs)/card/intro.tsx` (explainer) | searched "onboarding carousel steps progress" (cnippet-dev 19097, ephraimduncan 29458) | Segment progress across the top, one per step | Layout follows Solflare S16 (evidence `R1/screens/S16.jpg`): close/Skip at top, centred art, title + one line, one bottom action. |
| `features/card/SimulateSheet.tsx`, `TabSheet.tsx`, `WalletRow.tsx`, `SpendableHero.tsx` | — | Built from the foundation (`Sheet`, `SheetRow`, `AmountHero`, `SlideToConfirm`, `TradeTrace`) | No new component searched: these compose existing ported primitives. |

## Marks

- **Wallet mark.** `WalletRow` renders `provider:apple-wallet` (iOS) / `provider:google-wallet` (Android) from
  `@senryo/identity` as soon as that entity has first-party art (`hasArt`). Until then a card glyph disc stands in —
  never a drawn imitation of Apple's or Google's artwork. The first-party Wallet artwork (Apple Pay marketing
  guidelines; Google Wallet brand guidelines) is for the identity owner to add with provenance.
- **Payment glyphs.** Card payments use `CreditCard` / `Ban` / `ArrowDownUp` from `components/kit/symbols`; the MCC → 8
  category glyphs decision (E6) needs new symbols (fork.knife, car, bag, airplane, ticket, wrench, banknote) in the kit.
