# AUSD (Agora) and Perpl: integration guide for the mobile trading app

> Researched 2026-09-29. **Verified** here means one of three things: checked onchain with `cast` against `https://rpc.monad.xyz` / `https://testnet-rpc.monad.xyz`, called live against the API, or quoted from the cloned source.
> Cloned repos, all read-only, in `../../references/`: `perpl-api-docs` (commit `25ab6e2`, 2026-09-25), `perpl-dex-sdk`, `perpl-dex-sdk-examples`, `perpl-delegated-account`, `perpl-docs`. There is **no official Perpl TypeScript SDK**. The TS reference clients live in `perpl-api-docs/examples/typescript/` and `examples/js/` (deps: `@noble/ed25519@^2.1.0`, `ethers@^6`, `ws`).
> Items marked **(unverified)** were not confirmed. Scratch probes are in `/private/tmp/claude-501/-Users-abu-dev-hackathon-metropolis/e314a687-c8b9-4c36-89fe-c740bf68a9ee/scratchpad/int-agora-perpl/`.

---

## 0. TL;DR for the build

1. **The bounty needs only the AUSD *token* from Agora, not the Agora API.** The Mobile Trading bounty text is: *"authenticates users via Mera…, holds and displays a stablecoin balance in AUSD, and executes trades through Perpl"*. The sentence *"Teams should build against Agora's public API documentation and staging environment (internal codebase access is not provided)"* appears **only in the Cross-Border Payments bounty** (`_portal/bounties/agora-best-cross-border-payments-app-on-monad-agora-payments-bount.md`), not in ours. We can still show an Agora API touch (public metrics) as a bonus.
2. **AUSD is verified onchain.** Mainnet `0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a`, testnet `0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC`. Both return name/symbol `AUSD`, 6 decimals, EIP-712 domain `("Agora Dollar","1",chainId,self)`, and they have ERC-2612 and ERC-3009 typehashes.
3. **The Monad-testnet AUSD faucet is empty.** `requestFunds` reverts `InsufficientFunds` and the faucet holds 0.000001 AUSD. Perpl testnet also needs 100 AUSD to open an account. **Plan the demo on mainnet**: the minimum is 10 AUSD, AUSD/USDC on Uniswap v4 has about $3.9M of liquidity, and gas is fractions of a cent. Ask Agora or Perpl for a testnet drip in parallel (routes in §1.6).
4. **Perpl has two trade paths from a Mera EOA:**
   - **(A) API path.** Gasless orders forwarded by Perpl. Needs `createAccount` + `allowOrderForwarding(true)` + an Ed25519 API key enrolled with a wallet EIP-712 signature. **TP/SL and builder-fee charging only exist here.**
   - **(B) Direct onchain path.** The user's EOA calls `execOrder`/`execOrders` on the Exchange. No API key, and MON gas per order. **Verified by `eth_call` simulation on mainnet.** Needs `createAccount` only.
5. **Mera accounts are plain secp256k1 EOAs** with a viem `LocalAccount` (see `mera.md`). They can sign Perpl's EIP-712 enrollment payload and send Exchange txs silently inside a signing session. No ERC-1271 or smart-account questions arise.

---

## 1. Agora / AUSD

### 1.1 Contracts (verified onchain 2026-09-29)

| | Mainnet (143) | Testnet (10143) |
|---|---|---|
| AUSD token | `0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a` | `0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC` |
| `name()` / `symbol()` / `decimals()` | `"AUSD"` / `"AUSD"` / `6` | `"AUSD"` / `"AUSD"` / `6` |
| `eip712Domain()` (ERC-5267) | name `"Agora Dollar"`, version `"1"`, chainId 143, verifyingContract = token | `"Agora Dollar"`, `"1"`, 10143, token |
| `DOMAIN_SEPARATOR()` | `0x995063441ebf2219c94dce05014a545da4390d2362f99b3d7ad456046678cafe` | `0x7ff7d6b4bdc3e260c85cf89f8779b1ac80120e3c277f7db4900739a507f03ea1` |
| `totalSupply()` | 150,096,456.31 AUSD | 302,010,000 AUSD |
| Faucet | none | `0xd236c18D274E54FAccC3dd9DDA4b27965a73ee6C` (`token()` = testnet AUSD) **but empty; see 1.6** |
| AUSD LayerZero OFT bridge adapter | `0x9CaB7Ede13dc56652E44D2404E969C212f22689b` | n/a |

- Same address on Arbitrum, Avalanche, Base, Ethereum, Immutable, Katana, Mantle, Monad and Polygon (docs: `https://docs.agora.finance/developer/contract-deployments.md`). The Monad testnet address matches the other testnets. `monad-crypto/protocols/mainnet/agora.jsonc` confirms both addresses and describes AUSD as *"deployed across chains through LayerZero's OFT interoperability standard"*.
- Wrong-network check: mainnet AUSD has no code on testnet, and testnet AUSD has no code on mainnet (verified).
- Agora Public API supply for Monad (`GET https://api.agora.finance/v0/metrics`, live): `{"chainId":"eip155:143","circulatingSupply":"140453092.175560","network":"monad","totalSupply":"150096456.309437"}`. Monad is the **largest AUSD chain**; Ethereum's total supply is about 78.9M.

### 1.2 ERC-3009 / ERC-2612 / EIP-712 (verified onchain)

The docs list *"ERC-20, EIP-712, ERC-1271, ERC-2612 (Permit), ERC-3009 (gasless transfers)"* (`https://docs.agora.finance/contract-overview.md`). Checked onchain on both networks:

- `TRANSFER_WITH_AUTHORIZATION_TYPEHASH()` = `0x7c7c6cdb…2267`. This equals `keccak256("TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)")`, the standard EIP-3009 type.
- `RECEIVE_WITH_AUTHORIZATION_TYPEHASH()` = `0xd099cc98…3de8`. `authorizationState(address,bytes32)` exists.
- `PERMIT_TYPEHASH()` = `0x6e71edae…26c9`, the standard EIP-2612 `Permit(owner,spender,value,nonce,deadline)`. `nonces(address)` exists.
- Which `transferWithAuthorization` overload exists (`v,r,s` vs `bytes signature`) is **(unverified)**. Read it from the verified source on the explorer before shipping.

What this means for us:
- **The Perpl Exchange has no permit-based deposit function.** Its ABI has `createAccount(uint256)` and `depositCollateral(uint256)`, which use `transferFrom`. So depositing is `approve` → `createAccount`/`depositCollateral` (two txs, or a one-time large approve).
- ERC-3009 still helps with *sending* AUSD (P2P, card top-ups to our vault) without the sender paying gas, through a relayer.

```ts
// EIP-3009 TransferWithAuthorization signed by the Mera viem account (domain verified onchain)
const domain = { name: "Agora Dollar", version: "1", chainId: 143, verifyingContract: AUSD } as const;
const sig = await meraAccount.signTypedData({
  domain,
  types: { TransferWithAuthorization: [
    { name: "from", type: "address" }, { name: "to", type: "address" }, { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" }, { name: "validBefore", type: "uint256" }, { name: "nonce", type: "bytes32" } ] },
  primaryType: "TransferWithAuthorization",
  message: { from: meraAccount.address, to, value: 25_000_000n /* 25 AUSD */, validAfter: 0n,
             validBefore: BigInt(Math.floor(Date.now() / 1000) + 600), nonce: toHex(crypto.getRandomValues(new Uint8Array(32))) },
});
```

### 1.3 Agora Public API and the "staging environment"

