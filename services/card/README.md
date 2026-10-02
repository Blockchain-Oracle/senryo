# services/card — Kinpaku card service

The Lithic side of the Kinpaku card (D3, §0.6 E1–E6). It issues the sandbox card, answers Lithic's real-time
authorisation (ASA) by placing a hold onchain within the decision deadline, and turns Lithic lifecycle events into
capture, release and refund calls through an outbox. The service never moves user funds: debt repayment is a call
the app signs.

## Routes

App routes use the api's SIWE session token (`Authorization: Bearer …`). Shapes live in
`packages/api-client/src/routes/card.ts`.

| Route | What it does |
| --- | --- |
| `POST /v1/card/issue` `{label?}` | Creates a VIRTUAL Lithic card, one live card per account per network (idempotent; `created: false` returns the existing one). Returns the summary plus `cardToken`, `created`, `allowanceRequired`. |
| `GET /v1/card/summary` | Cards (live first, with `last4`), `issuer {name, sandbox, status}`, `openHoldsUsd6`, `debtUsd6` (SenryoCore `cardDebt`), recent authorisations with `declineReason`. |
| `POST /v1/card/freeze` `{cardToken, frozen}` | Our responder declines first, then Lithic `PAUSED`. The onchain allowance revoke is the app's own call. |
| `POST /v1/card/unfreeze` `{cardToken}` | Lithic `OPEN`, then our responder. `allowanceRequired: true` means the app must sign a new daily limit. |
| `POST /v1/card/simulate` `{cardToken, preset? \| amountCents+descriptor, mcc?}` | Sandbox only. A real `POST /v1/simulate/authorize`; returns `transactionToken`, our `authId`, `status`, `declineReason`. Presets: `coffee`, `groceries`, `taxi`, `books`, `laptop` (the last one is above the per-payment maximum). |
| `POST /v1/card/simulate/step` `{cardToken, transactionToken, step, amountCents?}` | Sandbox only. `clear` (capture; above the authorised amount = over-capture → possible card debt), `void`, `expire`, `return` (refund). |
| `POST /v1/card/repay-quote` `{amountUsd6?}` | The `repayCardDebt` call (to, data, gasCap) for the app to sign, capped by debt and trading-account balance. `NOT_NEEDED` with no debt. |
| `GET /v1/card/embed?cardToken&ttlSec` | Signed Lithic embed URL for the PAN/CVV reveal. |
| `POST /v1/card/allowance` | Relays the user-signed `SpendAllowance`. |
| `POST /v1/card/lithic/asa` | Lithic ASA (Standard Webhooks signature, `LITHIC_ASA_SECRET`). |
| `POST /v1/card/lithic/events` | `card_transaction.updated` (`LITHIC_WEBHOOK_SECRET`). |

Without `LITHIC_API_KEY`, issue, freeze, unfreeze, simulate and embed answer `503 ISSUER_UNAVAILABLE`, and the summary
reports `issuer.status: "issuer_unavailable"`. If Lithic itself fails, the answer is `502 ISSUER_UNAVAILABLE`, with
Lithic's `debuggingRequestId` in `details`.

Decline reasons (`declineReason`) are `over_limit`, `not_enough_spendable`, `frozen`, `prices_paused` and
`issuer_error`. New decisions store `card_auth.reason` as `<code>: <detail>`.

## Environment

`deploy/card.env.example` lists every variable. The Lithic ones:

- `LITHIC_API_KEY`: sandbox API key.
- `LITHIC_API_BASE`: defaults to `https://sandbox.lithic.com`.
- `LITHIC_ASA_SECRET`: from `GET /v1/auth_stream/secret`.
- `LITHIC_WEBHOOK_SECRET`: the events subscription secret.
- `LITHIC_CARD_PROGRAM_TOKEN`: optional; empty uses the program default.

Any secret may be given as `NAME_FILE`.

## Coolify (do not deploy from here)

- **Resource:** `senryo-card`, a Docker Image resource running the shared services image
  `ghcr.io/blockchain-oracle/senryo-api:sha-<short>`.
- **Service selection:** `SERVICE=card` selects the process (`dist/run.mjs` dispatches on it). There's no command
  override.
- **Port:** 3001. Route `api.<domain>/v1/card/*` to this resource. Memory limit 192m.
- **Health check:** the image's `HEALTHCHECK` (`/health`, liveness only). Never use `/ready`.
- **Env:** paste `deploy/card.env.example` into the resource, with every secret set as Runtime-only.
- **Migrations:** they run on boot. 0010 adds `cards.last4` and the one-live-card index.

## Going live once the sandbox key exists

1. Save the key: `~/.config/senryo/lithic-api-key` (mode 0600).
2. Deploy `senryo-card` with `LITHIC_API_KEY` set, so that `https://api.<domain>/v1/card/lithic/asa` is reachable.
3. Run the setup (idempotent):
   `LITHIC_API_KEY_FILE=~/.config/senryo/lithic-api-key CARD_PUBLIC_URL=https://api.<domain> pnpm --filter @senryo/card lithic:setup`.
   It enrolls the ASA responder, fetches the ASA secret, subscribes the events hook and fetches its secret. Both
   secrets are written to `~/.config/senryo/lithic-{asa,webhook}-secret` and never printed.
4. Set `LITHIC_ASA_SECRET` and `LITHIC_WEBHOOK_SECRET` on the resource from those files, then redeploy.
5. From the app: Get card → set a daily limit → Simulate a payment (`coffee`) → expect `APPROVED` and a hold.
   Then try `laptop` and expect `over_limit`. Clear an authorisation (`simulate/step` `clear`) and check that the
   hold is captured.
