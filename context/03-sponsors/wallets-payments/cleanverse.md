# Cleanverse — CVI / CVA compliance layer ("Best Integration of CVI/CVA", $2,000)

> Cleanverse International Pte Ltd (Singapore). It ran "Cleanverse Build", a 48h hackathon **supported by Monad Foundation** (Aug 2026, 91 finalists, many deployed on **Monad testnet**). A Metropolis livestream on integrating Cleanverse was held on 11 Sep 2026.

## What CVI / CVA are
The **Cleanverse Compliance Protocol (CCP)** is patent-pending and interlocks three pieces:
- **CVI, Cleanverse Verified Identity**, marketed as **"A-Pass"**. It is a **non-transferable, reusable identity token bound to a wallet address**, issued after an institution verifies the user (ID/passport/UEN plus bank credentials). The attestation is tiered, has status (active/frozen/revoked) and an expiry, and Cleanverse stores no KYC data on-chain.
- **CVA, Cleanverse Verified Asset**, marketed as **"A-Token"**, e.g. **aUSDC**. These are stablecoins, RWAs or tokenized deposits that were either issued with the CCP (by issuance) or deposited through approved licensed institutions (by deposit; USDC/USDT get wrapped). They can **only move between CVI-bound wallets**, and a transfer policy is enforced on every transfer.
- **Programmed governance / enforcement**: on-chain policy (`RuleV2`: group, sub-group, min tier, min sub-tier, country bitmap), pre-transaction checks, blacklists, **Travel Rule** reports, and member/regulator consoles.

## Monad support and access
- Docs are at **https://docs.cleanverse.com**, which is gated by an **invitation code**. Get one via the Metropolis Cleanverse channel/livestream, Telegram (t.me/TheCleanverseGroup), Discord, or `support@cleanverse.com`. **Do this first.** Sandbox `api-id`/`api-key` were reportedly issued instantly to Cleanverse Build teams.
- The details below come from **Cleanverse Build team write-ups** (the Legate repo `DECISIONS.md`, reporting live sandbox calls), not official docs we could read. They are **(unverified)**. Confirm against docs.cleanverse.com.

