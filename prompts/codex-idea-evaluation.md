# Task: Independent evaluation of two product directions for Monad Metropolis

I'm entering Monad's **Metropolis** hackathon and have narrowed it to **two product directions**. I want **your own independent research and opinion**, not a summary of my notes. Research what you need on the web, and challenge anything in my notes that looks wrong.

## Read first (my existing research)
All in `/Users/abu/dev/hackathon/metropolis/context/`:
- `README.md`: index
- `00-hackathon/overview.md`: official rules (captured from the logged-in portal). **One project per participant, one track per project.**
- `01-tracks/onchain-finance.md` (Track 01) and `01-tracks/consumer-payments.md` (Track 02): official track text, judging criteria, ideas
- `06-research/SHORTLIST.md`: shortlist with evidence
- `06-research/deep-dive-stablecoin-cards.md`: Direction A research
- `06-research/deep-dive-rwa-perps.md`: Direction B research
- `02-monad/`: Monad chain facts (≈300 ms blocks, ≈600 ms finality, gas charged on the gas limit, 10 MON reserve balance, P256 passkey precompile, Mera passkey accounts)

## The two directions
**A. Borrow-to-spend card (Track 02).** Modelled on ether.fi Cash. The user deposits crypto (MON, sUSDe, earnAUSD…) as collateral. When they pay with the card, the system borrows stablecoin against that collateral and pays, so they never sell their crypto. The claimed Monad-specific angle: a card authorisation must be answered within ~1.6 s (Reap's docs), and Monad finalises in ~600 ms, so the loan can be **executed and finalised onchain inside the authorisation window**. Rain (a Visa principal member) has issued cards on Monad since May 2026 and runs KYC. Rain cards support Apple Pay and Google Pay.

**B. Open listing layer for stock / gold / FX perpetuals (Track 01).** Modelled on Hyperliquid's HIP-3 (teams post a bond to launch markets; trade[XYZ] is the proven example). Monad has no permissionless market-listing layer; Perpl lists only crypto. Chainlink publishes gold/silver/FX and some tokenized-stock feeds on Monad. The claimed Monad angle: per-block marking and funding at ~300 ms, cheap, with contract-enforced market-hours, weekend and price-gap rules (Ostium's $23.75M oracle-key loss and trade[XYZ]'s ~$60M SK hynix refund were oracle and operations failures).

**C. (My own question)** Both in **one mobile app**: one account and one collateral balance that you can **spend with a card** and **use to trade stocks/gold**. Is this coherent? How should it be framed, given one project can only enter one track (Track 02 excludes products whose core value is trading)?

## My constraints and preferences (follow these strictly)
- **Mobile app** (iOS + Android), **Face ID / passkey sign-in** (Monad's Mera library or similar), no seed phrases.
- **Do NOT reject or down-rank anything because of time, deadline, build size, or "hard to demo".** I will do what it takes. If something is hard, research the route others used and tell me the concrete steps.
- **Competition is NOT a factor.** Other teams building similar things don't matter. Use them only as references for what works.
- **Don't block yourself.** For every obstacle (KYC, issuer, Apple Pay entitlement, oracles, liquidity, regulation), find how existing companies got past it and give me the route and first steps. Call something a risk only if no route exists anywhere, and explain why.
- **No invented facts.** Every number needs a source and date; mark anything unconfirmed as (unverified).

## Questions to answer
1. **For A:** exactly how card authorisation works end to end (issuer → our webhook → onchain borrow → approve), and whether the "finalise inside the auth window" claim holds up (check Rain's and Reap's actual authorisation docs and timing). How do ether.fi Cash, Gnosis Pay and Exa actually authorise: onchain first, or approve then settle later? How do we get the card into **Apple Pay / Google Pay** from our own app (push provisioning, Apple's in-app provisioning entitlement, what Rain provides)? Liquidation design for card debt. How a real team gets onboarded with Rain (startup programme, sandbox).
2. **For B:** the full component list (market factory + bond/slashing, oracle adapter with market-hours/weekend/gap rules, margin engine, funding, liquidations, insurance fund), which open-source perp engines are usable references (licences), and **how the successful venues got liquidity** (market makers, incentives, own desk). Would a mobile trading app on top be the better entry point?
3. **For C:** is a combined app a real, proven product shape (e.g. Revolut, Robinhood, Kraken, Bybit card + trading)? If yes, propose which part is the **core** for judging and which is a feature, and which track that means. If no, say why.
4. **Your recommendation:** A, B, or C, and why, scored against the official track-page judging criteria (Technical Execution 20%, Design & Craft 20%, Originality 15%, Founder & Market Readiness 25%, Traction 20%) and the rules' rubric (which includes Monad Integration 20%).
5. For your recommended option: a **mobile tech stack** proposal (e.g. Expo/React Native, passkeys via Mera, viem, indexer), the **smart contracts** needed, and the **order to build things in**.

## Output
Write `/Users/abu/dev/hackathon/metropolis/context/07-decision/codex-evaluation.md` with: short answers to Q1–Q5 first, then details, then sources. Don't edit any other files. When done, reply with your recommendation and the 5 most important facts behind it.
