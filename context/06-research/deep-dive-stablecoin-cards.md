# Deep dive: stablecoin cards and crypto neobanks, and what one on Monad would take

Research date: **2026-09-29**. Evidence rules: [README.md](README.md). This file expands candidates 1 (ether.fi Cash), 3 (Plasma One) and 10 (Exa) in [evm-l2s-and-payment-chains.md](evm-l2s-and-payment-chains.md) and trend #5 in [trend-radar.md](trend-radar.md). Track context: [../01-tracks/consumer-payments.md](../01-tracks/consumer-payments.md).

**Framing.** Time and effort are not treated as constraints. For every obstacle, the question is **how existing companies got past it and which of those routes a new team can use**. "Risk" is used only where no known route exists.

**Method.** Paymentscan (onchain card analytics) program, issuer and chain pages. DefiLlama fees, protocol and stablecoin APIs. Issuer docs read directly: Bridge, Reap, Baanx and Gnosis Pay (via their `llms.txt` / `.md` pages), plus Rain's public resource pages. GitHub source for ether.fi `cash-v3`, Exa and Gnosis Pay `account-kit`. Monad blog posts. Company press releases, Reuters, a16z and insights4vc. Everything was pulled on 2026-09-29 unless another date is given. Paymentscan's current month is partial (to 29 Sep).

---

## Verdict (read this first)

**The market is real, and it is the most revenue-proven consumer category in crypto.**
- Card spend was **$1.116B in Aug 2026, up from $380.1M in Aug 2025** (2.9×) (Paymentscan).
- KAST reports **1M+ users** and targets a **$100M revenue run rate in 2026** (PR Newswire, 2026-03-09).
- ether.fi Cash booked **$11.7M of revenue in the last 12 months** (DefiLlama).

**Monad already has the infrastructure. The generic product is also already taken there.**
- **Rain** (a Visa principal member) has supported Monad since **12 May 2026**, and **Avici** and **Rhythmic** are building card programs on it.
- **MetaMask Card** has spent USDC on Monad since **12 Mar 2026**.
- **MetaMask Money Account** (live 30 Jun 2026, Monad-exclusive) already ships the flagship Monad mechanic: *"spending pulls directly from the underlying balance, so users earn yield until the moment of purchase."*
- So a "neobank + card + yield" on Monad is a me-too product. It would also run straight into the Track 02 judging line *"a wallet/payments app with new branding."*

**Worth it only with a sharp wedge.** The whitespace we can evidence is:
1. **Borrow-to-spend against Monad-native collateral inside the authorisation window.** ether.fi proves the demand: its users spend the most per head of any program (~$2,450 per active address per month). Monad's own blog describes this exact flow as something issuers "can't previously [build] on any chain with multi-second finality". Nobody on Monad ships it.
2. **A corridor- or segment-specific dollar account where the card is one of several rails.** Examples: Argentina/Brazil freelancers with Pix/SPEI, or the Indian diaspora.
3. **Programmable or scoped cards:** earned-wage/streaming spend, family allowances, agent cards.

**What it would actually take (real product).** An incorporated entity, a signed issuer programme (Rain/Reap/Bridge, typically **~6–8 weeks**), a KYC flow the issuer hosts, audited smart accounts and spend modules, a funding/settlement design, fraud and dispute operations, and a rewards budget. Full detail is in §7.

**For the hackathon:** build the Monad-only onchain half (authorisation → collateral/borrow → settle in <1 s) against a sandbox or a simulated issuer webhook that copies Reap's or Rain's real authorisation contract. Show the path to a real BIN via Rain-on-Monad.

---

## 1. Market

### 1.1 Size and growth

