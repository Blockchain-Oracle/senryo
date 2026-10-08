/**
 * The window a call lived in, proved (pivot "Proof", S5.11 — the full re-verify page is S7): the line (the Pyth print
 * at the open) and the close print, each with its publish time and the transaction that put it on chain, where the
 * close landed against the line, and how the crowd called it. Facts only: no winner is inferred beyond the prints.
 */
import type { WindowProof as Proof } from "@senryo/api-client";
import { type ChainId, explorerTxUrl } from "@senryo/config";
import { usePrint, useWindowProof } from "@senryo/query";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { SectionHeading } from "~/features/profile/SectionHeading";
import { fire } from "~/feedback/fire";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { priceText, SIDE, usd, whenText } from "./format";

const PERCENT = 100n;
const UP = 0;
const DOWN = 1;
const MS = 1_000;

function Fact({
  label,
  value,
  detail,
  tx,
  chainId,
}: {
  label: string;
  value: string;
  detail?: string;
  tx?: string | null;
  chainId: ChainId;
}) {
  const { color } = useTheme();
  const body = (
    <View style={styles.fact}>
      <View style={styles.flex}>
        <Text style={[TYPE.rowTitle, { color: color.ink }]}>{label}</Text>
        {detail ? (
          <Text style={[TYPE.caption, { color: color.inkMuted }]}>
            {detail}
            {tx ? " · View transaction" : ""}
          </Text>
        ) : null}
      </View>
      <Text style={[TYPE.rowTitle, { color: color.ink }]}>{value}</Text>
    </View>
  );
  if (!tx) return body;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${label} ${value}${detail ? `, ${detail}` : ""}. View transaction`}
      onPress={() => {
        fire("tick");
        void Linking.openURL(explorerTxUrl(chainId, tx));
      }}
    >
      {body}
    </Pressable>
  );
}

/** "Up 62% · Down 38%" from the stake on each band; empty when nobody called. */
function crowdText(p: Proof): string {
  const total = p.bandStake.reduce((a, b) => a + b, 0n);
  if (total === 0n) return "No calls";
  return [UP, DOWN].map((band) => `${SIDE[band]} ${((p.bandStake[band] ?? 0n) * PERCENT) / total}%`).join(" · ");
}

export function WindowProof({ windowId, chainId }: { windowId: `0x${string}`; chainId: ChainId }) {
  const { color } = useTheme();
  const proof = useWindowProof(windowId);
  if (!("value" in proof)) {
    return (
      <View style={styles.wrap}>
        <SectionHeading>The window</SectionHeading>
        <Text style={[TYPE.caption, { color: color.inkMuted }]}>
          {proof.status === "failed" ? "Couldn’t load the window’s prints." : "Loading the window’s prints…"}
        </Text>
      </View>
    );
  }
  return <ProofBody p={proof.value} chainId={chainId} />;
}

/** Where the close landed against the line, in words. */
function whereText(gap: bigint): string {
  if (gap === 0n) return "Closed on the line";
  return `Closed ${priceText(gap < 0n ? -gap : gap)} ${gap > 0n ? "above" : "below"} the line`;
}

function ProofBody({ p, chainId }: { p: Proof; chainId: ChainId }) {
  const ended = Date.now() / MS > p.expiry;
  // Settlement posts the close only while calls ride the window; with none left it never will, so the archived print
  // (the same unique print settlement would have used) stands in, said as such.
  const unposted = ended && !p.close && p.state === "open" && p.liveCalls === 0;
  const archived = usePrint(p.symbol, unposted ? p.expiry : undefined);
  const archive = unposted && "value" in archived ? archived.value : undefined;
  const open = p.open;
  const closeE8 = p.close ? p.close.priceE8 : archive ? BigInt(archive.priceE8) : null;
  const gap = open && closeE8 !== null ? closeE8 - open.priceE8 : null;
  const closeDetail = p.close
    ? `Pyth print · ${whenText(p.close.publishTime)}`
    : p.state === "voided"
      ? "No print came · every call refunded"
      : unposted
        ? archive
          ? `Pyth print · ${whenText(archive.publishTime)} · not posted on chain: no call was still open`
          : "Not posted on chain: no call was still open"
        : ended
          ? "Settling…"
          : `Closes at ${whenText(p.expiry)}`;
  return (
    <View style={styles.wrap}>
      <SectionHeading detail={`${whenText(p.start)} → ${whenText(p.expiry)}`}>The window</SectionHeading>
      <Fact
        label="Line"
        value={open ? priceText(open.priceE8) : "—"}
        detail={open ? `Pyth print · ${whenText(open.publishTime)}` : "Set by the first print"}
        tx={open?.txHash ?? null}
        chainId={chainId}
      />
      <Fact
        label="Close"
        value={closeE8 !== null ? priceText(closeE8) : "—"}
        detail={closeDetail}
        tx={p.close?.txHash ?? null}
        chainId={chainId}
      />
      {gap !== null ? <Fact label="Result" value={whereText(gap)} chainId={chainId} /> : null}
      <Fact
        label="Crowd"
        value={crowdText(p)}
        detail={`${p.calls} ${p.calls === 1 ? "call" : "calls"} · ${usd(p.volume)} staked`}
        chainId={chainId}
      />
      {p.settledTx ? (
        <Fact label="Settled" value="Paid out" detail="Every call in it" tx={p.settledTx} chainId={chainId} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: SPACE.xs },
  fact: { flexDirection: "row", alignItems: "center", gap: SPACE.md, minHeight: SIZE.touch + SPACE.sm },
  flex: { flex: 1 },
});
