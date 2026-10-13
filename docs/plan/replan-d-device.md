# Stage D — The owner's iPhone review (13 Oct 2026, evening)

The owner tested on their real iPhone and found what the simulator never showed: a crash switching Real → Practice,
history missing most of what they did, their open event calls buried at the bottom, a Close that seems dead, Home that
won't refresh, replay sound that comes and goes, and Edit profile doing nothing. "Look into this beyond what I
mention." Stage P's P3–P5 resume after this stage. Evidence: five read-only investigations (13 Oct) and a two-app
sweep of the same patterns.

**Rules for this stage:** every fix lands on both apps where both have the surface; nothing is called done until it is
seen on the owner's iPhone (devicectl once it is paired) or, until then, on a Release simulator build with a passkey
account and on production web.

## D0 · Crashes leave evidence, and the switch stops crashing
- [ ] The prime suspect (with a passkey account only — why the simulator's guest never crashes): `useNetworkBalances`
      and `useMarketAccount` share `marketKeys.account(chainId, owner)` but cache different shapes (a bigint vs the
      account object). After a switch the object lands under the key the open Mode sheet reads; `formatUnits` throws
      "Cannot mix BigInt"; nothing catches it; a Release build aborts. The Mode sheet reads the shared account query and
      selects `.balance`.
- [ ] A safety net, over the air: a root error boundary (a calm "Something broke · Reload" screen, never a hard
      crash) and a global JS handler; each error kept on the device and sent on the next launch through the existing
      `POST /v1/events` (`props`: message, stack, screen, runtime, update id, build), with an unclean-exit flag for native
      crashes. A read route for ops.
- [ ] The device loop: the owner's iPhone paired with this Mac (`xcrun devicectl`) — crash reports, installs of Release
      builds, live logs.

## D1 · History is everything you did
- [ ] One history on Calls (both apps): calls, rides, settled parlays, event calls, duel matches, Lucky draws (as
      Lucky, not a bare call), newest first; the outcome filter keeps working; each row names its kind and opens its
      receipt or detail. Sources exist (`useEventCalls`, `useParlays`, `useDuels`, `useLuckyDraws`); the merge is one
      shared model in `@senryo/calls` with a renderer per app.

## D2 · Your event calls first
- [ ] Events (both apps): your open calls above the board, then the board; settled calls under "Settled"; a card
      shows the call you already hold on it.

## D3 · Every tap answers at once
- [ ] A position row's Close runs the terminal's own path (one shared close run): press cue, "Closing…" toast that
      becomes the result, an in-flight guard, the row held as Closing until the stream settles it.
- [ ] The same rule for every money action the sweep found late or unguarded: duel join / rematch / leave / pick,
      event call, parlay place, one-tap on/off, exit set, call trail, Earn take back, web test dollars.

## D4 · Everything refreshes, every failure offers Try again
- [ ] Phone: pull-to-refresh on Home and the 13 screens without it (receipts, Earn, Wallet, Parlay, Duel, Events,
      event detail, games, search). Web: Try again on the 10 screens that only say they failed or spin forever.

## D5 · Replay sound, every time
- [ ] Playback ignores the silent switch while a replay plays (`playsInSilentMode` on Play, restored after), keeps the
      session active, waits for the sound to load and seek before playing; Play says "Sound once ready" until the file
      exists and no longer cancels the encode; the mute follows the toggle.

## D6 · Edit profile, and no silent failures
- [ ] Edit profile never does nothing: unlock in place, say why a save didn't happen, keep the session.
- [ ] The ~12 silent failures from the sweep say what happened (parlay / event / duel early returns and unhandled
      signing errors, the terminal's not-ready guard, sign-out, delete data, unlock, paste, arcade seed, Lucky link).

## Then
P3 → P5 (stage P), then Q2, Q4–Q6, R8.

## Handoff
(written at the end of the stage)
