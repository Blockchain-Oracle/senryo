/** Card debt row shared by the card and liquidation handlers (handler files never import each other). */
import type { CardDebt } from "envio";
import type { Ctx, Meta } from "./meta.ts";

export async function updateCardDebt(ctx: Ctx, meta: Meta, userId: string, patch: (d: CardDebt) => Partial<CardDebt>) {
  const row: CardDebt = (await ctx.CardDebt.get(userId)) ?? {
    id: userId,
    user_id: userId,
    outstanding: 0n,
    created: 0n,
    repaid: 0n,
    coveredByInsurance: 0n,
    updatedAt: meta.timestamp,
  };
  ctx.CardDebt.set({ ...row, ...patch(row), updatedAt: meta.timestamp });
}
