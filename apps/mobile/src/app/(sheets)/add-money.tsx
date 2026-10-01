import { collateralId, ids, ROUTE_CHAIN_ID } from "@senryo/identity";
import { type Href, router } from "expo-router";
import { MarkCluster } from "~/components/identity/MarkCluster";
import { ListRow } from "~/components/kit/ListRow";
import { Panel } from "~/components/kit/Surface";
import { useSheetClose } from "~/components/sheet/Sheet";
import { SheetRoute } from "~/components/sheet/SheetRoute";
import { ACTIVE_NETWORK } from "~/lib/constants/auth";
import { fundQrRoute, ROUTES } from "~/lib/constants/routes";
import { SIZE } from "~/theme";

/**
 * F20 Add-money hub: always one tap away; also the empty state of Portfolio. Each route shows the real marks of what
 * it moves through: source networks, the Monad network, Aurora for the intent route, the two collateral tokens.
 */
const OPTIONS: { title: string; detail: string; href: Href; marks: readonly string[] }[] = [
  {
    title: "Deposit by QR",
    detail: "From any chain to your own address",
    href: fundQrRoute("evm"),
    marks: [ROUTE_CHAIN_ID.base, ROUTE_CHAIN_ID.ethereum, ROUTE_CHAIN_ID.arbitrum],
  },
  {
    title: "From a Monad wallet",
    detail: "AUSD or USDC",
    href: fundQrRoute("monad"),
    marks: [ids.evmChain(ACTIVE_NETWORK.chainId)],
  },
  {
    title: "From a wallet",
    detail: "Approve an intent with Face ID",
    href: ROUTES.fundWallet,
    marks: [ids.provider("aurora")],
  },
  {
    title: "Swap USDC ↔ AUSD",
    detail: "Uniswap v4 on Monad",
    href: ROUTES.fundSwap,
    marks: [collateralId(ACTIVE_NETWORK.chainId, "USDC"), collateralId(ACTIVE_NETWORK.chainId, "AUSD")],
  },
];

export default function AddMoneySheet() {
  return (
    <SheetRoute
      title="Add money"
      body="Practice mode gives free test funds after sign-in. Real deposits land in Free to trade."
    >
      <Options />
    </SheetRoute>
  );
}

function Options() {
  const close = useSheetClose();
  return (
    <Panel>
      {OPTIONS.map((o, i) => (
        <ListRow
          key={o.title}
          first={i === 0}
          leading={<MarkCluster ids={o.marks} size={SIZE.markToken} />}
          title={o.title}
          detail={o.detail}
          onPress={() => close(() => router.push(o.href))}
        />
      ))}
    </Panel>
  );
}
