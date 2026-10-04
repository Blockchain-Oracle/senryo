/** Public prediction discovery. Settlement networks do not expand Senryo's money-network allowlist. */
export const PREDICTION_VENUES = {
  polymarket: {
    gamma: "https://gamma-api.polymarket.com",
    clob: "https://clob.polymarket.com",
    data: "https://data-api.polymarket.com",
    web: "https://polymarket.com",
    chainId: 137,
    network: "Polygon",
    tags: { BTC: "235", ETH: "39" },
  },
  castora: {
    web: "https://castora.xyz",
    chainId: 143,
    network: "Monad",
    core: "0x9E1e6f277dF3f2cD150Ae1E08b05f45B3297bE6D",
    getters: "0xf08959E66614027AE76303F4C5359eBfFd00Bc30",
  },
} as const;

/** Provider identifiers, NOT transferable token contracts; pinned Castora frontend tokens.ts, revision 6e0b6dc. */
export const CASTORA_ASSETS: Readonly<Record<string, string>> = {
  [PREDICTION_VENUES.castora.core.toLowerCase()]: "MON",
  "0x294c2647d9f3eaca43a364859c6e6a1e0e582dbd": "ETH",
  "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac6": "BTC",
  "0xd31a59c85ae9d8edefec411d448f90841571b89c": "SOL",
};
