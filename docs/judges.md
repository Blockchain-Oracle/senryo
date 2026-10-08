# Judge guide

Senryo is a mobile app for pair trading on Monad, predictions, money flows, Kinpaku and social discovery. Start with Practice. This guide distinguishes implemented journeys from accepted execution; the [current product brief](product/current-product.md) and [work register](plan/reference-followthrough-2026-10-04.md) hold the current evidence.

## 1. Get the mobile beta

The recorded iOS TestFlight release is **0.3.0 (7)**. An invitation is required; a public join link has not been verified. Request access at **support@senryo.xyz**. The README's Android APK is an older runtime 0.2.0 preview, not evidence of parity with the current iOS app.

The browser companion at **https://senryo.xyz** remains available. Passkeys need a PRF-capable authenticator such as iCloud Keychain, Google Password Manager or 1Password. The website introduces the native product rather than making the browser the primary install journey.

## 2. Practice on Monad Testnet

1. Browse as a guest, then **Create account** with a passkey. Complete the profile and review the presented terms before accepting them.
2. Select **Practice**. A new eligible account can claim **P$100** through setup or **Add money → Get practice money**. The starter claim is sponsored; funds have no cash value.
3. **Markets → Perps → Gold (XAU)**: open the trading ticket. For example, enter P$10 at 5× leverage and review the entry, liquidation estimate and market status before sliding to open.
4. Open the position to set **take-profit / stop-loss**, reduce or close it. The outcome follows the finalized transaction; an unresolved submission must not be repeated blindly.
5. **Home → Activity** opens the history. Open a transaction for details, its receipt and the optional explorer destination.
6. Review the session cap and passkey step-up behavior. A larger trade must request the required authentication, not silently bypass a cap.

Gold, silver and currency pairs follow their market hours. A closed market shows its next opening. A visible Perpl crypto market is public discovery and does not establish that enrollment, funding and execution are accepted. Simulator, physical-device and provider acceptance are recorded separately.

## 3. Predictions

**Markets → Predict** shows Bitcoin and Ethereum price questions. The market selector switches between **Price markets** and **Price contests**; secondary choices live under **Filters**. Open a question for its outcomes, history, resolution rules and observation details, or save it to the watchlist.

- Polymarket binary price markets settle on **Polygon**. Five-minute, fifteen-minute and longer price-event choices remain available.
- Castora numerical price contests are on **Monad**. They use pooled stakes and operator-assigned winners; entries are not transferable Up/Down shares.

Both models currently support discovery. Orders, contest entry, positions, settlement and claims remain integration work. Indicative prices are not executable quotes or Practice positions. No prediction trade is required to review this beta.

## 4. Mainnet and provider execution

Mainnet tokens, markets and social profiles can be browsed. The current public configuration enables Senryo's own money operations only on **Practice (chain 10143)**. Mainnet trading, Perpl enrollment/funding, composed pay-with-any-asset execution and live card spending require their own acceptance gates.

Historical Mainnet examples or intended voucher workflows are not proof that those capabilities are enabled in the current app. Region eligibility, provider access and actual transaction outcomes must be checked before any live-money acceptance run.

## 5. Money and Kinpaku

- **Receive:** choose the correct asset/network, then use its QR or copyable address. Only actual arrival updates the balance.
- **Add money / bridge / withdraw:** routes and recovery state exist; a provider's purchase-created event is not delivered funds. Current execution and reconciliation gates remain in the work register.
- **Swap:** Practice supports test AUSD ↔ test USDC at par. Other pairs need an executable provider quote on the appropriate network; discovery prices must never substitute for one.
- **Kinpaku:** Lithic sandbox issuance, daily limits, freeze/unfreeze, protected card details and hold behavior have recorded simulator acceptance. Open a test payment for its details and branded receipt. It cannot pay for goods or be added to Apple/Google Wallet in this beta.
- **Card funding:** the native Ramp SDK is implemented. Successful funding, provider eligibility and actual delivery still need acceptance; buying with a card is not claimed as complete merely because the SDK opens.

## 6. Social and watch mode

Find people, inspect their public activity and use the leaderboard on the selected network. An empty network or new profile is a legitimate state; it must explain the next action. Relationship changes, moderation and cross-device acceptance remain distinct from successful reads.

Any public account can be viewed without signing in, on the network in its link. A recorded Practice example:

https://senryo.xyz/watch/?address=0x17f356db5f7ffc1aed64d9bfc38e19f1633504e1&chainId=10143

## 7. Account restoration and indexer

The passkey derives the signing account. After signing out or reinstalling, signing in with the same supported passkey should restore the same address and chain-backed history. Profile/storage services still exist; this is not a claim that the whole product is stateless. Use an isolated acceptance account and preserve a tested recovery option before destructive storage checks.

Public read-only GraphQL: `https://indexer.senryo.xyz/v1/graphql`.

```graphql
{ Fill(limit: 5, order_by: { timestamp: desc }) { chainId txHash market { id } user { id } timestamp } }
```

Config, schema and handlers: [`indexer/`](../indexer). Browser counts per network at **https://senryo.xyz/stats/** use this endpoint and the pool contract. Observed data and timestamps are evidence; a historical screenshot is not a current health check.

## 8. Remaining acceptance

Physical-device authentication, native save/share, notifications, fresh-install recovery, accessibility, complete pool deposit/redeem/claim journeys and live provider execution remain explicit gates. Prediction execution and production card/Wallet access remain retained work. See the work register for the complete scope; this guide does not mark the product finished.
