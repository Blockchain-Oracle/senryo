import { cardFreezeRoute } from "@senryo/api-client";
import { isDeployed } from "@senryo/chain";
import { useAccountRisk } from "@senryo/query";
import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { ListRow } from "~/components/kit/ListRow";
import { CollapsingScreen } from "~/components/shell/CollapsingScreen";
import { TabTitle } from "~/components/shell/TabTitle";
import { CardFace } from "~/features/card/CardFace";
import { SpendLimit } from "~/features/card/SpendLimit";
import { useCardAllowance } from "~/features/card/useCardAllowance";
import { useCardSummary } from "~/features/card/useCardSummary";
import { api, withSession } from "~/lib/account/api";
import { useAccount } from "~/lib/account/provider";
import { cardAuthRoute, ROUTES } from "~/lib/constants/routes";
import { usd } from "~/lib/money";
import { useNetwork } from "~/lib/network";
import { SPACE, TYPE, useTheme } from "~/theme";

/** Issued identity and activity come only from the authenticated card service. */
const USD6_PER_CENT = 10_000n;
export default function Card() {
  const { color } = useTheme();
  const network = useNetwork();
  const account = useAccount();
  const summary = useCardSummary();
  const issued = summary.data?.cards[0];
  const risk = useAccountRisk(isDeployed(network.chainId, "SenryoCore") ? account.hint?.address : undefined);
  const snapshot = risk.status === "fresh" || risk.status === "stale" ? risk.value : undefined;
  const allowance = useCardAllowance(snapshot);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const freeze = async () => {
    if (!account.client || !issued || busy) return;
    setBusy(true);
    setError(undefined);
    try {
      // Lowering the onchain allowance remains in scoped-session policy.
      if (isDeployed(network.chainId, "SenryoCore") && !snapshot) throw new Error("Card allowance is unavailable");
      if (snapshot) {
        const revoked = await allowance.freeze();
        if (revoked?.final?.stage !== "finalized") throw new Error("Allowance revocation is not confirmed");
      }
      await withSession(account.client, account.settings.faceId, () =>
        api().call(cardFreezeRoute, { body: { cardToken: issued.cardToken, frozen: true } }),
      );
      await summary.refetch();
    } catch {
      setError("Freeze could not be fully confirmed. Check card status before using it.");
    } finally {
      setBusy(false);
    }
  };
  const state = issued
    ? `${issued.sandbox ? "Sandbox card · " : ""}${issued.state === "PAUSED" ? "Frozen" : issued.state}`
    : summary.data
      ? "No card issued"
      : account.snapshot.status === "unlocked"
        ? "Card status unavailable"
        : "Unlock to view your card";
  return (
    <CollapsingScreen left={<TabTitle>Kinpaku</TabTitle>}>
      <View style={styles.hero}>
        <CardFace last4={issued?.last4 ?? undefined} />
        <Text style={[TYPE.rowDetail, styles.center, { color: color.text3 }]}>{state}</Text>
      </View>
      {!issued ? (
        <View style={styles.stack}>
          <Text style={[TYPE.body, { color: color.text2 }]}>
            {summary.data
              ? "Your card will appear here after issuance and identity verification are available."
              : "Card details and activity require a connected card service."}
          </Text>
          <Button
            label={account.snapshot.status === "unlocked" ? "Refresh card status" : "Unlock"}
            variant="outline"
            onPress={() =>
              account.snapshot.status === "unlocked" ? void summary.refetch() : router.push(ROUTES.session)
            }
          />
        </View>
      ) : (
        <>
          <View style={styles.actions}>
            <Button
              label={issued.state === "PAUSED" ? "Frozen" : "Freeze"}
              style={styles.flex}
              loading={busy}
              disabled={busy || issued.state === "PAUSED"}
              onPress={() => void freeze()}
            />
            <Button
              label="Spending limit"
              variant="outline"
              style={styles.flex}
              onPress={() => router.push(ROUTES.cardAllowance)}
            />
          </View>
          {error ? <Text style={[TYPE.body, { color: color.warn }]}>{error}</Text> : null}
          <ListRow title="Card details" detail="Secure mobile reveal requires issuer and protected-view acceptance." />
          <ListRow title="Add to Wallet" detail="Wallet provisioning is not available from this issuer yet." />
        </>
      )}
      {snapshot ? (
        <View style={styles.stack}>
          <View style={styles.between}>
            <Text style={[TYPE.rowDetail, { color: color.text3 }]}>Trading-account card capacity</Text>
            <Text style={[TYPE.rowAmount, { color: color.ink }]}>{usd(snapshot.freeToSpend)}</Text>
          </View>
          {issued ? <SpendLimit snapshot={snapshot} /> : null}
        </View>
      ) : null}
      <View style={styles.stack}>
        <Text style={[TYPE.sectionTitle, { color: color.ink }]}>Activity</Text>
        {summary.data?.recent.length ? (
          summary.data.recent.map((row) => (
            <ListRow
              key={row.id}
              onPress={() => router.push(cardAuthRoute(row.id))}
              title={row.merchantDescriptor ?? row.kind.replaceAll("_", " ")}
              detail={`${row.status} · ${new Date(row.receivedAt).toLocaleDateString()}`}
              trailing={
                <Text style={[TYPE.rowAmount, { color: color.ink }]}>{usd(row.amountCents * USD6_PER_CENT)}</Text>
              }
            />
          ))
        ) : (
          <Text style={[TYPE.rowDetail, { color: color.text3 }]}>
            {summary.data ? "No card activity yet" : "Activity unavailable"}
          </Text>
        )}
      </View>
    </CollapsingScreen>
  );
}
const styles = StyleSheet.create({
  hero: { gap: SPACE.sm, paddingTop: SPACE.sm },
  center: { textAlign: "center" },
  stack: { gap: SPACE.md },
  actions: { flexDirection: "row", gap: SPACE.sm },
  flex: { flex: 1 },
  between: { flexDirection: "row", justifyContent: "space-between", gap: SPACE.sm },
});
