# Practice (Monad testnet) MON runbook

Testnet MON is Practice's scarcest resource:

- **Keeper.** It mirrors the mainnet Chainlink gold, silver and FX prices onto testnet, because testnet Chainlink only has BTC and ETH. It burns about **2 MON/day**. When it runs dry, every engine market shows "Price paused" and trades fail; this happened from 4 to 7 Oct.
- **Sponsor and StarterDrip.** They give new Practice users gas.
- **Agora test AUSD.** This is not scarce: faucet `0xd236c18D274E54FAccC3dd9DDA4b27965a73ee6C` pays 10,000 AUSD per call to any address.

## Wallets (public addresses)

| Role | Address | Funded by |
|---|---|---|
| Keeper (price pushes, liquidations) | `0xf6a36dC37104e200B277Eedc60Af060440D33b10` | faucet claims or StarterDrip.withdrawNative |
| Sponsor (relays, gas top-ups) | `0xb00A73D3C207f8764A4cAD83a9b12186D9d6DA99` | faucet claims |
| StarterDrip (new-user MON drip, contract) | `0xD112a9A3Faa3491e3a91b95c0924b3eEaB85b207` | plain MON transfer |
| Deployer (admin; pays for withdrawNative) | `0x52d205731E97C90aAB738AE66371449F585C0E6A` | faucet claims |

## Check balances

```bash
for a in 0xf6a36dC37104e200B277Eedc60Af060440D33b10 0xb00A73D3C207f8764A4cAD83a9b12186D9d6DA99 0xD112a9A3Faa3491e3a91b95c0924b3eEaB85b207 0x52d205731E97C90aAB738AE66371449F585C0E6A; do cast balance $a --ether --rpc-url https://testnet-rpc.monad.xyz; done
```

Top up the keeper when it is below **1 MON** (about 12 hours left).

## Refill

1. **Faucets.** They are human-only because of bot checks; never automate around them. Send claims to the keeper first:
   - [faucet.monad.xyz](https://faucet.monad.xyz): official; linking X/Discord gives more.
   - [Alchemy](https://www.alchemy.com/faucets/monad-testnet): 1 MON per 24 h; needs 0.001 ETH on Ethereum mainnet.
   - [QuickNode](https://faucet.quicknode.com/monad): every 12 h.
   - Chainstack and OKX: about 0.5 MON per day each.
   - Circle developer console: 0.1 MON per request, 10 per day.
2. **Moving MON between our wallets.** Uses the deployer keystore and is recorded in `docs/plan/ids-and-txs.md`:

   ```bash
   cast send 0xD112a9A3Faa3491e3a91b95c0924b3eEaB85b207 "withdrawNative(address,uint256)" 0xf6a36dC37104e200B277Eedc60Af060440D33b10 <wei> --account senryo-deployer --password-file ~/.config/senryo/deployer.password --rpc-url https://testnet-rpc.monad.xyz
   ```
3. **Hackathon allocation.** Ask Monad DevRel through the Metropolis mentors (draft in `docs/plan/outreach-2026-10-08.md`).

## Planned relief
- Stage 1 moves Practice crypto trading onto Perpl testnet. Its prices come from Perpl's own market maker, not our keeper.
- Stage 5 moves Practice user gas and the keeper onto Pimlico's free testnet sponsorship (EIP-7702). See `docs/plan/real-venues-2026-10-08.md`.
