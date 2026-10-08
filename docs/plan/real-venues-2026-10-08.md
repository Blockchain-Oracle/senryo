> **SUPERSEDED by the prediction-market pivot (D-256, [pivot-2026-10-08.md](pivot-2026-10-08.md)).** Kept for history only; don't build from it.

# Senryo — real trading on Monad (mainnet + testnet), rebuilt on existing protocols

## Context

On 8 Oct the user tested TestFlight and hit five problems:
- Face ID kept opening the password manager.
- A Practice XAG trade failed with "The account, network or app state changed".
- The Card tab said "Card issuer not answering".
- Card funding opened an external Ramp page.
- Testnet "deposit from another chain" let them pick USDC, then dead-ended on "Mainnet only".

The core complaint: *"we can't even run a trade… it doesn't feel like a trading app… how do we define it?"*

They asked for:
- **Real integrations of existing protocols.** Don't reinvent the wheel, and don't make them the house funding a liquidity pool. Testnet pool funding is fine.
- Real trades **on both Monad mainnet and testnet**.
- Thorough online research before building, with the old roadmap folded in.

Constraint: it's Monad's Metropolis hackathon. Submissions close 14 Oct 03:59 UTC. Agora's $10K "Best Mobile Trading App" requires Mera auth, a visible AUSD balance, and at least one trade executed through Perpl.

### Already fixed (committed on `codex/senryo-unified`, not yet on the phone)
- **`e31d387` (D-255), Face ID instead of the password manager:**
  - Step-up (sends, over-cap trades, card limits, recovery) now reads the Face ID-gated key. The passkey sheet is only a fallback.
  - Every Face ID/passkey prompt waits for iOS to report the app `active` before signing. Root cause of the failed trade: the post-sign safety check ran while iOS was still `inactive` after Face ID.
  - 34/34 account checks pass.
- **`6316f36`, card error states:**
  - Card errors are named by cause. The reported case was the app being on Mainnet while the card service only runs in Practice; the service answered 400 and the app showed "issuer not answering".
  - API sign-in is single-flight. A network switch used to fire about 5 parallel sign-ins, stacking unlock prompts.
- Testnet keeper topped up with 1.2 MON (tx `0xf668af90…`). It burns about 2 MON/day, so it has roughly 1 day left.

## Research findings (verified live 8 Oct; full reports in the agent outputs)

| Venue | Network | Markets | Collateral | How you trade | Status / dependency |
|---|---|---|---|---|---|
| **Perpl** | Monad mainnet + testnet | Crypto perps. Mainnet: 11 (BTC, ETH, SOL, MON, HYPE…). Testnet: 8 | AUSD (testnet faucet pays **10,000 AUSD per call, for any address**, about 997M left) | Direct `execOrder` from the user's own wallet (no permission). Optional API keys are gasless (Perpl pays) and enable TP/SL, but need our Origin whitelisted and `allowOrderForwarding` | Live. Testnet book has a real market maker. Adapter already in the app. Required by the Agora bounty |
| **HelloTrade** | **Monad** mainnet + testnet (staging) | **Gold, silver, US stocks/ETFs** (XAU, XAG, NVDA, TSLA, AMZN, SPY, QQQ…; 16 on testnet) + BTC/ETH/SOL. No FX | USDC on Monad (testnet: their `UsdcMock`, owner-mint only) | **Gas-free.** EIP-191 sign-in, EIP-712 orders and withdrawals, ERC-2612 permit deposit. Cross or isolated margin. $5 minimum | Live: about $783K USDC in the mainnet vault, active book. **Invite-gated:** each wallet applies a referral code with one signed call. Co-founder is a listed Metropolis mentor. No SDK, but REST/WS is documented |
| Hyperliquid `xyz` (HIP-3) | Off-Monad | Gold $102M/day, silver $233M, S&P $218M, oil, stocks, FX (thin) | USDC. Monad → Hyperliquid in one transaction via Relay or Circle CCTP | Agent key, gas-free; `@nktkas/hyperliquid` supports React Native 0.86 | Self-serve. **Testnet faucet only for wallets that deposited on mainnet**, and testnet books are thin |
| LeverUp | Monad | Crypto only in practice; its 52 real-world-asset pairs are listed but can't be opened | USDC/MON | Gas-free intents | Not useful for real-world assets |
| Monday Trade | Monad | **Perps shut down 8 May 2026** | — | — | Out |
| Drake | Monad | Crypto only | AUSD | Contracts; needs a Pyth key | Duplicates Perpl |
| KyberSwap / Kuru | Monad mainnet | Spot any token, incl. **XAUt0 (real gold)** | — | REST, no key | Already used for swaps |

