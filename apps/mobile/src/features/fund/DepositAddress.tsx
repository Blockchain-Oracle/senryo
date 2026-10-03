/**
 * The deposit address (flow book B4 steps 4–5; Solflare S21 receive grammar): "Send 10 USDC" from that chain's mark,
 * the dotted QR with the origin chain's badge, the address in grouped mono, Copy · Share circles, what arrives at
 * least, the time and the route, then the timeline polled from Relay by the ADDRESS (open mode: a deposit of another
 * amount gets its own request, so the quote-time request id can't be trusted to finish): Waiting → Bridging → Arrived
 * on Monad, or Refunded / Didn't arrive with Relay's reason and the source transaction. Nothing is signed here.
 */
import { depositTimeline, useDepositStatus } from "@senryo/query";
import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import { Pressable, Share as ShareSheet, StyleSheet, Text, View } from "react-native";
import { EntityMark } from "~/components/identity/EntityMark";
import { Copy, Info, Share } from "~/components/kit/symbols";
import { ActionCircle, ActionCircles } from "~/features/money/ActionCircle";
import { type StepState, TimelineStep } from "~/features/money/BridgeTimeline";
import { etaText, providerMark, providerName } from "~/features/money/ChainGrid";
import { ReviewRow, ReviewRows } from "~/features/money/Review";
import { tokenAmount } from "~/features/tokens/format";
import { fire } from "~/feedback/fire";
import { CONTROL_FONT_SCALE, NUMERIC_VARIANT, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { DottedQr } from "./DottedQr";
import type { SavedDeposit } from "./deposit-addresses";
import { groupedAddress } from "./ReceiveCard";

const QR_SIZE = 196;
const BADGE = 32;
const RELAY = "relay";

export function DepositAddress({
  deposit,
  chainName,
  chainMark,
  onInfo,
}: {
  deposit: SavedDeposit;
  chainName: string;
  chainMark: string;
  onInfo: () => void;
}) {
  const { color } = useTheme();
  const [copied, setCopied] = useState(false);
  const status = useDepositStatus({ fromChain: deposit.fromChain, depositAddress: deposit.depositAddress });
  const value = status.status === "fresh" || status.status === "stale" ? status.value : undefined;
  const [top, bottom] = groupedAddress(deposit.depositAddress);
  const exact = tokenAmount(BigInt(deposit.amount), deposit.decimals, deposit.symbol);
  const steps: { title: string; detail?: string | undefined; state: StepState }[] = depositTimeline(
    deposit,
    value,
    chainName,
    status.status === "failed",
    tokenAmount,
  );
  return (
    <View style={styles.stack}>
      <View style={styles.title}>
        <EntityMark id={chainMark} label={chainName} size={SIZE.markInline} decorative />
        <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowStrong, { color: color.ink }]}>
          Send {exact} on {chainName}
        </Text>
      </View>
      <View style={styles.code}>
        <DottedQr
          value={deposit.depositAddress}
          size={QR_SIZE}
          label={`Deposit address on ${chainName} ${deposit.depositAddress}`}
          center={<EntityMark id={chainMark} size={BADGE} decorative ground={color.paper} />}
        />
      </View>
      <View accessible accessibilityLabel={`Address ${deposit.depositAddress}`}>
        <Text selectable style={[TYPE.numSm, styles.mono, { color: color.ink }]}>
          {top}
        </Text>
        <Text selectable style={[TYPE.numSm, styles.mono, { color: color.ink }]}>
          {bottom}
        </Text>
      </View>
      <ActionCircles>
        <ActionCircle
          icon={Copy}
          label={copied ? "Copied" : "Copy"}
          onPress={() =>
            void Clipboard.setStringAsync(deposit.depositAddress).then(() => {
              fire("filled");
              setCopied(true);
            })
          }
        />
        <ActionCircle
          icon={Share}
          label="Share"
          onPress={() =>
            void ShareSheet.share({ message: `${deposit.symbol} on ${chainName}\n${deposit.depositAddress}` })
          }
        />
      </ActionCircles>
      <ReviewRows>
        <ReviewRow label="Only" value={`${deposit.symbol} on ${chainName}`} tone="warn" />
        <ReviewRow
          label="You receive at least"
          value={tokenAmount(BigInt(deposit.minReceived), deposit.outDecimals, deposit.outSymbol)}
        />
        <ReviewRow label="Time" value={etaText(deposit.etaSec)} />
        <ReviewRow
          label="Route"
          value={providerName(RELAY)}
          mark={<EntityMark id={providerMark(RELAY)} label={providerName(RELAY)} size={SIZE.markChip} decorative />}
        />
      </ReviewRows>
      <View accessibilityRole="progressbar" accessibilityLabel={`Deposit from ${chainName}`}>
        {steps.map((s, i) => (
          <TimelineStep key={s.title} index={i} last={i === steps.length - 1} {...s} />
        ))}
      </View>
      <Pressable onPress={onInfo} accessibilityRole="button" hitSlop={SPACE.sm} style={styles.info}>
        <Info size={SIZE.iconSm} color={color.text3} />
        <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowDetail, { color: color.text3 }]}>
          How this address works
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: SPACE.lg },
  title: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACE.xs },
  code: { alignItems: "center" },
  mono: { textAlign: "center", fontVariant: NUMERIC_VARIANT, letterSpacing: SPACE.xxs / 2 },
  info: { flexDirection: "row", alignItems: "center", alignSelf: "center", gap: SPACE.xs },
});
