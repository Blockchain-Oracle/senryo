import { engineMarketsOn, marketPair } from "@senryo/config";
import { ids } from "@senryo/identity";
import { router, Stack } from "expo-router";
import { Plus } from "lucide-react-native";
import { type ReactNode, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { EntityMark } from "~/components/identity/EntityMark";
import { Button } from "~/components/kit/Button";
import { Screen } from "~/components/kit/Screen";
import { SectionLabel } from "~/components/kit/Surface";
import { LoadingState, ReadingView } from "~/components/kit/states";
import { Sheet } from "~/components/sheet/Sheet";
import { SheetHeading } from "~/components/sheet/SheetRoute";
import { SheetRow } from "~/components/sheet/SheetRow";
import { UTILITY_ICON, UtilityButton } from "~/components/shell/Utilities";
import { useAccount } from "~/lib/account/provider";
import { ROUTES } from "~/lib/constants/routes";
import { useNetwork } from "~/lib/network";
import { SHEET_SHAPE, SIZE, SPACE, TIMING, TYPE, useTheme } from "~/theme";
import { AlertEditor } from "./AlertEditor";
import { AlertRow } from "./AlertRow";
import { ALERT_SHEET_MAX_HEIGHT } from "./constants";
import { PageHeader, PageTitle } from "./PageHeader";
import { QuietLine } from "./QuietLine";
import { type Alert, alertErrorCopy, useAlerts, useRemoveAlert } from "./useAlerts";

/** The sheet over the list: choosing a market for a new alert, then that market's editor. */
type Open = "pick" | number | undefined;

/**
 * Alerts (`/alerts`; direction "Alerts list": instrument, condition, active / triggered state, edit / remove): the
 * account's price alerts on the selected network, read from the Senryo api (`useAlerts`). A guest, a locked session,
 * loading, an empty list and a failed read each say what is true and offer the one next step. The plus opens a compact
 * sheet — pick a market, then its editor — and a saved alert appears in the list behind it. The api has no "edit":
 * an alert is changed by removing it and saving a new one.
 */
export function AlertsScreen() {
  const { color } = useTheme();
  const account = useAccount();
  const [open, setOpen] = useState<Open>();
  const hasAccount = account.hint !== undefined;
  return (
    <View style={[styles.fill, { backgroundColor: color.ground }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <PageHeader
        right={
          hasAccount ? (
            <UtilityButton label="New alert" onPress={() => setOpen("pick")}>
              <Plus size={UTILITY_ICON} strokeWidth={SIZE.iconStroke} color={color.ink} />
            </UtilityButton>
          ) : undefined
        }
      >
        <PageTitle>Alerts</PageTitle>
      </PageHeader>
      <Screen>
        <List onNew={() => setOpen("pick")} />
      </Screen>
      {open === undefined ? null : (
        <View style={StyleSheet.absoluteFill}>
          <Sheet
            onClose={() => setOpen(undefined)}
            closeLabel="Close new alert"
            {...(open === "pick" ? {} : { maxHeight: ALERT_SHEET_MAX_HEIGHT })}
          >
            {/* Picker → editor crossfades in place instead of snapping to the new height. */}
            <Animated.View
              key={open === "pick" ? "pick" : "edit"}
              entering={FadeIn.duration(TIMING.selection)}
              style={styles.swap}
            >
              {open === "pick" ? <MarketPicker onPick={setOpen} /> : <AlertEditor marketId={open} />}
            </Animated.View>
          </Sheet>
        </View>
      )}
    </View>
  );
}

function List({ onNew }: { onNew: () => void }) {
  const { color } = useTheme();
  const account = useAccount();
  const network = useNetwork();
  const alerts = useAlerts();
  const remove = useRemoveAlert();
  const known = alerts.reading.status === "fresh" || alerts.reading.status === "stale";
  // Until the account store has been read, "no account" is not known yet: show the loader, not the invitation.
  if (!account.ready) return <LoadingState shape="list" label="Loading your alerts" />;
  if (alerts.access === "guest") {
    return (
      <Quiet line="Price alerts belong to an account">
        <Button
          label="Create an account"
          variant="outline"
          size="sm"
          block={false}
          onPress={() => router.push(ROUTES.accountRequired)}
        />
      </Quiet>
    );
  }
  if (alerts.access === "locked" && !known) {
    return (
      <Quiet line="Unlock to see your alerts">
        <Button
          label="Unlock"
          variant="outline"
          size="sm"
          block={false}
          // A cancelled Face ID leaves the page as it is: locked, with the same button.
          onPress={() => void account.unlock().catch(() => undefined)}
        />
      </Quiet>
    );
  }
  const failure = remove.isError ? alertErrorCopy(remove.error) : undefined;
  return (
    <ReadingView reading={alerts.reading} loading="list" loadingLabel="Loading your alerts" retry={alerts.refetch}>
      {(items: Alert[]) =>
        items.length === 0 ? (
          <Quiet line="No alerts yet">
            <Button label="Set an alert" variant="outline" size="sm" block={false} onPress={onNew} />
          </Quiet>
        ) : (
          <View>
            <SectionLabel>{network.modeLabel} alerts</SectionLabel>
            {items.map((alert) => (
              <AlertRow
                key={alert.id}
                alert={alert}
                showMarket
                busy={remove.isPending && remove.variables === alert.id}
                onRemove={() => remove.mutate(alert.id)}
              />
            ))}
            {failure ? (
              <Text accessibilityRole="alert" style={[TYPE.rowDetail, styles.note, { color: color.down }]}>
                {failure}
              </Text>
            ) : null}
            <Text style={[TYPE.rowDetail, styles.note, { color: color.text3 }]}>
              Checked against the oracle price. Push notifications aren’t set up on this phone yet, so an alert that
              fires shows here as Triggered.
            </Text>
          </View>
        )
      }
    </ReadingView>
  );
}

/** One quiet line and at most one action under it (build brief §2). */
function Quiet({ line, children }: { line: string; children: ReactNode }) {
  return (
    <View style={styles.quiet}>
      <QuietLine>{line}</QuietLine>
      {children}
    </View>
  );
}

/** The markets an alert can watch: our engine's listings on this network (the keeper checks those). */
function MarketPicker({ onPick }: { onPick: (marketId: number) => void }) {
  const network = useNetwork();
  const markets = engineMarketsOn(network.chainId);
  return (
    <>
      <SheetHeading title="New alert" body="Choose the market to watch." />
      <View style={styles.rows}>
        {markets.map((m, index) => (
          <SheetRow
            key={m.id}
            index={index}
            title={m.name}
            detail={marketPair(m)}
            leading={<EntityMark id={ids.engineMarket(network.chainId, m.id)} size={SIZE.markRow} decorative />}
            onPress={() => onPick(m.id)}
          />
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  quiet: { alignItems: "center" },
  note: { paddingTop: SPACE.md },
  rows: { gap: SHEET_SHAPE.rowGap },
  /** The sheet spaces its direct children; this wrapper keeps that spacing for what it holds. */
  swap: { gap: SHEET_SHAPE.padding },
});
