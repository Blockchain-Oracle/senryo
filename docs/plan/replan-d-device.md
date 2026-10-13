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
- [x] The prime suspect (with a passkey account only — why the simulator's guest never crashes): `useNetworkBalances`
      and `useMarketAccount` share `marketKeys.account(chainId, owner)` but cache different shapes (a bigint vs the
      account object). After a switch the object lands under the key the open Mode sheet reads; `formatUnits` throws
      "Cannot mix BigInt"; nothing catches it; a Release build aborts. The Mode sheet reads the shared account query and
      selects `.balance`.
- [x] A safety net, over the air (`5a231260`, OTA `816ade85`; seen arriving from the owner's iPhone, update `01a13633`): a root error boundary (a calm "Something broke · Reload" screen, never a hard
      crash) and a global JS handler; each error kept on the device and sent on the next launch through the existing
      `POST /v1/events` (`props`: message, stack, screen, runtime, update id, build), with an unclean-exit flag for native
      crashes. A read route for ops.
- [x] The device loop (paired 13 Oct 18:47 UTC+1; iOS 27.2, Developer Mode on, wired — `devicectl` installs, launches,
      crash logs; the phone had no Senryo crash file and no updater error in 24 h): the owner's iPhone paired with this Mac (`xcrun devicectl`) — crash reports, installs of Release
      builds, live logs.

## D1 · History is everything you did
- [x] One history on Calls (`88dfc0ec`) (both apps): calls, rides, settled parlays, event calls, duel matches, Lucky draws (as
      Lucky, not a bare call), newest first; the outcome filter keeps working; each row names its kind and opens its
      receipt or detail. Sources exist (`useEventCalls`, `useParlays`, `useDuels`, `useLuckyDraws`); the merge is one
      shared model in `@senryo/calls` with a renderer per app. Open event calls and duels under way show with what's
      open the moment they're placed (`04e1eb21` — the owner's "once I place an event, it doesn't show").

## D2 · Your event calls first
- [x] Events (both apps): your open calls above the board, then the board; settled calls under "Settled"; a card
      shows the call you already hold on it ("You hold Yes · $10.00", `381d50de`).

## D3 · Every tap answers at once
- [x] A position row's Close runs the terminal's own path (one shared close run): press cue, "Closing…" toast that
      becomes the result, an in-flight guard, the row held as Closing until the stream settles it.
- [x] (parlay, event call, duel join / rematch / leave / pick done, `d910a6fa`) The same rule for every money action the sweep found late or unguarded: duel join / rematch / leave / pick,
      event call, parlay place, one-tap on/off, exit set, call trail, Earn take back, web test dollars.

## D4 · Everything refreshes, every failure offers Try again
- [x] (phone: all 14 screens; web: Parlay and Warm-up Try again, `05aed918`; the other seven, `bfe1ebe0` — `LoadFailed`) Phone: pull-to-refresh on Home and the 13 screens without it (receipts, Earn, Wallet, Parlay, Duel, Events,
      event detail, games, search). Web: Try again on the 10 screens that only say they failed or spin forever.

## D5 · Replay sound, every time
- [x] Playback ignores the silent switch while a replay plays (`playsInSilentMode` on Play, restored after), keeps the
      session active, waits for the sound to load and seek before playing; Play says "Sound once ready" until the file
      exists and no longer cancels the encode; the mute follows the toggle.

## D6 · Edit profile, and no silent failures
- [x] (says a save wasn't confirmed, records why — `d910a6fa`) Edit profile never does nothing: unlock in place, say why a save didn't happen, keep the session.
- [x] Profile → Unlock answered no taps (`8b11c35d`): four route sheets (session, account-required, receive, terms)
      drew their panel under their own native modal. They render in place; the gate's `route-sheets-in-place` keeps it
      so, and forbids a bare `router.back()` — a cold-opened sheet left a blank stack on close (`2fac3e21`,
      `leaveSheetRoute`).
- [ ] (the terminal's guard, cash-out, ride close, trail, parlay / event / duel done) The ~12 silent failures from the sweep say what happened (parlay / event / duel early returns and unhandled
      signing errors, the terminal's not-ready guard, sign-out, delete data, unlock, paste, arcade seed, Lucky link).

## D7 · Fixes reach the phone
- [x] The owner's iPhone sat on D0 for hours (EAS insights: later groups 0 launches): expo-updates checks only at launch
      and applies at the next. `UpdateHost` (`2fac3e21`, OTA `46c07976`) checks on every return, offers Restart once a
      version is in, applies on its own after 30 min away. Local builds carry `expo-channel-name` (app config) — the
      stale local `ios/` (runtime 0.4.0, no channel) was refused on every check; re-prebuild before any local build
      ships to the owner.

## Open (13 Oct, 20:40)
- D3: done — one-tap on/off, exit set (call and ride), call trail, Earn take back, web test dollars answer at the tap
  (busy before the signing import, one at a time, a press cue; take back says it was taken back).
- D4 web: done (`bfe1ebe0`) — events, event page, arcade board, both proof pages, Home's balance, the duel ladder and
  the ride receipt; StatsCard stays hidden on a failure (the history below it says so).
- D6: sign-out, delete data, paste, arcade seed now say what happened (both apps where both have it); unlock was the
  route-sheet freeze. Open: Lucky's link (not found on the phone), the web's "unavailable" grant wording.
- Web: React #418 (HTML mismatch) — intermittent on production Events; not the stored network (fresh tabs clean with
  either), not in dev. Likely a Suspense subtree hydrating after the query cache filled. React recovers; low impact.
- Verify on the owner's iPhone (paired; devicectl can't launch while it's locked — over Wi-Fi it times out): Unlock,
  history with events / parlays / duels and the open ones, Close, replay sound. Needs the owner's two restarts once to
  get `UpdateHost`; after that a toast offers Restart.
- Arcade runs (Line Rider, Candle Hop) aren't in the money history (no stake); if the owner means those by "games",
  a "your runs" list belongs on the arcade screen.

## Then
P3 → P5 (stage P), then Q2, Q4–Q6, R8.

## Handoff
(written at the end of the stage)
