# Judge guide

The fastest way through Senryo, what to look for per bounty, and what to do if your region or device can't run part of it.
Everything below runs on the live product; nothing is mocked.

## 1. Five minutes in Practice (Monad testnet, no real money)

1. Open **https://senryo.xyz** (any browser with a PRF passkey: iCloud Keychain, Google Password Manager, 1Password), or
   install the Android APK from the README.
2. **Create account** → one passkey prompt → pick a handle → accept the terms. No seed phrase, no extension, no gas.
3. **Get P$100** (setup step, or Add money → Get practice money). The claim is relayed by the sponsor; you sign, you
   don't pay fees.
4. **Markets → XAU → Long.** Enter P$10, leverage 5×, and **slide to long**. The outcome screen waits for the finalized
   block, then shows size, entry and liquidation price.
5. Open the position: add a **take-profit / stop-loss**, **reduce 50 %**, then **slide to close**.
6. **Home → clock (Activity):** every step above, with explorer links.
7. **Try a trade above the session cap** (P$100 at 10×): it asks for the passkey once instead of failing.

Gold, silver and FX follow their real market hours. Outside them the ticket says when the market reopens. Crypto on Perpl
trades around the clock (Mainnet, §3).

## 2. The stateless test (Mera)

Sign out (Profile → Settings → Sign out), clear the site's storage or reinstall, then **I have an account** → the same
passkey → the same address, positions and history, rebuilt from the chain and the indexer. Nothing about the account
lives on a Senryo server.

## 3. Mainnet: Perpl (Agora Mobile Trading)

Switch to **Mainnet** with the mode pill on Home. Markets → **BTC** (or ETH, MON, SOL …) → Long or Short. The first
trade moves AUSD from your wallet into a Perpl account, then places an immediate-or-cancel order, and the outcome shows
the fill decoded from Perpl's own event.

To fund a judge account, redeem a **voucher code** in Add money → Redeem a code. *(Codes are issued to the judges'
contact before submission; each carries enough AUSD for Perpl's 10 AUSD minimum plus MON for fees.)*

**Geo-blocked from Perpl** (US, UK and the other regions Perpl blocks): use watch mode (§5) and the demo video, which
shows the Mainnet trade end to end with its transaction hashes.

## 4. Moving money (Aurora, any asset)

- **Add money → From another chain:** pick the asset and the source chain; Senryo shows a deposit address and QR, then
  tracks Waiting → Bridging → Arrived. Routes: Relay, Circle CCTP v2, Across, and Aurora / NEAR Intents for Bitcoin, TON
  and Tron. *(Aurora's Monad routes are subject to Aurora's own incident status; the app shows it live.)*
- **Withdraw:** any asset you hold, to a Monad address, an exchange, or another chain.
- **Swap:** any token for any other (Mainnet), with the price-impact rule (warns over 1 %, blocks over 5 %).

## 5. Watch mode (no account needed)

Any public account, read-only, on the network in the link. A Practice example:

https://senryo.xyz/watch/?address=0x17f356db5f7ffc1aed64d9bfc38e19f1633504e1&chainId=10143

## 6. Indexer (Envio)

Public GraphQL: `https://indexer.senryo.xyz/v1/graphql`. Try:

```graphql
{ Fill(limit: 5, order_by: { timestamp: desc }) { chainId txHash market { id } user { id } timestamp } }
```

Config, schema and handlers: [`indexer/`](../indexer).

Live counts per network, read in the browser from this endpoint (accounts, trades, traded notional, a daily chart) and
from the pool contract (pool value): https://senryo.xyz/stats/

## 7. Known limits, stated plainly

- Practice swaps test AUSD ↔ test USDC at par (a testnet contract, no market); every other pair swaps on Mainnet.
- Bank cash-out through Ramp waits for Ramp to enable the off-ramp key; buying with a card works.
- Add to Apple Wallet is locked: it needs Apple's provisioning entitlement.
- *(This section is updated as acceptance runs land before submission.)*
