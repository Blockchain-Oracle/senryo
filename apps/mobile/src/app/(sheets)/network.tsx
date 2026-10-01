import { MAINNET, NETWORKS, TESTNET } from "@senryo/config";
import { type Href, router, useLocalSearchParams } from "expo-router";
import { useSheetClose } from "~/components/sheet/Sheet";
import { SheetRoute } from "~/components/sheet/SheetRoute";
import { NetworkPicker } from "~/features/network/NetworkPicker";
import { activeNetwork, type NetworkKey } from "~/lib/network";

/** An in-app path only (never `//host` or a scheme): `next` arrives from a deep link. */
const inApp = (path: string | undefined): path is string => path?.startsWith("/") === true && !path.startsWith("//");

/**
 * The mode capsule's selector (S8.22): Practice · Paper money / Mainnet · Real money. A deep link for the other
 * network lands here (`to`, `next` from `+native-intent`): it continues to `next` only after the user switches.
 */
export default function NetworkSheet() {
  const { to, next } = useLocalSearchParams<{ to?: string; next?: string }>();
  const request = to === MAINNET.key || to === TESTNET.key ? (to as NetworkKey) : undefined;
  const body = request
    ? `This link is for ${NETWORKS[request].modeLabel}. Switch to open it, or stay where you are.`
    : "Practice with paper money, or trade real funds on Monad.";
  return (
    <SheetRoute title="Choose your money" body={body}>
      <Picker request={request} next={inApp(next) ? next : undefined} />
    </SheetRoute>
  );
}

function Picker({ request, next }: { request: NetworkKey | undefined; next: string | undefined }) {
  const close = useSheetClose();
  return (
    <NetworkPicker
      request={request}
      onDone={() =>
        close(() => {
          if (request && next && activeNetwork().key === request) router.navigate(next as Href);
        })
      }
    />
  );
}
