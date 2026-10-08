# UGLYCASH continuation — 8 October 2026

The user resumed the approved whole-product plan after clarifying that TestFlight `0.3.0 (8)` was a partial milestone. This record separates implementation, native observation, services, deployment and device acceptance. Baseline: `aae7d930ac1d2fcc5fdf9cf96e3bf9ed750b973f`, `codex/senryo-unified`. Pre-existing dirty prediction, CardIssued, website and documentation work is preserved. No release upload, source push, public-chain transaction or deployment is evidenced by this continuation.

## First-run source and local observations

Source commit `90b6dc0` implements the next first-run pass: full sky welcome with owned foregrounds, condensed/recessed/keyboard-anchored forms, serialized native auth ceremonies, owner-scoped asynchronous callbacks, optional voucher recovery, notification retry/explicit Continue and biometric capability refresh after Settings. Independent review found a compact-screen accessibility issue in the shared setup layout. Fix `f50624b` moves uncapped title/body into the field scroll viewport while retaining the keyboard-anchored footer; scoped re-review found the issue resolved. Physical acceptance remains open.

The U14-S01–S19 references remain authoritative. The original generated sky has provenance beside its bundled image; no competitor screenshots or art became app assets. Six existing Senryo scenes retain actual product promises. Caption contrast uses localized full-width shading; low clouds remain visible. The native screenshot comparison caught and corrected an intrinsic image sizing problem, an inset shade band and a development badge overlapping the account action.

Observed through the running local development client on the existing iOS 26.5 simulator, 402×874 points:

| Journey | Observed | Limit |
|---|---|---|
| Username | Too-short name disables Claim and shows local reason; mixed case normalizes; available fixture name claims; CTA remains above actual software keyboard | Local service fixture, not production handle ownership |
| Follow setup | Initial unavailable state exposed missing Retry; source now separates failed/empty and adds actual refetch | Real recommendation service not accepted by this fixture |
| Practice money | Existing local funding is labelled; Continue works; no public starter relay claim | Controlled local fork; no production funding claim |
| Optional voucher | Recessed field and anchored action; unavailable local relay retains typed value; no-code/back returns to money | No production voucher submitted or settled |
| Return | Continue returns to actual Home with fixture account identity | Terms/Face ID/push are not accepted or verified by this replay |
| Welcome | Full sky, real owned passkey/money foregrounds, cumulative progress and account actions render; clouds and soft full-width caption treatment observed | Genuine native auth, small phone, Android and maximum Dynamic Type remain open |

Mobile typecheck, focused Biome, setup migration, auth foreground and targeted native-ceremony serialization checks passed on the first-run implementation. Repository invariants passed with zero errors/warnings during the continuation; final combined-source checks remain required after subsequent changes. Simulator interaction was left on the user's current Card route when the user took control.

## Money source and isolated Practice

Source `15873ba` implements U11 Send/U15 Receive, complete prepared operations, source-scoped reviews, saved deposit reopening and durable provider-attempt evidence. Independent review found bridge approval coupled to an idle runner and confirmation unlocked before asynchronous fees completed. Fix `36e8dac` separates runner leases, requires exact successful fee facts, and enforces per-step reviewed network-fee ceilings before signature. Scoped independent re-review found no remaining important findings.

Mobile/query/chain/drive typechecks, focused lint, lifecycle/source/review/foundation/deposit checks passed. Ten actual finalized transactions on host-local Anvil used isolated throwaway accounts for faucet/deposit, Send/free-trading pull, Withdraw and AUSD/USDC round-trip swaps; the active simulator fixture was not reset. This is local contract execution, not native UI, public-chain execution or Apple Pay delivery. Physical QR/layout/accessibility, native prompt/cancel and actual provider payment/delivery remain open.

A separate isolated PostgreSQL16.14 baseline passed all 167 existing social API checks with real SQL transactions/injected HTTP and an in-memory indexer. It establishes existing behavior before later social changes, not completion of new clubs/thesis/privacy contracts.

## Trading source and isolated Practice

Source `d8b2cdc` adds source-time ordering, distinct Live/History, background/reconnect state, durable confirmed-fill feedback, optional bounded fresh-position reactions and full composed fee preparation before approval. Per-step reviewed fee ceilings reach actual static and dynamic requests. Perpl conditional source is typed against pinned official protocol; broader forwarding/key authority is not silently enabled. Independent review found terminal protection recovery could regress from a delayed authenticated snapshot. Fix `45a2d65` preserves terminal and exposure-changing states through reconciliation and journal writes; scoped independent re-review found all findings addressed with no new important breakage.

Mobile/query/drive types, focused lint and live/recovery/fee checks passed. A separate disposable Anvil fork executed open, new-before-retire SL replacement, TP cancellation, partial reduction, full close, reopen and actual keeper stop execution using throwaway accounts. That fork was stopped. These checks did not reset the user's active account or establish native phone/public-provider acceptance. Physical audio, keyboard, accessibility and measured frame-rate checks remain open. Authenticated Perpl conditional enrollment/signing, explicit authority UX, provider expiry/revocation and real trigger/race/restart acceptance remain concrete required gates.

## Remaining full scope

Money/receive/send/swap/withdraw/provider receipts, live trading and feedback/protection, genuine native BTC/ETH execution, profile/thesis/sharing, real clubs/programmes, Card/Pool/settings and retained features, companion/distribution, accessibility and full physical-device acceptance remain required. The first-run source milestone does not close those rows or claim fresh TestFlight installation.

The [native prediction feasibility record](2026-10-08-native-prediction-feasibility.md) identifies current signed-oracle access, boundary-proof simulation and dedicated liquidity as concrete gates for the candidate original Monad binary-share AMM. [Access setup](../../development/prediction-oracle-access.md) keeps provider credentials on the server. No view-only prediction screen is represented as executable.

The [binary-testnet proposal](../prediction-binary-testnet-v1.md) and [platform surfaces architecture](../platform-surfaces-2026-10-08.md) record reviewable local designs. Neither document is a deployment, implemented widget, provisioned extension or accepted production economics. The [programmes/content architecture](../programme-content-2026-10-08.md) records required persistent programme, news, first-party chat and X-linking owners separately from their actual policy, funding and provider activation gates.
