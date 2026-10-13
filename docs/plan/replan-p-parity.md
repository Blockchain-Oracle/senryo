# Stage P — Feature parity, phone ↔ web (13 Oct 2026)

The owner: "the features have to be consistent… what's in the mobile that's not in the web, and vice versa". The look
stays as it is until after submission; this stage is behaviour only. Source: a two-way audit of every route, feature
folder and one-sided shared export (five areas, read-only, 13 Oct). Each item names the side that lacks it and the
shared module that closes it. Order is demo impact: the trade loop, receipts and positions, the wallet, then the rest.

## P1 · Trade loop (terminal)
- [ ] Phone: the terms gate before the first trade. `useTermsGate` exists with no caller; pass it to `useCallFlow`'s
      effects as the web does (`useTerminalEffects.ts:33-42`).
- [ ] Phone: the shortfall button. "Short by $x" opens Add money with the amount, as on the web.
- [ ] Phone: a tap on an unpriced side says "Not priced right now" (the web does; the phone ignores it silently).
- [ ] Web: "Rides are Practice-only…" with Switch to Practice, from a shared "not deployed" state in `use-ride-flow`.
- [ ] Web: the coached first call. The terminal takes the coach banner and the filled callback like the phone.
- [ ] Phone: a music track chip (`TERMINAL_SONGS`); the saved track is read but never written. Music on also turns
      sound on.
- [ ] Both: one rule for when Close is offered (`clock.live` on both); a market link to an unknown symbol stays on the
      last market on both.
- [ ] Phone: the "Live position reactions" switch is either wired into `useReactions` or deleted.

## P2 · Receipts, positions, Calls
- [ ] Phone: proof screens (the feed and the window page), using the web's helpers (`windowRow`, `bandVerdicts`,
      `useWindows`, `reverifyPrint`) instead of opening the browser.
- [ ] Deep links: add `/ride` to the iOS association file; route `/proof*` in `deep-link.ts`.
- [ ] Phone: Calls "didn't load" state; "Show older" disabled while loading; Close all can't be dismissed mid-batch.
- [ ] Web: a pull-to-refresh equivalent (Try again) and live positions kept on screen while history loads.
- [ ] Web: screen-reader actions on a position row (a visible ⋯ that opens the menu).
- [ ] Phone: the countdown ring respects Reduce Motion.

## P3 · Wallet, Home, search
- [ ] Web: test-dollar claim outcomes (already / next top-up / unavailable) as on the phone.
- [ ] Web: Receive with Share and Explorer.
- [ ] Web: Home shows a Practice guest's balance with "Make a passkey to keep it".
- [ ] Web: profile editing (name, bio, visibility) with `useMyProfile` / `useSaveProfile`.
- [ ] Phone: a Practice guest's inbox (`useGuestKey` + guest session).
- [ ] Phone: hide-balances also masks the Wallet balance.
- [ ] Web: Earn "All" keeps the exact amount (today it rounds to the cent and can leave dust or overshoot).
- [ ] Phone: markets "Pull to try again" actually refreshes.

## P4 · Account and settings
- [ ] Web: session settings (length, idle lock, passkey per trade) via `applySettings`.
- [ ] Web: sign-in safety checks (empty / different / same account) moved into `@senryo/account`; sign-out confirm.
- [ ] Web: Delete my data; Help credits (Pyth, Envio, DB-IP, logo owners) from `@senryo/config`.
- [ ] Phone: recovery with a backup passkey or recovery file at sign-in (`packages/account/src/recovery.ts`).
- [ ] Web: theme "System"; an offline banner; a not-found page that goes Home.

## P5 · Games, events, duel, parlay
- [ ] Web: self-playing arcade cards (`createAttract` + `SILENT`) instead of the static scene.
- [ ] Phone: Lucky's fairness panel and the "Placed" link to Calls.
- [ ] Phone: event committee sources open their pages; the event fee is the question's own `feeBps`.
- [ ] Web: parlay "any amount" checks the balance like the phone's stake sheet; the socket doesn't double-open the slip.

## Out of scope here
- Web push notifications (a service worker and Web Push behind `/v1/push/token`): its own stage.
- Mainnet mode switching (balances, slide-to-confirm, lock): matters once Real money is live.
- The web's visual likeness to the phone: after submission (the owner).
