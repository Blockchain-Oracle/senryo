/**
 * The Card tab (§0.9 "Card tab, unissued" / "issued"; E1–E6). Who the user is decides the first screen: a guest gets
 * the card art and Create account, a locked session Unlock, a card service that isn't there a calm "Card unavailable"
 * with Retry, no card yet "Get your Kinpaku card" (Practice: an instant test card; Mainnet: a test card beside the
 * locked real card), and a card the issued layout. Sheets (Spendable breakdown, Simulate, Wallet, the Mainnet choice)
 * open over the page with the dock held down.
 */
import { isDeployed } from "@senryo/chain";
import { useAccountRisk } from "@senryo/query";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { CreditCard, Lock } from "~/components/kit/symbols";
import { useSheetClose } from "~/components/sheet/Sheet";
import { SheetHeading } from "~/components/sheet/SheetRoute";
import { SheetRow } from "~/components/sheet/SheetRow";
import { CollapsingScreen } from "~/components/shell/CollapsingScreen";
import { TabTitle } from "~/components/shell/TabTitle";
import { useAccount } from "~/lib/account/provider";
import { ROUTES } from "~/lib/constants/routes";
import { useNetwork } from "~/lib/network";
import { STORAGE_KEYS, storage } from "~/lib/storage";
import { SHEET_SHAPE, SIZE, useTheme } from "~/theme";
import { CardIssued } from "./CardIssued";
import { CardUnissued, type UnissuedState } from "./CardUnissued";
import { SimulateSheet } from "./SimulateSheet";
import { allowanceNow, SpendableBreakdown } from "./SpendableHero";
import { TabSheet } from "./TabSheet";
import { useCardFreeze } from "./useCardFreeze";
import { cardUnavailable, useCardSummary } from "./useCardSummary";
import { WalletSheetBody } from "./WalletRow";

type Open = "breakdown" | "simulate" | "wallet" | "choose";

/** Get card: the explainer first, the first time only (E1 step 3), then limit → issue → ready. */
function startGetCard() {
  router.push(storage.getBoolean(STORAGE_KEYS.cardIntroSeen) ? ROUTES.cardGet : ROUTES.cardIntroThenGet);
}

export function CardTab() {
  const account = useAccount();
  const network = useNetwork();
  const practice = network.key === "testnet";
  const address = account.hint?.address;
  const summary = useCardSummary();
  const deployed = isDeployed(network.chainId, "SenryoCore");
  const risk = useAccountRisk(deployed ? address : undefined, "latest");
  const snapshot = risk.status === "fresh" || risk.status === "stale" ? risk.value : undefined;
  const card = summary.data?.cards.find((c) => c.state !== "CLOSED");
  const allowance = snapshot ? allowanceNow(snapshot) : undefined;
  const freeze = useCardFreeze(card, snapshot);
  const [open, setOpen] = useState<Open>();
  const close = () => setOpen(undefined);
  // "Simulate a payment" from Card ready lands here with `?simulate=1`: open the sheet once the card is read.
  const { simulate } = useLocalSearchParams<{ simulate?: string }>();
  const cardToken = card?.cardToken;
  useEffect(() => {
    if (simulate !== "1" || !cardToken) return;
    router.setParams({ simulate: undefined });
    setOpen("simulate");
  }, [simulate, cardToken]);

  const unissued = (): UnissuedState => {
    if (!account.ready) return { kind: "loading" };
    if (!address) return { kind: "guest" };
    if (account.snapshot.status !== "unlocked")
      return { kind: "locked", unlock: () => void account.unlock().catch(() => undefined) };
    if (summary.isPending) return { kind: "loading" };
    if (summary.isError || cardUnavailable(summary.error, summary.data))
      return { kind: "unavailable", retry: () => void summary.refetch(), retrying: summary.isFetching };
    return { kind: "get", practice, onGet: practice ? startGetCard : () => setOpen("choose") };
  };

  return (
    <View style={styles.fill}>
      {/* Pull to refresh re-reads every query on the page: the card service and the account snapshot. */}
      <CollapsingScreen left={<TabTitle>Kinpaku</TabTitle>}>
        {card && summary.data ? (
          <CardIssued
            card={card}
            summary={summary.data}
            snapshot={snapshot}
            spendableUnavailable={!deployed || risk.status === "failed"}
            allowance={allowance}
            freeze={freeze}
            practice={practice}
            onBreakdown={() => setOpen("breakdown")}
            onSimulate={() => setOpen("simulate")}
            onWallet={() => setOpen("wallet")}
          />
        ) : (
          <CardUnissued state={unissued()} />
        )}
      </CollapsingScreen>
      {open === "breakdown" && snapshot ? (
        <TabSheet id="card-breakdown" onClose={close} closeLabel="Close Spendable">
          <SpendableBreakdown
            snapshot={snapshot}
            openHoldsUsd6={summary.data?.openHoldsUsd6 ?? 0n}
            debtUsd6={summary.data?.debtUsd6 ?? snapshot.cardDebt}
          />
        </TabSheet>
      ) : null}
      {open === "simulate" && card ? (
        <TabSheet id="card-simulate" onClose={close} closeLabel="Close Simulate a payment">
          <SimulateSheet cardToken={card.cardToken} {...(allowance ? { allowance } : {})} />
        </TabSheet>
      ) : null}
      {open === "wallet" ? (
        <TabSheet id="card-wallet" onClose={close} closeLabel="Close Add to Wallet">
          <WalletSheetBody />
        </TabSheet>
      ) : null}
      {open === "choose" ? (
        <TabSheet id="card-choose" onClose={close} closeLabel="Close Get card">
          <ChooseCard />
        </TabSheet>
      ) : null}
    </View>
  );
}

/** Mainnet (E-D1): the test card (no charge) beside the real card, locked on its named dependency. */
function ChooseCard() {
  const { color } = useTheme();
  const closeSheet = useSheetClose();
  return (
    <>
      <SheetHeading title="Get card" />
      <View style={styles.rows}>
        <SheetRow
          index={0}
          title="Test card"
          detail="No charge · holds only"
          leading={<CreditCard size={SIZE.icon} color={color.ink} />}
          onPress={() => closeSheet(startGetCard)}
        />
        <SheetRow
          index={1}
          title="Real card"
          detail="Needs issuer approval"
          disabled
          leading={<CreditCard size={SIZE.icon} color={color.text3} />}
          trailing={<Lock size={SIZE.iconSm} color={color.text3} />}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  rows: { gap: SHEET_SHAPE.rowGap },
});
