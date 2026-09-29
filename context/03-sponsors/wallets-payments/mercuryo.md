# Mercuryo — Fiat on/off-ramp widget + Partner API

> Prize: **$10,000 sponsored prize**, "Product credits and integration support for winning teams" (credits and support, not cash). Mercuryo CBO Arthur (x.com/soultaker_eth) is a Metropolis mentor. Mercuryo announced MON on/off-ramp support (x.com/Mercuryo_io/status/2018346892673905062).

## Overview
- A hosted **on-ramp (buy)** and **off-ramp (sell)** widget with 50+ cryptos and 40+ fiats. Payment by Visa/Mastercard, Apple Pay, Google Pay and local APMs (e.g. Revolut Pay).
- KYC is handled by Mercuryo through SumSub. **Light KYC with no documents covers transactions up to €699.** Themes are customizable (40+ presets or Figma).
- Integration options: **redirect**, **iFrame via the JS SDK**, or **mobile** (iOS/Android wrappers; Android Custom Tabs are needed for Google Pay).
- Extras:
  - **Silent sign-up/sign-in** (skip the Mercuryo login)
  - SumSub KYC share token
  - **Recurring purchases** (weekly or monthly DCA)
  - **Spend Card** (virtual EUR Mastercard funded with crypto)
  - Off-chain mode (credit a business wallet, no network fee)
  - Passkey login inside the widget
- Off-ramp and Spend Card are **off by default**. Ask your integration manager to enable them.

## Monad support (checked live 2026-09-28 against the public API)
`GET https://api.mercuryo.io/v1.6/lib/currencies` returns:
```json
{"currency":"MON","network":"MONAD","contract":"","widget_onramp_enabled":true,"widget_offramp_enabled":true,
 "restricted_countries_onramp":["gb"],"restricted_countries_offramp":["gb"]}
```
- ✅ **Native MON on network `MONAD`**, for both on-ramp and off-ramp. Not available in the UK.
- ❌ **No USDC/USDT on Monad in the list at time of check.** For a stablecoin UX, on-ramp MON and then auto-swap to USDC through a Monad DEX/aggregator in the same flow, or on-ramp USDC on another chain and bridge (worse UX). Re-check the currencies endpoint before building. Asking the Mercuryo mentor about adding USDC on Monad is worth doing.
- Monad docs list Mercuryo as a ✅ onramp provider (US, EU).

## Environments
| Service | Production | Sandbox |
|---|---|---|
| Dashboard | https://dashboard.mercuryo.io | https://sandbox-dashboard.mrcr.io |
| Widget (redirect) | https://exchange.mercuryo.io | https://sandbox-exchange.mrcr.io |
| Widget (iFrame) | https://widget.mercuryo.io | https://sandbox-widget.mrcr.io |
| API | https://api.mercuryo.io/v1.6 | https://sandbox-api.mrcr.io/v1.6 |

Sandbox access: contact the integration manager and whitelist your IPs. Test cards are `4444 4444 4444 3333` (any expiry, CVV 123) and `5555 4444 3333 1111` (CVV `123` succeeds, `555` fails). Sandbox KYC needs manual approval, or SumSub test documents. The documented sandbox testnet addresses are only BTC testnet and ETH Sepolia, so a sandbox Monad flow is **(unverified)**. Plan the demo around a small real mainnet MON buy, or around sandbox on Sepolia.

## Quickstart
1. Dashboard → Widgets → Add Widget. Set the Domain URL to `https://exchange.mercuryo.io` for redirect, or **your exact origin** for iFrame (no trailing slash). Copy the **Widget ID** and **Secret**.
2. Set the **Callback URL** and copy the **Sign Key**.
3. Build a signed URL **on the server**, since the signature includes the user's IP and your secret.

```ts
// app/api/onramp/route.ts (Next.js)
import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { address } = await req.json();                      // user's embedded wallet (Privy/Dynamic)
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  const txId = crypto.randomUUID();
  // signature = "v2:" + sha512(address + secret + ip + merchant_transaction_id)
  const signature = "v2:" + crypto.createHash("sha512")
    .update(`${address}${process.env.MERCURYO_SECRET}${ip}${txId}`).digest("hex");
  const u = new URL("https://exchange.mercuryo.io/");
  Object.entries({
    widget_id: process.env.MERCURYO_WIDGET_ID!, type: "buy",
    currency: "MON", network: "MONAD", fix_currency: "true",
    fiat_currency: "EUR", fiat_amount: "50",
    address, merchant_transaction_id: txId, signature,
    redirect_url: "https://yourapp.xyz/topup/done",
  }).forEach(([k, v]) => u.searchParams.set(k, v));
  return NextResponse.json({ url: u.toString(), txId });
}
```
**iFrame (users stay in-app):**
```html
<div id="mercuryo-widget"></div>
<script src="https://widget.mercuryo.io/embed.2.1.js"></script>   <!-- sandbox: https://sandbox-widget.mrcr.io/embed.2.1.js -->
<script>
mercuryoWidget.run({
  widgetId: 'WIDGET_ID', host: document.getElementById('mercuryo-widget'),
  address: '0xUser', merchantTransactionId: 'tx_123', signature: 'v2:...',   // from your server
  type: 'buy', currency: 'MON', network: 'MONAD', fixCurrency: true, fiatCurrency: 'EUR',
  onStatusChange: (d) => console.log(d),   // {status, merchant_transaction_id, amount, currency, network, ...}
  onPaymentFinished: (d) => {},            // fiat paid + KYC done
});
</script>
```
With a plain `<iframe>` you must add `allow="camera"` for the KYC liveness check. The JS SDK uses camelCase for parameters (`fiat_currency` becomes `fiatCurrency`).

