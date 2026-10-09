/**
 * The window a call lived in, proved (pivot "Proof", S5.11 — the full re-verify page is S7): the line (the Pyth print
 * at the open) and the close print, each with its publish time and the transaction that put it on chain, where the
 * close landed against the line, and how the crowd called it. Facts only: no winner is inferred beyond the prints.
 */
import type { WindowProof as Proof } from "@senryo/api-client";
import { closeUnposted, proofFacts } from "@senryo/calls";
import { type ChainId, explorerTxUrl } from "@senryo/config";
import { usePrint, useWindowProof } from "@senryo/query";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { SectionHeading } from "~/features/profile/SectionHeading";
import { fire } from "~/feedback/fire";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";

function Fact({
  label,
  value,
  detail,
  tx,
  chainId,
}: {
  label: string;
  value: string;
  detail?: string | undefined;
  tx?: string | null | undefined;
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

function ProofBody({ p, chainId }: { p: Proof; chainId: ChainId }) {
  const archived = usePrint(p.symbol, closeUnposted(p) ? p.expiry : undefined);
  const { heading, facts } = proofFacts(p, "value" in archived ? archived.value : undefined);
  return (
    <View style={styles.wrap}>
      <SectionHeading detail={heading}>The window</SectionHeading>
      {facts.map((f) => (
        <Fact key={f.label} {...f} chainId={chainId} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: SPACE.xs },
  fact: { flexDirection: "row", alignItems: "center", gap: SPACE.md, minHeight: SIZE.touch + SPACE.sm },
  flex: { flex: 1 },
});
