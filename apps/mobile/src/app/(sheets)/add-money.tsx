import { type Href, router } from "expo-router";
import { ListRow } from "~/components/kit/ListRow";
import { Panel } from "~/components/kit/Surface";
import { useSheetClose } from "~/components/sheet/Sheet";
import { SheetRoute } from "~/components/sheet/SheetRoute";
import { fundQrRoute, ROUTES } from "~/lib/constants/routes";

/** F20 Add-money hub: always one tap away; also the empty state of Portfolio. */
const OPTIONS: { title: string; detail: string; href: Href }[] = [
  { title: "Deposit by QR", detail: "From any chain to your own address", href: fundQrRoute("evm") },
  { title: "From a Monad wallet", detail: "AUSD or USDC", href: fundQrRoute("monad") },
  { title: "From a wallet", detail: "Approve an intent with Face ID", href: ROUTES.fundWallet },
  { title: "Swap USDC ↔ AUSD", detail: "Uniswap v4 on Monad", href: ROUTES.fundSwap },
];

export default function AddMoneySheet() {
  return (
    <SheetRoute title="Add money" body="Practice mode gives free test funds after sign-in. Real deposits land in Free to trade.">
      <Options />
    </SheetRoute>
  );
}

function Options() {
  const close = useSheetClose();
  return (
    <Panel>
      {OPTIONS.map((o, i) => (
        <ListRow key={o.title} first={i === 0} title={o.title} detail={o.detail} onPress={() => close(() => router.push(o.href))} />
      ))}
    </Panel>
  );
}
