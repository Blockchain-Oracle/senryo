import { isDeployed } from "@senryo/chain";
import type { BridgeAsset } from "@senryo/config";
import { collateralId, ids, ROUTE_CHAIN_ID } from "@senryo/identity";
import { type Href, router, useLocalSearchParams } from "expo-router";
import { type ReactNode, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { MarkCluster } from "~/components/identity/MarkCluster";
import { Gift } from "~/components/kit/symbols";
import { Sheet, useSheetClose } from "~/components/sheet/Sheet";
import { SheetHeading } from "~/components/sheet/SheetRoute";
import { CardPanel } from "~/features/fund/CardPanel";
import { ChainAssets, ChainSources } from "~/features/fund/ChainPanel";
import { PracticePanel } from "~/features/fund/PracticePanel";
import { PanelHeading, SheetPanel } from "~/features/fund/SheetPanel";
import { TintBadge } from "~/features/markets/LeverageBadge";
import { useAccount } from "~/lib/account/provider";
import { useStarter } from "~/lib/account/use-starter";
import { bridgeInRoute, ROUTES } from "~/lib/constants/routes";
import { useNetwork } from "~/lib/network";
import { DISABLED_OPACITY, RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";

type Panel =
  | { kind: "methods" }
  | { kind: "practice" }
  | { kind: "card" }
  | { kind: "chain" }
  | { kind: "source"; asset: BridgeAsset };

/**
 * Add money (flow book B1–B5, B15; plan §0.9 "Add money sheet"; Fomo F20 "Deposit with" → F21 child panels): one
 * compact sheet, centred title, rich rows with the marks of what each way moves through at the trailing edge.
 * Practice leads with "Get practice money" (claim · daily top-up · code, landing in Assets); Mainnet with "Card or
 * bank" (Ramp). Then Crypto on Monad and From an exchange (Receive), From another chain (asset → source chain → the
 * quote page) and Redeem a code where vouchers are live. A child panel slides in with Back; `?panel=chain` opens the
 * other-chain panel directly (Receive's "Sending from another chain?").
 */
export default function AddMoneySheet() {
  const owner = useAccount().hint?.address;
  const chainId = useNetwork().chainId;
  return (
    <Sheet onClose={() => router.back()} closeLabel="Close add money">
      <Body key={`${owner}:${chainId}`} />
    </Sheet>
  );
}

function Body() {
  const { panel: start } = useLocalSearchParams<{ panel?: string }>();
  const [panel, setPanel] = useState<Panel>(start === "chain" ? { kind: "chain" } : { kind: "methods" });
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const close = useSheetClose();
  const go = (next: Panel, dir: "forward" | "back" = "forward") => {
    setDirection(dir);
    setPanel(next);
  };
  const back = () => go(panel.kind === "source" ? { kind: "chain" } : { kind: "methods" }, "back");
  const key = panel.kind === "source" ? `source:${panel.asset}` : panel.kind;
  return (
    <SheetPanel panelKey={key} direction={direction}>
      {panel.kind === "methods" ? (
        <>
          <SheetHeading title="Add funds" />
          <Methods onPanel={go} />
        </>
      ) : panel.kind === "practice" ? (
        <>
          <PanelHeading title="Practice money" onBack={back} />
          <PracticePanel onCode={() => close(() => router.push(ROUTES.voucher))} />
        </>
      ) : panel.kind === "card" ? (
        <>
          <PanelHeading title="Card or bank" body="Ramp · KYC in Ramp" onBack={back} />
          <CardPanel onDone={() => close()} />
        </>
      ) : panel.kind === "chain" ? (
        <>
          <PanelHeading title="From another chain" onBack={back} />
          <ChainAssets onPick={(asset) => go({ kind: "source", asset })} />
        </>
      ) : (
        <>
          <PanelHeading title={`${panel.asset} from`} onBack={back} />
          <ChainSources
            asset={panel.asset}
            onPick={(chain) => close(() => router.push(bridgeInRoute(panel.asset, chain.chainId) as Href))}
          />
        </>
      )}
    </SheetPanel>
  );
}

function Methods({ onPanel }: { onPanel: (next: Panel) => void }) {
  const network = useNetwork();
  const account = useAccount();
  const close = useSheetClose();
  const starter = useStarter();
  const signedIn = account.hint !== undefined;
  const practice = network.key === "testnet";
  const chainId = network.chainId;
  const guard = (fn: () => void) => () => (signedIn ? fn() : close(() => router.push(ROUTES.accountRequired)));
  const vouchers = isDeployed(chainId, "StarterDrip") && isDeployed(chainId, "SenryoCore");
  const claimed = starter.phase.kind === "claimed" || starter.phase.kind === "done";
  let index = 0;
  return (
    <View style={methodStyles.grid}>
      {practice ? (
        <MethodTile
          index={index++}
          title="Get practice money"
          detail={claimed ? "Claimed · use a code ›" : "Free practice dollars"}
          trailing={<MarkCluster ids={[collateralId(chainId, "AUSD")]} size={SIZE.markCell} />}
          onPress={guard(() => onPanel({ kind: "practice" }))}
        />
      ) : null}
      <MethodTile
        index={index++}
        title="Card or bank"
        detail={practice ? "Mainnet only" : "USDC, AUSD or MON · Ramp"}
        {...(practice ? { badge: <Locked text="Mainnet" /> } : {})}
        trailing={
          <MarkCluster
            ids={[collateralId(chainId, "USDC"), collateralId(chainId, "AUSD"), ids.native(chainId, "MON")]}
            size={SIZE.markCell}
          />
        }
        disabled={practice}
        onPress={guard(() => onPanel({ kind: "card" }))}
      />
      <MethodTile
        index={index++}
        title="Crypto on Monad"
        detail="Any token"
        trailing={<MarkCluster ids={[ids.evmChain(chainId)]} size={SIZE.markCell} />}
        onPress={guard(() => close(() => router.push(ROUTES.receive)))}
      />
      <MethodTile
        index={index++}
        title="From an exchange"
        detail="Check Monad support with your exchange"
        trailing={<MarkCluster ids={[ids.evmChain(chainId)]} size={SIZE.markCell} />}
        onPress={guard(() => close(() => router.push(`${ROUTES.receive}?from=exchange` as Href)))}
      />
      <MethodTile
        index={index++}
        title="From another chain"
        detail="Ethereum, Base, Solana and more"
        trailing={
          <MarkCluster
            ids={[ROUTE_CHAIN_ID.ethereum, ROUTE_CHAIN_ID.base, ROUTE_CHAIN_ID.solana, ROUTE_CHAIN_ID.arbitrum]}
            size={SIZE.markCell}
          />
        }
        onPress={guard(() => onPanel({ kind: "chain" }))}
      />
      {vouchers ? (
        <MethodTile
          index={index++}
          title="Redeem a code"
          detail="A code adds money"
          trailing={<GiftMark />}
          onPress={guard(() => close(() => router.push(ROUTES.voucher)))}
        />
      ) : null}
    </View>
  );
}

/** The quiet plate on a row that only opens on the other network. */
function Locked({ text }: { text: string }) {
  const { color } = useTheme();
  return <TintBadge text={text} ink={color.text2} fill={color.raised2} label={`${text} only`} />;
}

function GiftMark() {
  const { color } = useTheme();
  return <Gift size={SIZE.icon} strokeWidth={SIZE.iconStroke} color={color.gold} />;
}

function MethodTile({
  title,
  detail,
  trailing,
  disabled,
  onPress,
  badge,
}: {
  title: string;
  detail: string;
  trailing?: ReactNode;
  disabled?: boolean;
  onPress: () => void;
  badge?: ReactNode;
  index: number;
}) {
  const { color } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${detail}`}
      accessibilityState={{ disabled }}
      style={[methodStyles.tile, { backgroundColor: color.raised2, opacity: disabled ? DISABLED_OPACITY : 1 }]}
    >
      {trailing}
      <Text style={[TYPE.rowStrong, methodStyles.center, { color: color.ink }]}>{title}</Text>
      <Text style={[TYPE.meta, methodStyles.center, { color: color.text2 }]}>{detail}</Text>
      {badge}
    </Pressable>
  );
}
const methodStyles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm },
  tile: {
    width: "48%",
    minHeight: 116,
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.xs,
    padding: SPACE.sm,
    borderRadius: RADIUS.md,
  },
  center: { textAlign: "center" },
});
