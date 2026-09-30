import type { PositionView, TxRequest } from "@senryo/chain";
import { ENGINE_MARKETS } from "@senryo/config";
import { previewDecrease, RISK } from "@senryo/core";
import {
  cancelTriggerRequest,
  type LiveMarket,
  placeTriggerRequest,
  triggerOrder,
  useQueryEnv,
  useSendTrace,
  useTriggers,
} from "@senryo/query";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { Segmented } from "~/components/kit/Segmented";
import { KeyValue, Panel, SectionLabel } from "~/components/kit/Surface";
import { useAccount } from "~/lib/account/provider";
import { userSender } from "~/lib/account/sender";
import { pct, price18, signedUsd } from "~/lib/money";
import { SPACE, TYPE, useTheme } from "~/theme";
import { DEFAULT_TRIGGER_STEP_BPS, TRIGGER_STEPS_BPS } from "./constants";

const KINDS = [
  { value: "tp", label: "Take profit" },
  { value: "sl", label: "Stop loss" },
] as const;
type Kind = (typeof KINDS)[number]["value"];

/**
 * F14 TP/SL on a held position (TriggerOrders.sol): active orders with Cancel; a new order N % from the oracle price
 * with the realised PnL previewed at the trigger; signed in session, placed by the user (in scope), executed by any
 * keeper when the accepted oracle price crosses. Closed sessions queue until the market opens (stated).
 */
export function TriggerPanel({ market, position }: { market: LiveMarket; position: PositionView }) {
  const { color } = useTheme();
  const env = useQueryEnv();
  const account = useAccount();
  const address = account.hint?.address;
  const triggers = useTriggers(address);
  const trace = useSendTrace();
  const [kind, setKind] = useState<Kind>("tp");
  const [stepBps, setStepBps] = useState<bigint>(DEFAULT_TRIGGER_STEP_BPS);
  const takeProfit = kind === "tp";
  const up = position.isLong === takeProfit;
  const trigger18 = up
    ? (market.pv.price18 * (RISK.BPS + stepBps)) / RISK.BPS
    : (market.pv.price18 * (RISK.BPS - stepBps)) / RISK.BPS;
  const atTrigger = previewDecrease(
    market.risk,
    { ...market.pv, price18: trigger18, status: "OPEN" },
    position,
    position.size,
    position.openedBlock + RISK.MIN_HOLD_BLOCKS,
  );
  const marketKey = `ours-${market.marketId}`;
  const mine =
    triggers.status === "fresh" || triggers.status === "stale"
      ? triggers.value.filter((t) => t.market_id === marketKey)
      : [];
  const busy = trace.running;
  const failed = trace.events.find((e) => e.stage === "failed" || e.stage === "reverted");
  const symbol = ENGINE_MARKETS.find((m) => m.id === market.marketId)?.symbol ?? "";

  const send = async (build: () => Promise<TxRequest>) => {
    const client = account.client;
    if (!client || !address) return;
    const sender = userSender(client, address, account.settings.faceId);
    const request = await build().catch(() => undefined);
    if (request) await trace.run(sender, request);
  };

  return (
    <Panel style={styles.panel}>
      <SectionLabel>TP / SL</SectionLabel>
      {mine.map((t) => (
        <View key={t.id} style={styles.row}>
          <Text style={[TYPE.numSm, { color: t.takeProfit ? color.up : color.down, flex: 1 }]}>
            {t.takeProfit ? "TP" : "SL"} · {price18(t.triggerPrice)} · {t.size >= position.size ? "all" : "part"}
          </Text>
          <Button
            label="Cancel"
            size="sm"
            variant="outline"
            block={false}
            disabled={busy}
            onPress={() => void send(async () => cancelTriggerRequest(env.chainId, t.id as `0x${string}`))}
          />
        </View>
      ))}
      <Segmented options={KINDS} value={kind} onChange={setKind} label="Trigger kind" />
      <Segmented
        options={TRIGGER_STEPS_BPS.map((b) => ({ value: String(b), label: `${up ? "+" : "−"}${pct(b)}` }))}
        value={String(stepBps)}
        onChange={(v) => setStepBps(BigInt(v))}
        label="Distance from the oracle price"
      />
      <KeyValue label={`${symbol} AT`} value={price18(trigger18)} />
      <KeyValue label="REALISED AT TRIGGER" value={signedUsd(atTrigger.netUsd6)} />
      {market.pv.status !== "OPEN" ? (
        <Text style={[TYPE.caption, { color: color.inkMuted }]}>
          The market is {market.pv.status.toLowerCase()}: a crossing executes once it opens.
        </Text>
      ) : null}
      {failed ? (
        <Text style={[TYPE.caption, { color: color.down }]}>That didn't go through; nothing changed.</Text>
      ) : trace.events.some((e) => e.stage === "finalized") ? (
        <Text style={[TYPE.caption, { color: color.up }]}>Saved onchain · keepers watch the oracle.</Text>
      ) : null}
      <Button
        label={busy ? "Placing…" : `Place ${takeProfit ? "TP" : "SL"} at ${price18(trigger18)}`}
        disabled={busy || !account.client || position.size === 0n}
        loading={busy}
        onPress={() =>
          void send(async () => {
            if (!address) throw new Error("no account");
            const client = account.client;
            if (!client) throw new Error("locked");
            const order = triggerOrder({
              user: address,
              marketId: market.marketId,
              isLong: position.isLong,
              takeProfit,
              triggerPrice18: trigger18,
              sizeDelta: position.size,
            });
            return placeTriggerRequest(userSender(client, address, account.settings.faceId), order);
          })
        }
        accessibilityHint={`Closes the whole position when ${market.name} reaches ${price18(trigger18)}, ${pct(stepBps)} from now`}
      />
    </Panel>
  );
}

const styles = StyleSheet.create({
  panel: { padding: SPACE.md, gap: SPACE.sm },
  row: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
});