| Item | Reported value |
|---|---|
| UAT REST base | `https://uatapi.cleanverse.com/api/cooperate` (header auth with `api-id`; some endpoints need **AES-CBC encrypted bodies** using `api-key`) |
| API size | ~40 endpoints in 5 modules, **no official SDK** (raw HTTP/JSON) |
| Identity endpoints | `query_apass`, `verify_apass`, `generate_apass`, `update_status` (a missing A-Pass returns code `0002`) |
| Asset/flows | `query_deposit_address`, `query_deposit_atoken_list({chain:"monad"})`, `query_institution_white_list`, `query_txs`, `download_travel_rule` (PDF by txHash), `faucet` |
| Validator registration | `POST /validator/grant` then `POST /validator/register` (both EIP-191 signed by the **contract's `Ownable` owner** over lowercase `chain+address`), plus `validator/verify` |
| On-chain validator (Monad testnet) | `IAPassComplianceValidator` at `0xaC7e5179C2C7f03f209136886c172eb34F161792`, `complianceVerify(pool, user) returns (bool)`, public view |
| aUSDC (Monad testnet) | **Redeployed on 2026-08-08**: `0xFA96de5b8f434c26fdff953303dd66ff80af1026` with **18 decimals** (the old `0xaC08…f20D` had 6). It wraps testnet USDC `0x534b2f3A21130d7a60830c2Df862319e593943A3`. Always read `decimals()` live |
| Fiat ramp module | Transak-powered, gated to the "Issue Member" role. Reportedly **no `monad` network** support |
| Revocation webhooks | None for A-Pass. Poll `query_apass`/`verify_apass` |

## Minimal integration pattern (Solidity)
```solidity
// Gate any value-moving function on Cleanverse CVI (interface as reported by Cleanverse Build teams — verify in docs)
interface IAPassComplianceValidator {
    function complianceVerify(address pool, address user) external view returns (bool);
}

contract VerifiedEscrow {
    IAPassComplianceValidator public immutable validator;
    IERC20 public immutable aToken;          // CVA (aUSDC) — only settlement asset
    constructor(address v, address a) { validator = IAPassComplianceValidator(v); aToken = IERC20(a); }

    error NotCompliant(address who);
    modifier cvi(address who) { if (!validator.complianceVerify(address(this), who)) revert NotCompliant(who); _; }

    function pay(address to, uint256 amt) external cvi(msg.sender) cvi(to) {
        aToken.transferFrom(msg.sender, to, amt);   // CVA transfer itself also enforces CCP rules
    }
}
```
Flow:
1. Deploy the contract (it must be `Ownable`, since the validator checks the owner signature).
2. `POST /validator/grant` → `POST /validator/register` with your `RuleV2` (e.g. `min_tier`, `countries: ["SG","MY"]`).
3. Register the contract's A-Pass (`registerApass`, which the guide says is "factory-only" and reportedly worked for REGISTER_ROLE holders) so it can hold A-Tokens.
4. Register test wallets and give them A-Passes.
5. After settlement, anchor the `download_travel_rule` report hash on-chain.

## Judging (from the Cleanverse Build rubric, likely reused)
**Concept 20 · CVI-CVA integration depth 30 · Build quality 25 · UX & demo 15 · Scalability 10.** Depth means "how many genuine integration points, and whether verification is enforced **where value actually moves**". Previous winners say things like "remove Cleanverse and the product can't exist".

## Winning ideas (Metropolis angle)
1. **Compliant agent payment rail** (Trust/AI track): AI agents pay only CVI-verified counterparties in aUSDC. Caps live in contract storage, the x402 endpoint checks `complianceVerify` before settling, and a Travel Rule proof is attached per payment. Similar to the "Legate" and "SpendClear" entries, so differentiate with a Monad-mainnet-grade UX.
2. **Verified payroll / remittance streams**: a Sablier-style per-second stream of aUSDC that auto-pauses when the recipient's A-Pass is revoked or expired (polled), with the employer and regulator dashboard. Consumer + compliance.
3. **KYC'd group treasury / ROSCA**: group spending where every member must hold an A-Pass of tier ≥ N, settle-up happens only in CVA, and the audit export works in one click.
4. **CVI-tiered undercollateralized credit**: the A-Pass tier is a live risk parameter, and revocation freezes the position on-chain. This theme won 3rd place at Cleanverse Build.

## Gotchas
- **Docs are invite-only** and some roles or modules are gated, so start access requests now.
- Addresses and decimals changed mid-hackathon last time. **Query `query_deposit_atoken_list` and `decimals()` live** and never hardcode 6.
- `validator/verify` returns error `12027` for an unregistered **or** paused pool.
- The sandbox had a seeded A-Pass on `0x…dEaD`. Register your own wallets for the demo.
- Validator registration is human-in-the-loop at Cleanverse and turnaround isn't guaranteed. Build behind a mock `complianceVerify` toggle from hour one.
- Keep the `api-key` out of the repo, since it's used for AES body encryption.

## Sources
- https://cleanverse.com/ · https://cleanverse.com/how-it-works · https://cleanverse.com/hackathon-results (rubric + winners)
- https://docs.cleanverse.com/ (invite-gated) · https://github.com/cleanverseorg
- https://web3voyager.com/event/cleanverse-build-trusted-assets-hackathon-1785115285432
- Team repos (third-party, unverified): https://github.com/Ritik200238/legate-cleanverse (README + DECISIONS.md) · https://github.com/winsznx/conduit · https://github.com/icohangar-ops/spendclear-cleanverse · https://github.com/Alike001/principal-cleanverse
- https://www.youtube.com/watch?v=FScR7LD78c0 (Monsoon: trade finance on Monad with CVI/CVA)
