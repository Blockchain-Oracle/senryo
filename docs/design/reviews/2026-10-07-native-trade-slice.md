# Native trading slice — 7 October 2026

Baseline: `344f009`, `codex/senryo-unified`. Implements the already-approved UGLYCASH plan §5 trading adaptation and native development amendment. Existing prediction/card/website work remains preserved.

## Locked target

Native pairs and held positions use U01-S01 and U16-S04: compact instrument identity, price/line chart with dotted grid and periods, a white position facts card, contextual sharing and the actual transaction actions. Senryo retains its real margin/leverage/SL/TP/close and operation lifecycle. Tradash contributes the moving price head and entry reference, without synthetic history or one-tap authorization. UGLYCASH remains the visual authority.

| Decision | Evidence | Adaptation |
|---|---|---|
| Default line chart with current head; candles remain selectable | U01-S01, U16-S04; approved Tradash study | Real indexed candle closes plus a timestamped oracle observation; gaps remain gaps; raw values drive trade math |
| Dotted grid, semantic direction, entry reference | U01-S01 and approved Tradash study | Position color follows net PnL, including booked funding, rather than side or tick direction; reduced motion stops head interpolation |
| Compact white position summary before the chart | U01-S01, U16-S04 and the user's 7 Oct ZEC capture | Preserve net unrealised P&L, size, entry, mark, liquidation and funding; keep them visible without making the user scroll through a mostly flat chart |
| Pill transaction controls, black/magenta action roles | U01-S02–04; approved palette | Keep explicit Long/Short labels and reviewed slide; direction facts retain green/red |
| Development chart history comes from the local fork | Latest user dev-mode request; existing isolation contract | Collect only successful local oracle rounds, aggregate actual OHLC, clear on reset; no public history attached to controlled prices |
| Freshness advances while the page is idle | Approved pricing amendment | Show source age and update mode without labelling polling or local observations an external live stream |

## Research that changed the implementation

- Opened the supplied [Tradash ZEC screen](https://www.tradash.xyz/trade/ZEC). Observed the moving green price head, dotted chart workspace, sizing/leverage controls and UP/DOWN actions without connecting a wallet. Used behavior as an interaction reference; UGLYCASH remains the color/layout authority. No third-party code or sound assets were copied.
- Read the sibling `canton-season3/context/13-revamp/tradash` study and the original `owarine/web/src/features/terminal` chart/feedback implementation. Useful separation: raw mark events, display interpolation, monetary PnL and position-aware feedback. Senryo currently eases its native head and streams raw observations; the sibling’s complete reaction/odometer engine is still an open adaptation.
- Official [Perpl market-data protocol](https://github.com/PerplFoundation/api-docs/blob/main/websocket.md): public `market-state@143` / `@10143`, scaled integer marks and source timestamps. One shared connection, foreground lifecycle, bounded samples, validation and reconnect backoff; no account API key and no client ping loop.
- The earlier “testnet faucet empty / Mainnet only” assumption is obsolete. Read-only probes on 7 October found the Agora test-AUSD faucet funded, `requestFunds` callable, Exchange unhalted, 100 AUSD account-open minimum and eight unpaused markets. Verified testnet ids/scales: BTC16, ETH32, SOL48, MON64, ZEC256, LIT272, PUMP320, NEAR336.
- Public stream check: three progressing ZEC packets on each network, latest source ages 887ms Mainnet and 1299ms testnet in the recorded run. This verifies actual packets, not a promise of latency under every network condition.
- Pair oracle transport was labelled “Streaming” despite heartbeat/deviation source cadence. Added source-age labels and active-position relay of every new valid source round; invalid/stale upstream values are refused and relay cursors advance only on finality. Keeper changes are saved, **not deployed**.

## Implementation

Native Perpl Practice follows the selected deployment through ids/scales, reads/cache keys, plans, account policy, quotes, receipts, explorer links and P$ collateral labels. Unsupported testnet symbols stay out of that network’s list. Existing direct-wallet execution, reviewed slide, time-window validation, geo restrictions and recovery remain in place. Agora AUSD stays separate from Senryo MockAUSD.

The native test-AUSD sheet invokes the real faucet using passkey step-up and the operation journal. A local fork gas estimate was 129,671, above MockStable’s 120k budget; this request now has its own explicit 180k cap. No public faucet transaction was sent by the agent.

Native market/position charts show actual observations, entry and source age; live PnL uses integer lots/scales and preserves booked funding. The close still re-reads executable terms and its receipt owns the realized result. Engine and crypto position facts use the reference’s white card. Hidden navigation is explicitly invisible while transactional screens are focused.

Local development now supplies real confirmed engine OHLC and actual fork Perpl marks, ± gold/ZEC controls, test collateral and isolated reset. It never attaches public historical prices to controlled local marks. Only the verified loopback Anvil receives owner impersonation, local oracle-ignore/max-age settings and weekly-calendar storage overrides. The calendar slot is verified with `forge inspect MarketCalendar storage-layout`: `_week` slot1. Public holidays and public contracts are not changed. Development reads allow cold fork storage fetches; public read timeouts retain their existing defaults. Background refreshes are coalesced.

## Acceptance and limits

The user's later ZEC capture showed the earlier position presentation failing at phone width: the mark label ran off the right edge, the facts escaped their white card, and a tall sparse chart pushed the useful controls down. Commits `9ebefc7` and `c32a19d` constrain the position to the viewport, use a two-column fact grid, put P&L first, shorten the live position chart, make the entry/mark labels fit its plot, and use the supplied magenta action role for Perpl slides. The ticket now separates liquidation price from distance. The username step uses U14-S13–14's large recessed field, condensed Senryo wordmark and black claim action, with magenta onboarding progress; actual availability checks and network-specific trade visibility remain. These changes passed mobile typecheck, focused Biome and iOS export. The ticket spacing was observed in the simulator, but the final magenta action, populated position and username screens still need phone-size visual QA after the Mac is unlocked.

- Contract lifecycle: local engine gold long/short finalized, price control changed the oracle, positions closed. Perpl ZEC long/short actually filled, controlled favorable marks improved each side’s PnL, display estimate agreed within two micro-AUSD, and actual closes left no positions.
- Mobile, drive and keeper typechecks; focused Biome; repository invariants; actual development/release boundary check; iOS and Android Hermes exports are the required gates for this slice. All passed; the complete lifecycle output is preserved in [validation](2026-10-07-native-trade-validation.md).
- Native observation: eight testnet crypto markets with real leverage caps; ZEC Practice ticket, P$ buying power, margin/leverage, liquidation estimate and reviewed slide. A native ZEC position was also visible in a simulator capture. That capture exposed integer-truncated leverage, a sub-cent loss shown as negative zero and insufficient card padding; all were corrected in source. Final populated-position visual recheck remains open because the CUA capture/control service returned intermittent ScreenCaptureKit failures. CLI lifecycle completion is separate evidence.
- Still open: physical-device auth/audio/haptics/performance and interrupted/reconnected network acceptance; complete Tradash-style reaction/rolling-price behavior; crypto TP/SL (UI still says pending); native BTC/ETH prediction execution; full UGLYCASH onboarding/money/profile/clubs/card parity. Source-level keeper improvements need deployment and post-deployment feed-health evidence. No public trade, production deployment, push or mainnet funds were performed in this slice.
