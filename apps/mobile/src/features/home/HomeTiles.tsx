import { useLpVault } from "@senryo/query";
import { router } from "expo-router";
import { ListRow } from "~/components/kit/ListRow";
import { useAccount } from "~/lib/account/provider";
import { ROUTES } from "~/lib/constants/routes";
import { usd } from "~/lib/money";
/** Investments follow wallet holdings, without a duplicated card promotion. */
export function HomeTiles() {
  const vault = useLpVault(useAccount().hint?.address);
  const value = vault.status === "fresh" || vault.status === "stale" ? vault.value : undefined;
  return (
    <ListRow
      title="Liquidity pool"
      detail={
        value
          ? `${usd(value.sharesValue + value.pendingValue)} invested${value.pending.length ? " · Redemption pending" : ""}`
          : "Your investment"
      }
      onPress={() => router.push(ROUTES.lp)}
    />
  );
}