**Infrastructure:**
- **Relay:**
  - Sends AUSD straight to a user's Monad wallet from about 60 chains. A $20 quote from Base costs about 0.19% and arrives in about 1 second.
  - **Adds MON for gas in the same deposit**, which fixes the zero-MON deadlock.
  - Deposit addresses already exist in the app; the API key is self-serve.
  - Its testnet doesn't cover Monad testnet.
- **Pimlico:**
  - Free gas sponsorship on Monad **testnet** and paid sponsorship on mainnet.
  - Works via EIP-7702, so users keep their own address.
  - Delegated wallets must keep 10 MON when sending MON.
- **Circle:**
  - CCTP domain 15 on mainnet and testnet.
  - Faucet: 20 testnet USDC every 2 hours.
- **Ramp:**
  - Production sells AUSD, USDC and MON on Monad.
  - Its demo environment has no Monad, so card purchases can't produce Practice tokens.
- **Chainlink:**
  - Monad mainnet has gold, silver and FX feeds.
  - Testnet has only BTC/ETH, which is why our keeper copies prices on testnet.
- **Test MON** is the scarce resource. Public faucets give about 1 MON per wallet per day.

**What the app actually does today:**
- On Mainnet, only Perpl trades.
- Funding is three manual steps.
- The Perpl ticket has no "pay with" and no MON top-up.
- Practice has two different test dollars, and Home doesn't count Perpl.
- Each venue has its own ticket, positions and wording. Cross vs isolated margin is never explained.
- The last over-the-air update to the phone was 4 Oct.
- The repo has never been pushed to GitHub.

## Product definition (the answer to "how do we define it")

**Senryo is a Monad trading app you open with Face ID.**
- **Your money:** dollars (AUSD/USDC) in your own wallet on Monad.
- **What you can trade, from one trading screen:**
  - **crypto perps on Perpl:** BTC, ETH, SOL, MON and more;
  - **gold, silver and US stocks on HelloTrade.**

  Both are real Monad order books with their own liquidity. Senryo is the app, not the house.
- **What you can deposit:**
  - any token from about 60 chains, which arrives as AUSD plus a little MON for fees;
  - a card purchase through Ramp;
  - any Monad token, which you can swap.

  The app moves dollars into whichever venue you trade, as part of the same confirmed order.
- **Practice is the same app on Monad testnet.** "Get test money" gives you test dollars on every venue in one tap.
- **Retained around the core:** spot tokens (including real gold, XAUt0), predictions, the Kinpaku card (sandbox), social.

**Leverage, shown on every ticket (filled with live numbers):**
1. "You put in $100. At 5× you control $500 of gold."
2. "Every 1% gold moves, you gain or lose about $5."
3. "If gold falls 18% to $3,380, this trade closes and you lose the $100 (isolated). That's the most you can lose."
4. "Opening costs about $0.10; funding is about $0.02/day."
5. "Auto-close: take profit at …, stop loss at …"

Margin mode is always stated, and cross mode says what it puts at risk.

**FX:** no Monad venue offers tradable FX perps, so Senryo doesn't pretend to.
- Practice: FX perps stay on our own testnet engine, clearly labelled "Practice market". We fund that pool with test tokens only.
- Mainnet: FX comes later via Hyperliquid `xyz`, or not at all. That's a stage-5 decision.
- There is no Senryo-run mainnet pool.

## Architecture

1. **Venue adapter interface** (`packages/query/src/venues/`; the chain side in `packages/chain`):
   - `markets()`, `quote(intent)`, `openOperation()`, `closeOperation(share)`, `protection()`, `positions()`, `fundOperation()`, `withdrawOperation()`, `capabilities` (margin modes, min size, TP/SL, gasless).
   - Every action returns the existing `MoneyOperation` (`packages/query/src/money-operation.ts`), so review, journal, unknown/recovered outcomes and receipts are reused, not rebuilt.
   - Adapters:
     - `perpl`: wraps the existing `packages/chain/src/perpl/*` and `packages/query/src/perpl-plan.ts`.
     - `hellotrade`: new; EIP-712/191 signing through the scoped signer; WS client.
     - `senryo-engine`: wraps the existing `useTicket` engine path; Practice only.
     - `hyperliquid`: later, behind the same interface.
2. **One ticket and one positions list** (`features/trade/`):
   - Merge `features/perpl/*` and the engine ticket into one shell. The venue supplies the facts (liquidation, fees, funding, margin mode).
   - Keep the keypad/ruler/`CloseBar`/risk explainer, `SlideToConfirm` and the `firstTradeBlocker` style of blocker chain.
   - The positions list badges each venue. Close supports partial and full, and "close & move money back" is one action.
