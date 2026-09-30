import type { AccountSnapshot } from "@senryo/chain";

/** The bucket fields the apps render (api-client `bucketsSchema`), from a chain snapshot. */
export function bucketsOf(s: AccountSnapshot) {
  return {
    freeToTrade: s.freeToTrade,
    freeToSpend: s.freeToSpend,
    equityInit: s.equityInit,
    equityLiq: s.equityLiq,
    im: s.im,
    mm: s.mm,
    holds: s.holds,
    cardDebt: s.cardDebt,
    envelope: s.envelope,
    ausd: s.ausd,
    usdc: s.usdc,
    nonce: s.nonce,
  };
}
