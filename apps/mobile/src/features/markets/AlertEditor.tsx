import { type EngineMarket, engineMarket } from "@senryo/config";
import { RISK } from "@senryo/core";
import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { Segmented } from "~/components/kit/Segmented";
import { SectionLabel } from "~/components/kit/Surface";
import { ReadingView } from "~/components/kit/states";
import { useSheetClose } from "~/components/sheet/Sheet";
import { SheetHeading } from "~/components/sheet/SheetRoute";
import { TriggerInput } from "~/features/trade/TriggerInput";
import { parsePrice, priceText } from "~/features/trade/tpsl";
import { fire } from "~/feedback/fire";
import { useAccount } from "~/lib/account/provider";
import { ROUTES } from "~/lib/constants/routes";
import { price18, priceDecimalsOf } from "~/lib/money";
import { useNetwork } from "~/lib/network";
import { SPACE, TYPE, useTheme } from "~/theme";
import { AlertRow } from "./AlertRow";
import { ALERT_SUGGESTIONS_BPS, BPS_PER_PERCENT } from "./constants";
import { type Alert, alertErrorCopy, useAlerts, useCreateAlert, useRemoveAlert } from "./useAlerts";
import { type MarketLine, useMarketLine } from "./useMarketLine";

const DIRECTIONS = [
  { value: "above", label: "Rises above" },
  { value: "below", label: "Falls below" },
] as const;
type Direction = Alert["direction"];

/**
 * The price-alert editor for one market (direction "Alert editor": price / condition, mode, permission status,
 * validation and save), as the body of a compact sheet. The condition is a side — rises above or falls below — and a
 * price that must sit on that side of the current oracle price, so an alert can't fire the moment it is saved. The
 * alert is stored on the Senryo api for this account and network and checked by the keeper (`useAlerts`); saving shows
 * it in the list under the form — no toast. A guest is invited to create an account; nothing is stored on the phone.
 */
export function AlertEditor({ marketId, onSeeAll }: { marketId: number; onSeeAll?: () => void }) {
  const meta = engineMarket(marketId);
  const account = useAccount();
  const close = useSheetClose();
  const line = useMarketLine(marketId, meta?.symbol ?? "");
  if (!meta) return <SheetHeading title="Price alert" body="This market isn't available here." />;
  if (account.ready && !account.hint) {
    return (
      <>
        <SheetHeading
          title={`Alert for ${meta.name}`}
          body="Alerts belong to an account, so they follow you to every device you sign in on."
        />
        {/* This sheet slides away first, so the account sheet never stacks a second scrim over it. */}
        <Button label="Create an account" onPress={() => close(() => router.push(ROUTES.accountRequired))} />
      </>
    );
  }
  return (
    <ReadingView reading={line} loading="line" loadingLabel="Reading the oracle">
      {(l) => <Form meta={meta} line={l} {...(onSeeAll ? { onSeeAll } : {})} />}
    </ReadingView>
  );
}

function Form({ meta, line, onSeeAll }: { meta: EngineMarket; line: MarketLine; onSeeAll?: () => void }) {
  const { color } = useTheme();
  const network = useNetwork();
  const [direction, setDirection] = useState<Direction>("above");
  const [text, setText] = useState("");
  const create = useCreateAlert();
  const decimals = priceDecimalsOf(meta.id);
  const mark = line.price18;
  const shownMark = price18(mark, decimals);
  const target = parsePrice(text);
  const above = direction === "above";
  const problem =
    text === ""
      ? undefined
      : target === undefined
        ? "Enter a price above zero."
        : above && target <= mark
          ? `${meta.name} is already at $${shownMark}. Set a higher price.`
          : !above && target >= mark
            ? `${meta.name} is already at $${shownMark}. Set a lower price.`
            : undefined;
  const failure = create.isError ? alertErrorCopy(create.error) : undefined;
  const save = () => {
    if (target === undefined || problem) return;
    create.mutate(
      { marketId: meta.id, direction, price18: target },
      {
        onSuccess: () => {
          fire("confirm");
          setText("");
        },
        // A cancelled Face ID is the user's choice, not a failure: no error buzz.
        onError: (error) => {
          if (alertErrorCopy(error)) fire("fail");
        },
      },
    );
  };
  return (
    <>
      <SheetHeading title={`Alert for ${meta.name}`} body={`${meta.symbol}/USD is $${shownMark} now`} />
      <Segmented options={DIRECTIONS} value={direction} onChange={setDirection} label="Alert condition" />
      <View style={styles.field}>
        <TriggerInput
          value={text}
          placeholder={priceText(mark, decimals)}
          prefix="$"
          label={`Alert price, ${above ? "above" : "below"} the current price`}
          onChange={setText}
          onFocus={() => undefined}
        />
      </View>
      <View style={styles.suggestions}>
        {ALERT_SUGGESTIONS_BPS.map((bps) => (
          <Button
            key={bps.toString()}
            label={`${above ? "+" : "−"}${bps / BPS_PER_PERCENT}%`}
            variant="outline"
            size="sm"
            style={styles.suggestion}
            onPress={() => setText(priceText((mark * (above ? RISK.BPS + bps : RISK.BPS - bps)) / RISK.BPS, decimals))}
          />
        ))}
      </View>
      {problem ? (
        <Text accessibilityLiveRegion="polite" style={[TYPE.rowDetail, { color: color.down }]}>
          {problem}
        </Text>
      ) : null}
      {failure ? (
        <Text accessibilityRole="alert" style={[TYPE.rowDetail, { color: color.down }]}>
          {failure}
        </Text>
      ) : null}
      {/* Save sits right under the field, so it stays in the visible part of the sheet while the keyboard is up. */}
      <Button
        label="Save alert"
        disabled={target === undefined || problem !== undefined}
        loading={create.isPending}
        onPress={save}
      />
      <Text style={[TYPE.rowDetail, { color: color.text3 }]}>
        {network.modeLabel} alert, checked against the oracle price. Push notifications aren’t set up on this phone yet,
        so an alert that fires shows as Triggered in Alerts.
      </Text>
      <Existing marketId={meta.id} name={meta.name} />
      {onSeeAll ? <Button label="All alerts" variant="ghost" size="sm" onPress={onSeeAll} /> : null}
    </>
  );
}

/** This market's alerts under the form: where a save shows up, and where one is removed. */
function Existing({ marketId, name }: { marketId: number; name: string }) {
  const { color } = useTheme();
  const alerts = useAlerts();
  const remove = useRemoveAlert();
  const all = alerts.reading.status === "fresh" || alerts.reading.status === "stale" ? alerts.reading.value : [];
  const mine = all.filter((a) => a.marketId === marketId);
  const failure = remove.isError ? alertErrorCopy(remove.error) : undefined;
  if (mine.length === 0) return null;
  return (
    <View>
      <SectionLabel>Your {name} alerts</SectionLabel>
      {failure ? (
        <Text accessibilityRole="alert" style={[TYPE.rowDetail, { color: color.down }]}>
          {failure}
        </Text>
      ) : null}
      {mine.map((alert) => (
        <AlertRow
          key={alert.id}
          alert={alert}
          showMarket={false}
          busy={remove.isPending && remove.variables === alert.id}
          onRemove={() => remove.mutate(alert.id)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { flexDirection: "row" },
  suggestions: { flexDirection: "row", gap: SPACE.sm },
  suggestion: { flex: 1 },
});
