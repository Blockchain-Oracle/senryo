# R7 — Games that feel like games (replan stage 7; finishes S8.8)

**Goal:** every game has art, sound, motion and a result moment, uses real logos, and runs on both apps:
- Lucky;
- Warm-up;
- Line Rider and Candle Hop;
- Duel, Events and Parlays.

**Authority:**
- `replan-2026-10-10.md` R7; D-295;
- research `02` §2 and §6 B12–B15, `06` §1 #2–#4, #7, #16, #19 and §7;
- port sources `../owarine/web/src/features/games/`: `audio.ts`, `bed.ts`, `lucky/{reel-sfx,LuckyReels}.tsx`,
  `LuckyResultModal`, `DuelResultModal`, `SeasonBanner`, `AchievementsPlate`, `GameCard`, `GameProfileCard`,
  `HowToSheet`, `GameSettingsSheet`, `arcade/{ride-draw,flap-draw,sprites,arcade-sfx,palette}.ts`, `art/PixelArt.tsx`,
  `stage/stage.css`;
- licences checked before shipping (the pixel font, Kenney CC0);
- 21st.dev first.

**Gate:**
- `pnpm gate` 0;
- each game played through on the web (preview) and the phone (simulator), recorded:
  - the Lucky stagger at 720/980/1240 ms with sound;
  - an arcade run with impacts and a result;
  - a duel and an event settled with their moments;
- no game screen leads with proof text (it sits behind ⓘ).

## Steps
- [ ] R7.1 A games audio module (Kenney CC0 effects, a sequenced chip bed, effects and music volume) plus a games
  settings sheet (volumes, haptics, motion). Phone sounds are pre-rendered.
- [ ] R7.2 Lucky:
  - **keep:** the tumbling reel;
  - **stops:** staggered at 720/980/1240 ms, each with its own thunk and haptic, and a 480 ms lock-in;
  - **landing:** eased out from the current speed, a fixed landing distance, and no reshuffle while moving (both apps'
    reel components);
  - **faces:** market marks, pixel bull/bear/coin and a reach plate;
  - **sound:** spin sweep, ratchet, landings climbing a chord, win and lose stings;
  - **after:** a result modal with the streak; confetti on a win; a near-miss beat; history shows the outcome;
  - **proof:** behind ⓘ.
- [ ] R7.3 Warm-up on the phone; market marks on its cards and results; a sound and a result moment.
- [ ] R7.4 Arcade (Line Rider, Candle Hop):
  - CRT bezel, pixel font, sprites, sparks and trail, impact bursts, shake, combo heat, a grip vignette;
  - effects and the chip bed;
  - the engine's `impact`, `scored`, `crashed`, `regained` and `milestoneHit` events drive them;
  - the market's mark and candles as the stage;
  - full screen and pause on the web.
- [ ] R7.5 Arcade on the phone in Skia (not Owarine's SVG recorder), full-screen landscape with pause and quit. The
  config's phone routes become real.
- [ ] R7.6 The hub on both apps:
  - key art per game;
  - a season banner and an achievements plate (indexer facts);
  - a profile card with Elo;
  - "pick up where you left off";
  - interface clicks with a random detune.
- [ ] R7.7 Duel:
  - a queue screen (searching banner, breathing glow);
  - a versus lobby with the commitment;
  - the card flip and urgency bar;
  - a result with jingles and confetti;
  - a share image;
  - opponent avatars, tier badges and the real rating.
- [ ] R7.8 Events: a settlement moment, league and team marks from the registry, and the committee and statements behind
  ⓘ. Parlays: a leg-by-leg reveal.

## Handoff
(written at the end of the stage)
