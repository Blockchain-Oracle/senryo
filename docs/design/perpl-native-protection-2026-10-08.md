# Perpl native protection: remaining source boundary

8 October 2026. Narrow architecture/gap audit only, following Task 3 commits d8b2cdc and 45a2d65. No duplicate review of math, fee fixes or terminal recovery. No tests, user credentials, enrollment, UI interaction, transactions, source changes or Git mutations were performed. This report is the sole write.

## Decision

**Recommend Task 3B. Feasible source work remains.** The current adapter is useful protocol groundwork, but it is not a native protection journey. Retain activation gating while implementing the native review, credential lifecycle, authenticated transport and order controller behind injected dependencies. Those implementations and their local checks do not require enabling forwarding or granting an API key on a real account. “Provider blocked” is accurate for live admission/acceptance and several authority guarantees, not for all remaining source work.

A completed Task 3B would mean a concrete, reviewable, locally exercised implementation with accurately bounded production capability. It would not mean provider acceptance or permission-bounded server authority. Do not remove the remaining full native protection requirement from the approved product scope.

## What actually exists

- `packages/query/src/perpl-protection.ts` has a review/spec encoder, status reducer, replacement eligibility predicate, cancellation spec constructor and public-intent journal. Its production references found under apps/packages/services consist of the query barrel export and `PERPL_PROTECTION_GATES` usage. No native controller instantiates the journal or calls the spec/reconciliation functions.
- `apps/mobile/src/features/perpl/PerplPositionDetail.tsx` opens a requirements sheet with current held size, mark and static “Not activated” status. It contains no threshold inputs, frozen review, submission, order list or actionable recovery. `PerplTicketEntry.tsx` also retains setup messaging. Static unavailability is honest but does not implement the journey.
- `packages/query/src/perpl.ts` reads chain account/position/market state. The public market stream is not an authenticated trading connection. No production `ApiKeySignIn`, enrollment-payload or signed REST implementation was found in apps/packages/services.
- `apps/mobile/src/features/positions/OrdersScreen.tsx` and `useCancelOrder.ts` are existing engine lifecycle owners, not an implemented Perpl conditional controller. Preserve the engine lifecycle and add venue-specific integration.

## Correct the signer assumption

The default native account is a **passkey-unlocked secp256k1 EOA**, not inherently a WebAuthn/EIP-1271 contract wallet:

- `packages/account/src/derive.ts`: passkey PRF → frozen BIP-39/BIP-32 derivation → `createSecp256k1SigningSession` → EVM address.
- Installed `@category-labs/mera@0.2.0/src/viem.ts`: EIP-712 is `hashTypedData` followed by session secp256k1 signing and ordinary serialized Ethereum signature.
- `packages/account/src/client.ts`: `stepUp` opens a fresh pinned ceremony, exposes a one-shot signer, then ends the session in `finally`.
- `packages/account/src/policy/typed-data.ts`: deliberately rejects unknown/Perpl enrollment typed data from the ordinary scoped session with step-up required.
- `packages/account/src/delegation.ts` separately supports an EIP-7702 authorization spike. Do not infer that every current account is delegated, or that EOA signing is unavailable.

Therefore an exact enrollment signer adapter, scope rejection checks, fixture signature recovery and one-shot step-up binding are feasible now. Actual provider acceptance remains untested. Only accounts whose actual address/deployment requires contract-wallet verification need a separate compatibility gate; do not impose speculative EIP-1271 support as a universal blocker. Do not bypass the existing policy or broadly whitelist enrollment typed data into the trading session.

## Documented interface versus missing guarantees

Pinned primary evidence remains `PerplFoundation/api-docs` commit `25ab6e2c75c8f84d0550da8c3be30af49ad631f2`; the relevant pages were read again for this audit.