**All tracked programs, monthly spend** (Paymentscan, "spends only, includes offchain data", 27 of 29 tracked programs; https://paymentscan.xyz, 2026-09-29):

| Month | Spend | Transactions | Active addresses |
|---|---|---|---|
| Sep 2024 | $90.2M | 2.24M | 4,059 |
| Mar 2025 | $176.4M | 3.23M | 25,740 |
| Sep 2025 | $403.1M | 5.69M | 98,021 |
| Mar 2026 | $735.3M | 8.97M | 259,210 |
| Jul 2026 | $1.038B | 10.56M | 261,615 |
| **Aug 2026** | **$1.116B** | 11.08M | 287,634 |
| Sep 2026 (to 29th) | $1.092B | 10.25M | 279,243 |

All-time: **$12.33B** across 162.6M transactions.
- a16z crypto's earlier cut of the same data: **$759M in Jul 2026, ~2.5× YoY, ~9M purchases, $86 average ticket**. USDC carries 58% of card spend and USDT 26%. Optimism carries 29% of settlement, Solana 19%, Base 19% (https://a16zcrypto.com/posts/article/charts-payment-card-stablecoin-spend/, 2026-08-07). The gap with Paymentscan's $1.038B for July comes from programs Paymentscan added later and from RedotPay's self-reported offchain spend.
- Visa: **$20B annual run rate of stablecoin settlement, up 15× YoY, 160+ stablecoin card programs** (Reap/Visa release, 2026-09-23: https://reap.global/newsroom/reap-visa-launch-100-markets-stablecoin-card-program).
- Visa carries **>90%** of onchain crypto-card volume (insights4vc, 2026-01-22: https://insights4vc.substack.com/p/the-state-of-stablecoin-cards).
- Forecast: RedotPay projects **$50B a year of stablecoin card spend by 2028** (Reuters, 2026-08-25). This is a company projection (unverified).
- Stablecoin supply is flat at ~$307–318B all year ([trend-radar.md](trend-radar.md)). The growth is in *use per dollar*, not new dollars.

### 1.2 The programs (Sep 2026)

All figures from Paymentscan program pages, 2026-09-29.

| Program | Sep 2026 spend | Active addr. | Spend / addr. | 90-day trend | Custody | Borrow-to-spend | Network / issuer |
|---|---|---|---|---|---|---|---|
| RedotPay | $360–373M (self-reported) | n/a | n/a | +17% | custodial | no | Visa |
| **ether.fi Cash** | $115.3M | 47,146 | **~$2,446** | +45% | self-custodial Safe | **yes** | Visa via Rain + Reap (see §2.3) |
| KAST | $103–107M | (batched) | n/a | +38% | custodial | no | Visa via Rain |
| Karta | $46.0M | (batched) | n/a | +48% | custodial (unverified) | no | Visa via Rain |
| Wirex One | $41.7M | n/a | n/a | n/a | custodial | no | Visa (Wirex is its own issuer) |
| **Plasma One** | $22.6M | ~20,261 | ~$1,110 | **+353%** | self-custodial app | no | Visa |
| Kolo | $18.0M | n/a | n/a | +75% | n/a | n/a | n/a |
| Tria | $15.2M | n/a | n/a | −15% | self-custodial | n/a | n/a |
| Gnosis Pay | $7.1M | 6,908 | ~$1,028 | **−9%** | self-custodial Safe | no | Visa via Monavate |
| Avici | $3.5M | 2,982 | ~$1,190 | flat | self-custodial | **yes** | Visa (Rain partner) |
| **MetaMask Card** | **$2.37M** | 3,054 | ~$775 | **falling** | self-custodial (delegation) | no | Mastercard |
| Exa | $1.57M | ~1,490 | ~$1,050 | n/a | self-custodial (ERC-6900) | **yes (fixed-rate BNPL)** | Visa |
| UR (issuer) | $1.09M | 21,165 | ~$51 | **falling fast** | Swiss account | no | Mastercard principal |

Spend per address is our own division of Paymentscan's two columns. Karta and KAST address counts reflect batched settlement, not users.

**What the table says:**
- **Spend per user tracks the mechanic.** ether.fi's borrow-to-spend, yield-bearing base does ~2–3× the spend per active address of the other self-custodial cards. Its users are crypto-wealthy and treat the card as a way to *not sell*.
- **Some programs are shrinking.** MetaMask Card peaked at $5.99M (Oct 2025) and was $2.37M in Sep 2026. Gnosis Pay fell from $11.2M (Sep 2025) to $7.1M. UR fell from $8.76M (Jan 2026) to $1.09M. A wallet-attached card with 1% cashback does not compound on its own.
- **Caveat:** Paymentscan tracks **no Monad settlement at all**. Monad isn't in its list of 21 chains, so MetaMask Money Account spend on Monad is invisible here. There is no public, verifiable card-spend number for Monad.

### 1.3 Revenue model: where the money is

| Revenue line | Evidence | Size |
|---|---|---|
| **Interchange** (merchant pays, issuer shares with program) | US debit is capped at $0.21 + 0.05% only for issuers with >$10B assets. Crypto issuers are small, so they earn the uncapped rate. EU caps are 0.2% (debit) and 0.3% (credit) (Paymentscan, 2026-09-08: https://paymentscan.xyz/blog/crypto-card-costs-abroad-explained). Typical interchange is **1–2%**, used to fund cashback or margin (insights4vc). | Main line |
| **Interchange share tiers** | Rain has three pricing tiers. A bigger interchange share comes with higher minimums or longer commitments (Rain, undated: https://www.rain.xyz/resources/launch-a-card-program-with-rain). Gnosis Pay: "earn from transactions & optional fees (e.g. FX)", agreements from 2 years (https://gnosispay.com). | Negotiated |
| **FX / cross-border fees** | Network cost is 1.1–1.4% when the issuer settles in USD. Programs add their own: ether.fi 1%, KAST 0.5–1.75%, Avici 0.4–1%, MetaMask 0.5% (Paymentscan program pages). Bridge lets the program set transaction and FX fees on top of interchange share (https://apidocs.bridge.xyz/platform/cards/additional/fees). | Material for travellers and non-USD users |
| **On/off-ramp spreads** | €5,000 round-trip tests: RedotPay charged an effective **2% ($113.69)** on EUR→USDC. KAST's payout FX was **~1% ($59.29)**. ether.fi via Due was 0.16% per leg. Bridge EUR accounts had **>0.5% per leg** (Paymentscan, 2026-08-04: https://paymentscan.xyz/blog/the-hidden-vendors-behind-stablecoin-neobanks). | Quiet but large |
| **Subscriptions / tiers** | RedotPay Pro $12.90/mo. Plasma One Core $120/yr or lock 20K XPL; Platinum drove $3.2M of XPL locked in 7 days (Paymentscan, 2026-06-24). | Growing |
| **Yield spread on idle balances** | MetaMask Money Account pays "up to 4% APY" via Morpho vaults built by Veda and curated by Steakhouse (Monad blog, 2026-06-30). Plasma One Earn ~4% via Aave. | Depends on rates; under GENIUS issuers can't pay yield, but the app layer can |
| **Credit / borrow-to-spend** | ether.fi `DebtManager`/Aave-gateway credit mode. Exa fixed-rate instalments. Reap stablecoin-collateralised credit cards in 100+ markets (Reap, 2026-09-23). | Highest ARPU |

**Hard revenue data points:**
- **ether.fi Cash:** fees of **$33.0M over the last year** (including cashback), revenue **$11.7M over the last year**, **$1.72M in the last 30 days**. Monthly fees went from $1.86M (Oct 2025) to $4.09M (Aug 2026) (DefiLlama `etherfi-cash-liquid`, 2026-09-29). All-time spend is only $909.6M, so revenue is **at least ~1.3% of card spend** (derived).
- **KAST:** "revenue to reach $100 million annual run rate in 2026, with both users and revenue currently growing approximately 15–20% month-on-month". 1M+ users, ~$5B annualised transaction volume. Raised an **$80M Series A** co-led by QED and Left Lane (PR Newswire, 2026-03-09). A LinkedIn post cites a $600M valuation (unverified).
- **RedotPay:** **8M+ users**, **$14B+ annualised payment volume** including top-ups (Reuters, 2026-08-25).
- **Rain** (the infrastructure layer): $250M Series C at ~$1.95B (Jan 2026), with 200+ partners claimed (insights4vc).

### 1.4 Growth and retention

- **Plasma One cohorts:** the May 2026 cohort kept 88%, 78% and 72% over three months. The June cohort kept 84% and 76%. More than 90% of card users return day to day. It hit $1M spend 45 days after its private beta (Paymentscan, 2026-06-24 and program page).
  - **Why it works:** its cashback is paid in XPL, the chain's own token, and the tiers lock that token. The growth is subsidised.
- **ether.fi Cash:** spend rose from $24.06M (Sep 2025) to $115.3M (Sep 2026), and active addresses from 27,055 to 47,146.
- **Decliners:** MetaMask Card, Gnosis Pay and UR (§1.2). Gnosis Pay is **shutting its consumer card on 20 Dec 2026** to become a B2B programme manager (The Defiant, 2026-09-24; Gnosis Pay blog, 2026-09-03).

### 1.5 Who uses them: segments and regions

- **LatAm first, Africa second.** *"Latin America has the highest adoption and greatest potential for growth at the moment, followed by Africa"* (RedotPay co-founder, Reuters, 2026-08-25). KAST's $80M is earmarked for LatAm, North America and the Middle East (PR Newswire, 2026-03-09).
- **Why LatAm** (BlindPay, 2026-09-21: https://blindpay.com/resources/more/stablecoin-cards-latin-america):
  - Argentina adds a **30% income-tax withholding** on foreign-currency card spend paid in pesos, so spending from a dollar balance wins.
  - Brazil charges **3.5% IOF** on foreign-currency spend with locally issued cards.
  - Colombian freelancers paid in USD are the "strongest use case".
  - The catch: rent and bills run on **Pix/SPEI/boleto, which cards can't pay**.
- **Crypto-wealthy DeFi users** are the ether.fi segment (~$2.4K a month per active address). Their need is not selling and not triggering a tax event.
- **Internet-native / AI spenders:** Plasma One gives 5–10% cashback on AI subscriptions and flights (Paymentscan, 2026-06-24).
- **Diaspora remittance:** Abound (Indian diaspora in the US) has done **$500M+ remittance volume** and chose Monad (Monad Aug-2026 highlights, 2026-09-02).
- **Contractors and freelancers:** Meru offers USD accounts for LatAm freelancers paid via PayPal, Upwork, Deel and Payoneer (Portal case study). Dealroom lists 100K+ users (unverified).
- **Survey:** 71% of stablecoin holders are likely to use a card to spend them (BVNK Stablecoin Utility Report 2026: https://www.bvnk.com/utility; company survey).

---

## 2. Product mechanics that work

### 2.1 Mechanics and the evidence for each

| Mechanic | Who proves it | Evidence it works |
|---|---|---|
| **Borrow-to-spend** (spend without selling; debt is repaid later or liquidated) | ether.fi Cash, Avici, Exa (fixed-rate BNPL), Baanx "credit wallet" | ether.fi has the highest spend per user (~$2,446/addr/mo) and the #2 volume. Paymentscan flags borrow-to-spend ✓ only for ether.fi, Avici (and Exa) |
| **Earn-while-idle, spend from the yield position** | MetaMask Money Account (Monad), ether.fi Liquid, Plasma One Earn | Money Account is built around it on Monad. **mUSD on Monad is only $15.9M** (DefiLlama stablecoins, 2026-09-29), so traction there is still small |
| **Cashback in a token** | ether.fi (3% in ETHFI, 7-day lock), Plasma One (2–4% in XPL, 10% on AI), Gnosis Pay (up to 4–5% in GNO, requires holding GNO) | Drives acquisition (Plasma +353% in 90 days) but is a **subsidy**. Gnosis Pay's GNO-gated cashback didn't stop decline |
| **Tiers / membership** | Plasma One Lite/Core/Platinum, RedotPay Pro | 350+ Platinum upgrades and $3.2M XPL locked in 7 days (Paymentscan, 2026-06-24) |
| **Local rails beside the card** (virtual IBAN/ACH/Pix/SPEI) | ether.fi (USD, EUR, BRL, MXN, COP, GBP, AED accounts via Bridge + Due), KAST (Bridge + Noah), Gnosis Pay (EUR via Monerium, BRL Pix, ARS) | Every top-5 neobank has them (Paymentscan, 2026-08-04) |
| **Zero-FX / multi-currency settlement** | ether.fi 0% FX on EUR, Gnosis Pay 0% FX | Cross-border premium is 0.5–1%+ when the issuer settles in the wrong currency (Paymentscan, 2026-09-08) |

### 2.2 Custody models

- **Custodial** (RedotPay, KAST, Karta, Wirex): the user deposits to the program and the card spends a ledger balance. This is the simplest model and the one with the most volume (RedotPay alone is ~⅓ of the market).
- **Self-custodial with delegated pull:** the user keeps keys and grants the program a capped right to pull.
  - **MetaMask Card (Baanx):** ERC-20 `approve` allowance, "delegation", on Linea/Ethereum (https://docs.baanx.com/guides/delegation/overview.md).
  - **Bridge noncustodial cards:** ERC-20 `approve` to a Bridge card contract. *"At the time of each card authorization, Bridge pulls the exact spend amount onchain"*. Supported chains: **Tempo, Solana, Base, World Chain, Linea; not Monad** (https://apidocs.bridge.xyz/platform/cards/overview/noncustodial).
  - **Rain real-time funding (beta):** user approves; *"only the amount needed… is committed to the collateral contract at authorization"*. At launch: USDC on Base and Arbitrum, USDT0 on Plasma (Rain, undated: https://www.rain.xyz/resources/introducing-real-time-funding).
- **Self-custodial smart account with spend module** (strongest guarantees, most engineering): Gnosis Pay, ether.fi, Exa. See §2.3.
- **The industry is moving away from per-transaction onchain settlement.** Gnosis Pay's new platform collects settlement *"once a day, with grouped payments"* for privacy and fewer declines (Gnosis Pay blog, 2026-09-03). Issuers settle with Visa daily either way.

### 2.3 How authorisation works onchain (three open designs)

**Gnosis Pay: Safe + Zodiac modules** (https://docs.gnosispay.com/gp-onchain/about-GP-safe; `gnosispay/account-kit`, Apache-2.0, 15★)
- A 1/1 Safe is "upgraded": the owner is swapped to an unreachable address (`0x…02`), and **Delay** and **Roles** modules are enabled.
- The user acts through the Delay module, with a **~3-minute cooldown**.
- Gnosis Pay's spender has unilateral spend rights through the Roles module, within an **allowance** (balance, cap, refill per period).
- **Result:** the issuer can pull instantly within limits, and the user can't front-run a withdrawal against a pending authorisation. The delay is the double-spend guard.

**ether.fi Cash: `cash-v3`** (https://github.com/etherfi-protocol/cash-v3; 18★, no licence file, pushed 2026-09-29; audited by Certora and Nethermind)
- An `EtherFiSafe` smart account plus a `CashModule`.
- `spend(safe, txId, binSponsor, tokens[], amountsInUsd[], cashbacks[])` is callable only by the ether.fi wallet role.
- The `BinSponsor` enum is **{Reap, Rain, PIX, CardOrder}**. ether.fi routes through **two issuers at once** and has a Brazilian Pix path.
- Modes are **Debit | Credit**; credit borrows via `DebtManager` or an Aave gateway.
- Built-in delays: withdrawal 1 s, spend-limit change 1 h, mode change 1 s.
- Settlement dispatchers exist per BIN sponsor.

**Exa: ERC-6900 plugin + issuer signatures** (https://github.com/exactly/exa; `IssuerChecker.sol` is GPL-3.0; protocol is BUSL-1.1)
- The card issuer signs an EIP-712 `Collection(account, amount, timestamp)`.
- A keeper calls `collectDebit`, `collectCredit(maturity…)` or `collectInstallments` on the user's modular account.
- `IssuerChecker` verifies the signature, the expiry and replay protection.
- Credit and instalments borrow at fixed rates from Exactly pools.

**The authorisation time budget.** Reap's external-authorisation webhook must **return a decision within 1.6 s**: *"the card network does not wait, and there is no retry"* (https://docs.reap.global/transactions/external-authorization/authorization-request.md). Monad's case is that with **300 ms blocks and ~600 ms deterministic finality**, the authorisation → deposit collateral → borrow → transfer → approve chain fits inside that window. Chains with multi-second or probabilistic finality force issuers to use "push" prefunding or to float credit (Monad blog, 2026-02-10, updated 2026-07-23: https://monad.xyz/blog/finality-and-cards).

### 2.4 Settlement flow (the generic shape)

1. **Card tap.** Visa/Mastercard sends the authorisation to the issuer processor (Rain / Reap / Stripe / Monavate).
2. **Decision.** The issuer checks the balance: a ledger, an onchain allowance, or the partner's webhook. It approves and **holds**.
3. **Onchain leg.**
   - *Push model:* already prefunded.
   - *Pull model:* pull or commit collateral now (Bridge, Rain real-time funding, Gnosis Pay Roles).
   - *Credit model:* the issuer extends credit and liquidates collateral later (Rain's collateral contract, Reap credit).
4. **Daily clearing.** The issuer settles with the network in fiat or, increasingly, stablecoins. Visa's stablecoin settlement pilot includes Rain, Reap and Bridge-backed Lead Bank.

---

## 3. Card-issuing infrastructure a new startup can use

"Monad?" means whether the provider supports Monad for **card spend** today.

| Provider | What it is | Chains | Monad? | Requirements / KYC | Sandbox | Timeline | Commercials |
|---|---|---|---|---|---|---|---|
| **Rain** | Visa principal member, full-stack issuer. Mastercard principal too (Rain news) | Many EVM + Solana + Stellar + Plasma. Adds chains with custom, audited contracts | **Yes, since 2026-05-12** (https://monad.xyz/blog/rain-on-monad; https://www.rain.xyz/resources/rain-integrates-monad-bringing-card-programs-to-the-financial-layer-of-the-internet). Avici and Rhythmic named as building | Partner KYB. Partner must meet CDD/CIP. KYC/AML workflows are included in every program (Rain risk and global pages) | **Yes, on request after NDA** | "Typically ~6 weeks". Product page says 8–12 weeks; FAQ says "some programs… under two weeks" | 3 tiers trading interchange share against minimums and commitment (numbers not public) |
| **Bridge (Stripe) + Stripe Issuing** | Stablecoin-backed Visa cards; Stripe issuing on a BIN sponsor | Noncustodial: Tempo, Solana, Base, World Chain, Linea. Custodial Bridge wallets; **Privy** wallets supported | **No for cards.** Bridge supports **USDC on Monad for ramps/transfers** (min $1–50 per route; https://apidocs.bridge.xyz/get-started/introduction/what-we-support/payment-routes) | Bridge runs **hosted KYC links**; a `cards` endorsement per customer (valid 24 h) | **Yes:** Bridge sandbox (keys self-serve in dashboard after support@bridge.xyz onboards you) + Stripe Sandbox. Stripe stablecoin cards are **private preview** | **6–8 weeks** kickoff → live (Bridge docs) | Interchange share + configurable transaction/FX fees |
| **Reap** (Payward/Kraken group per site footer) | Visa principal issuer in **Hong Kong and Mexico**. Visa deal for **100+ markets incl. EMEA and Africa** (2026-09-23) | User-funded: Base, Polygon, Solana. Program-funded collateral: Ethereum, Polygon, Solana | **No** (program-funded route works; see §5) | **Managed KYC:** Reap runs Sumsub inside your app. Or Sumsub token sharing / "Universal KYC" with your own provider | **Yes** (contact Reap). Sandbox simulates auth, clearing, reversal, refund, decline | Not published | Program sets cardholder FX/ATM fees; interchange + fees |
| **Gnosis Pay** | Programme manager; cards issued by **Monavate** (FCA EMI, Visa Europe) | Ethereum, Polygon, Gnosis Chain. Rails: USD, EUR (IBAN), BRL (Pix), ARS | **No** | Sumsub KYC in an iframe, run by Gnosis Pay. "Using your existing KYC/AML flow" on the enterprise tier | **Self-serve Partners Dashboard: PartnerID + APP_ID "instantly"** (https://docs.gnosispay.com/integration-model); open-source reference UI `gnosispay/ui` | "Virtual cards in minutes, physical cards in days" (marketing) | Custom; agreements from 2 years |
| **Baanx** (Exodus agreed to buy parent W3C Corp, **Baanx + Monavate**, for $175M; CoinDesk, 2025-11-24: https://www.coindesk.com/business/2025/11/24/crypto-wallet-firm-exodus-buys-baanx-and-monavate-for-usd175m) | White-label self-custody cards (MetaMask Card, Ledger CL Card); FCA-registered | Delegation docs: Linea, Ethereum, Solana | **Via MetaMask Card only** (Monad USDC, since 2026-03-12). MetaMask Card = Baanx + Monavate on Mastercard (withcl.com), so both are now Exodus group | Veriff KYC session hosted by Baanx | API docs public; access by contract | n/a | n/a |
| **Immersve** | **Mastercard principal member**; "supports centralized and decentralized payment experiences" (https://immersve.com); Circle case study | n/a (docs not reachable 2026-09-29) | unverified | unverified | unverified | unverified | unverified |
| **Nium** | Stablecoin card issuing on Visa and Mastercard via one API, 190-country payouts (Fintech Wrap Up, 2026-05) | n/a | unverified | License-heavy; handles KYC | n/a | n/a | n/a |
| **PayCaddy** (YC W22) | LatAm USD Mastercard programs, "in weeks" | n/a | no (unverified) | n/a | n/a | n/a | n/a |
| **Pomelo** | LatAm issuer-processor; issues Binance's Argentina card (TWIF LatAm, Sep 2026) | n/a | unverified | n/a | n/a | n/a | n/a |
| **Striga** (now Lightspark) | EU crypto BaaS: wallets, vIBANs, cards under its VASP licence | EU | unverified | Striga KYC | n/a | n/a | n/a |
| **Holyheld** | Pivoted to **business accounts** (holyheld.com, 2026) | n/a | no | n/a | n/a | n/a | not a consumer-issuer route now |
| **Kulipa** | Self-custodial card issuer | n/a | n/a | n/a | n/a | n/a | **Wound down without warning ~29 Jul 2026**, killing Ready (ex-Argent), Solflare and others' cards (The Defiant: https://thedefiant.io/converge/cefi/ready-shuts-card-program-after-issuer-winds-down) |
| **UR** (ex-Fiat24) | Swiss-licensed account + **Mastercard principal**; "one API, anyone can build on it" | Arbitrum (EUR24/USD24/CHF24/CNH24 tokens) | Listed on Monad App Hub; card settlement on Arbitrum | Swiss KYC | n/a | n/a | Spend fell to $1.09M in Sep 2026 |

**Issuers already live with Monad:**
- **MetaMask Card:** Monad USDC. *"Solana and Monad are not supported"* in New York and Texas (https://support.metamask.io/trade/metamask-card/funding/). Announcement dated 2026-03-12 (x.com/monad/status/2032117067755774411).
- **MetaMask Money Account:** Mastercard via MetaMask Card, mUSD issued by Bridge on M0.
- **Rain:** since 2026-05-12.
- **Visa and Mastercard:** "both support stablecoin payments on Monad" (Monad blog, 2026-07-27). Mastercard added Monad to its Crypto Partner Program (Monad LinkedIn, "Stablecoin Sunday", 2026-04-26; unverified primary).

---

## 4. Monad specifics

### 4.1 Who is already there

| Product | What it actually does | Traction (source) |
|---|---|---|
| **MetaMask Money Account** | Self-custodial smart account holding **mUSD** (Bridge-issued on M0). Up to 4% APY via Morpho (Veda vaults, Steakhouse curation). Card spend **pulls from the yield position with real-time authorisation**. Gas sponsored. Monad is the exclusive chain (Monad blog, 2026-06-30) | 1M+ gasless MetaMask txs on Monad (Monad, 2026-09-02). **mUSD on Monad $15.9M** (DefiLlama, 2026-09-29). Card spend on Monad isn't tracked by Paymentscan |
| **MetaMask Card on Monad** | Mastercard debit that spends Monad USDC by delegation | Program-wide spend is falling: $5.35M (Mar) → $2.37M (Sep 2026) (Paymentscan) |
| **Avici** | Self-custodial neobank with a Visa card and borrow-to-spend; building on Monad with Rain | $3.55M spend in Sep 2026, 2,982 addresses (Paymentscan; its settlement is on Ethereum/Solana today). Monad launch status unverified |
| **Rhythmic** | "Consumer payment products with embedded stablecoin rails" on Rain + Monad | No public metrics (unverified). Dragonfly-led $4M seed per [trend-radar](trend-radar.md) (unverified primary) |
| **UR** | Swiss multi-currency account + Mastercard | On the Monad App Hub. Issuer spend fell to $1.09M in Sep 2026 |
| **Cero** | "Spending, rewards, credit-building", live on Monad (Monad Aug-2026 highlights) | No public metrics (unverified) |
| **Axal** | Savings/wealth app ("6–10% APY on cash"). "Axal Prime" routes to Monad pools | No public metrics |
| **Meru** | USD accounts for LatAm freelancers, 150+ countries; built on Stellar, now "live on Monad" for top-ups | 17.8K Google Play ratings (4.3★). Dealroom 100K+ users (unverified) |
| **Abound** | Indian-diaspora remittance super-app choosing Monad for next products | **$500M+ remittance volume**; "800,000 NRIs" (Play Store listing, unverified) |
| **Blend Neobank Stack** | Portal wallets/ramps + Blend yield routing (Aave, Morpho) + per-user self-custodial accounts: a **neobank backend kit on Monad** (Monad blog, 2026-06-22) | n/a |
| **Hamirach** | Multi-currency stablecoin layer (USD/CLP/COP/MXN) clearing everything on Monad | "Pilot processed more than $20M, $1.2M annualized payments live" (Monad blog, 2026-06-19) |
| **AEON Pay** | Crypto → fiat QR payments at 50M+ merchants (SEA/Africa/LatAm), MON supported | (Monad blog, 2026-02-04) |
| **Zerohash** | Regulated stablecoin rails on Monad (Kalshi, Gusto payouts). Also powers **Visa Direct stablecoin payouts** | (Monad blog, 2026-02-11) |
| Monad Foundation payments team | Raj Parekh (ex-founding member of Visa crypto) leads payments after the **Portal acquisition** (Monad blog, 2025-07-09). 30+ onramps incl. PIX and UPI (Monad blog, 2026-07-27) | Contact point for issuer intros |

### 4.2 AUSD's role

- **Supply:** AUSD (Agora) has **$150.1M on Monad** out of $254.9M total, **59% of all AUSD** (DefiLlama stablecoins, 2026-09-29).
- **Where it's used on Monad:** collateral on Perpl, quote asset on Kuru, Chainlink/Pyth feeds, and a yield wrapper (Upshift **earnAUSD**, which Pendle can fix-rate).
- **Primitives:** ERC-2612 `permit` and **ERC-3009** `transferWithAuthorization`/`receiveWithAuthorization`, for gasless, signature-based transfers ([../03-sponsors/finance-trading/agora-ausd.md](../03-sponsors/finance-trading/agora-ausd.md)).
- **Gap:** no issuer spends AUSD today.
  - MetaMask Card on Monad = USDC only.
  - Bridge cards = USDC/USDB.
  - Rain real-time funding = USDC/USDT0.
  - So an AUSD card needs either a just-in-time **AUSD→USDC swap inside the authorisation window** (Agora Instant Settlement AUSD/USDC pair `0xf332…2470`, or Kuru/Uniswap), or a **program-funded** design where the program's USDC float backs cards while users hold AUSD/earnAUSD.
- **ERC-3009 fit:** it needs a fresh user signature per transfer, so it suits P2P/remittance sends. It doesn't suit issuer-initiated card pulls, which need a standing allowance: `permit`/`approve`, or smart-account session permissions (ERC-7715-style, as MetaMask's Agent Wallet uses on Monad).

### 4.3 Gaps left on Monad (what nobody ships)

1. **Borrow-to-spend against Monad collateral:** MON, LSTs, sUSDe, earnAUSD, tokenized equities, Pendle PTs. Money Account spends *from* yield; it does not *borrow against* assets. Monad's own blog uses this as its example flow. Aave, Euler, Morpho and Curvance are live.
2. **An AUSD-native card or account** (see §4.2).
3. **Corridor wedges with local rails beside the card** (Pix/SPEI/UPI). Monad has the ramps (PIX, UPI) and Abound, Meru and Hamirach as B2B-ish players, but no consumer "dollar account + card" for one named segment.
4. **Programmable or scoped cards:** streaming-salary spend, family/teen allowances, per-merchant envelopes, agent cards. Rain markets "scoped cards" and "controlled agentic payments", and the Monad Foundation joined Rain's **Agentic Payments Alliance** (Monad, 2026-09-02). There is no consumer product on Monad.
5. **Public card analytics for Monad.** Paymentscan doesn't track Monad. That is minor, but it means no verifiable traction exists for anyone.

---

## 5. Obstacles and the routes that work

### 5.1 "We need a card issuer / BIN sponsor / programme manager"

**Routes that work:**
- **Full-stack principal issuers that act as BIN + processor + programme manager:**
  - Rain (Visa principal): KAST, ether.fi, Karta and Avici all launched on it. ether.fi got to **$1M spend in its first month** (Rain case study: https://www.rain.xyz/resources/from-launch-to-1m-in-1-month----heres-how-ether-fi-did-it).
  - Reap (Visa principal, HK + MX): *"you launch on Reap's licence without applying for your own"* (https://reap.global/products/card-issuing).
  - Bridge + Stripe Issuing: Phantom and MetaMask use Bridge cards (Visa release, 2026-03-03: https://usa.visa.com/about-visa/newsroom/press-releases.releaseId.22206.html).
- **Programme managers on a sponsor's BIN:** Gnosis Pay on Monavate (FCA EMI). Partner apps Rebind, Picnic, MiniPay and Zeal run on it. Monavate is now in the same group as Baanx: Exodus agreed to buy both in Nov 2025, so this is not independent redundancy.
- **Two issuers at once for redundancy:** ether.fi's contract routes to both Rain and Reap (`BinSponsor {Reap, Rain, PIX, CardOrder}`).
- **Riding an existing card instead of issuing one:** build the account and logic on Monad, and let the user's MetaMask Card (Monad USDC) or a partner card do the spending. This gives zero issuer work, but you don't own interchange.

**First steps:**
- For agent or scoped cards, apply to **Rain's Agentic Startup Program**: venture-backed startups get cards, money movement and spending credit. Cohort 2 runs Nov 2026–Jan 2027, applications open in October (https://www.rain.xyz/agentic-startup-program).
- Rain: https://www.rain.xyz/contact-us → scope program → pick tier → NDA → docs + sandbox. Ask for real-time funding on Monad.
- Ask the Monad Foundation payments team (Raj Parekh) for a warm intro to Rain, since Rain names Monad partners publicly.
- Reap: request sandbox keys (https://docs.reap.global/quickstart).
- Bridge: email support@bridge.xyz for a developer account, then generate an `sk-test` key.

### 5.2 "We can't run KYC/KYB ourselves"

**Routes that work: the issuer hosts KYC and the app never touches documents.**
- **Bridge:** hosted KYC link API plus a `cards` endorsement (https://apidocs.bridge.xyz/platform/cards/overview/kyc).
- **Reap Managed KYC:** *"Reap runs the identity verification… You never handle identity documents"* via an embedded Sumsub SDK. Sumsub **token sharing** reuses KYC you already did.
- **Gnosis Pay:** the Sumsub iframe or mobile SDK is issued by the Gnosis Pay API (https://docs.gnosispay.com/onboarding-flow).
- **Baanx:** a Veriff session URL.
- **Rain:** KYC/AML workflows included in every program.

**KYB of your company:** every issuer requires it (Rain: *"Every partner is required to complete a Know Your Business (KYB) review"*). So incorporate a company first. There's no way around this, but it is routine.

**First step:** incorporate the entity. Then choose the issuer-hosted KYC option in scoping, so the app stays out of PII and document scope. Card details go through issuer-hosted elements; Stripe Issuing Elements keeps you *"out of PCI DSS scope"*.

### 5.3 "The issuer doesn't support Monad (or AUSD)"

**Routes that work:**
- **Use the issuer that already supports Monad:** Rain (since 2026-05-12). Rain states *"each new chain integration is custom work… outside auditors review everything"*. It added Monad, Plasma, Solana and Stellar on partner demand.
- **Ask for a chain add:** Rain's Monad and Plasma posts both frame integrations as demand-driven. Bridge already lists Monad USDC for ramps, so a card-contract deployment there is plausible (unverified).
- **Keep the user experience on Monad and settle elsewhere:**
  - Reap's **program-funded** model: the program holds master collateral on Ethereum/Polygon/Solana and decides every authorisation via its **external-authorisation webhook (1.6 s budget)**.
  - Rain's **partner-managed** model: *"you maintain the reserve balance, decide whether to approve or decline each transaction via webhook"*.
  - In both, the user's balance, credit logic and state live on Monad. The program rebalances treasury collateral to the issuer's chain periodically. This is how most custodial neobanks work.
- **AUSD:** hold AUSD/earnAUSD and swap to USDC inside the authorisation window (Monad's composability case), or back cards with a USDC float (program-funded).

**First step:** in the Rain call, ask for **real-time funding on Monad USDC** and for **partner-managed authorisation**. Prototype against Reap's published webhook contract in the meantime.

### 5.4 "Licences and regulation"

**Routes that work:**
- **Operate under the issuer's licences.** Principal issuers hold Visa membership and local approvals. Rain says it has *"secured the approvals needed to issue cards in dozens of countries"*. Reap and Visa cover 100+ markets (2026-09-23). Bridge is live in 18 countries with 100+ planned (2026-03-03).
- **Pick markets where the stack already exists:** LatAm (Reap Mexico principal; Gnosis Pay BRL/ARS; Pomelo in Argentina), HK/APAC (Reap), EU/UK (Monavate via Gnosis Pay).
- **Keep the app non-custodial** to cut its own licensing surface. Baanx: *"Platform doesn't hold user funds, reducing regulatory complexity"*. Bridge, Gnosis Pay, Rain real-time funding and Money Account all use this.
- **Yield:** the GENIUS Act bars *issuers* from paying yield. Congress's research service notes *"the current restriction on yield would presumably apply when a customer self-custodies"* only at the issuer level (https://www.congress.gov/crs-product/IF13174). Programs route yield through DeFi vaults with curators (MetaMask/Morpho/Steakhouse), not through the stablecoin issuer.
- **US states:** MetaMask excludes Monad spend in New York and Texas. Bridge returns `endorsement_not_available_in_customers_region` where money-transmitter licences block it. **Launch outside the US first**, as KAST, RedotPay and Plasma One did.

**First step:** choose launch countries from the issuer's approved-region list before building. Get a fintech lawyer's view on whether the app layer (non-custodial, yield via third-party vaults) needs its own VASP/EMI registration in the launch market. Brazil (SPSAV since 2026-02-02) and Argentina (PSAV registry) need checking for the ramp layer (BlindPay, 2026-09-21).

### 5.5 "Collateral, minimums and upfront cost"

**Routes that work:**
- Rain's lowest tier *"keep[s] fixed fees lighter for earlier-stage or experimental programs"*. It also claims *"up to 60% lower collateral requirements compared to traditional card issuers"*.
- The **Rain-managed** flow of funds means Rain runs the per-user collateral contract and daily settlement, so no ledger or treasury build is needed.
- The **user-funded** model (Reap, Bridge noncustodial, Rain real-time funding) puts no program float at risk.

Exact minimums aren't public (unverified). Expect a platform fee and a commitment, traded against a bigger interchange share.

### 5.6 "Self-custody pull must be safe against double-spend"

**Routes that work (open designs to copy or adapt):**
- Gnosis Pay's Roles allowance + Delay cooldown (Apache-2.0 `account-kit`, LGPL Zodiac modules).
- ether.fi's `CashModule` with delayed withdrawals and mode changes.
- Exa's issuer-signed `Collection` + keeper.
- Monad adds sub-second finality. Gnosis Pay itself is removing its withdrawal delay ("instant withdrawals") on its new platform, which shows the delay is a workaround for slow settlement.

**First step:** fork the design, not the code. `cash-v3` has no licence and Exa's protocol is BUSL. Build a small ERC-7579/Safe module with allowance + short delay + an issuer-only `spend`, and get it audited.

### 5.7 "Fraud, chargebacks and disputes"

**Routes that work:**
- Principal issuers bundle fraud and disputes. Rain: *"Compliance, fraud, disputes, and reporting are handled within Rain's platform"*. Bridge/Stripe: *"disputes, fraud management"* in card features.
- Program-set controls: Reap policies, Gnosis Pay per-card spending rules, Rain programmable limits and MCC controls.

**Residual:** friendly-fraud chargebacks can't claw back onchain funds (Banxa explainer). The issuer absorbs that and prices it into tiers. A self-custodial pull model limits program exposure to the committed authorisation amount.

### 5.8 "What if our issuer dies?" (the Kulipa lesson)

- **What happened:** Kulipa's wind-down (~29 Jul 2026) turned off Ready's and Solflare's cards overnight (The Defiant). Ready's funds were safe *because* the wallet was self-custodial.
- **Routes that work:**
  - Multi-issuer routing (ether.fi: Rain + Reap).
  - Self-custodial balances, so an issuer failure strands only the card, not the money.
  - Choose Visa principal members with large balance sheets (Rain $338M raised; Reap inside Payward).

### 5.9 "Cashback economics look subsidised"

- **Evidence:** Plasma pays XPL, ether.fi pays ETHFI, Gnosis Pay pays GNO. Without a token, RedotPay's Pro cashback nets ~0.7–0.8% after FX (Paymentscan program page).
- **Routes that work:**
  - Monetise FX, ramps and subscriptions, not interchange alone (KAST, RedotPay).
  - Monetise credit (ether.fi's revenue is at least ~1.3% of spend).
  - Get ecosystem co-marketing. Monad Foundation incentives are possible (unverified).

### 5.10 "The card isn't the rail our users need"

For bills, rent and street merchants in LatAm and SEA, a card is the wrong tool.

**Routes that work:**
- Pix / SPEI / Transfers 3.0 / PSE payouts from USDC (BlindPay; Gnosis Pay BRL Pix; ether.fi's `PIX` BIN-sponsor path).
- Stablecoin-to-fiat **QR** switches: AEON Pay (live on Monad, 50M+ merchants), SQRIL (Thailand/Cambodia, now Africa), Bitget Wallet QR in Argentina/Colombia/Bolivia.
- **Visa Direct stablecoin payouts** via Zerohash (on Monad) and BVNK.
- Virtual USD/EUR accounts via Bridge (supports Monad USDC), Due, Noah or Iron.

---

## 6. Where a new entrant could win

Ranked by evidence of demand × gap on Monad × how much Monad specifically enables.

| # | Wedge | Segment / region | Demand evidence | Gap on Monad | Monad-specific? |
|---|---|---|---|---|---|
| **1** | **Borrow-to-spend card on Monad collateral.** Swipe → deposit MON/sUSDe/earnAUSD/tokenized stocks/PTs → borrow AUSD/USDC on Aave/Euler/Morpho → settle, all inside ~1 s. User sets LTV guardrails; auto-repay from incoming salary | Crypto-wealthy holders (ether.fi's user base); later, tokenized-stock holders | ether.fi $115M/mo, highest spend per user, $11.7M revenue over the last year | **Nobody** (Money Account spends *from* yield; it doesn't borrow) | **Yes.** The Monad blog's canonical example. Needs deterministic sub-second finality |
| **2** | **Streaming-salary card** (Track 02 official idea 06). Salary streams per second (Sablier on Monad); the card authorises against the streamed-but-unclaimed balance; the idle remainder earns in a vault | Contractors/freelancers paid in USD, LatAm (Meru/Colombia evidence) | Idea 06 is official; KAST +15–20% MoM users; the LatAm freelancer thesis | No consumer product; Sablier on Monad is idle ([ecosystem-map](../05-ecosystem/ecosystem-map.md)) | Yes: claim + authorisation in one window |
| **3** | **AUSD dollar account for one corridor** (e.g. US→India diaspora, or AR/BR freelancers) with card + local payout rails + passkeys (Mera) | Named corridor | Abound $500M+; RedotPay's LatAm quote; Argentina 30% withholding; Brazil IOF | Abound and Meru occupy parts; no AUSD card | Partly (fees, finality); fits the Agora bounty |
| **4** | **Scoped / programmable cards:** teen or family allowance cards, envelope budgets, per-merchant caps, agent cards with onchain mandates | Families; AI-agent users | Rain markets scoped and agentic cards; Monad joined the Agentic Payments Alliance | None consumer-side | Moderately (policy engine onchain) |
| 5 | **Gnosis Pay refugee partner app:** users must move by 20 Dec 2026 | EU self-custody users | Gnosis Pay $7.1M/mo, 6,908 active addresses | Needs a Gnosis Pay partnership (Ethereum/Polygon/Gnosis, not Monad) | No |

**Recommendation for Metropolis Track 02:** #1 or #2. Both are new *mechanics*, not a rebranded wallet.
- #1 has the strongest evidence and the clearest "only on Monad" story.
- #2 matches an official track idea word for word.
- Either can reuse #3's AUSD + Mera onboarding to add the Agora bounty angle. Note that Agora's bounty asks for *cross-border* payments.

---

## 7. What it would actually take (real product, not the demo)

Durations are anchored where a source exists. Other durations and headcounts are our estimates (unverified).

1. **Company and compliance base.** Incorporate. Engage the issuer (KYB). Get a fintech counsel memo per launch market (§5.4). Set up a support desk, because disputes and support are table stakes (Gnosis Pay says *"partners will compete… on… customer support"*).
2. **Issuer programme.**
   - Rain: scoping → tier → NDA → sandbox → contract → implementation, **typically ~6 weeks** (Rain), up to 8–12.
   - Or Bridge: **6–8 weeks** (Bridge docs).
   - Decide **Rain-managed** (fast, less control) or **partner-managed** (own authorisation webhook: needed for borrow-in-swipe).
3. **Onchain core (Monad).**
   - Smart account (passkey-owned; Mera/Privy/Dynamic).
   - Spend module with allowance, delay and issuer-only `spend`.
   - Credit module wired to Aave/Euler/Morpho, with oracles and liquidation handling.
   - Swap path for AUSD↔USDC.
   - Settlement dispatcher to the issuer's collateral address.
   - **Two independent audits.** ether.fi used Certora + Nethermind. Rain audits every chain integration.
4. **Authorisation service.** A low-latency webhook that simulates, submits and confirms the Monad transaction within Reap's **1.6 s** envelope, or whatever Rain's is. It needs a fallback decision (credit line or decline) if the chain is slow.
5. **Money-in / money-out.** Bridge virtual accounts (Monad USDC supported), Mercuryo/Transak/MoonPay onramps (Monad has 30+), and Pix/SPEI payout partners.
6. **Growth budget.** Cashback or points. The evidence says subsidised rewards drive the first 6 months (Plasma One). Plan monetisation through FX, subscriptions and credit (§5.9).
7. **Ops.** Fraud rules, dispute handling (via the issuer), reconciliation, monitoring. Keep multi-issuer optionality (§5.8).

**Is it worth it?** Commercially, yes, if the wedge is #1 or #2 and the team can raise money: KAST, Rain and Plasma show investors fund this category. As a copy of Money Account, no: MetaMask owns distribution on Monad.

---

## 8. Risks with no known route

- **Card-network policy.** Visa/Mastercard can change crypto-program rules or suspend programs, and every route depends on them (insights4vc). Mitigation is diversification only, not a real route.
- **Interchange compression by regulation** (e.g. if crypto issuers fall under Durbin-style caps). No route beyond diversifying revenue.
- **Stablecoin de-peg or freeze** (USDC/USDT/AUSD have freeze roles). Diversifying assets reduces this but doesn't remove it.
- **Smart-contract loss in a consumer product.** *"Regulators will expect regulated issuers to make users whole"* (insights4vc). Audits reduce this but don't remove it.

---

## Sources (primary; all pulled 2026-09-29 unless dated)

- Paymentscan: home, program pages (etherfi, kast, redotpay, gnosis-pay, avici, metamask, karta), issuers/ur, chains; blogs 2026-06-24 (Plasma One), 2026-08-04 (neobank vendors), 2026-09-08 (card currencies). https://paymentscan.xyz
- a16z crypto, "5 charts…", 2026-08-07. https://a16zcrypto.com/posts/article/charts-payment-card-stablecoin-spend/
- Reuters, RedotPay $50B forecast, 2026-08-25. https://www.reuters.com/business/finance/stablecoin-card-spending-forecast-hit-50-billion-year-by-2028-redotpay-2026-08-25/
- insights4vc, "The State of Stablecoin Cards", 2026-01-22. https://insights4vc.substack.com/p/the-state-of-stablecoin-cards
- KAST $80M Series A, PR Newswire, 2026-03-09. https://www.prnewswire.com/news-releases/kast-raises-80-million-as-stablecoins-move-from-infrastructure-into-mainstream-financial-services-302708234.html
- DefiLlama: `summary/fees/etherfi-cash-liquid`, `protocols`, `stablecoins`. https://defillama.com/protocol/etherfi-cash-liquid
- Monad blog:
  - finality-and-cards (2026-02-10)
  - merchant-psp (2026-02-04)
  - zerohash-on-monad (2026-02-11)
  - rain-on-monad (2026-05-12)
  - hamirach (2026-06-19)
  - blend-neobank-stack (2026-06-22)
  - metamask-money-account-launches-on-monad (2026-06-30)
  - monad-economy-eight-months-in (2026-07-27)
  - vaults-curators-fintech-earn-programs (2026-08-10)
  - ecosystem highlights Aug 2026 (2026-09-02)
  - monad-foundation-acquires-portal (2025-07-09)
- Rain (undated pages): integrates Monad; launch a card program; real-time funding; global programs; risk guide; Plasma. https://www.rain.xyz/resources/
- Bridge docs: cards overview, stripe-issuing, noncustodial, kyc, sandbox, fees, payment-routes. https://apidocs.bridge.xyz. Stripe stablecoin cards (private preview): https://docs.stripe.com/issuing/stablecoin-cards
- Visa × Bridge, 2026-03-03. https://usa.visa.com/about-visa/newsroom/press-releases.releaseId.22206.html
- Reap docs (supported assets, managed KYC, external authorisation, sandbox, quickstart) https://docs.reap.global; Reap × Visa 100+ markets, 2026-09-23.
- Gnosis Pay docs (integration model, onboarding, GP Safe) https://docs.gnosispay.com; blog "The Next Era", 2026-09-03; The Defiant, 2026-09-24.
- Baanx docs (delegation) https://docs.baanx.com
- MetaMask Card funding (Monad USDC) https://support.metamask.io/trade/metamask-card/funding/
- GitHub: etherfi-protocol/cash-v3, exactly/exa, exactly/protocol, gnosispay/account-kit (checked 2026-09-29).
- BlindPay, Stablecoin cards in LatAm, 2026-09-21. https://blindpay.com/resources/more/stablecoin-cards-latin-america
- The Defiant, Kulipa wind-down (Ready post 2026-07-29). https://thedefiant.io/converge/cefi/ready-shuts-card-program-after-issuer-winds-down
- CRS, "The Stablecoin Yield Debate". https://www.congress.gov/crs-product/IF13174