Sources: `https://docs.agora.finance/api.md`, `/api/authentication.md`, `/api/changelog.md`, `/api/errors.md`, and the live spec `https://api.agora.finance/v0/openapi.json`. The docs index is at `https://docs.agora.finance/llms.txt`, and there is a docs MCP server at `https://docs.agora.finance/_mcp/server`.

**Base URL:** `https://api.agora.finance`. **Staging:** the live OpenAPI `servers` array (verified) is:
```json
[{"url":"https://api.agora.finance","description":"Production"},{"url":"https://api.agorafi.co","description":"Staging"}]
```
`https://api.agorafi.co` and `https://app.agorafi.co` both answer `302` to `agorafinance.cloudflareaccess.com` (Cloudflare Access login), verified. **Staging is closed.** Agora has to add us to their Cloudflare Access policy (by email or service token). Nothing in the public docs describes self-serve staging access. (`api.sandbox.agora.finance` answered `200` with a `partial:true` metrics payload, but `*.agora.finance` is a wildcard DNS record; treat it as **(unverified), don't rely on it**.)

**Endpoints** (all under `/v0`, from the live OpenAPI):

| Method | Path | Auth |
|---|---|---|
| GET | `/v0/metrics`, `/v0/metrics/total-supply`, `/v0/metrics/circulating-supply` | none (CORS permissive) |
| POST | `/v0/auth/token` | `Authorization: Bearer <API_KEY>` → `{ sessionJwt }` (15 min, no refresh token) |
| GET / POST | `/v0/accounts`; GET/PUT `/v0/accounts/{accountId}` | `Bearer <sessionJwt>` |
| GET / POST | `/v0/routes`; GET `/v0/routes/{routeId}` | `Bearer <sessionJwt>` |
| GET | `/v0/transactions`, `/v0/transactions/{txnId}` | `Bearer <sessionJwt>` |

- **Auth:** *"Owners and Admins create and manage keys from the Agora dashboard (app.agora.finance), under API keys."* That requires an **onboarded Agora organization**. The Aug 5 2026 changelog adds `403 account_not_provisioned` (*"Contact your Agora account manager to have the product enabled"*) and `403 account_verification_pending`.
- **Routes** are the mint and redeem rails. `from.currency ∈ {ausd, usdi, usd, usdc}`, `to.chain ∈ {arbitrum, avalanche, base, ethereum, immutable, monad, polygon-pos, solana}`. A route returns a wire memo (fiat) or a per-chain `depositAddress` (onchain). *"Registering a wallet starts the per-network entitlement flow; the API never auto-approves."*
- **Conventions:** amounts are decimal **strings**. Every response has a `Request-Id` header. Rate limits are per IP at the Cloudflare edge and return `429 rate_limit_exceeded` with `Retry-After`.
- **Realistic use in our app:** the public `/v0/metrics` works with no key (for example, "AUSD on Monad: $150M" on the funding screen). Routes (mint from USD wire / USDC) need an onboarded org, so we can't show them without Agora's help.

**Route to access** for staging credentials or a sandbox org: ask the Agora mentors at Metropolis (Nick van Eck, CEO; Drake Evans, CTO; see `../03-sponsors/finance-trading/agora-ausd.md`), or `https://www.agora.finance/contact`, or X `@withAUSD`. Ask for: (1) Cloudflare Access to `api.agorafi.co` for our emails, (2) a staging org with an Owner/Admin API key, (3) a testnet AUSD drip.

### 1.4 How a user actually gets AUSD on Monad

| Route | Who | Notes |
|---|---|---|
| **Mint/redeem with Agora** (wire or stablecoin → AUSD, zero fee) | **Businesses only** | agora.finance: *"Stablecoin infrastructure for global business"*, CTA "Get started" → `/contact`. Needs an onboarded, verified org (403 codes above). Not for our retail users. |
| **Instant Settlement** (fixed-price AUSD⇄USDC pair) | **Whitelisted/verified wallets only** | Docs: *"a fixed-price swap protocol for verified users"*. Monad pair `0xf33286E3222D1c829dACeac48c0Ec651F6452470`, factory `0x8468587Af422ad440F58a57E955eCA6A970b5375` (from earlier notes). Non-whitelisted swaps revert. |
| **DEX swap on Monad** (retail, permissionless) | Anyone | GeckoTerminal, live 2026-09-29: **Uniswap v4 AUSD/USDC 0.005% about $3.89M reserve, $735K/24h**; **Curve AUSD/USDC/USDT0 about $2.35M** (`0x942644106b073e30d72c2c5d7529d5c296ea91ab`); PancakeSwap v3 AUSD/WMON about $279K; Uniswap v4 MON/AUSD about $1.45M; also a Uniswap v4 **XAUt0/AUSD** pool (about $8K, gold). Kuru has a MON-AUSD book (earlier notes; not in GeckoTerminal). Use an aggregator (0x / Uniswap Trading API / Kuru Flow) for USDC→AUSD. |
| **Bridge AUSD from another chain** | Anyone holding AUSD elsewhere | LayerZero OFT adapter `0x9CaB…689b` (Ethereum/Base/Avalanche/Katana/Monad). Perpl's own onboarding says: *"send AUSD to your wallet from a centralized exchange wallet or by using fiat onramps"*, then bridge to Monad (`perpl-docs/docs/onboarding/funding-a-wallet.md`). |
| **Any-chain deposit via Aurora** | Anyone | Lands as USDC on Monad (Aurora doesn't list AUSD), then swap USDC→AUSD on Uniswap v4 (see `aurora-intents.md`). |
| **Fiat on-ramp directly to AUSD on Monad** | ? | **(unverified)**. No on-ramp listing AUSD-on-Monad was found. Practical path: an on-ramp to USDC on Monad, then swap. |

### 1.5 Yield variants (AUSD itself pays holders nothing)

| Token | Address (Monad mainnet) | Issuer / mechanism | Verified |
|---|---|---|---|
| **earnAUSD** | `0x103222f020e98Bba0AD9809A011FDF8e6F067496` (6 dec, LayerZero OFT; Ethereum `0xa6916b65c5e3fEdf46c0a2F59bff776e872C8992`) | **Upshift** (not Agora): *"The primary liquid yield token on Monad, systematically allocating AUSD across top DeFi opportunities"* (`monad-crypto/protocols/mainnet/upshift.jsonc`). Not ERC-4626 (`asset()` reverts). CoinGecko about $1.04. | onchain `name/symbol = earnAUSD`, supply about 22.7M |
| sAUSD | `0xD793c04B87386A6bb84ee61D98e0065FdE7fdA5E` | monad-crypto/token-list | list only |
| hyAUSD ("High Yield AUSD Vault"), gAUSD ("K3 x Galaxy Lending") | `0xaD663aC84052b52BE4ed1b27BA416505e84a00Bf`, `0x0143C3eF3a76Ed825Fd5201953f65b52aCEfD799` | token-list | list only |
| Chainlink EARNAUSD/AUSD feed | proxy `0x66608681545AAa50D9ebdBd9542fEea4e49B85DA` | `monad-crypto/protocols/mainnet/chainlink.jsonc` | list only |

Agora's own yield is a **B2B partner rewards model**. The homepage says *"While most issuers keep the economics, Agora shares it with the partners who build with AUSD"*, *"2.7% APY Base Rewards Rate"*. That comes through a partnership, not a token. Idle-collateral yield in our vault (earnAUSD) is a possible feature; its redemption mechanics are **(unverified)**.

### 1.6 Testnet AUSD faucet: empty (verified)

- Docs: faucet `0xd236c18D274E54FAccC3dd9DDA4b27965a73ee6C`, `requestFunds(address)`, *"there should now be 10,000 AUSD"* (Sepolia example; `https://docs.agora.finance/instant-settlement/guides/getting-testnet-tokens.md`).
- On Monad testnet: `balanceOf(faucet)` = `1` (0.000001 AUSD). `eth_call requestFunds(x)` → `execution reverted: InsufficientFunds`.
- Perpl testnet also needs **100 AUSD** to open an account (`min_account_open_amount: "100000000"`) and has no faucet of its own (searched the `perpl-docs` repo and the testnet web bundle).
- **Routes:** (1) ask Agora mentors to refill `0xd236…e6C` or send testnet AUSD; (2) ask in Perpl Discord `https://discord.gg/perpl` (the testnet context lists `builderApplyUrl: https://discord.gg/perpl`); (3) **default: demo on mainnet** with about $15–50 of AUSD. The account minimum is 10 AUSD and a taker order costs about 590k gas ≈ 0.06 MON.

---

## 2. Perpl

### 2.1 Networks (verified live from `/v1/pub/context` and onchain)

| | Mainnet | Testnet |
|---|---|---|
| REST base (**includes `/api`**) | `https://app.perpl.xyz/api` | `https://testnet.perpl.xyz/api` |
| WS base (**no `/api`**) | `wss://app.perpl.xyz` → `/ws/v1/market-data`, `/ws/v1/trading` | `wss://testnet.perpl.xyz` |
| Chain ID / RPC | 143 / `https://rpc.monad.xyz` | 10143 / `https://testnet-rpc.monad.xyz` |
| Exchange (UUPS proxy, `getContractVersion()` = 1.7.5) | `0x34B6552d57a35a1D042CcAe1951BD1C370112a6F` | `0x1964C32f0bE608E7D29302AFF5E61268E72080cc` |
| Collateral (`getExchangeInfo().collateralToken`) | AUSD `0x00000000…9012a` | AUSD `0xa9012a05…22dC` |
| `min_account_open_amount` / `min_deposit_amount` / `min_withdraw_amount` (6 dec) | 10 / 10 / 0.01 AUSD | 100 / 10 / 0.01 AUSD |
| `max_account_trigger_orders` | 16 | 16 |
| Accounts (`numberOfAccounts()`) | 5,356 | 738 |
| `whitelistingEnabled()` / `isHalted()` | false / false | false / false |
| DelegatedAccount factory | `0xc535276e3e446e4f28d95ed27ccd5c32e4c8907a` | `0xf42548Ccb3300Bc76c35dc2D347416db2E8d7209` |
| Exchange deploy block (log-scan lower bound) | 54773010 | 62953 |

**Stale-docs trap:** `perpl-api-docs/README.md` lists testnet collateral `0xdf5b718d8fcc173335185a2a1513ee8151e3c027 (USD)`. Onchain that is `"Test USD"`, **not** what the testnet Exchange uses. `perpl-docs` and the live context both say `0xa9012a…22dC`.

**Markets (live context, 2026-09-29). The docs' tables are out of date, so always read `/v1/pub/context`:**

| Mainnet id | Name | price_dec | size_dec | max lev* | | Testnet id | Name |
|---|---|---|---|---|---|---|---|
| 1 | BTC | 1 | 5 | 15x | | 16 | BTC |
| 10 | MON | 6 | 0 | 10x | | 32 | ETH |
| 20 | ETH | 2 | 3 | 12x | | 48 | SOL |
| 31 | SOL | 3 | 3 | 12x | | 64 | MON |
| 40 | HYPE | 4 | 2 | 10x | | 256 | ZEC |
| 50 | ZEC | 2 | 4 | 10x | | 272 | LIT |
| 60 | LIT | 5 | 1 | 3x | | 320 | PUMP |
| 70 | VVV | 4 | 2 | 3x | | 336 | NEAR |
| 90 | PUMP | 6 | 0 | 5x | | | |

\* Max leverage = `config.initial_margin / 100`. This is inferred from `types.md`: `initial_margin: Fraction; // e.g., 1000 = 10% (10x max)`, where `Fraction` = hundredths. Mainnet fees: base maker 45 / taker 345 micros (0.0045% / 0.0345%). `order_ttl_blocks` = 20 and `order_max_market_slippage_bps` = 100 (mainnet) on every market. **No gold, stock or FX markets are listed.** The Exchange ABI does have `initializeV3(... rwaTakerFeesPer100K, rwaMakerFeesPer100K ...)` and a `DefaultRwaFeeScheduleSet` event, so RWA markets are planned (**unverified** timing).

**Geo-block:** `/v1/pub/context.geo_block` = `["BY","CU","GB","IR","KP","RU","SY","UA","US"]` on both networks. Whether the API or the WS enforces it (as opposed to only the web UI) is **(unverified)**. Check before demoing from the US or UK, or for US/UK judges' devices.

### 2.2 Three separate prerequisites (quoted)

`perpl-api-docs/README.md` → "API Auth vs Smart Contract Account":

> *"API authentication, smart contract account creation, and the on-chain permission to forward orders are three separate things"*
> 1. *"API auth does NOT create an exchange account"*
> 2. *"Exchange account must be created on-chain — Call `createAccount(uint256 amountCNS)`"*
> 3. *"Order forwarding must be enabled on-chain to trade via the API … `createAccount` leaves forwarding **disabled** … Call `allowOrderForwarding(true)` on the Exchange contract from the account's own wallet"*
> *"The flag gates only the forwarded path. An account can still trade by sending its own order transactions on-chain"*

`fw` (the forwarding flag) has **no onchain getter**. Read it from `Account.fw` in the WalletSnapshot (mt 19), in `GET /v1/trading/wallet`, or in `mt: 21` updates. Without it, orders are acked `code:0` and then fail on `mt:24` with `st:7, sr:34 OrderForwardingNotAllowed`.

### 2.3 Onboarding a Mera user (account creation + deposit)

All of these are ordinary txs from the Mera EOA. The EOA needs **MON for gas** (see `mera.md` §gas: a fresh Mera EOA has 0 MON). Monad bills the **gas limit**, so set `gas` explicitly.

```
1. AUSD.approve(Exchange, amount)                 // ERC-20 (no permit path into the Exchange)
2. Exchange.createAccount(amountCNS)              // ≥ min_account_open_amount; reverts AccountAlreadyCreated if it exists
   or Exchange.depositCollateral(amountCNS)       // later top-ups, ≥ min_deposit_amount
3. Exchange.allowOrderForwarding(true)            // only for path A (API/gasless); emits OrderForwardingUpdated(accountId, allowed)
   Withdraw: Exchange.withdrawCollateral(amountCNS)   // onchain only; "Withdrawals and transfers-out are never permitted via an API key"
   Lookup:   Exchange.getAccountByAddr(addr) -> AccountInfo{accountId, balanceCNS, lockedBalanceCNS, frozen, accountAddr, positions}
             (reverts AccountDoesNotExist(addr) if none; verified)
```

Withdrawals are rate-limited by the protocol (`getWithdrawAllowanceData`; `perpl-docs/docs/exchange/security/withdrawal-limits.md`).

### 2.4 Path A: API key auth (Ed25519) + forwarded, gasless orders

**Key model** (`perpl-api-docs/authentication.md`): *"An API key is an **Ed25519 key pair** — the server only ever stores the public key … every request is signed with the key's private key."* Scopes: `1` read, `2` trade (implies read), `3` both. *"Withdrawals and transfers-out are never permitted via an API key."* Max 16 active keys per profile. Listing and revoking keys is web UI only (`/apikeys`).

**Programmatic enrollment** (`integrations.md`):
1. `POST /api/v1/api-key/payload` `{chain_id, address, public_key (0x 32-byte hex), scope_mask, label, expires_at?, ip_cidrs?, target_profile?, builder_id?, max_builder_fee_per_100k?}` → `{typed_data, mac}`.
2. The wallet signs `typed_data` (EIP-712), and the Ed25519 key signs the EIP-712 digest (proof of possession).
3. `POST /api/v1/api-key/enroll` `{chain_id, address, typed_data, mac, signature, pop_signature, target_profile?}` → `{api_key: {api_key: "<X-API-Key token>", …}}`. *"store it, it is not re-derivable"*. Errors: `404` target profile not found, `409` public key already registered, `423` 16-key limit.

**Origin whitelisting, and what this means for a native app.** The docs say: *"In **both** cases the request's `Origin` must be whitelisted by Perpl … requests from a non-whitelisted `Origin` are rejected. Ask Perpl to whitelist the origin(s)"*.
Live probe on testnet:
- `payload` with `Origin: https://example.com` → **422**.
- `payload` with **no Origin header** (what a React Native `fetch` sends) → **200**, and `typed_data.message.origin = ""`. Verified.
- Completing `enroll` for a brand-new throwaway EOA (valid EIP-712 + PoP signatures, no Origin) → **404** (a garbage body gets 400, so the route exists).

Per the docs' table, 404 = *"Target profile not found"*. So a wallet likely needs a Perpl profile first. The most likely trigger is creating the exchange account or signing in on the web app once, but that is **(unverified)**. **Order in our app: `createAccount` first, then enroll.** Route: ask Perpl (Discord `discord.gg/perpl`; mentor gvan, Head of Growth; judge PBJ) to (a) whitelist our web origin for the Expo-web build, and (b) confirm origin-less native enrollment and what creates a profile.

The EIP-712 payload captured live (testnet), useful for UI copy:
```json
"domain":{"name":"perpl.xyz","version":"1","chainId":"0x279f","verifyingContract":"0x0000000000000000000000000000000000000000","salt":"0x…6abba71adef173c38d3e31f9"},
"primaryType":"PerplRegisterApiKey",
"message":{"signer":"0x…","statement":"I authorize the creation of Perpl API key with the specified scope and parameters","publicKey":"<base64url>","scope":"3","label":"…","expiresAt":"0","ipCidrs":"","origin":"","builderId":"0","maxBuilderFeePer100K":"0","time":"0x…"}
```

**Request signing (REST).** The canonical string is `chain_id \n METHOD \n request-target(path+query exactly as sent, without /api) \n timestamp_ms \n nonce(base64url) \n sha256(body) hex`. Headers are `X-API-Key`, `X-API-Timestamp`, `X-API-Nonce`, `X-API-Signature` (base64url, no padding). The timestamp window is ±30 s, and each nonce is single-use.
**WS sign-in:** the first frame is `mt:29`, signing `chain_id \n trading-ws-signin \n ts \n nonce`. It must arrive within the idle timeout (**5 s mainnet, 10 s testnet**) or the server closes with `1008 idle timeout`.

### 2.5 Orders (Path A): market, limit, cancel, change, TP/SL

`OrderSpec` (`types.md`), sent as WS `mt:22` or in a REST `POST /v1/trading/orders` batch `{d:[…1–100]}`:

| Field | Meaning |
|---|---|
| `rq` | idempotency id, **strictly > `Account.lfr`**; seed with `max(counter, lfr)+1`. `sr:32 OrderDescIdTooLow` → retry once with a new `rq` |
| `mkt`, `acc` | market id, account id (from `getAccountByAddr` or WalletSnapshot) |
| `t` | **API enum:** 1 OpenLong, 2 OpenShort, 3 CloseLong, 4 CloseShort, 5 Cancel, 6 IncreasePositionCollateral, 7 Change |
| `p`, `s` | scaled price (`0` = market), scaled size |
| `fl` | 0 GTC, 1 PostOnly, 2 FOK, 4 IOC |
| `lv` | leverage in hundredths (`1000` = 10x) |
| `lb` | last exec block: `head < lb ≤ head + order_ttl_blocks`, or `0` (server uses the max window). **Trigger orders: `lb: 0`** |
| `ms` | max market slippage bps (0 = market default) |
| `mnp` | max negative-PnL collateralisation, bps of resulting notional. *"Omitting `mnp` is not the same as sending `0`"* |
| `tp`, `tpc`, `lp`, `tr` | trigger price; condition 1 GTELast, 2 LTELast, 3 GTEMark, 4 LTEMark; linked position; linked request |
| `oid` | order to cancel/change |
| `bf` | builder fee per_100k (builder-bound keys only) |

- **Acks:** WS `mt:3` on `sid:100`, correlated by your `sn` (echoed as `cid`). *"`code: 0` means accepted for forwarding — not posted, not filled."* The outcome arrives on `mt:24` (orders), `mt:25` (fills), `mt:27` (positions), `mt:21` (account). An unknown `mkt`, an `acc` you don't own, or an unparseable frame closes the socket with `1011` and sends **no** `mt:3`.
- **REST batch:** HTTP 200 means *judged*. Read `statuses[i]` by position. Per-order `429` is possible inside a 200.
- **TP/SL** (`perpl-docs/docs/resources/for-developers/recipes.md`): reduce-only `CloseLong`/`CloseShort` with `tp`, `tpc`, `lp: positionId`, `p: 0`, `fl: 4`, `lv: 0`, `lb: 0`. The live context has `tpSlOrdersUseIoc: on` and `tpSlTriggerOnMarkPrice: on`. Cap: 16 trigger orders per account. **TP/SL are not contract primitives**: *"Advanced order types like Stop Market, Stop Limit, Take Profit, and TWAP are abstractions built on top of these on-chain primitives via the SDK and keeper layer — they are not native contract operations"* (`perpl-docs/docs/exchange/order-types.md`). So TP/SL require Path A.
- *"Use Change orders instead of Post + Cancel"* (`t:7` amends price, size and expiry only).

### 2.6 Path B: direct onchain orders from the user's wallet (no API key)

Yes, this is possible. README: *"An account can always transact directly on-chain from its own wallet — submitting its own order transactions and paying its own gas — and that path is unaffected by the flag. Direct on-chain trading is out of scope for these docs."* The contract interface is in `perpl-dex-sdk/crates/sdk/abi/dex/Exchange.json` (REVISION `rc_v1.1.7-203-g0e5902dd`):

```solidity
execOrder(OrderDesc) returns (OrderSignature{perpId, orderId})
execOrders(OrderDesc[], bool revertOnFail)
execOrderV2(OrderDesc, bytes extension)             // builder attribution envelope, contract ≥1.7.4
struct OrderDesc { uint256 orderDescId; uint256 perpId; uint8 orderType; uint256 orderId; uint256 pricePNS; uint256 lotLNS;
  uint256 expiryBlock; bool postOnly; bool fillOrKill; bool immediateOrCancel; uint256 maxMatches; uint256 leverageHdths;
  uint256 lastExecutionBlock; uint256 amountCNS; uint256 maxNegPnlCollatBPS; }
```

The account is resolved from `msg.sender`; there is no account field. **Onchain `orderType` is 0-based**: 0 OpenLong, 1 OpenShort, 2 CloseLong, 3 CloseShort, 4 Cancel, 5 IncreasePositionCollateral, 6 Change (`perpl-dex-sdk/crates/sdk/src/types/request.rs`, `impl From<u8> for RequestType`). **This is off by one from the API's `t`.**

Verified with `eth_call` on mainnet from an existing account holder (`0x52e1…dd84`, account 100):

| Simulation | Result |
|---|---|
| post-only bid BTC `(orderType 0, pricePNS 400000, lotLNS 10, lev 100, lastExecutionBlock 0)` | `(1, 161)` → would rest as order 161 |
| IOC long at mark+1% (`immediateOrCancel=true`) | `(0, 0)` → filled immediately, nothing rests |
| `pricePNS = 0` + IOC | `PriceOutOfRange(0, 1, 16777215)`. **There is no price-0 market order onchain**; use IOC with a slippage-bounded limit |
| `lastExecutionBlock = eth_blockNumber + 2` or `+5` | `ExceedsLastExecutionBlock(lb)`; `+20`, `+50` and `0` pass. Monad executes ahead of the reported head; use `0` or `head + ≥20` onchain **(inferred)** |
| from an address without an account | `AccountDoesNotExist(addr)` |
| `cast estimate`: post-only / IOC taker | about 285k / about 590k gas (≈0.03 / 0.06 MON at about 100 gwei) |

Path B trade-offs: every order is a signed tx (silent inside a Mera session), costs MON, and has **no TP/SL** (keeper layer). Its `orderDescId` isn't used for dedup (*"For smart contract / SDK users placing non API orders the value maybe set to anything"*). Positions and fills still show up on Perpl's API and indexers because they are onchain events.

### 2.7 Builder codes / fee attribution

- Register with Perpl: *"Builder codes are issued by the operator; there is no self-service endpoint"*. You provide a display name and your Perpl account address and get a `builder_id` 1..255. Mainnet context `builderApplyUrl`: `https://docs.google.com/forms/d/e/1FAIpQLSfpuNGEpvEzfUJK3lM7bAmvinEFQnsnPP50rx2I9Nlg3vEqMg/viewform`. The testnet one is Discord.
- The user enrolls a key **bound** to our code (`builder_id`, `max_builder_fee_per_100k` ≤ 100 = 0.1%). The user's wallet signature *is* the fee consent. Each order sets `bf` ≤ that ceiling. An order that omits `bf` is still attributed, at zero fee. `bf` above the ceiling → `400`, not clamped.
- `max_builder_fee_per_100k: 0` = **attribution without a fee**. This is the cheapest way to prove usage to judges.
- Reporting: fees are **gross** (`f` includes `bfa`). `AccountStats.tbf` = lifetime builder fees. Builder fees settle *"to the Perpl account registered with your code, on a periodic epoch schedule"*.
- **Docs vs SDK conflict:** integrations.md says *"Orders a user sends directly on-chain cannot be attributed to a builder"*. But contract 1.7.5 (≥ `BUILDER_CODES` 1.7.4, `state/version.rs`) exposes `execOrderV2(OrderDesc, bytes extension)`, where `extension = abi.encode(uint16 1, abi.encode(uint256 builderId, uint256 feePer100k))` (`types/extension.rs`, max fee 1000 per_100k, max 256 bytes). Whether an unregistered or non-consented direct-onchain attribution is accepted is **(unverified)**. Ask Perpl.

### 2.8 Positions, balances, PnL

- **Live state** (read-scope key): `GET /v1/trading/positions` (mt 26 shape), `/orders` (mt 23), `/wallet` (mt 19: `as[]` accounts with `b` balance, `lb` locked, `fw`, `ft`, `lfr`; `sts[]` all-time stats). **404 if the wallet has no exchange account.**
- **History:** `/v1/trading/account-history`, `/fills`, `/order-history`, `/position-history`, paged with `page=<np>`, `count≤100`. **Charts:** `GET /v1/trading/portfolio/{equity|pnl}/{all|day|week|2weeks|month}`.
- **Position** fields: `sd` 1 long / 2 short, `c` collateral, `ep` entry price, `s` size, `lv`, `efs` entry funding sum, `fee` entry-side fees; events carry `dpnl` realized, `fnd` funding, `cfee` close fee. **There is no unrealized-PnL field.** Compute `uPnL = (mark − ep)·s` for longs and `(ep − mark)·s` for shorts, in collateral units after scaling, using `mrk` from `market-state`. Funding accrues through `efs` against the market's funding sum (`perpl-docs/docs/exchange/funding.md`); treating that as a display-time term is **(inferred)**.
- **Without an API key (Path B):** onchain `getPositionV2(perpId, accountId)` → `{positionType, depositCNS, pricePNS, lotLNS, pnlCNS, deltaPnlCNS, premiumPnlCNS, …}, markPricePNS, markPriceValid`, plus `getAccountByAddr`. Our Envio indexer (`envio.md`) handles history.

### 2.9 Market data (public, no auth)

REST: `GET /v1/pub/context`, `/v1/market-data/{id}/ticker`, `/v1/market-data/ticker`, `/v1/market-data/{id}/book`, `/v1/market-data/{id}/candles/{res}/{from_ms}-{to_ms}`, `/v1/market-data/{id}/funding/{from}-{to}`. WS `/ws/v1/market-data`, subscribe `{mt:5, subs:[{stream, subscribe:true}]}`. Streams: `heartbeat@<chain>`, `gas-stats@<chain>`, `market-config@<chain>`, `market-state@<chain>` (mt 9), `funding@<chain>` (mt 10), `candles@<mkt>*<res>` (mt 11/12; res 60…86400), `order-book@<mkt>` (mt 15 snapshot / 16 delta, remove levels with `o:0`), `trades@<mkt>` (mt 17/18). Verified live on mainnet: sub ack mt 6, then mt 15, 17, 9, 100 and 16 within 4 s.

### 2.10 Rate limits (`perpl-api-docs/README.md`, authoritative)

| | Testnet | Mainnet |
|---|---|---|
| Trading WS requests | 60/min | 120/min |
| Trading WS connections | 4 per **wallet** (shared by all keys + browser sessions) | 4 per wallet |
| Market-data WS | 10 requests/min, 16 subscriptions per connection (both nets) | same |
| REST | edge-limited, *"not published"*; back off on 429. A batch costs 1 unit per order | same |

- Exceeding a WS request rate → close `1008`, with in-flight requests lost silently. `1013` = the client read too slowly. `3401` = auth. `1001` = reconnect immediately.
- **Don't ping the market-data socket** (pings count against the 10/min). On the trading socket, ping `mt:1` every 30 s.
- Trading WS: on a heartbeat `sn` gap, force a reconnect.
- The recipes page's "~100/min public, ~60/min auth, ~5 conn/IP" figures are older approximations. Prefer the README table.
- Mobile note: iOS kills sockets in the background. On foreground: reconnect → sign in → reconcile from snapshots. Keep at most 1–2 trading sockets per wallet.

### 2.11 Delegated accounts (optional hardening)

`perpl-delegated-account`: a BeaconProxy contract that owns the Exchange account. The **owner** can withdraw. The **operator** (hot key) can only call allowlisted selectors (`execOrder(s)`, `increasePositionCollateral`, `requestDecreasePositionCollateral`, `buyLiquidations`, `depositCollateral`, `allowOrderForwarding`); `withdrawCollateral` is permanently blocked for the operator. `factory.createWithSignature(owner, operator, deadline, ownerSig, opDeadline, opSig)` lets a third party pay the gas. API keys can target it through `target_profile`.

For us: owner = the Mera account derived at `m/44'/60'/0'/0/0` (Face ID step-up), operator = the trading key at `/0/1` (silent session). A leaked session key can then trade but never withdraw. This matches the scoped-session idea in `mera.md` §5. Cost: more setup txs, and the Exchange account address becomes the proxy's. **Not needed for the MVP.**

---

## 3. TypeScript for the Expo / React Native app

Dependencies: `viem`, `@noble/ed25519@^2` (the version the Perpl examples pin), `@noble/hashes`, `@scure/base`, `react-native-get-random-values` (or `expo-crypto`), `expo-secure-store`. RN has no Node `crypto`/`Buffer`. The Perpl samples use `createHash`, `randomBytes` and `Buffer`, which are swapped below for `@noble/hashes` + `@scure/base` with the same bytes on the wire. The protocol is quoted from `authentication.md` / `websocket.md`.

### 3.1 Config, chain, AUSD balance

```ts
// perpl/config.ts
import "react-native-get-random-values";
import { createPublicClient, createWalletClient, defineChain, erc20Abi, http, parseAbi, type LocalAccount } from "viem";

export const NET = {
  mainnet: { chainId: 143, rpc: "https://rpc.monad.xyz", api: "https://app.perpl.xyz/api", ws: "wss://app.perpl.xyz",
             exchange: "0x34B6552d57a35a1D042CcAe1951BD1C370112a6F", ausd: "0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a" },
  testnet: { chainId: 10143, rpc: "https://testnet-rpc.monad.xyz", api: "https://testnet.perpl.xyz/api", ws: "wss://testnet.perpl.xyz",
             exchange: "0x1964C32f0bE608E7D29302AFF5E61268E72080cc", ausd: "0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC" },
} as const;
export const cfg = NET.mainnet;

export const monad = defineChain({ id: cfg.chainId, name: "Monad", nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: [cfg.rpc] } } });
export const publicClient = createPublicClient({ chain: monad, transport: http() });
export const walletFor = (account: LocalAccount) => createWalletClient({ account, chain: monad, transport: http() }); // Mera: toViemAccount(session)

// Always read markets/decimals/minimums at runtime (docs tables are stale)
export const getContext = () => fetch(`${cfg.api}/v1/pub/context`).then(r => r.json());

export const exchangeAbi = parseAbi([
  "function createAccount(uint256 amountCNS) returns (uint256)",
  "function depositCollateral(uint256 amountCNS)",
  "function withdrawCollateral(uint256 amountCNS)",
  "function allowOrderForwarding(bool allow)",
  "function getAccountByAddr(address) view returns ((uint256 accountId,uint256 balanceCNS,uint256 lockedBalanceCNS,uint8 frozen,address accountAddr,(uint256,uint256,uint256,uint256) positions))",
  "struct OrderDesc { uint256 orderDescId; uint256 perpId; uint8 orderType; uint256 orderId; uint256 pricePNS; uint256 lotLNS; uint256 expiryBlock; bool postOnly; bool fillOrKill; bool immediateOrCancel; uint256 maxMatches; uint256 leverageHdths; uint256 lastExecutionBlock; uint256 amountCNS; uint256 maxNegPnlCollatBPS; }",
  "function execOrder(OrderDesc orderDesc) returns ((uint256 perpId, uint256 orderId))",
]);

// Wallet AUSD (6 decimals) — the bounty's "holds and displays an AUSD balance"
export const ausdBalance = (addr: `0x${string}`) =>
  publicClient.readContract({ address: cfg.ausd, abi: erc20Abi, functionName: "balanceOf", args: [addr] });
// Collateral inside Perpl (also 6 decimals); reverts AccountDoesNotExist if none
export const perplAccount = (addr: `0x${string}`) =>
  publicClient.readContract({ address: cfg.exchange, abi: exchangeAbi, functionName: "getAccountByAddr", args: [addr] }).catch(() => null);
```

### 3.2 Onboarding txs (Mera EOA signs silently inside its session)

```ts
// perpl/onboard.ts: approve → createAccount (or deposit) → allowOrderForwarding (Path A only)
export async function fundPerpl(account: LocalAccount, amount: bigint /* 6-dec */, enableApiTrading = true) {
  const w = walletFor(account);
  const ctx = await getContext();
  const min = BigInt(ctx.instances[0].min_account_open_amount);           // 10_000_000 mainnet, 100_000_000 testnet
  const existing = await perplAccount(account.address);
  if (!existing && amount < min) throw new Error(`first deposit must be ≥ ${Number(min) / 1e6} AUSD`);

  const wait = (hash: `0x${string}`) => publicClient.waitForTransactionReceipt({ hash });
  // Monad bills the gas LIMIT: set gas explicitly (values ≈ estimates with headroom; re-estimate in-app)
  await wait(await w.writeContract({ address: cfg.ausd, abi: erc20Abi, functionName: "approve", args: [cfg.exchange, amount], gas: 80_000n }));
  await wait(await w.writeContract({ address: cfg.exchange, abi: exchangeAbi,
    functionName: existing ? "depositCollateral" : "createAccount", args: [amount], gas: 400_000n }));
  if (enableApiTrading)
    await wait(await w.writeContract({ address: cfg.exchange, abi: exchangeAbi, functionName: "allowOrderForwarding", args: [true], gas: 120_000n }));
  return perplAccount(account.address);
}
```
The gas limits above are placeholders **(unverified)**. Only `execOrder` was estimated (285k/590k). Run `estimateContractGas` and add about 20%.

### 3.3 Ed25519 signer for React Native (protocol from `authentication.md`)

```ts
// perpl/signer.ts
import * as ed from "@noble/ed25519";                    // v2 API (as pinned by perpl-api-docs examples)
import { sha256, sha512 } from "@noble/hashes/sha2";
import { bytesToHex, utf8ToBytes, hexToBytes } from "@noble/hashes/utils";
import { base64urlnopad } from "@scure/base";
ed.etc.sha512Sync = (...m) => sha512(ed.etc.concatBytes(...m));   // RN has no crypto.subtle

const nonce = () => base64urlnopad.encode(crypto.getRandomValues(new Uint8Array(16)));

export type PerplKey = { apiKey: string; secretHex: string };      // persist in expo-secure-store

// REST: canonical = chain_id \n METHOD \n target \n ts_ms \n nonce \n sha256(body) hex
export async function signedFetch(k: PerplKey, method: "GET" | "POST", target: string, body = "") {
  const ts = Date.now().toString(), n = nonce();
  const canonical = [cfg.chainId, method, target, ts, n, bytesToHex(sha256(utf8ToBytes(body)))].join("\n");
  const sig = ed.sign(utf8ToBytes(canonical), hexToBytes(k.secretHex.replace(/^0x/, "")));
  return fetch(`${cfg.api}${target}`, { method, body: body || undefined, headers: {
    "X-API-Key": k.apiKey, "X-API-Timestamp": ts, "X-API-Nonce": n, "X-API-Signature": base64urlnopad.encode(sig),
    ...(body ? { "Content-Type": "application/json" } : {}) } });
}

// WS sign-in frame: canonical = chain_id \n trading-ws-signin \n ts \n nonce
export function wsSignIn(k: PerplKey) {
  const ts = Date.now().toString(), n = nonce();
  const sig = ed.sign(utf8ToBytes([cfg.chainId, "trading-ws-signin", ts, n].join("\n")), hexToBytes(k.secretHex.replace(/^0x/, "")));
  return { mt: 29, chain_id: cfg.chainId, api_key: k.apiKey, timestamp: ts, nonce: n, signature: base64urlnopad.encode(sig) };
}
```

### 3.4 Enroll a key with the Mera account (flow from `integrations.md` / `examples/js/enroll_api_key.js`)

```ts
// perpl/enroll.ts: run AFTER createAccount (a fresh wallet got 404 on enroll in our probe)
import { hashTypedData, hexToBytes as vHexToBytes, type LocalAccount } from "viem";

export async function enrollPerplKey(account: LocalAccount, opts: { builderId?: number; maxBuilderFeePer100k?: number } = {}): Promise<PerplKey> {
  const secret = ed.utils.randomPrivateKey();
  const pub = await ed.getPublicKeyAsync(secret);
  // Native fetch sends no Origin → accepted by /payload (verified). Expo-web sends its page Origin → must be whitelisted by Perpl.
  const payloadRes = await fetch(`${cfg.api}/v1/api-key/payload`, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chain_id: cfg.chainId, address: account.address, public_key: "0x" + bytesToHex(pub),
      scope_mask: 3, label: "Metropolis mobile",
      ...(opts.builderId ? { builder_id: opts.builderId, max_builder_fee_per_100k: opts.maxBuilderFeePer100k ?? 0 } : {}) }) });
  if (!payloadRes.ok) throw new Error(`payload ${payloadRes.status}`);
  const { typed_data, mac } = await payloadRes.json();
  const { EIP712Domain, ...types } = typed_data.types;

  // 1) wallet EIP-712 signature (Mera LocalAccount → no passkey prompt inside a session)
  const signature = await account.signTypedData({ domain: typed_data.domain, types, primaryType: typed_data.primaryType, message: typed_data.message });
  // 2) Ed25519 proof-of-possession over the EIP-712 digest keccak256(0x1901‖domainSep‖hashStruct)
  const digest = hashTypedData({ domain: typed_data.domain, types, primaryType: typed_data.primaryType, message: typed_data.message });
  const pop_signature = "0x" + bytesToHex(ed.sign(vHexToBytes(digest), secret));

  const res = await fetch(`${cfg.api}/v1/api-key/enroll`, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chain_id: cfg.chainId, address: account.address, typed_data, mac, signature, pop_signature }) });
  if (!res.ok) throw new Error(`enroll ${res.status}`);   // 404 profile not found · 409 key reused · 423 >16 keys
  const { api_key } = await res.json();
  return { apiKey: api_key.api_key, secretHex: bytesToHex(secret) };   // token is NOT re-derivable → SecureStore
}
```
Note: the Perpl sample uses ethers `signTypedData(domain, types, message)` plus `TypedDataEncoder.hash`. The viem equivalents are above. The domain has `chainId` as a hex string (`"0x279f"`) and a `salt`; viem accepts both **(verified for ethers by the sample; viem parity is unverified; test once)**.

Stateless-test note (`mera.md` §stateless): the X-API-Key token can't be re-derived. After a reinstall, either (a) enroll a fresh key (limit 16 active; revoke old ones in the web UI), or (b) store `{apiKey, secretHex}` server-side, encrypted under a PRF-derived key.

### 3.5 Trading WS client: market, limit, cancel, TP/SL (Path A)

```ts
// perpl/trading.ts
type Market = { id: number; order_ttl_blocks: number; config: { price_decimals: number; size_decimals: number } };
export class PerplTrading {
  ws!: WebSocket; sn = 0; nextRq = 0; head = 0; lastSn?: number; accountId = 0; fw = false;
  constructor(private k: PerplKey, private on: (m: any) => void) {}
  connect() {
    this.ws = new WebSocket(`${cfg.ws}/ws/v1/trading`);
    this.ws.onopen = () => this.ws.send(JSON.stringify(wsSignIn(this.k)));          // must arrive < 5 s (mainnet)
    this.ws.onmessage = (e) => {
      const m = JSON.parse(e.data as string);
      if (m.mt === 19) { const a = m.as?.[0]; this.accountId = a?.id; this.fw = a?.fw; this.nextRq = Math.max(this.nextRq, a?.lfr ?? 0); this.lastSn = m.sn; }
      if (m.mt === 21) { this.fw = m.fw; this.nextRq = Math.max(this.nextRq, m.lfr); }  // re-read fw/lfr on every update
      if (m.mt === 100) { if (this.lastSn != null && m.sn !== this.lastSn + 1) return this.ws.close(); this.lastSn = m.sn; this.head = m.h; }
      this.on(m);   // 3 ack · 23/24 orders · 25 fills · 26/27 positions · 28 stats
    };
    this.ws.onclose = () => setTimeout(() => this.connect(), 2000);                  // add backoff per websocket.md
    setInterval(() => this.ws.readyState === 1 && this.ws.send(JSON.stringify({ mt: 1, t: Date.now() })), 30_000);
  }
  private send(o: Record<string, unknown>) {
    const rq = ++this.nextRq; const sn = ++this.sn;
    this.ws.send(JSON.stringify({ mt: 22, sn, rq, acc: this.accountId, ...o }));
    return { rq, sn };                                                                  // match mt:3 by cid===sn, mt:24 by rq
  }
  // Market: p:0 + IOC + slippage bound (API only; onchain needs a limit price)
  market(mk: Market, side: "long" | "short", size: number, lev: number, slippageBps = 50) {
    return this.send({ mkt: mk.id, t: side === "long" ? 1 : 2, p: 0, s: Math.round(size * 10 ** mk.config.size_decimals),
      fl: 4, ms: slippageBps, lv: Math.round(lev * 100), lb: 0 });
  }
  limit(mk: Market, side: "long" | "short", price: number, size: number, lev: number, postOnly = false) {
    return this.send({ mkt: mk.id, t: side === "long" ? 1 : 2, p: Math.round(price * 10 ** mk.config.price_decimals),
      s: Math.round(size * 10 ** mk.config.size_decimals), fl: postOnly ? 1 : 0, lv: Math.round(lev * 100),
      lb: this.head ? this.head + mk.order_ttl_blocks : 0 });
  }
  cancel(mk: Market, oid: number) { return this.send({ mkt: mk.id, oid, t: 5, s: 0, fl: 0, lv: 0, lb: 0 }); }
  // TP/SL on a LONG (mirror with t:4 and swapped conditions for shorts) — recipes.md
  stopLossLong(mk: Market, positionId: number, sizeScaled: number, stop: number) {
    return this.send({ mkt: mk.id, t: 3, p: 0, s: sizeScaled, tp: Math.round(stop * 10 ** mk.config.price_decimals), tpc: 4, lp: positionId, fl: 4, lv: 0, lb: 0 });
  }
  takeProfitLong(mk: Market, positionId: number, sizeScaled: number, target: number) {
    return this.send({ mkt: mk.id, t: 3, p: 0, s: sizeScaled, tp: Math.round(target * 10 ** mk.config.price_decimals), tpc: 3, lp: positionId, fl: 4, lv: 0, lb: 0 });
  }
}
```
Dedup rule (`websocket.md`): *"First non-failure status (`st: 2–5, 8, 9, 10`) is definitive — ignore everything after"*. If only failures arrive, process the first. On `sr:32`, retry once with a new `rq`.

REST alternative for one-shot actions (no socket), from `examples/typescript/submit_orders.ts`: read `GET /v1/trading/wallet` (`sn` = head block, `as[0].lfr`, `as[0].fw`), then `signedFetch(k, "POST", "/v1/trading/orders", JSON.stringify({ d: [orderSpec] }))`, and read `statuses[i]`.

### 3.6 Direct onchain order (Path B, no API key)

```ts
// Onchain enum is 0-based: 0 OpenLong 1 OpenShort 2 CloseLong 3 CloseShort 4 Cancel 5 IncreaseCollateral 6 Change
export async function onchainMarketOrder(account: LocalAccount, mk: Market, side: "long" | "short", size: number, lev: number, slippageBps = 50) {
  const t = await fetch(`${cfg.api}/v1/market-data/${mk.id}/ticker`).then(r => r.json());
  const mark = t.d[mk.id].mrk as number;                                   // scaled by price_decimals
  const px = side === "long" ? Math.ceil(mark * (1 + slippageBps / 1e4)) : Math.floor(mark * (1 - slippageBps / 1e4));
  const desc = {
    orderDescId: BigInt(Date.now()), perpId: BigInt(mk.id), orderType: side === "long" ? 0 : 1, orderId: 0n,
    pricePNS: BigInt(px), lotLNS: BigInt(Math.round(size * 10 ** mk.config.size_decimals)), expiryBlock: 0n,
    postOnly: false, fillOrKill: false, immediateOrCancel: true, maxMatches: 0n,
    leverageHdths: BigInt(Math.round(lev * 100)), lastExecutionBlock: 0n,    // 0 passes; head+<20 reverted in simulation
    amountCNS: 0n, maxNegPnlCollatBPS: 300n,                                  // market default is 300 on mainnet
  } as const;
  const { request, result } = await publicClient.simulateContract({ address: cfg.exchange, abi: exchangeAbi, functionName: "execOrder", args: [desc], account });
  const hash = await walletFor(account).writeContract({ ...request, gas: 700_000n });   // IOC taker ≈ 590k estimated
  return { hash, simulated: result };                                                   // (0,0) = filled immediately (IOC)
}
```

### 3.7 Market data + PnL

```ts
export function streamMarkets(ids: number[], on: (m: any) => void) {
  const ws = new WebSocket(`${cfg.ws}/ws/v1/market-data`);             // no pings needed (10 req/min budget)
  ws.onopen = () => ws.send(JSON.stringify({ mt: 5, subs: [
    { stream: `market-state@${cfg.chainId}`, subscribe: true }, { stream: `funding@${cfg.chainId}`, subscribe: true },
    { stream: `heartbeat@${cfg.chainId}`, subscribe: true },
    ...ids.flatMap(id => [{ stream: `order-book@${id}`, subscribe: true }, { stream: `trades@${id}`, subscribe: true }]) ] })); // ≤16 subs
  ws.onmessage = (e) => on(JSON.parse(e.data as string));   // 6 sub-ack · 9 state {d:{[mkt]:{mrk,orl,lst,bid,ask,oi,…}}} · 15/16 book · 17/18 trades · 100 head
  return ws;
}
// Unrealized PnL in AUSD (inferred formula; positions carry no uPnL field)
export const uPnL = (p: { sd: 1 | 2; ep: number; s: number }, mark: number, mk: Market) =>
  ((p.sd === 1 ? mark - p.ep : p.ep - mark) / 10 ** mk.config.price_decimals) * (p.s / 10 ** mk.config.size_decimals);
```

---

## 4. Recommended architecture for the bounty demo

1. **Sign in with Mera** (Face ID) → EOA → show **AUSD wallet balance** (`balanceOf`) and **Perpl collateral** (`getAccountByAddr.balanceCNS`), both labelled AUSD. Optionally add the Agora `/v0/metrics` Monad supply line.
2. **Fund.** Swap USDC→AUSD on Uniswap v4 (or Aurora deposit → USDC → AUSD), then `approve` + `createAccount`. The user needs a little MON for gas (sponsor it; see `mera.md`).
3. **Trade.** For the MVP use **Path B** (`execOrder` IOC with a slippage-bounded price). It needs no API key, no origin whitelisting and no dependence on the enroll-profile question, and every trade is a Face-ID-scoped onchain tx, which demos well. **Upgrade to Path A** (one-time `allowOrderForwarding` + key enroll) for gasless one-tap orders, TP/SL and builder-code attribution once Perpl confirms native enrollment.
4. **Positions/PnL.** Read-scope key → `/v1/trading/positions` + `market-state`; or onchain `getPositionV2` + the Envio indexer.
5. **Ask Perpl now:** builder code (form above), origin whitelist for the web build, a profile/enroll prerequisite for native origin-less enrollment, whether the geo-block is enforced at the API, direct-onchain builder attribution via `execOrderV2`, and testnet AUSD.

## 5. Open questions / routes

| Question | Route |
|---|---|
| Staging `api.agorafi.co` (Cloudflare Access) and a sandbox org API key | Agora mentors (Nick van Eck, Drake Evans) at Metropolis; `agora.finance/contact`; X `@withAUSD` |
| Testnet AUSD (faucet `0xd236…e6C` drained on Monad testnet) | Agora mentors (refill the faucet); Perpl Discord `discord.gg/perpl`; else mainnet |
| What creates a Perpl "profile" (enroll → 404 for a fresh wallet) and whether origin-less native enrollment is allowed | Perpl Discord / mentor gvan / judge PBJ |
| Builder code registration | Google Form in mainnet `/v1/pub/context.features.builderApplyUrl` |
| Geo-block `US`, `GB`, … enforced by the API/WS? | Perpl |
| RWA (gold/stock/FX) markets on Perpl: the ABI has an RWA fee schedule, but no market is listed | Perpl |
| Exact `transferWithAuthorization` overload on AUSD | Read the verified source on monadscan |

## Sources

- Bounty: `../_portal/bounties/agora-best-mobile-trading-app-on-monad-agora-onchain-trading-bount.md`; staging clause only in `../_portal/bounties/agora-best-cross-border-payments-app-on-monad-agora-payments-bount.md`
- Agora: `https://docs.agora.finance/llms.txt`, `/api.md`, `/api/authentication.md`, `/api/changelog.md`, `/api/errors.md`, `/api/endpoints/routes/overview.md`, `/developer/contract-deployments.md`, `/contract-overview.md`, `/developer/advanced-erc-features.md`, `/instant-settlement/guides/getting-testnet-tokens.md`; live `https://api.agora.finance/v0/openapi.json` (servers incl. Staging `https://api.agorafi.co`), `https://api.agora.finance/v0/metrics`; `https://www.agora.finance/`
- Monad registries: `github.com/monad-crypto/protocols` (`mainnet/agora.jsonc`, `upshift.jsonc`, `chainlink.jsonc`), `github.com/monad-crypto/token-list` (`mainnet/earnAUSD`, `sAUSD`, `hyAUSD`, `gAUSD`)
- DEX liquidity: `https://api.geckoterminal.com/api/v2/networks/monad/tokens/0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a/pools`
- Perpl: `references/perpl-api-docs/{README,authentication,integrations,websocket,rest-endpoints,types,examples}.md`, `examples/typescript/submit_orders.ts`, `examples/js/enroll_api_key.js`; `references/perpl-docs/docs/resources/for-developers/{networks-and-configuration,recipes,api/typescript}.md`, `docs/exchange/{order-types,margin,minimum-orders}.md`, `docs/onboarding/funding-a-wallet.md`; `references/perpl-dex-sdk/crates/sdk/{abi/dex/Exchange.json,src/types/request.rs,src/types/extension.rs,src/state/version.rs,src/lib.rs}`; `references/perpl-delegated-account/README.md`; live `https://{app,testnet}.perpl.xyz/api/v1/pub/context`
- Mera account model: `./mera.md`