[Integrations](https://github.com/PerplFoundation/api-docs/blob/25ab6e2c75c8f84d0550da8c3be30af49ad631f2/integrations.md) documents payload/enroll endpoints, wallet EIP-712 plus Ed25519 proof, finite `expires_at`, a client-held opaque token, required whitelisted Origin and broad trade scope. Key listing/revocation is web-UI-only. Thus client enrollment/storage code is implementable; origin admission and fully native provider-key revocation are external gates. The response's `typed_data:any` is not an adequate trusted schema: bind the returned payload to reviewed terms and refuse unknown semantics; obtain a pinned schema/example before enabling its live signer.

[Authentication](https://github.com/PerplFoundation/api-docs/blob/25ab6e2c75c8f84d0550da8c3be30af49ad631f2/authentication.md) specifies REST request signing and first-message WebSocket authentication. Implement byte-exact target/body signing, random nonce, timestamp/expiry checks, fresh authentication on reconnect and explicit expired/revoked/clock-error states. A new HTTP authentication nonce is distinct from a stable business request ID. No undocumented signing protocol is needed.

[REST endpoints](https://github.com/PerplFoundation/api-docs/blob/25ab6e2c75c8f84d0550da8c3be30af49ad631f2/rest-endpoints.md) provides signed wallet/orders/positions snapshots, order/fill history and order submission. REST is sufficient for an initial complete native controller; a second trading socket implementation need not precede local lifecycle work. Use snapshot block/as-of information and pagination. Absence from an open-orders response is not proof of cancellation or fill.

[WebSocket lifecycle](https://github.com/PerplFoundation/api-docs/blob/25ab6e2c75c8f84d0550da8c3be30af49ad631f2/websocket.md) remains a source for conditional status and recovery semantics. Preserve the earlier audit's explicit trigger-expiry conflict; do not fabricate an expiry, OCO or key-expiry cancellation promise. API admission and actual execution remain separate.

## Minimal Task 3B owner map and acceptance checks

1. **Native form and review** — add `features/perpl/PerplProtectionSheet.tsx` and `usePerplProtection.ts`; connect position detail and Perpl order rows to existing navigation. Implement SL/TP threshold, mark/last source, exact held quantity, executable price/slippage, fee review and a frozen review identity. Invalidate on account/network/position/side/size/source or terms changes before confirmation and transport. Show draft, setup unavailable, pending, active, execution started, partial, terminal and uncertain recovery distinctly. Do not persist a mere draft as an admitted protection intent. Tests: field scaling/bounds, stale review, account switch during confirm, independently reviewed legs and unavailable activation with useful drafts.

2. **Authenticated protocol client** — add focused `packages/query/src/perpl-auth.ts` and `perpl-trading.ts` with injected fetch, clock, randomness and credential signer; keep secrets outside Query cache and the public journal. Parse provider responses before reconciliation. Bind chain, API deployment, wallet, exchange account, request and actual order identity. Tests: canonical bytes, malformed/mismatched snapshots, HTTP success/admission without activation, timeout then same-rq recovery, pagination and expired credentials. Network-disabled fixture tests can exercise this source without claiming provider validation.

3. **Order controller and durable recovery** — extend the adapter through a controller rather than teaching screens ad hoc retry rules. Coordinate request allocation at account scope across SL, TP, replacement and cancellation; retain separate order IDs and actual fill/remaining quantities. Journal submitted cancellations and replacement relations as well as creations. Recover after restart before issuing uncertain work; refresh wallet forwarding and authenticated state. Only retire old protection after confirmed new activation; retain both orders and explain overlap if old cancellation fails. Never infer sibling cancellation or future-position sizing. Tests: concurrent legs, canceled-request recovery, new-active/old-cancel-failed, reduce/invert during review, partial fill and reconnect. Keep the already-fixed absorbing terminal reducer intact.

4. **Secure credential/enrollment lifecycle** — add Perpl-specific account/platform storage and a mobile enrollment model beside existing `packages/account/src/platform/secret-store.native.ts` patterns. Scope by deployment/owner; use OS secure storage for key and token, explicit finite expiry, bounded unlocked use and lock/sign-out/account-switch cleanup. Never store secrets in MMKV, logs, analytics or intent history. Implement payload validation, reviewed consent binding, one-shot `AccountClient.stepUp`, proof generation and token persistence as injectable operations. Handle payload/enroll/store failure separately: successful enrollment with lost response/token is uncertain, not a license for endless re-enrollment; keep public metadata and offer provider cleanup. Tests: storage failure, expired key, biometric invalidation, interrupted enrollment, locked app, account mismatch, redaction and no silent fallback to an unbounded credential. Actual native keychain/biometric behavior remains device acceptance.

5. **Explicit forwarding/recovery ceremony** — source can prepare a separate reviewed enable/disable operation once the exact ABI/deployment is verified, reusing the existing fee/passkey/send gates. The checked-in ABI currently has no forwarding function; add only from verified ABI evidence. Do not inject forwarding into protection save, scoped session policy or ordinary IOC entry. Implement explanatory recovery actions now: reconnect/reconcile, renew through explicit enrollment, open provider key management when authorized, and reviewed forwarding disable when supported. Local deletion, forwarding disable, outstanding-order cancellation and provider key revocation must have separate states and labels.

## Genuine activation gates

- Product/user acceptance of persistent forwarding and accountwide API trade authority remains required. A finite credential lifetime limits time; it does not impose provider-enforced market/size/reduce-only caps. If the approved requirement is strict per-order bounded authority, these APIs do not satisfy it; provider changes or a separately approved architecture are necessary.
- A whitelisted integration origin and verified native transport treatment are required for live enrollment. Do not invent a browser origin, relay private keys through a backend or bypass provider admission.
- The exact returned enrollment schema/domain/terms must be verified before live signing. Existing EOA cryptography is source-supported; enrollment acceptance for the actual chosen account is still a real integration test.
- Fully native key listing/revocation needs a documented provider capability; otherwise an explicitly accepted provider-web management handoff is a product decision. Local deletion is not revocation.
- Trigger lifetime ambiguity and behavior under position changes, sibling races, provider restart, forwarding disable and expired keys require provider clarification/isolated authorized testing. Do not claim finite protection lifetime from finite key expiry.
- Real admission, execution, cancellation, replacement and recovery need authorized provider testing; phone/keyboard/biometric acceptance needs devices/UI permission. None is proved by local fixtures.

Task 3B can finish items 1–4 and the verified preparatory/recovery portions of 5 without granting public authority. Report implementation completeness separately from these remaining activation gates. This prevents an honest unavailable label from becoming a silent endpoint for required native functionality.