**Webhook verification:** the `X-Signature` header is `HMAC-SHA256(rawBody, SignKey)` in hex. Use the **raw** body. Mercuryo retries non-200 responses with exponential backoff for up to 3 days.
```ts
const ok = crypto.createHmac("sha256", process.env.MERCURYO_SIGN_KEY!).update(rawBody).digest("hex") === req.headers.get("x-signature");
```
Polling alternative: `GET /v1.6/sdk-partner/transactions?merchant_transaction_id=...` (Sdk-Partner-Token).

## Key APIs (Widget Partner API v1.6)
| Endpoint | Use |
|---|---|
| `GET /public/data-by-ip` | User country |
| `GET /lib/currencies` | Supported assets/networks, `widget_onramp_enabled`, restricted countries |
| `GET /public/currency-limits` · `GET /widget/buy/rate` · `GET /widget/sell/rate` | Limits and quotes for your own UI |
| `POST /sdk-partner/sign-up` · `POST /sdk-partner/login` | **Silent auth**: returns `init_token` + `init_type_token` → pass as `init_token` / `init_token_type=sdk_partner_authorization` (note the field-name swap) |
| `POST /sdk-partner/user/sign-in-no-verify` | OTP-less API auth → `Sdk-User-Token` (24h) for KYC doc upload |
| `GET /sdk-partner/transactions` | Status polling |

Auth headers: `Sdk-Partner-Token` (from the integration manager) and `Sdk-User-Token`. Useful widget params: `type`, `currency`, `network`, `amount`/`fiat_amount`, `fix_*`, `payment_method` (`card|mobile_pay|spend|spend_card`), `address_map`, `refund_address`, `share_token`, `theme`, `lang`, `redirect_url`, `widget_flow=recurrent_setup|recurrent_manage`, `frequency`, `charge_day`, `merchant_subscription_id`.

## Bounty angle and ideas
Judging is likely based on a real integration that drives users through fiat → Monad → a real action, polished UX (silent auth, pre-filled locked params, no crypto jargon), and production-readiness (signature on the server, webhooks verified).
1. **"Top up with card" inside a no-crypto payments app**: Privy/Dynamic email login → embedded wallet → Mercuryo iFrame with silent sign-up, pre-filled with the wallet address, `MON`/`MONAD` locked, fiat amount locked → webhook `paid` → auto-swap MON→USDC → show the balance in USD. Fits the Consumer track's "never mentions a blockchain".
2. **Recurring fiat DCA into a Monad savings or streaming product**: `widget_flow=recurrent_setup` (weekly/monthly card charge buys MON), and the webhook routes proceeds into a Sablier Flow stream or yield vault.
3. **Cash-out for creators/merchants**: an off-ramp (sell MON → EUR/USD card) button inside a creator-tips or group-settle-up app. The creator gets paid in MON and withdraws to their card, and the 6-hour send window is handled with a clear UX. The off-ramp must be enabled by Mercuryo.

## Gotchas
- **Only MON on Monad** today, no stablecoins. Design for it.
- The signature needs the **end-user IP**, so generate it server-side per session. `address` and `merchant_transaction_id` must also appear in the URL, or you get "Signature is invalid".
- A domain mismatch gives `widget.mercuryo.io refused to connect`.
- Apple Pay works only in Safari, and Google Pay needs Android Custom Tabs (not WebView).
- Off-ramp: fiat payout is EUR/USD only. The user must send crypto **within 6 hours**, otherwise it lands as a Mercuryo wallet deposit.
- Get your sandbox credentials early, because they require a human at Mercuryo. The `Sdk-Partner-Token` also comes from the integration manager.

## Sources
- https://widget.docs.mercuryo.io/llms.txt · …/guide/getting-started/overview · …/quick-start · …/sandbox
- https://widget.docs.mercuryo.io/guide/integration/methods · …/security · …/widget-parameters
- https://widget.docs.mercuryo.io/guide/flows/on-ramp · …/off-ramp · …/monitoring/callbacks · …/features/authentication · …/features/recurring-payments · …/features/off-chain
- https://widget.docs.mercuryo.io/api/overview · https://widget.docs.mercuryo.io/api/widget-partner/openapi.json
- https://api.mercuryo.io/v1.6/lib/currencies (live check) · https://docs.monad.xyz/tooling-and-infra/onramps
- https://x.com/Mercuryo_io/status/2018346892673905062
