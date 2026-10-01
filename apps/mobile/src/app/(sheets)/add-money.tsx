import { collateralId, ids, ROUTE_CHAIN_ID } from "@senryo/identity";
import { type Href, router } from "expo-router";
import { MarkCluster } from "~/components/identity/MarkCluster";
import { useSheetClose } from "~/components/sheet/Sheet";
import { SheetRoute } from "~/components/sheet/SheetRoute";
import { SheetRow } from "~/components/sheet/SheetRow";
import { fundQrRoute, ROUTES } from "~/lib/constants/routes";
import { useNetwork } from "~/lib/network";
import { SIZE } from "~/theme";

/**
 * F20 Add-money hub: always one tap away; also the empty state of Portfolio. Each route is a filled row with the real
 * marks of what it moves through at its trailing edge (F20's "Exchanges and apps"): source networks, the Monad
 * network, Aurora for the intent route, the two collateral tokens.
 */
const optionsOn = (chainId: number): { title: string; detail: string; href: Href; marks: readonly string[] }[] => [
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
    marks: [ids.evmChain(chainId)],
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
    marks: [collateralId(chainId, "USDC"), collateralId(chainId, "AUSD")],
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
  const network = useNetwork();
  return optionsOn(network.chainId).map((o, i) => (
    <SheetRow
      key={o.title}
      index={i}
      title={o.title}
      detail={o.detail}
      trailing={<MarkCluster ids={o.marks} size={SIZE.markCell} />}
      onPress={() => close(() => router.push(o.href))}
    />
  ));
}
