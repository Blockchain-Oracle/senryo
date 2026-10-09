# Judge guide

Senryo is a real-time prediction market on Monad: call whether a live price closes **Up** or **Down** against the
line a window opened on — over 1, 5 or 15 minutes, or an hour — and the payout lands on its own when the window
closes. Prices come from Pyth; a pool takes the other side within limits the contracts enforce. Practice runs on
Monad testnet with free test dollars; Real (USDC on mainnet) opens with the mainnet deploy.

## 1. Make a call in a browser (two minutes)

1. Open **https://senryo.xyz** and choose **Open the app**, or go straight to **https://senryo.xyz/app/trade/btc/**.
2. **Create account** — one passkey prompt (iCloud Keychain, Google Password Manager or 1Password; no seed phrase).
3. Setup asks for a username, the terms, then grants **test dollars** on its own (gas-free; they have no value).
4. On the terminal, pick a stake ($1 · $5 · $10 · $25, any amount, or Max) and tap **Up** or **Down**. The odds under
   each button are the contracts' own price for that stake right now ("pays 1.92× · about 52%").
5. Watch it ride: the dashed line is **K**, the window's opening Pyth print; your side of it is shaded; the pill shows
   the price and your result rolling. **Cash out** (all, 25 % or 50 %) any time until 20 seconds before the close.
6. When the window closes its result arrives wherever you are, with confetti on a win. **Calls** holds every call;
   open one for its receipt.

Keys on the web: **⌘K** search · **1–4** places · **5** Everything · **↑ / ↓** call · **C** cash out · **?** the list.

## 2. On a phone

The iPhone app (runtime 0.4.0, build 11) is on TestFlight and the Android app on the Play internal track; both take
updates over the air. Ask for an invitation at **support@senryo.xyz**. The phone and the web share one account (the
same passkey), one call flow and the same receipts.

## 3. Check any call yourself

Every receipt shows each step — placed, filled, cashed out, settled — with its transaction, and the window it lived in:
the opening and closing Pyth prints with the transactions that posted them, where the close landed against the line,
and how the crowd called it. A shared call opens for anyone at `https://senryo.xyz/call?id=<ticket>&chainId=10143`.

Monad testnet (chain 10143) contracts, as the API's catalogue reports them:

| Contract | Address |
| --- | --- |
| BandReserve (the pool and its book) | `0xbcf5E007DBFd1BF579fFD17CbA0e3885906230D4` |
| Windows (series, prints, settlement) | `0x6f4Cc798951f889b9f2a7029C1D8D7749860dF69` |
| Pyth print verifier | `0x06C766c57c88124db9D302cD2050bEbAD9c1b5Df` |
| Test dollar (EIP-2612 / EIP-3009) | `0xeA23d6884b7861d2b9324C6A542020e8995cd3D3` |

Explorer: https://testnet.monadvision.com. Public reads, no account needed:

- `GET https://api.senryo.xyz/v1/markets/catalog?chainId=10143` — markets, windows, terms, contracts.
- `GET https://api.senryo.xyz/v1/markets/calls?chainId=10143&owner=<address>` — an address's calls.
- `GET https://api.senryo.xyz/v1/markets/windows/<windowId>?chainId=10143` — a window's prints and crowd.

## 4. How it is built

- **Calls are signed, then relayed.** The passkey signs an EIP-712 intent (and an EIP-2612 permit for the stake when
  needed); the relay commits it and the fill prints a second later at the next Pyth price. With **one-tap** on, a
  capped delegate key on the device signs instead — no prompt — within per-call and session caps the contracts check.
- **The pool prices every call** from the price, the time left and σ, with a surcharge as a window fills and hard caps
  on what one window and the whole pool can owe. A full window says so before you sign.
- **Settlement** posts the closing print and pays every call in the window; there is nothing to claim.
- **One stream.** Each app holds one server-sent-events stream for prices, prints and the user's own events; neither
  app reads the chain directly.

Source: [`contracts/`](../contracts), [`services/`](../services), [`packages/calls`](../packages/calls) (the call flow both
apps share), [`apps/web`](../apps/web), [`apps/mobile`](../apps/mobile).

## 5. Not yet

Real money opens with the mainnet deploy. Range and Moonshot calls, stocks, multi-market baskets, Earn (providing the
pool's liquidity) and the proof page arrive next; games, people and events after them. They are not shown in the
apps until they work — nothing on screen is a placeholder.
