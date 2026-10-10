# Replan synthesis — 10 October 2026

The owner's feedback (10 Oct) was that Senryo should have followed **Tradash** as its overarching approach from day one, as Owarine
(Canton S3) did. The requirements:

- live PnL moving in real time is the heart of the product;
- pricing can never fail and must be fast;
- games must feel like games, with real logos;
- the web colour is wrong;
- ⌘K can be better;
- take the best from four references: Tradash, Owarine, Canton S2 and Mitoshi.

Six read-only studies sit beside this file. This page is what they add up to.

## What the studies found

**1. The engines are right; the product around them is not** (01, 02).

- **Already faithful to Tradash's numbers:**
  - the chart engine (easing, the 600-sample buffer, pill, callouts, dot field);
  - the reaction and pitch-ladder sound engine;
  - live cash-out from the contract maths.
- **Senryo is already ahead of Owarine on:**
  - Skia on the phone;
  - on-chain exits that fire with the app closed;
  - a 2 s close against Owarine's 11–14 s;
  - asset logos;
  - ⌘K actions;
  - working push.
- **What's missing is everything the engines are meant to serve:**
  - a **live positions book**: Unrealized PnL card, position rows with ROI, an equity pill and Close all. The terminal only
    sees the call in the current window (`packages/calls/src/use-call-window.ts:31-36`);
  - **one-tap TRAIL/CLOSE** with break-even and trail levels on the chart;
  - **win/loss at the moment of close**, with a realized toast and confetti;
  - an **instant first call** with a pending entry drawn at the tap;
  - the **tutorial**, **music** and **candles**;
  - **replay** and the **leaderboard**;
  - the **colour rule**: PnL ≥ 0 rather than "would win".

**2. The line moves once a second; Tradash's moves about five times** (01, 04).

- Production sends one Pyth tick a second (the Starter plan's cap). The line therefore glides about 6× slower and the numbers
  step instead of rolling.
- Surge, mega and slump reactions can never fire: the 1.5 s window holds 2 ticks and needs 4.
- Owarine drew its crypto line from Coinbase trades at ≤ 8 Hz, labelled as display, with settlement kept separate.

**3. Pricing can fail silently in seven ways** (04). The design is sound, but:

- a non-JSON 200 from a RedStone gateway crashes the whole api;
- archive look-ups and an anonymous route share the live stream's rate budget;
- a missed boundary print is never back-filled, so a short Hermes outage becomes mass refunds;
- a dead feed shows "Live" and a flat, calmly scrolling line;
- reconnects take up to 20 s to notice;
- a failing stream ticket blocks prices entirely;
- RedStone's keyless gateways end on 29 Oct, taking 19 of the 34 markets.

The fixes are R1–R18. All are free except the RedStone route.

**4. The contracts already support live PnL; the experience is the gap** (05).

- The apps recompute `shares × (probability − spread) − stake` on every tick, exactly as the fill does.
- **Differences from Tradash** (inherent to a prediction):
  - the value is non-linear and moves with time;
  - it starts about 7.7% in the red, from the 2-point spread paid in and out;
  - a call lives only as long as its window.
- **A real bug:** a near-certain winner shows −$10 in the win colour.
- **Unverified:** an estimated 1 in 4 taps may be refused by the 3% tolerance near the line.
- **Recommendation:**
  - keep the contracts and finish the deploy;
  - fix the experience;
  - optionally cut the spread to 1 point (one admin transaction);
  - a linear "ride the price" mode would be a new contract and would undo the 8 Oct prediction-only decision.

**5. Three looks in one product** (03, 06).

- **Phone:** UGLYCASH — light, black, magenta `#FA00FF`, condensed numbers.
- **Web app:** the retired "Living Lacquer" — indigo `#414EF4` on violet-black, dark forced on in `apps/web/src/app/layout.tsx:24`.
- **Landing:** its own lavender.

The approved 7 Oct UGLYCASH plan already supersedes the web palette (`docs/plan/uglycash-revamp-2026-10-07.md:33`). The web
never switched, which is almost certainly "the colour".

**6. The games have mechanics and no game layer** (02, 06).

- Owarine ships what's missing, none of it ported:
  - staggered reel stops (720/980/1240 ms), each with its own thunk, plus a 480 ms lock-in;
  - reel sound;
  - pixel art and sprites;
  - a CRT frame and a chiptune bed;
  - result modals;
  - seasons and achievements.
- Senryo's reels are grey text, the arcade is a dot and some rectangles, and the games use no logos.
- The phone has one of the four games.

**7. Logos.**

- **Missing:** in every game, in Earn, the web wallet drawers, the landing chart, proof and toasts.
- **No art:** QQQ, MSFT, AMZN and Pyth.
- **Not from the registry:** event team logos are hot-linked from ESPN.

**8. ⌘K** (03, 06): a good base, but no recents or ranking, no previews, no trade actions. It ignores trading sessions, doesn't
search events, calls or people, and the phone has no global search.

**9. Unfinished tells** (06):

- engineering copy on gated features ("the next markets deploy");
- a placeholder Status screen;
- settings for features that don't exist;
- judge-guide claims that contradict the screens;
- universal links still pointing at the old trading routes.

**10. Canton S2 on disk is Sotto, a private payroll app** — not a trading reference (03). Ideas worth taking:

- **From Sotto:** a real "unknown outcome" state with Check status; the honest money flow.
- **From Mitoshi:**
  - emoji callouts on the line;
  - tense music when losing;
  - a stamped paper receipt;
  - every failure saying whether money moved;
  - a stricter rule that no hotkey moves real money.

## Decisions for the owner (plain words)

1. **Instrument:** keep Up/Down as a prediction with a Tradash-style live screen (recommended), or also add a linear "ride the
   price" mode (a new contract, more MON, against the 8 Oct decision)?
2. **Spread:** drop the pool's spread from 2 points to 1 so calls start less in the red? This halves what the pool earns per
   call.
3. **The 19 RedStone markets after 29 Oct:** ask RedStone for a key (free, probably), buy Pyth Pro equities ($5,000/month), or
   make them read-only after the 29th.
4. **Faster crypto line:** add a free display-only exchange feed (Coinbase/Kraken trades, labelled), or pay for Pyth Pro
   crypto ($2,500/month) for 200 ms ticks?
5. **Web theme:** light by default like the phone and UGLYCASH (recommended), or keep dark?
6. **Hotkeys on Real money:** keep the arrow/C keys placing and cashing out on Real, or Practice only, as Mitoshi does?
7. **Pyth display rights:** whether the current Pyth key allows showing prices to app users is a licensing question for Pyth.

## Things decided internally (no ask needed)

- **Pricing:** all free fixes R1–R10 and R12–R18 (the crash guard, PrintFetcher, PrintWatch back-fill, health states, honest
  chips, ticket decoupling, reconnect speed, replay epochs, batched fan-out, charts at any refresh rate).
- **The −$10 win-colour bug**, and refused-close copy that says whether money moved.
- **Wiring the dead reactions switch;** deleting `movement.ts`.
- **Web onto the UGLYCASH tokens,** if the owner keeps light.
- **Engineering copy replaced** with plain states; the placeholder Status screen built or removed; stale settings removed;
  universal links fixed.
- **Logos:** register the missing marks by script (QQQ, MSFT, AMZN, Pyth, leagues, teams through the identity registry).
