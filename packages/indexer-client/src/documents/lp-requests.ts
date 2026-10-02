import { z } from "zod";
import { type ChainWhere, defineDocument } from "../client.ts";
import { META_FIELDS, meta } from "./fragments.ts";

export const LpRequestsDocument = defineDocument<{
  chainId: number;
  where: ChainWhere;
  offset: number;
  limit: number;
}>()(
  "LpRequests",
  `query LpRequests($chainId: Int!, $where: LpRedeemRequest_bool_exp!, $offset: Int!, $limit: Int!) {
    LpRedeemRequest(where: $where, order_by: { id: asc }, offset: $offset, limit: $limit) { id }
    _meta(where: { chainId: { _eq: $chainId } }) { ${META_FIELDS} }
  }`,
  z
    .object({ LpRedeemRequest: z.array(z.object({ id: z.string() })), _meta: z.array(meta) })
    .transform((d) => ({ requests: d.LpRedeemRequest, meta: d._meta[0] })),
);
