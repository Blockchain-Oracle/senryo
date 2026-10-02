import type { SpotToken } from "@senryo/config";
import { router } from "expo-router";
import { RowShell } from "~/features/markets/RowShell";
import { tokenRoute } from "~/lib/constants/routes";
import { signedPct, usd } from "~/lib/money";
import { tokenAmount, tokenPrice } from "./format";

/**
 * One spot token (Fomo F10; flow book C1 step 4), in the markets' `RowShell` grammar: its real logo from the Monad
 * token list, symbol over name — or over what you hold and its worth — then the live price over its 24 h change.
 * A token whose route has no live pool shows no price. The row opens the token's page.
 */
export function TokenRow({
  token,
  priceUsd18,
  change24hBps,
  held,
}: {
  token: SpotToken;
  /** Undefined while loading; null when a hop has no live pool. */
  priceUsd18: bigint | null | undefined;
  change24hBps: bigint | undefined;
  /** What the account holds: raw units and their USD worth (usd6), when it holds any. */
  held?: { balance: bigint; valueUsd6: bigint | undefined } | undefined;
}) {
  const detail = held
    ? `${tokenAmount(held.balance, token.decimals, token.symbol)}${held.valueUsd6 === undefined ? "" : ` · ${usd(held.valueUsd6, undefined, "mainnet")}`}`
    : token.name;
  const price = priceUsd18 === undefined ? undefined : priceUsd18 === null ? null : tokenPrice(priceUsd18);
  return (
    <RowShell
      mark={token.mark}
      markLabel={token.symbol}
      title={token.symbol}
      subtitle={detail}
      price={price}
      changeBps={change24hBps}
      onPress={() => router.push(tokenRoute(token.symbol))}
      accessibilityLabel={`${token.name}, ${token.symbol}${price ? `, ${price}` : ""}${change24hBps === undefined ? "" : `, ${change24hBps >= 0n ? "up" : "down"} ${signedPct(change24hBps)} in 24 hours`}${held ? `, you hold ${detail}` : ""}`}
    />
  );
}
