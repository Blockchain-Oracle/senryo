/**
 * Portfolio: the account's latest risk buckets (AccountRiskUpdated), per-token balances, open positions on both
 * venues, the Perpl account and the indexer's progress on that chain — one request per screen. Display only: money
 * decisions read the chain at `finalized` (D-014).
 */
import { z } from "zod";
import { defineDocument, type ResultOf } from "../client.ts";
import { bigintish, optionalBigint, optionalInt } from "../scalars.ts";
import { META_FIELDS, meta, POSITION_FIELDS, position } from "./fragments.ts";

export interface AccountVars {
  chainId: number;
  /** lowercase address */
  user: string;
}

const user = z.object({
  id: z.string(),
  riskNonce: bigintish,
  equityInit: bigintish,
  imTotal: bigintish,
  mmTotal: bigintish,
  holds: bigintish,
  cardDebt: bigintish,
  envelope: bigintish,
  freeToTrade: bigintish,
  freeToSpend: bigintish,
  riskUpdatedAt: optionalInt,
  riskBlock: optionalInt,
  deposited: bigintish,
  withdrawn: bigintish,
  realizedPnl: bigintish,
  feesPaid: bigintish,
  fundingPaid: bigintish,
  borrowPaid: bigintish,
  volume: bigintish,
  cardSpent: bigintish,
  cardRefunded: bigintish,
  perplCollateral: bigintish,
  tradeCount: z.number().int(),
  liquidationCount: z.number().int(),
  openPositions: z.number().int(),
  firstDepositAt: optionalInt,
  firstTradeAt: optionalInt,
  perplAccount: z.object({ id: z.string(), balance: optionalBigint }).nullable(),
  balances: z.array(
    z.object({
      symbol: z.string(),
      token: z.string(),
      balance: optionalBigint,
      balanceBlock: optionalInt,
      deposited: bigintish,
      withdrawn: bigintish,
    }),
  ),
  positions: z.array(position),
});

export type IndexedUser = z.infer<typeof user>;

/** `user` is null when the address has never touched our contracts on that chain (a real "no account yet"). */
export const PortfolioDocument = defineDocument<AccountVars>()(
  "Portfolio",
  `query Portfolio($chainId: Int!, $user: String!) {
    User(where: { chainId: { _eq: $chainId }, id: { _eq: $user } }) {
      id riskNonce equityInit imTotal mmTotal holds cardDebt envelope freeToTrade freeToSpend riskUpdatedAt riskBlock
      deposited withdrawn realizedPnl feesPaid fundingPaid borrowPaid volume cardSpent cardRefunded perplCollateral
      tradeCount liquidationCount openPositions firstDepositAt firstTradeAt
      perplAccount { id balance }
      balances(order_by: { symbol: asc }) { symbol token balance balanceBlock deposited withdrawn }
      positions(where: { status: { _eq: "OPEN" } }, order_by: { openedAt: desc }) { ${POSITION_FIELDS} }
    }
    _meta(where: { chainId: { _eq: $chainId } }) { ${META_FIELDS} }
  }`,
  z
    .object({ User: z.array(user).max(1), _meta: z.array(meta) })
    .transform((d) => ({ user: d.User[0] ?? null, meta: d._meta[0] ?? null })),
);

export type Portfolio = ResultOf<typeof PortfolioDocument>;
