# Company and real integrations: getting a real card (and everything else) without a registered company

**Researched 2026-09-29.** Evidence rules: [../06-research/README.md](../06-research/README.md). Every fact has a source URL; everything was fetched on 2026-09-29 unless another date is given. Items not confirmed in a primary source are marked **(unverified)**.
Builds on: [deep-dive-stablecoin-cards.md](../06-research/deep-dive-stablecoin-cards.md) (issuer landscape), [codex-evaluation.md](../07-decision/codex-evaluation.md) (card authorization design, section A), and [platforms-and-stores.md](../08-integrations/platforms-and-stores.md) (store policy).

**Framing.** No obstacle here is treated as a wall. For each one we record how others got past it and which route this team can use now.

---

## 0. Answer first

**A real card integration with no company is possible today. There are three independent routes, and the team can run all of them this week:**

1. **Immersve on Monad (a real issuer that supports Monad, with public sandbox keys).** Immersve is a **Mastercard principal member**. It has deployed its funding contracts on **Monad mainnet and Monad testnet**, and it publishes **public sandbox partner credentials** that anyone can use. So the team can create cardholders, deposit Monad-testnet USDC from our vault, issue a test card and run simulated payments today, with no sign-up. Sources: [supported chains](https://docs.immersve.com/guides/supported-chains), [Monad addresses](https://docs.immersve.com/guides/monad), [public sandbox account](https://docs.immersve.com/resources/public-sandbox-account), [home page](https://immersve.com/).
2. **Borrow-in-swipe against a real issuer processor, self-serve: Lithic.** Lithic gives every sign-up a free sandbox API key. Its real-time authorization webhook (**Auth Stream Access, ASA**) is *"self-serve"* in sandbox: a simulated Visa or Mastercard authorization calls our endpoint, and our endpoint can run the Monad borrow before it answers. Lithic has been **Rain's processing partner since 18 Sep 2025**. Sources: [Lithic API key](https://docs.lithic.com/docs/get-api-key), [ASA](https://docs.lithic.com/docs/auth-stream-access-asa), [Rain × Lithic](https://www.lithic.com/blog/rain).
3. **A real, spendable card for a real person, no company and no KYC: Laso Finance.** One x402 HTTP call paid in USDC on Base or Solana returns a real prepaid card number, expiry and CVV. It has *"No Laso account, API key, or sign-up"*. Laso says it is a FinCEN-registered MSB, and the international card can be added to Apple Pay or Google Pay. Our app would draw borrowing power from the Monad vault, bridge it to Base with Aurora Intents, and buy the card. Sources: [Laso x402 guide](https://laso.finance/guides/issue-a-virtual-card-with-one-x402-call), [Laso home](https://laso.finance/).

**What still needs a company:** our **own** card program with our own BIN relationship (Rain, Reap, Bridge/Stripe, Immersve live). Every one of them runs KYB on the partner. The same entity also unlocks Apple/Google **organization** developer accounts, which crypto and financial apps need for public store release (see §3). The fastest entity routes are in §2. A UK Ltd costs **£100 and is "usually registered within 24 hours"** ([GOV.UK](https://www.gov.uk/limited-company-formation/register-your-company)).

**A precedent that shows the path works:** at the Monad **Mobil3** hackathon (Aug 2025), "Monad Pay" issued a virtual card for every user through **Stripe Issuing sandbox**. Stripe's real-time authorization webhook gave it 2 seconds, and it waited for Monad finality before approving. The team had formed a UK Ltd (Companies House NI732549) and reports *"approval from Stripe to go live"*. That last point is the team's own claim (unverified). Sources: [README](https://github.com/the-pines/monad-pay), [0x showcase, 2025-09-11](https://0x.org/post/monad-mobil3-hackathon-bounty-showcase).

---

## 1. Card issuing without a company: platform by platform

Legend: **Indiv.** = can an individual (no company) get access? **Sbx** = self-serve sandbox? **Real card** = can a real, spendable card reach a person?

| Platform | Indiv. | Sbx | Real card to a person | KYB | Time / cost | Monad / EVM | Apple / Google Pay |
|---|---|---|---|---|---|---|---|
| **Immersve** (Mastercard principal, NZ) | **Yes for test**: public sandbox creds, no sign-up ([link](https://docs.immersve.com/resources/public-sandbox-account)). Own creds: *"Contact support"* ([guide](https://docs.immersve.com/guides/web3-wallet-card-issuing-integration)) | **Yes** (public keys; may be *"revoked at any time"*) | Live requires partner onboarding; KYB likely **(unverified)** | Live: probably **(unverified)**. Cardholder KYC can be **Immersve-conducted** (hosted) | Test: minutes. Live: not published | **Monad mainnet `0xcfCD…FE1a` and testnet `0x1754…2086`**, Universal EVM protocol. Deposit **and approval** funding on Monad; custodial webhook billing **not** on Monad ([funding protocols](https://docs.immersve.com/guides/funding-protocols)). Tokens: USDC, USDT, vmUSD | **Apple Pay in-app provisioning** via its API (needs Apple entitlement). Google/Samsung: manual add; push is *"soon"* ([xPay guide](https://docs.immersve.com/guides/add-card-to-xpay-wallet/)) |
| **Lithic** (issuer processor; Rain's processing partner) | **Yes for sandbox**: *"Each account comes with a Sandbox API key"*. The sign-up form may ask for a company name **(unverified)** | **Yes, free.** ASA enrollment *"self-serve"* | Production: *"contact Sales"* | Yes for production | Sandbox: minutes. ASA deadline **6 s hard, <3 s recommended** | Chain-agnostic (our backend does the Monad leg). Visa and Mastercard test BINs | Production digital wallets supported **(unverified for our case)** |
| **Stripe Issuing** | Test mode is **instant if the account is in the US, UK or certain EU countries** ([Stripe support](https://support.stripe.com/questions/how-to-apply-for-issuing)). Sole-prop Stripe accounts exist in the US and UK **(unverified for Issuing)** | **Yes** for those countries | Live: form + Sales review; *"commercial use cases in the US, the UK and … EU"*. Atlas users need a US address and US-based cardholders | Yes (live) | Test: minutes. RTA webhook **2 s** ([docs](https://docs.stripe.com/issuing/controls/real-time-authorizations)) | Chain-agnostic. Stablecoin-backed cards via Bridge are private preview | Apple/Google/Samsung Pay: manual, in-app push and web push ([Issuing docs](https://docs.stripe.com/issuing)) |
| **Bridge (Stripe) cards** | Sandbox keys *"self-serve in dashboard after support@bridge.xyz onboards you"* (see deep-dive) | Partly. Needs a Stripe **Sandbox** (not Test Mode) linked by `POST /v0/cards/enable` ([Bridge sandbox](https://apidocs.bridge.xyz/platform/cards/sandbox/sandbox)) | Live: 6–8 weeks | Yes | n/a | Noncustodial cards: Tempo, Solana, Base, World Chain, Linea. **Not Monad** (Monad USDC for ramps only) | Via Stripe |
| **Rain** (Visa principal; Monad since 2026-05-12) | Not self-serve. Docs and sandbox come *"once… a mutual NDA is in place"*, *"on request"* ([launch page](https://www.rain.xyz/resources/launch-a-card-program-with-rain)). **Hackathon precedent:** individual engineers built on Rain at the **Raingentic Commerce Hackathon** (NYC, 8–9 Aug 2026), which Rain co-hosted with Monad Foundation ([Luma](https://luma.com/encode-2gj9), [results](https://medium.com/encode-club/raingentic-commerce-hackathon-nyc-2026-8cbea2addbc9)) | On request | Needs a signed program | *"company formation documents… UBOs"* | ~6 weeks typical | **Monad supported** | Rain-specific push provisioning **(unverified)** |
| **Rain Agentic Startup Program** | **No.** For *"venture-backed startups"* with an institutional pre-seed or later round. KYB after admission. 5 startups per cohort, $5,000 spending credit. Cohort 2 runs Nov 2026–Jan 2027, applications *"opening in October"* ([program page](https://www.rain.xyz/agentic-startup-program), [X, 2026-07-07](https://x.com/raincards/status/2074479556233220598)) | Via program | Yes, after KYB | Yes | 10 weeks | Monad supported | n/a |
| **Reap** (Visa principal, HK and MX) | Sandbox: *"Contact the Reap team to get your sandbox credentials"* ([quickstart](https://docs.reap.global/quickstart)). A dashboard sign-up exists at dashboard.reap.global/register; whether it grants sandbox keys is **(unverified)** | On request. Simulates auth, clearing, refund, decline, 3DS, fraud, and **external authorization** ([sandbox](https://docs.reap.global/transactions/testing-in-sandbox)) | After KYB | *"You complete KYB"* ([card issuing](https://reap.global/products/card-issuing)) | *"2 to 3 months after KYB"*; fast teams in 2 weeks | Base, Polygon, Solana. Not Monad | *"Apple Pay and Google Pay provisioning from day one"* |
| **Marqeta** | **Yes**: a free Marqeta.com account gives a *"public sandbox"* ([docs](https://www.marqeta.com/docs/developer-guides/marqeta-account-management)) | **Yes**, including **Gateway JIT Funding** (real-time funding webhook) ([JIT guide](https://www.marqeta.com/docs/developer-guides/configuring-gateway-jit-funding)) | Enterprise contract | Yes | Sandbox: minutes | Chain-agnostic | Enterprise |
| **Highnote** | Test environment via *"Create a Highnote account"* ([docs](https://docs.highnote.com/docs/get-started/about-highnote)); live is contract-gated ([apis.io](https://apis.io/providers/highnote/)) | Yes (test) | Contract | Yes | n/a | Chain-agnostic | n/a |
| **Paymentology Sprint** | Developer portal: *"Create an account… Access Paymentology's Sprint sandbox"* ([portal](https://developer.sprint.paymentology.com/)) | Yes (per portal) | Contract | Yes | n/a | Chain-agnostic | Tokenization API exists |
| **Galileo (SoFi)** | Historically an open sandbox ([PaymentsJournal](https://www.paymentsjournal.com/galileo-financial-technologies-powerful-apis-and-a-penchant-to-reduce-card-fraud-losses-drive-this-fast-growing-fintech-provider/), undated). Current status **(unverified)** | **(unverified)** | Contract | Yes | n/a | Chain-agnostic | n/a |
| **Baanx** (MetaMask Card's platform) | Keys come *"from your technical account manager"* ([OAuth quickstart](https://docs.baanx.com/guides/oauth/quickstart)) | No | Contract | Yes | n/a | Delegation on **Linea, Ethereum, Solana** ([delegation](https://docs.baanx.com/guides/delegation/overview)) | n/a |
| **Gnosis Pay** | No. Now a B2B programme manager issuing with Monavate. The consumer card and web app wind down (**20 Dec 2026**) ([blog, 2026-09-03](https://gnosispay.com/blog/gnosis-pay-the-next-era)) | No | Via partner apps (Rebind, MiniPay, Picnic) | Partner contract | n/a | Gnosis Chain (see below) | n/a |
| **Holyheld / BRRR** | SDK and API keys *"issued during the partner onboarding process"* ([FAQ](https://docs.brrr.network/docs/faq)) | SDK test tag `$SDKTEST` with real onchain txs and no fiat ([testing](https://docs.brrr.network/docs/testing)) | Tops up an existing Holyheld card (EUR) | Partner onboarding | n/a | Many EVM chains. **Not Monad** ([networks](https://docs.brrr.network/docs/supported-networks)) | Holyheld card supports Apple/Google Pay ([Alchemy listing](https://www.alchemy.com/dapps/holyheld)) |
| **Kulipa** | **Dead.** Ceased operations 29 Jul 2026. Earlier, on 29 Dec 2025, the Bank of Lithuania ordered Monavate to stop servicing it. ~120,000 cards stopped ([Paymentscan](https://paymentscan.xyz/issuers/kulipa)). Solflare paused its card and announced a new-issuer replacement ([Solflare](https://www.solflare.com/blog/cards-service-pause/)) | n/a | n/a | n/a | n/a | n/a | n/a |
| **Laso Finance** (prepaid, not issuing-as-a-service) | **Yes.** *"the paying wallet is the identity"* | **No sandbox**; mainnet only, $5 minimum US card | **Yes**: US card $5–$1,000, US merchants only, non-reloadable, 0% fee. International card $100–$1,000 + 3.8%, human-fulfilled, usually within 24 h ([guide](https://laso.finance/guides/issue-a-virtual-card-with-one-x402-call)) | None for the card buyer | Seconds (US) | Pays in **USDC on Base or Solana** (bridge from Monad) | International card: Apple/Google/Samsung Pay ([home](https://laso.finance/)) |

### 1.1 Card-as-a-feature: can an existing programme be the issuer for our app?

- **Gnosis Pay, funded from a Monad vault.** Technically yes: a Gnosis Pay account is a Safe on Gnosis Chain, and any bridge can top it up. But the consumer card is being retired (20 Dec 2026), and future accounts live inside **partner apps** ([blog](https://gnosispay.com/blog/gnosis-pay-the-next-era)). To be the app ourselves, we would become a partner (B2B contract). Not a no-company route.
- **Holyheld SDK.** Built for this: a third-party app moves a user's tokens into *their* Holyheld card via `$holytag` ([FAQ](https://docs.brrr.network/docs/faq)). It needs an SDK API key from partner onboarding, it settles in EUR, and Monad is not a listed source chain. It is a plausible "top up your own card" feature once the key is granted **(unverified: whether individuals get SDK keys)**.
- **Baanx OAuth.** Baanx's docs list *"Third-party Apps: Integrate with existing Baanx accounts using OAuth 2.0"* ([intro](https://docs.baanx.com/guides/introduction)). A third-party app could therefore read and act on a user's Baanx-backed card account with consent. Keys come from a Baanx technical account manager. Whether MetaMask Card accounts are exposed to third parties is **(unverified)**.
- **User brings their own card (no integration contract).** MetaMask Card (via Money Account) spends on Monad (see deep-dive §1.2: MetaMask Card on Monad since 12 Mar 2026; Money Account is Monad-exclusive, [Monad blog](https://monad.xyz/blog/metamask-money-account-launches-on-monad)). Our vault can pay "free to spend" USDC into the user's own wallet, and their existing card then spends it. That is real merchant spend with zero integration, but it is not *our* card. Whether a transfer from our contract lands in a MetaMask Card spendable balance on Monad is **(unverified)** and needs one test.
- **Laso x402.** This is "card-as-an-API-call" for anyone. It is the only fully permissionless route to a real card we found.
- **Rain partners as sub-issuers.** No public white-label-of-a-white-label offer was found. Rain's model is direct partner programs.

### 1.2 How others got past "we're not a company yet"

| Who | What they did | Source |
|---|---|---|
| Monad Pay (Mobil3 bounty winner) | Stripe Issuing sandbox for the demo; formed a UK Ltd; Stripe webhook plus Monad finality | [GitHub](https://github.com/the-pines/monad-pay) |
| Raingentic hackathon teams (35 projects) | Rain provided *"scoped virtual cards"* to participants at a Rain + Monad co-hosted event; winners used Rain cards with Monad settlement | [Encode results, 2026-08-12](https://medium.com/encode-club/raingentic-commerce-hackathon-nyc-2026-8cbea2addbc9) |
| Immersve | Publishes shared sandbox credentials so anyone can integrate before contracting | [public sandbox](https://docs.immersve.com/resources/public-sandbox-account) |
| Lithic, Marqeta | Free self-serve sandbox; commercial contract only for production | [Lithic](https://docs.lithic.com/docs/sign-up), [Marqeta](https://www.marqeta.com/docs/developer-guides/marqeta-account-management) |

---

## 2. Fastest legal-entity routes (the user's country is not assumed)

| Route | Time | Cost | Works for non-residents? | Banking | Notes |
|---|---|---|---|---|---|
| **UK Ltd (Companies House)** | *"usually registered within 24 hours"* (online) | **£100** online (£124 by post) ([GOV.UK](https://www.gov.uk/limited-company-formation/register-your-company)) | Yes. Since **18 Nov 2025** every director and PSC must **verify identity**, either directly (free) or through an authorised agent (ACSP) ([GOV.UK IDV](https://www.gov.uk/guidance/verifying-your-identity-for-companies-house), [TLT](https://www.tlt.com/insights-and-events/insight/we-have-a-date---identity-verification-and-statutory-register-reforms)) | Wise Business, UK EMIs **(unverified per country)** | Unlocks **Stripe UK** (Issuing test mode is instant for UK accounts). The Monad Pay precedent used this route |
| **Stripe Atlas (Delaware C-corp or LLC)** | *"Within two business days"* | **$500** one-time. Refunded after a $5,000 Stripe Treasury deposit ([Atlas](https://stripe.com/atlas)) | Yes | Mercury (see restrictions), Stripe | Stripe Issuing for Atlas companies needs a US address and US-based cardholders ([Stripe support](https://support.stripe.com/questions/how-to-apply-for-issuing)) |
| **doola (LLC)** | ~1 week, avg ~4 weeks without SSN ([doola](https://www.doola.com/blog/llc-for-non-us-residents/)) | Starter **$297/yr** + state fee ([doola cost page](https://www.doola.com/blog/how-much-does-it-cost-to-start-an-llc/)) | Yes | Partner banks | |
| **Firstbase** | n/a | $399 formation; registered agent $299/yr; Form 5472 $899/yr ([pricing](https://www.firstbase.io/pricing), [comparison, Sep 2026](https://www.form5472.online/post/launchusa-vs-doola-vs-firstbase-llc-cost-2026)) | Yes | Partner banks | |
| **Clerky (Delaware C-corp)** | Delaware filing; expedite options ([help](https://help.clerky.com/article/2820-formation-timeline)) | **$427** incorporation ([pricing](https://www.clerky.com/pricing)) | Yes | n/a | VC-standard paperwork |
| **DIY Wyoming LLC** | Days | ~$100–150 state + agent ([taxhavendirectory](https://taxhavendirectory.com/blog/stripe-atlas-vs-us-llc-non-residents), secondary) | Yes | Wise, Relay **(unverified)** | |
| **Estonia e-Residency (OÜ)** | Card pickup **2–5 weeks** after a ~30-day identity check | **€150** state fee (**€165 from 1 Jan 2027**) + OÜ registration (~€265 per secondary sources) ([e-Residency](https://www.e-resident.gov.ee/become-an-e-resident/), [2026 changes](https://www.e-resident.gov.ee/blog/posts/changes-to-e-residency-in-2025-and-beyond/)) | Yes; card pickup at an embassy or collection point | EU EMIs | Slowest; an EU entity |
| **UAE free zone** | Meydan: *"licensed in as little as 60 minutes"* ([Meydan](https://www.meydanfz.ae/blog/low-cost-business-setup-in-dubai)) | From ~AED 12,500 (IFZA/Meydan); Ajman/UAQ/Sharjah ~AED 4,800–6,500 ([Commenda](https://www.commenda.io/blog/cheapest-free-zone-in-uae), [Juriszone](https://juriszone.com/cheapest-free-zones-in-the-uae-2025/)) | Yes | UAE banks are slow for non-residents **(unverified)** | Useful for VARA-adjacent plans |
| **Nigeria (CAC), if a founder is there** | Ltd **5–10 working days** ([Nairaland guide](https://www.nairaland.com/8662328/cac-registration-nigeria-2026-full), secondary) | ~₦30,000 for a Ltd ([Siiqo](https://siiqo.com/blog/cac-registration-2026-full-cost-timeline-steps), secondary) | Residents | Local banks | Good enough for Apple and Google **organization** accounts (any legal entity with a D-U-N-S). Issuer KYB acceptance of Nigerian entities is **(unverified)** |

**Banking caveats (primary sources):**
- **Mercury** requires a US-formed company, and it **cannot serve founders residing in Nigeria** (and others). The list is based on residence, not citizenship ([eligibility](https://support.mercury.com/hc/en-us/articles/28770467511060-Eligibility-and-requirements-for-opening-a-Mercury-account), [prohibited countries](https://support.mercury.com/hc/en-us/articles/28771710754580-Prohibited-countries)). Mercury also won't open accounts for **MSBs or crypto exchanges**, though it *"supports many crypto and Web3 businesses"*.
- **Wise Business** accepts US LLCs owned by non-residents, with stricter KYC in 2026 ([Wise](https://wise.com/gb/blog/how-to-open-a-us-bank-account-for-llc-as-a-non-resident), [James Baker CPA](https://jamesbakercpa.com/blog/open-wise-non-us-resident-2026-guide/)). Country-by-country acceptance is **(unverified)**.

**D-U-N-S number (free route and timing):**
- Apple: look up or request a **free** D-U-N-S through Apple's tool. Allow **up to 5 business days** from D&B plus **up to 2 business days** for Apple to receive it. Expediting doesn't help. Sole proprietorships and DBAs are rejected; the business must be a legal entity ([Apple D-U-N-S](https://developer.apple.com/help/account/membership/D-U-N-S/)).
- Organization enrollment also needs a domain email, a working public website and binding authority; **$99/yr** ([Apple enroll](https://developer.apple.com/programs/enroll/)).
- Google: D-U-N-S is free from D&B, and *"the process can take up to 28 days"* ([Google help](https://support.google.com/android-developer-console/answer/16561738?hl=en)). Using Apple's lookup tool first often yields the same number sooner (common practice, **(unverified)** as a guarantee).

---

## 3. App distribution as individuals

**Apple individual account ($99/yr, no D-U-N-S):**
- **TestFlight internal:** no review. Up to 100 App Store Connect users; builds last 90 days (see [platforms-and-stores.md](../08-integrations/platforms-and-stores.md), [TestFlight overview](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/)). This works for an individual account, so judges can be added as App Store Connect users.
- **TestFlight external / public link:** up to 10,000 testers. *"The first build you submit requires a full review"* (TestFlight App Review) ([external testers](https://developer.apple.com/help/app-store-connect/test-a-beta-version/invite-external-testers)).
  - At that review, guideline **3.1.5(i)** (wallets must come from developers *"enrolled as an organization"*), **5.1.1(ix)** (financial apps *"should be submitted by a legal entity"*) and **3.1.5(iv)** (crypto futures from approved institutions) apply ([platforms-and-stores.md §4](../08-integrations/platforms-and-stores.md)).
  - An individual account shipping a crypto trading build externally is therefore likely to be rejected (our inference, **(unverified)** until tried).
- **Apple Pay in-app provisioning entitlement:** production Team ID only, requested by the Account Holder ([platforms-and-stores.md](../08-integrations/platforms-and-stores.md)). In practice it follows an issuer partnership (Immersve documents the PassKit flow).

**Google Play personal account:**
- **Still current (page read 2026-09-29):** personal accounts created after 13 Nov 2023 must run a closed test with **≥12 testers opted in for 14 continuous days** before production ([Play help](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)).
- **Internal testing** has *"None"* as its access requirement, so it works immediately for judges. Its size cap of about 100 testers is **(unverified today)**.
- For crypto: Play's account-type rule tells developers of *"cryptocurrency software wallets, and cryptocurrency exchanges"* to use an **Organization** account ([Play account types](https://support.google.com/googleplay/android-developer/answer/13634885?hl=en)). Non-custodial wallets are out of scope of the country licensing table (platforms-and-stores §4).

**APK sideloading:**
- Remains a full channel. **Android developer verification** starts on **30 Sep 2026 only in Brazil, Indonesia, Singapore and Thailand**. The first phase verifies installs *from listed app stores* (Google Play, Galaxy Store, Xiaomi GetApps, etc.), and it expands globally in **2027** ([Google help](https://support.google.com/android-developer-console/answer/16561738?hl=en)).
- A **free "limited distribution" account** allows unlimited apps on **up to 20 devices without a government ID**. A full account is $25. ADB installs are unaffected.
- Outside those four countries, EAS `preview` APKs install as before.

**Web:** the Expo web build needs no store at all. Mera passkeys work in Safari 18+ and in Chrome with Google Password Manager (platforms-and-stores §0).

---

## 4. Everything else that needs no company

| Integration | Individual OK? | Evidence |
|---|---|---|
| **Mera** (passkey accounts) | **Yes.** Open-source library, dual **MIT / Apache-2.0**, no backend or keys | `references/mera/LICENSE-MIT`, `LICENSE-APACHE` (local clone); [mera.md](../08-integrations/mera.md) |
| **Perpl** | **Yes, technically.** No KYC. Direct onchain path needs only `createAccount`; the API path uses an Ed25519 key enrolled by a wallet signature ([agora-ausd-and-perpl.md](../08-integrations/agora-ausd-and-perpl.md)). **Caveat:** Perpl's terms bar *"persons… in the United States"*, sanctioned territories and their citizens ([Perpl terms](https://perpl.xyz/terms-of-use)). Geofence those users | |
| **AUSD** | **Yes to hold and use.** Buy on DEX (AUSD/USDC Uniswap v4 ~$3.9M liquidity). The Agora staging API is closed (Cloudflare Access) and the bounty needs only the token (agora-ausd-and-perpl.md). Direct mint/redeem is *"built for institutions"* ([Agora docs](https://docs.agora.finance/)) | |
| **Aurora Intents** | **Yes.** studio.aurora.dev: *"Permissionless… API keys are issued immediately"* ([aurora-intents.md](../08-integrations/aurora-intents.md)) | |
| **Envio** | **Yes.** Free Development plan (100k events, 30 days); self-hosting allowed under its EULA ([envio.md](../08-integrations/envio.md)) | |
| **Chainlink Data Feeds** | **Yes.** Public onchain reads; live on Monad mainnet ([changelog](https://dev.chain.link/changelog/data-feeds-expands-to-monad-mainnet)). **Data Streams** need Chainlink credentials. **CRE deploy** needs approval via `cre account access`, with review by email; simulation is free ([CRE deploy access](https://docs.chain.link/cre/account/deploy-access)) | |
| **Pyth** | **Yes to sign up, but paid for mainnet data.** Since the **31 Jul 2026** Core upgrade, *"accessing any Pyth Price Feeds API will require a Pyth data plan"*. Starter is **$500/mo**, U.S. Equities $5,000/mo, Metals $2,500/mo. A free trial is included, and testnets are available ([Pyth blog](https://www.pyth.network/blog/the-pyth-core-upgrade), [upgrade guide](https://docs.pyth.network/price-feeds/core/upgrade/preparing)). **Route:** trial key for the build window, Chainlink feeds where they exist, and ask the Pyth sponsor contact for hackathon credits **(unverified availability)** | |
| **Coolify** | **Yes.** *"Free and open source"* self-hosted (Apache-2.0) ([GitHub](https://github.com/coollabsio/coolify)); see [deployment-coolify.md](deployment-coolify.md) | |

---

## 5. Recommended path to a REAL card integration

### Step 1: Immersve on Monad testnet (today, no company, no sign-up)
- Use the published public sandbox partner account (`https://test.immersve.com`). Read the credentials from [the page](https://docs.immersve.com/resources/public-sandbox-account) at runtime, and don't commit them.
- Create our own **Funding Channel** on **monad-testnet** with USDC `0x534b…43A3`, using the Universal EVM Funds Manager `0x1754AE802dCcc5bd4fe2d2b42ac01e2AB3552086` → `createFundsStorage(...)` ([Universal EVM](https://docs.immersve.com/guides/universal-evm-funding-protocol), [test tokens](https://docs.immersve.com/guides/obtaining-test-tokens/)).
- Flow: user login with a SIWE-style signature from the Mera EOA → **Immersve-conducted KYC** (test documents allowed; a real face is needed for the facial scan, [pass-KYC-in-test](https://docs.immersve.com/guides/pass-kyc-in-testmode/)) → **vault "free to spend" → ERC-20 transfer into the Funds Storage** (card top-up from borrowing power) → issue a virtual card → Payment Simulator purchase → settlement onchain on Monad testnet.
- **What this proves:** a Mastercard principal issuer settles against our Monad contracts. The same contract family is already on **Monad mainnet**.

### Step 2: Borrow-in-swipe on a real issuer processor (today, self-serve)
- Sign up at app.lithic.com and create a card on the **Visa test BIN** `card_program_token 00000000-0000-0000-1000-000000000000`.
- Enroll our authorization service as the **ASA responder**. Each simulated authorization then calls us, and we run the risk check → Monad borrow/hold → reply `APPROVED` or decline. Target **<3 s** end-to-end; the hard timeout is 6 s ([ASA](https://docs.lithic.com/docs/auth-stream-access-asa)).
- Log p50/p99. This gives the "authorization sandbox with timing" acceptance evidence named in codex-evaluation.md.
- Optional twin: the **Marqeta public sandbox** with Gateway JIT Funding, to show the design is issuer-agnostic.

### Step 3: A real card in a real hand, real merchant spend (days, no company)
- **Laso:** the vault releases free borrowing power → Aurora Intents bridges USDC Monad→Base (1Click quote) → the app's backend wallet pays `GET /get-card?amount=…` via x402 → card details shown in the app → buy something real.
- Constraints: US card works at US merchants only; the international card takes ~24 h and costs +3.8%; cards are non-reloadable ([guide](https://laso.finance/guides/issue-a-virtual-card-with-one-x402-call)).
- Label this honestly in the demo as *"prepaid card purchased from borrowing power"*, not our own BIN.
- **In parallel:** a team member's own **MetaMask Card** funded from the vault on Monad (one test transfer to confirm).

### Step 4: Form the entity and start the issuer track (start now; it runs in the background)
- **UK Ltd** (£100, ~24 h, directors verify identity) **or** **Stripe Atlas** ($500, two business days) if US banking matters. If a founder lives in Nigeria: Mercury is out, so plan on **Wise Business** or a UK EMI **(unverified)**, or use a CAC Ltd for the store accounts.
- **D-U-N-S** via Apple's free lookup (≤5 + 2 business days) → Apple and Google **organization** accounts (fixes 3.1.5(i)/5.1.1(ix) and the 12-tester gate).
- **Issuer applications with the entity:**
  - **Immersve** live partner credentials: its contracts are already on Monad mainnet, and it supports Apple Pay push.
  - **Rain** via warm intro: contact-us → NDA → sandbox → ask for **partner-managed authorization plus real-time funding on Monad**.
  - **Reap** sandbox (external authorization mode).
  - With a UK Ltd, also switch on **Stripe Issuing test mode** (instant for UK accounts).

### Step 5: Rain-specific fast lane
- Rain has already given individual hackathon engineers scoped cards at an event it **co-hosted with Monad Foundation** (Aug 2026).
- Ask Monad Foundation to broker the same **Rain sandbox access for a Metropolis team**. The Rain people who judged that event were **Ross Basri (Product Lead)**, **Farhan Khwaja** and **Juan Blanco**; **Charles Yoo-Naut** (Rain CTO) gave the keynote ([results](https://medium.com/encode-club/raingentic-commerce-hackathon-nyc-2026-8cbea2addbc9), [Luma](https://luma.com/encode-2gj9)).
- Rain's Agentic Startup Program (cohort 2 applications open in October) only fits once the team has an institutional round.

### Who to contact (Metropolis mentors; route: portal **Mentors** page, reviewed by organizers, plus [Monad dev Discord](https://discord.gg/monaddev))

| Person | Why | Source |
|---|---|---|
| **Jarrod Watts** (Monad Foundation, Lead AI Engineer) | Ran the Monad session and **judged alongside Rain staff** at the Raingentic hackathon. The warmest path to Rain | [results](https://medium.com/encode-club/raingentic-commerce-hackathon-nyc-2026-8cbea2addbc9), [mentor-profiles](../_portal/pages/mentor-profiles.md) |
| **Charles** (Monad Foundation Ecosystem, *"consumer and trading verticals"*) | Our exact vertical; can route to the MF payments team (Raj Parekh, deep-dive §4) | mentor-profiles |
| **Pareen** (MF Founder Initiatives) | Company formation and "where your startup will break" | mentor-profiles |
| **Arthur Firstov** (Mercuryo CBO) | Neobanks, stablecoin APIs, corridors. Sanity check on issuer choice and entity jurisdiction | mentor-profiles |
| **Stephen Edvi** (Blink.cash) | *"stablecoin payment infrastructure for consumer crypto apps"* | mentor-profiles |
| **Yash** (ether.fi) | ether.fi runs Rain + Reap borrow-to-spend (`BinSponsor {Reap, Rain, …}`) | mentor-profiles, deep-dive §2.3 |
| **Antons K.** (Crouton) / **Will Liao** (lawyer, Money in Motion) | EU/UK payments licences; stablecoin payments law | mentor-profiles |

### Message drafts

**A. To Jarrod Watts or Charles (portal Mentors page / Discord):**
> Hi Jarrod — we're a Metropolis team (Track 01) building a mobile trading app on Monad with one risk-accounted collateral vault, plus a card that spends *free* borrowing power: authorization → Monad borrow → approve, inside the issuer's window. We already run it against Lithic's sandbox auth webhook and Immersve's Monad testnet contracts. Rain is the issuer we want for the real thing (Monad-native, partner-managed auth). At Raingentic, Rain gave hackathon teams scoped cards. Could you introduce us to Ross Basri (or whoever ran builder access) so we can get Rain sandbox access for the rest of Metropolis? We're incorporating now, and a 3-minute Loom of the auth flow is ready. Thanks!

**B. To Rain (rain.xyz/contact-us, cc Ross Basri via the intro):**
> Subject: Monad card program — partner-managed auth + real-time funding on Monad
> We're building [app] on Monad: a trading app whose collateral vault backs card spend (borrow-to-spend, like ether.fi Cash). Requesting: (1) sandbox access now for Metropolis (Monad Foundation hackathon), (2) scoping for a consumer program with partner-managed authorization and real-time funding in USDC/AUSD on Monad. Entity: [UK Ltd / Delaware], formed [date]; UBO documents ready. Target markets: [list]. We can show p50/p99 authorization latency from our current sandbox harness.

**C. To Immersve support:**
> We're integrating Immersve's Universal EVM funding on Monad (testnet now, mainnet `0xcfCD…FE1a` next) using your public sandbox account. Could we get our own test partner account, Card Program ID and client application (allowed origin [domain])? We'd also like the requirements for live credentials (KYB jurisdictions, whether a newly formed UK Ltd qualifies, Apple Pay in-app provisioning), plus the region roadmap, since Nigeria and the US show as "coming soon".

**D. To Arthur / Stephen (portal Mentors page):**
> Quick sanity check from a Metropolis team: for a Monad trading + card app with a pre-seed-stage team outside the US, would you start with Rain (Monad-native, Visa) or Immersve (Mastercard, contracts already on Monad), and which entity jurisdiction do issuers accept fastest? We have sandbox flows running on both sides.

---

## 6. Open questions to close with one call each

- Can individuals get their **own** Immersve test partner account, and what KYB does Immersve require for live? (Step 1 works on public credentials meanwhile.)
- Does Rain's **real-time funding** beta, or its partner-managed auth, run on **Monad**? Public launch assets were Base/Arbitrum USDC and Plasma USDT0 (deep-dive §2.2).
- Does a transfer into a MetaMask Money Account / Card balance on Monad become card-spendable immediately?
- Does **Pyth** grant hackathon data-plan credits? Otherwise the trial covers the build window.
