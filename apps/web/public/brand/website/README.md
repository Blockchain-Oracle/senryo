# Senryo website media

First-party artwork from the approved story art; no third-party screenshot is used as public Senryo artwork.

- `scene-call.webp`, `scene-payout.webp`, `scene-passkey.webp`, `scene-modes.webp`: the phone's story scenes
  (`brand/art/onboarding/scene-*.svg`, made by `brand/scripts/onboarding.py`), each flattened to one 756 × 940 WebP by
  `node apps/web/scripts/website-art.mjs`. The masters' blank label plates (Practice · Test dollars, Real · USDC) are
  printed in from `brand/art/onboarding/labels.json`, as the phone draws them over its layers.

The landing's hero is not an image: it is the live BTC line from the terminal's own chart and quote pass, loaded after
first paint (`src/features/landing/LiveHero.tsx`).