3. **Funding composed into the order:**
   - If the venue balance is short, the ticket prepends legs:
     - swap to the venue's collateral (Kyber/Monorail on mainnet);
     - deposit (Perpl `createAccount`/`depositCollateral`; HelloTrade permit deposit);
     - top up MON for fees (D-245 `planNetworkFee`, now also wired into Perpl).
   - One review and one approval (session or Face ID per D-255).
4. **Signing policy** (`packages/account/src/policy/`):
   - Add HelloTrade EIP-712 domains (orders and withdrawals to self) and its EIP-191 sign-in format to the scoped allow-list.
   - Add Perpl `allowOrderForwarding`.
   - The same caps apply, and step-up goes to Face ID.
5. **Practice funding service** (`services/api`, new route `POST /v1/practice/fund`):
   - In one call it queues:
     - an Agora AUSD faucet call for the user (the faucet has a shared 60-second cooldown, so calls go through a queue);
     - a MON gas drip from the sponsor wallet;
     - HelloTrade test USDC from a treasury, if their team grants it;
     - our MockAUSD for the engine's FX.
   - Replaces the scattered claim/voucher/faucet/Perpl-faucet buttons with one "Get test money" button. Vouchers stay.
6. **Gas:**
   - Mainnet: Relay deposits carry MON; HelloTrade is gasless.
   - Practice:
     - First, a sponsored MON drip plus a faucet runbook.
     - Then Pimlico's free testnet sponsorship (Stage 5): a 7702 sponsored sender that runs every inner call through the existing `judgeAction` policy.
     - The keeper's price pushes are moved onto the same sponsorship.

## Work plan

**How the work runs (user rule):**
- One checkout (`/Users/abu/dev/hackathon/metropolis`, branch `codex/senryo-unified`).
- Stages run one at a time, in order. No git worktrees, no parallel feature branches, no parallel implementation agents. Read-only research agents only when needed.
- Each stage ends with its acceptance (see Verification). It is recorded in `docs/plan/` (a new stage file plus a STATUS pointer) and committed with only this session's files. Codex's unfinished uncommitted work stays in the checkout untouched.

### Stage 0: get today's fixes onto the phone, and start the outreach (day 1, first hours)
1. **Over-the-air update** of committed HEAD to the production channel (runtime 0.3.0; native dependencies unchanged since build 7).
   - Codex's uncommitted mobile files (`PredictionCard/Picker/List/Detail.tsx`, `CardIssued.tsx`) are unfinished, so they must not ship.
   - In the same checkout: `git stash push --include-untracked` only those paths, run `eas update`, then `git stash pop` straight away. Check the restore with `git status`.
   - Record the update group ID.
2. The user retests on the phone: Face ID approvals, a Practice XAG trade, and the Card tab.
3. Outreach messages that I draft and the user sends:
   - **HelloTrade**, via the Metropolis mentor portal (co-founder Kevin Tang is a listed mentor) or X/Discord:
     - a multi-use integration referral code for mainnet and staging;
     - a testnet `UsdcMock` drip.
   - **Monad DevRel**, for a hackathon testnet MON allocation.

   Optional: Perpl Discord for the API-key whitelist and a builder code.
4. Write the Practice keeper/MON runbook and record the 1.2 MON top-up in `docs/plan/ids-and-txs.md`.

### Stage 1: Perpl, complete on both networks (days 1–2)
1. Practice "Get test money" route (Architecture 5): Agora AUSD plus a MON drip.
2. Perpl ticket gains:
   - "pay with" (AUSD in the wallet, or a swap to AUSD on mainnet);
   - a MON fee top-up;
   - automatic `createAccount`.
3. Close offers "close & move back"; Perpl withdraw is reachable from the main Withdraw flow.
4. Home and the balance sheet count the Perpl balance and positions on both networks.
5. Fix the bugs from the trading map:
   - typed drafts lost at sign-up (keyed by "guest");
   - having to slide again after the risk explainer;
   - the risk explainer's per-network keys and venue-specific copy;
   - the close dead-end with no MON;
   - fill and position reads on the wrong network;
   - the dead "Mainnet only" code.
6. Prove it on public testnet with a script: fund → createAccount → open → partial close → full close → withdraw, with transaction hashes. Then the user runs the same journey on the phone.

### Stage 2: one trading experience (days 2–3)
1. Introduce the venue adapter interface (Architecture 1). Move the engine and Perpl onto it.
2. Build one ticket and one positions list (Architecture 2) to the 14-item checklist:
   - amount first, leverage with presets, live liquidation price and its distance;
   - TP/SL where the venue supports it;
   - every cost listed; margin mode stated;
   - honest order states, receipts and push notifications on fill/TP/SL/liquidation risk.
