import { engineMarketsOn, marketPair } from "@senryo/config";
import { ids } from "@senryo/identity";
import { router } from "expo-router";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { EntityMark } from "~/components/identity/EntityMark";
import { Button } from "~/components/kit/Button";
import { LoadingState, ReadingView } from "~/components/kit/states";
import { Sheet } from "~/components/sheet/Sheet";
import { SheetHeading } from "~/components/sheet/SheetRoute";
import { SheetRow } from "~/components/sheet/SheetRow";
import { useAccount } from "~/lib/account/provider";
import { ROUTES } from "~/lib/constants/routes";
import { useNetwork } from "~/lib/network";
import { SHEET_SHAPE, SIZE, SPACE, TIMING, TYPE, useTheme } from "~/theme";
import { AlertEditor } from "./AlertEditor";
import { AlertRow } from "./AlertRow";
import { ALERT_SHEET_MAX_HEIGHT } from "./constants";
import { QuietLine } from "./QuietLine";
import { type Alert, alertErrorCopy, useAlerts, useRemoveAlert } from "./useAlerts";

/** The sheet over the alerts list: choosing a market for a new alert, then its editor — or editing one alert. */
export type AlertSheetState = "pick" | { marketId: number; editing?: Alert } | undefined;

/**
 * The inbox's Alerts tab (G1 step 5, C9): the account's price alerts on this network, read from the Senryo api.
 * A row opens its editor (Save replaces it — one alert, never two) and × deletes it. A guest, a locked session,
 * loading, an empty list and a failed read each say what is true and offer the one next step.
 */
export function AlertsList({ onNew, onEdit }: { onNew: () => void; onEdit: (alert: Alert) => void }) {
  const { color } = useTheme();
  const account = useAccount();
  const alerts = useAlerts();
  const remove = useRemoveAlert();
  // Until the account store has been read, "no account" is not known yet: show the loader, not the invitation.
  if (!account.ready) return <LoadingState shape="list" label="Loading your alerts" />;
  if (alerts.access === "guest") {
    return (
      <Quiet line="Alerts need an account">
        <Button label="Create account" size="sm" block={false} onPress={() => router.push(ROUTES.accountRequired)} />
      </Quiet>
    );
  }
  if (alerts.access === "locked") {
    return (
      <Quiet line="Unlock to see your alerts">
        <Button
          label="Unlock"
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
      {(items: Alert[]) => (
        <View style={styles.list}>
          <Button label="Create alert" size="sm" block={false} onPress={onNew} />
          {items.length === 0 ? (
            <Quiet line="No alerts yet" />
          ) : (
            items.map((alert) => (
              <AlertRow
                key={alert.id}
                alert={alert}
                showMarket
                busy={remove.isPending && remove.variables === alert.id}
                onRemove={() => remove.mutate(alert.id)}
                onEdit={() => onEdit(alert)}
              />
            ))
          )}
          {failure ? (
            <Text accessibilityRole="alert" style={[TYPE.rowDetail, styles.note, { color: color.down }]}>
              {failure}
            </Text>
          ) : null}
        </View>
      )}
    </ReadingView>
  );
}

/** The compact sheet for a new or edited alert, rendered at the page's root. */
export function AlertSheet({
  open,
  onClose,
  onPick,
}: {
  open: AlertSheetState;
  onClose: () => void;
  onPick: (marketId: number) => void;
}) {
  if (open === undefined) return null;
  return (
    <View style={StyleSheet.absoluteFill}>
      <Sheet
        onClose={onClose}
        closeLabel={open !== "pick" && open.editing ? "Close alert" : "Close new alert"}
        {...(open === "pick" ? {} : { maxHeight: ALERT_SHEET_MAX_HEIGHT })}
      >
        {/* Picker → editor crossfades in place instead of snapping to the new height. */}
        <Animated.View
          key={open === "pick" ? "pick" : "edit"}
          entering={FadeIn.duration(TIMING.selection)}
          style={styles.swap}
        >
          {open === "pick" ? (
            <MarketPicker onPick={onPick} />
          ) : (
            <AlertEditor marketId={open.marketId} {...(open.editing ? { editing: open.editing } : {})} />
          )}
        </Animated.View>
      </Sheet>
    </View>
  );
}

/** One quiet line and at most one action under it (build brief §2). */
function Quiet({ line, children }: { line: string; children?: ReactNode }) {
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
      <SheetHeading title="New alert" />
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
  list: { gap: SPACE.xxs },
  quiet: { alignItems: "center" },
  note: { paddingTop: SPACE.md },
  rows: { gap: SHEET_SHAPE.rowGap },
  /** The sheet spaces its direct children; this wrapper keeps that spacing for what it holds. */
  swap: { gap: SHEET_SHAPE.padding },
});
