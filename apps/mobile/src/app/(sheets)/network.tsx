import { MAINNET, NETWORKS, TESTNET } from "@senryo/config";
import { type Href, router, useLocalSearchParams } from "expo-router";
import { useSheetClose } from "~/components/sheet/Sheet";
import { SheetRoute } from "~/components/sheet/SheetRoute";
import { NetworkPicker } from "~/features/network/NetworkPicker";
import { activeNetwork, type NetworkKey } from "~/lib/network";

/** An in-app path only (never `//host` or a scheme): `next` arrives from a deep link. */
const inApp = (path: string | undefined): path is string => path?.startsWith("/") === true && !path.startsWith("//");

/**
 * The mode sheet (A8): two rows, Practice and Mainnet. A deep link or push for the other network lands here (`to`,
 * `next` from `+native-intent`) with one line saying so, and continues to `next` only after a deliberate switch.
 */
export default function NetworkSheet() {
  const { to, next } = useLocalSearchParams<{ to?: string; next?: string }>();
  const request = to === MAINNET.key || to === TESTNET.key ? (to as NetworkKey) : undefined;
  return (
    <SheetRoute title="Mode" {...(request ? { body: `This link is for ${NETWORKS[request].modeLabel}` } : {})}>
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