3. The 5-line leverage explainer is filled from venue data.
4. The UGLYCASH visual language, with components from 21st.dev first (memory rule). One simulator pass for the merged area.

### Stage 3: HelloTrade for gold, silver and stocks (days 3–4)
1. Build the adapter on the Stage 2 interface:
   - public market data WS (instruments, tickers, book, candles);
   - signed `referral/apply` during setup;
   - permit deposit;
   - EIP-712 orders, cancels and leverage;
   - execution reports and account summary;
   - withdraw;
   - the signing-policy entries from Architecture 4.
2. XAU, XAG and stock rows show live public data as soon as the adapter lands (read-only discovery). Trading turns on once access is granted (`GET /api/user/access-status`).
3. Verify on testnet (staging) with a script, then the user verifies on the phone.
4. Fallback: if no code has arrived by the start of this stage, build this stage as Hyperliquid `xyz` on mainnet instead (self-serve; Relay/CCTP funding; agent key). Practice gold/silver then stays on our engine.

### Stage 4: funding that matches the product (day 4)
1. **Add money:**
   - Mainnet:
     - "From another chain": a Relay deposit address that delivers AUSD plus MON for gas;
     - "Card": Ramp, presented in-app and labelled "Ramp handles card payment and ID";
     - "On Monad": receive.
   - Practice: "Get test money" first.
   - Other-chain rows are consistent per network. No clickable dead-ends: Practice explains that cross-chain deposits are a Mainnet feature.
2. "Deposit anything": any Monad token converts through the existing swap. Unsupported tokens are shown as such.
   - Add **Kuru** (Monad's on-chain spot order book; Flow API, no key; live XAUt0/USDC book at about 6 bps) as a swap route next to Monorail/Kyber.
   - The "Buy gold" spot path (XAUt0) routes through Kuru.
   - This also qualifies us for Kuru's $5K "consumer trading app on Kuru" bounty, which requires target users, evidence of demand and a retention plan in the submission.
3. Card tab copy separates the Kinpaku card (Practice sandbox) from buying crypto (Ramp).

### Stage 5: lower friction and the remaining roadmap (day 5, then continuing)
1. Pimlico 7702 sponsorship for Practice users and the keeper.
2. Perpl API keys (gas-free, TP/SL), once Perpl whitelists us. Their builder code is optional.
3. Decide on Hyperliquid `xyz` for mainnet FX and oil.
4. The UGLYCASH roadmap continues in order:
   - predictions: evaluate Hermes Trade (a live BTC up/down order book on Monad mainnet) against the own-contract plan, and resume the uncommitted 4C1b indexer work;
   - card lifecycle fixes;
   - profile, social, clubs;
   - website;
   - companion and delivery.
5. Submission:
   - push the repo public (user go-ahead);
   - demo video (≤3 min) with real trades on both networks;
   - pitch;
   - judge access and TestFlight link;
   - the Envio and Mera bounty fields.

## What only the user can do (no other blockers)
1. **HelloTrade access:** send the request I draft for a referral code and testnet USDC, via their mentor or Discord. This is the only external dependency on the gold/silver/stocks path, and there's a fallback by end of day 3.
2. **Test MON:** claim the daily faucets to the keeper/sponsor address, or ask Monad DevRel for a hackathon allocation. Faucets have bot checks I mustn't bypass.
3. **Real money for mainnet testing:** about $20–50 of AUSD/USDC and a little MON in your Senryo wallet to place real Perpl and HelloTrade trades for the demo.
4. **Go-aheads:** pushing the repo public to GitHub. Optionally, Perpl's whitelist and builder code through their Discord or form (not on the critical path).

## Verification
- **Source gates, checked by exit code:**
  - `pnpm --filter @senryo/account check` and `typecheck`;
  - mobile `pnpm typecheck`;
  - Biome on changed paths;
  - policy checks extended for the HelloTrade and Perpl allow-list entries.
- **Public-network scripts** in `scripts/drive`, recording real transaction hashes in `docs/plan/acceptance.md`:
  - Perpl on testnet: fund → open → partial/full close → withdraw;
  - HelloTrade on staging: access → deposit → order → close → withdraw;
  - the same on mainnet once the user has funded the wallet.
- **Phone:**
  - over-the-air updates for JS-only stages; a new TestFlight build only if a native module is added (none are planned);
  - the user runs the same journeys on both networks, and each result is recorded as "accepted on device" separately from "built".
- **Simulator:** one pass per merged area (dev workspace `pnpm dev:mobile`), no screenshot loops.
