import { collateralId, ids, ROUTE_CHAIN_ID } from "@senryo/identity";
import { type Href, router } from "expo-router";
import { Check, Gift } from "lucide-react-native";
import { ActivityIndicator } from "react-native";
import { MarkCluster } from "~/components/identity/MarkCluster";
import { useSheetClose } from "~/components/sheet/Sheet";
import { SheetRoute } from "~/components/sheet/SheetRoute";
import { SheetRow } from "~/components/sheet/SheetRow";
import { TintBadge } from "~/features/markets/LeverageBadge";
import { useAccount } from "~/lib/account/provider";
import { type StarterPhase, useStarter } from "~/lib/account/use-starter";
import { fundQrRoute, ROUTES } from "~/lib/constants/routes";
import { usd } from "~/lib/money";
import { useNetwork } from "~/lib/network";
import { SIZE, useTheme } from "~/theme";

interface Route {
  title: string;
  detail: string;
  href: Href;
  marks: readonly string[];
  /** Not open on this network: the row says so before it is tapped (review "Add money"), and its page explains. */
  soon?: { badge: string; line: string };
}

/** Where money comes from, per network (direction §6: Practice has paper money; Mainnet real routes only). */
function routesOn(chainId: number, practice: boolean): Route[] {
  const monad: Route = {
    title: "Receive on Monad",
    detail: "AUSD or USDC to your own address",
    href: fundQrRoute("monad"),
    marks: [ids.evmChain(chainId)],
  };
  const otherChain: Route = {
    title: "From another chain",
    detail: "Base, Ethereum, Arbitrum and more",
    href: fundQrRoute("evm"),
    marks: [ROUTE_CHAIN_ID.base, ROUTE_CHAIN_ID.ethereum, ROUTE_CHAIN_ID.arbitrum],
    soon: { badge: "Soon", line: "Not open yet · arrives with cross-chain intents" },
  };
  const wallet: Route = {
    title: "From a wallet",
    detail: "Approve an intent with Face ID",
    href: ROUTES.fundWallet,
    marks: [ids.provider("aurora")],
    soon: { badge: "Soon", line: "Not open yet · arrives with cross-chain intents" },
  };
  const swap: Route = {
    title: "Swap USDC ↔ AUSD",
    detail: "Uniswap v4 on Monad",
    href: ROUTES.fundSwap,
    marks: [collateralId(chainId, "USDC"), collateralId(chainId, "AUSD")],
    ...(practice ? { soon: { badge: "Mainnet", line: "Mainnet only · the test network has no pool" } } : {}),
  };
  return practice ? [monad, otherChain, swap] : [monad, otherChain, wallet, swap];
}

/** The claim row's second line follows the claim itself. */
function claimDetail(phase: StarterPhase): string | undefined {
  switch (phase.kind) {
    case "idle":
      return "Paper dollars and gas, sent by our sponsor · no fee";
    case "signing":
      return "Signing…";
    case "sending":
      return "Sending…";
    case "settling":
      return "Adding practice dollars…";
    case "done":
      return `${usd(phase.creditUsd6)} practice dollars are in`;
    case "failed":
      return "That didn’t go through · tap to try again";
    default:
      return undefined;
  }
}

/**
 * F20 Add-money hub (C33): one tap away from the fan, Home and the empty states. Filled rows with the real marks of
 * what each route moves through at the trailing edge. Practice leads with the free claim — it runs right here, its
 * second line following the claim — then a voucher (a child sheet, F21), receiving on Monad, other chains and the
 * swap. Mainnet has no claim. A route not open on this network says so in its row ("Soon" and why) before it is tapped.
 * A route that opens a page closes the sheet first; back returns to the page under it.
 */
export default function AddMoneySheet() {
  const network = useNetwork();
  const practice = network.key === "testnet";
  return (
    <SheetRoute
      title="Add money"
      body={practice ? "Practice money has no value. Real money starts on Mainnet." : "Real money, on Monad."}
    >
      <Options practice={practice} />
    </SheetRoute>
  );
}

function Options({ practice }: { practice: boolean }) {
  const close = useSheetClose();
  const network = useNetwork();
  const account = useAccount();
  const signedIn = account.hint !== undefined;
  const open = (href: Href) => close(() => router.push(signedIn ? href : ROUTES.accountRequired));
  const rows = routesOn(network.chainId, practice);
  let index = 0;
  return (
    <>
      {practice && signedIn ? <ClaimRow index={index++} /> : null}
      <SheetRow
        index={index++}
        title="Redeem a voucher"
        detail="A code adds funds · we pay the network fee"
        trailing={<GiftMark />}
        onPress={() => router.push(signedIn ? ROUTES.voucher : ROUTES.accountRequired)}
      />
      {rows.map((o) => (
        <SheetRow
          key={o.title}
          index={index++}
          title={o.title}
          detail={o.soon?.line ?? o.detail}
          {...(o.soon ? { badge: <SoonBadge text={o.soon.badge} /> } : {})}
          trailing={<MarkCluster ids={o.marks} size={SIZE.markCell} />}
          onPress={() => open(o.href)}
        />
      ))}
    </>
  );
}

/** The quiet plate beside a route that isn't open on this network ("Soon", "Mainnet"). */
function SoonBadge({ text }: { text: string }) {
  const { color } = useTheme();
  return <TintBadge text={text} ink={color.text2} fill={color.raised2} label={`${text}: not open here`} />;
}

function GiftMark() {
  const { color } = useTheme();
  return <Gift size={SIZE.icon} strokeWidth={SIZE.iconStroke} color={color.gold} />;
}

/** The practice claim in place: hidden once claimed, its state on its own second line. */
function ClaimRow({ index }: { index: number }) {
  const { color } = useTheme();
  const network = useNetwork();
  const starter = useStarter();
  const { phase } = starter;
  if (phase.kind === "claimed" || phase.kind === "checking" || phase.kind === "unchecked") return null;
  const working = phase.kind === "signing" || phase.kind === "sending" || phase.kind === "settling";
  const done = phase.kind === "done";
  const detail = claimDetail(phase);
  return (
    <SheetRow
      index={index}
      title={done ? "Practice funds added" : "Claim practice funds"}
      {...(detail ? { detail } : {})}
      trailing={
        working ? (
          <ActivityIndicator color={color.practice} />
        ) : done ? (
          <Check size={SIZE.icon} strokeWidth={SIZE.iconStroke} color={color.up} />
        ) : (
          <MarkCluster ids={[collateralId(network.chainId, "AUSD")]} size={SIZE.markCell} />
        )
      }
      disabled={working || done || !starter.ready}
      onPress={() => void starter.claim()}
    />
  );
}
