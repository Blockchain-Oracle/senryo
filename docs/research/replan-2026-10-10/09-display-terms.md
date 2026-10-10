# 09 · The display line: exchange market-data terms and measured rates (10 Oct 2026)

R1.16 asked for "read Coinbase's and Kraken's market-data terms first and record them". The display line (D-302) would
use five venues: Coinbase Exchange (socket + REST), Bitstamp, Bitfinex, Kraken and Gemini (REST median, Owarine's
`crypto-rest.ts`). All five were read. This is a reading of their published terms, not legal advice.

## Gaps first
- Coinbase's `legal/market_data` page failed to load through a plain fetch; it was read through a rendering scraper.
- Gemini's market-data fee schedule now redirects to its general fees page; a search snippet saying redistribution is
  free is **unverified**.
- Bitstamp's Data License Agreement text isn't public; what it allows beyond the API docs' summary is **unverified**.
- No standalone Kraken market-data terms were found; that none exist is **unverified**.
- Kraken's API was unreachable from the build machine (an iPhone hotspot that drops Cloudflare ranges), so its pair
  list for the other 14 symbols wasn't read; it keeps Owarine's three verified pairs.

## Verdict
Under the free terms, **no venue allows a commercial app to show its market data to end users, raw or derived.** Each
needs a signed agreement or written consent. A basis-adjusted or cross-venue median line is treated as derived data,
not as something new.

| Venue | Terms (official) | Showing it to app users | Derived values | Licence route |
|---|---|---|---|---|
| Coinbase Exchange / Advanced | coinbase.com/legal/market_data (7 Aug 2026), bound by the Exchange API docs | Prohibited without written consent: no end-user apps, no redistribution or display | Covered: derived works, combinations and "fair value prices" are restricted | marketdata@coinbase.com, or an authorised redistributor |
| Kraken | kraken.com/legal/global-terms (6 Oct 2026) §8–9 | Own benefit only; no making it available to third parties | No carve-out | marketdata@kraken.com |
| Bitstamp | bitstamp.net/api ("Commercial use"), site terms 30 May 2025 | Allowed **under a signed Data License Agreement**; otherwise personal and non-commercial only | Allowed under the DLA (calculations, new works) | partners@bitstamp.net |
| Bitfinex | bitfinex.com/legal/general/market-data (6 Jul 2022), api-terms (7 Jan 2025) | Personal or internal only; no redistribution without consent | No carve-out; no benchmarks or indices; not to price contracts | written consent |
| Gemini | gemini.com/legal/market-data-agreement, api-agreement (12 Oct 2025) | Personal, internal or informational; commercial use under a Redistribution Agreement | No carve-out; no benchmarks; not to price contracts | bizdev@gemini.com (attribution "Data provided by Gemini" + link) |

Rate limits read on the way: Coinbase public REST 10/s per IP, socket 8 messages/s per IP, subscribe within 5 s;
Bitfinex `/v2/tickers` 30/min per IP (a breach blocks the IP 60 s); Gemini public 120/min (1/s advised); Kraken about
1/s; Bitstamp 400/s with 10,000 per 10 min.

## Measured (10 Oct, Saturday, the real Coinbase socket through the real gateway)
- **Trade-driven rates are low at weekends.** Coinbase's `ticker` channel (one message per match) gave BTC 0.1–1.1 Hz,
  ETH 0.2–0.3, SOL 0.1–0.3, XRP 0.3–0.5, DOGE ~0 across three runs. The R1 gate's "≥ 6 Hz" display line cannot come
  from trades alone; it needs order-book mid-price updates or a faster settlement-grade feed.
- **The basis works.** After three samples the shifted line sat within 0.1 bps of Pyth (BTC $82,733.28 vs $82,733.32);
  Coinbase BTC ran $0.86–4.33 under Pyth, Bitfinex ~$100 over.
- **Packages appear 4.2–6.5 s after RedStone's grid point** (separate finding, R1.9).

## What was built (R1.16) and its state
`services/api/src/prices/display/` (`venues.ts`, `display-feed.ts`, `basis.ts`, `display-line.ts`): Coinbase socket with
the `heartbeat` channel as its liveness check (reopened after 5 s silent), a per-market REST median (dead socket, or 30 s
without a trade) with two-look hysteresis, the basis, `dp` frames only to apps that ask for batches, and the `fallback`
feed state. **Off by default (`DISPLAY_FEED=off`)** until a licence exists. Nothing reaches users.

## Choices for the owner
1. **Keep the line on Pyth** (what ships today): no new licence beyond the open Pyth display-rights question
   (04-pricing §9.2); the line eases between 1 Hz prints; R1's "≥ 6 Hz" gate is dropped.
2. **Pyth Pro for crypto** ($2,500/month; 200 ms or 50 ms channels; display rights listed under Pro): the line moves
   ~5 Hz from settlement-grade prices, and the Pyth licensing question closes at the same time.
3. **License exchange data**: Bitstamp's DLA (the only venue offering commercial derived use publicly) and Gemini's
   Redistribution Agreement; the line would need order-book mid-prices to reach several Hz.
