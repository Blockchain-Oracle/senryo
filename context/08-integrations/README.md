# 08: Integration research (for the locked direction)

**Locked direction (2026-09-29):** Track 01. A mobile-first trading app for real-world markets (gold, stocks, FX perps) plus crypto perps via Perpl, with one collateral vault and a card that spends uncommitted collateral. Face ID passkeys via Mera for sign-in and transaction confirmation. Ships on iOS, Android (APK/Play) and web (some features, e.g. Apple Pay, mobile-only).
**Target bounties:** Agora Mobile Trading ($10K), Mera-Powered UX ($2.5K), Aurora Intents ($5K), Envio ($1K). See [../07-decision/track-and-bounty-fit.md](../07-decision/track-and-bounty-fit.md).

Cloned source repos live in `../../references/` (read-only references; any code reused must be disclosed per rules §4.1).

| File | Covers |
|---|---|
| `mera.md` | Mera passkey accounts: web + React Native SDK, signing sessions, stateless test, rpId, PRF |
| `agora-ausd-and-perpl.md` | AUSD + Agora public API/staging; Perpl API/SDK: onboarding, collateral, placing trades from a mobile app |
| `aurora-intents.md` | Swap API, Intents Deposits, Intents Connect: deposit-and-execute into our vault (done 2026-09-29) |
| `envio.md` | HyperIndex on Monad for our contracts + Perpl events; Envio Cloud |
| `platforms-and-stores.md` | Expo/React Native for iOS + Android + web, passkeys on each, Apple Pay provisioning, App Store and Google Play policies for trading apps |
