/**
 * One window's proof on the phone (stage P2; the web's `/proof/w/?id=`, S7.7, D-288): its line and close — each a
 * print posted on chain with its source, confidence, publish time and transaction, and a Re-verify that has this phone
 * decode the proof from that transaction and ask the verifier again (`useReverify`, the web's own) — then every band's
 * verdict as the chain recorded it beside the same rule applied here, the crowd and where the money went, and every
 * call with its receipt.
 */
import type { WindowProof } from "@senryo/api-client";
import { bandVerdicts, callTitle, crowdText, OUTCOME_WORD, unitOf, utcTime, windowRow } from "@senryo/calls";
import { type ProofPrint, useReverify } from "@senryo/calls/react";
import { type ChainId, explorerTxUrl, MARKETS } from "@senryo/config";
import { priceText, signedUsd, usd } from "@senryo/core";
import { ids, marketId } from "@senryo/identity";
import { useWindowProof } from "@senryo/query";
import { type Href, router, Stack, useLocalSearchParams } from "expo-router";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { EntityMark } from "~/components/identity/EntityMark";
import { Button } from "~/components/kit/Button";
import { FactList } from "~/components/kit/FactList";
import { ListRow } from "~/components/kit/ListRow";
import { Screen } from "~/components/kit/Screen";
import { Panel } from "~/components/kit/Surface";
import { EmptyState, LoadingState } from "~/components/kit/states";
import { SectionHeading } from "~/features/profile/SectionHeading";
import { fire } from "~/feedback/fire";
import { useNetwork } from "~/lib/network";
import { SPACE, TYPE, useTheme } from "~/theme";

const WINDOW_ID = /^0x[0-9a-fA-F]{64}$/;
const TITLE_MARK = 36;
const SOURCE_MARK = 14;

function Reverify({ p, print, t, chainId }: { p: WindowProof; print: ProofPrint; t: number; chainId: ChainId }) {
  const { color } = useTheme();
  const { state, run } = useReverify(p, print, t, chainId);
  if (state.kind === "done") {
    return (
      <Text accessibilityLiveRegion="polite" style={[TYPE.caption, { color: state.ok ? color.up : color.down }]}>
        {state.text}
      </Text>
    );
  }
  return (
    <Button
      label={state.kind === "busy" ? "Asking the chain…" : "Re-verify on this phone"}
      variant="outline"
      size="sm"
      block={false}
      disabled={state.kind === "busy"}
      onPress={() => void run()}
    />
  );
}

/** Whose print it is (R2.8): the market's own source with its mark — Pyth, RedStone, or a basket's members. */
function sourceOf(symbol: string): { name: string; mark: string | null } {
  const kind = MARKETS.find((m) => m.symbol === symbol)?.source.kind;
  if (kind === "basket") return { name: "A basket print", mark: null };
  const redstone = kind === "redstone";
  return { name: redstone ? "RedStone print" : "Pyth print", mark: ids.provider(redstone ? "redstone" : "pyth") };
}

function PrintBlock(props: { label: string; p: WindowProof; print: ProofPrint | null; t: number; chainId: ChainId }) {
  const { label, p, print, t, chainId } = props;
  const { color } = useTheme();
  const source = sourceOf(p.symbol);
  return (
    <View style={styles.block}>
      <View style={styles.head}>
        <Text style={[TYPE.sectionTitle, styles.flex, { color: color.ink }]}>{label}</Text>
        <Text style={[TYPE.rowAmount, { color: color.ink }]}>
          {print ? priceText(print.priceE8, unitOf(p.symbol)) : "—"}
        </Text>
      </View>
      {print ? (
        <>
          <View style={styles.source}>
            {source.mark ? <EntityMark id={source.mark} size={SOURCE_MARK} decorative /> : null}
            <Text style={[TYPE.caption, styles.flex, { color: color.text3 }]}>
              {source.name} at {utcTime(print.publishTime)}, ±{priceText(print.confE8, unitOf(p.symbol))}
            </Text>
          </View>
          <Pressable
            accessibilityRole="link"
            hitSlop={SPACE.xs}
            onPress={() => {
              fire("tick");
              void Linking.openURL(explorerTxUrl(chainId, print.txHash));
            }}
          >
            <Text style={[TYPE.caption, { color: color.link }]}>The transaction ›</Text>
          </Pressable>
          <Reverify p={p} print={print} t={t} chainId={chainId} />
        </>
      ) : (
        <Text style={[TYPE.caption, { color: color.text3 }]}>
          {p.state === "voided" ? "No print came in time." : "Not posted yet."}
        </Text>
      )}
    </View>
  );
}

function Proof({ p, chainId }: { p: WindowProof; chainId: ChainId }) {
  const { color } = useTheme();
  const row = windowRow({ ...p, openE8: p.open?.priceE8 ?? null, closeE8: p.close?.priceE8 ?? null });
  const verdicts = bandVerdicts(p);
  return (
    <>
      <View style={styles.block}>
        <View style={styles.source}>
          <EntityMark id={marketId(p.symbol)} size={TITLE_MARK} decorative />
          <Text style={[TYPE.title, styles.flex, { color: color.ink }]}>{row.title}</Text>
        </View>
        <Text style={[TYPE.body, { color: color.text2 }]}>{row.detail}</Text>
      </View>
      <PrintBlock label="The line" p={p} print={p.open} t={p.start} chainId={chainId} />
      <PrintBlock label="The close" p={p} print={p.close} t={p.expiry} chainId={chainId} />
      <View style={styles.block}>
        <SectionHeading>Every band</SectionHeading>
        <Panel>
          {verdicts.map((v) => (
            <ListRow
              key={v.index}
              title={v.name}
              detail={`wins ${v.where}`}
              trailing={
                <Text style={[TYPE.caption, { color: v.agrees ? color.text2 : color.down }]}>
                  {v.chain ? `${OUTCOME_WORD[v.chain]} on chain` : "Not settled"}
                  {v.recomputed ? `\n${OUTCOME_WORD[v.recomputed]} here ${v.agrees ? "✓" : "✗"}` : ""}
                </Text>
              }
            />
          ))}
        </Panel>
      </View>
      <View style={styles.block}>
        <SectionHeading detail={crowdText(p)}>The crowd and the money</SectionHeading>
        <FactList
          facts={[
            { label: "Called", value: usd(p.volume), money: true },
            { label: "To callers", value: usd(p.toHolders), money: true },
            { label: "To the pool", value: usd(p.toPool), money: true },
          ]}
        />
        {p.settledTx ? (
          <Pressable
            accessibilityRole="link"
            hitSlop={SPACE.xs}
            onPress={() => {
              fire("tick");
              void Linking.openURL(explorerTxUrl(chainId, p.settledTx as string));
            }}
          >
            <Text style={[TYPE.caption, { color: color.link }]}>The settlement ›</Text>
          </Pressable>
        ) : null}
      </View>
      {p.callList.length > 0 ? (
        <View style={styles.block}>
          <SectionHeading>Every call</SectionHeading>
          <Panel>
            {p.callList.map((c) => (
              <ListRow
                key={c.ticketId.toString()}
                title={callTitle(c)}
                detail={`${usd(c.stake)} in, ${c.pnl === null ? "open" : signedUsd(BigInt(c.pnl))}`}
                onPress={() => router.push(`/calls/${c.ticketId}` as Href)}
              />
            ))}
          </Panel>
        </View>
      ) : null}
    </>
  );
}

function Body({ windowId, chainId }: { windowId: `0x${string}`; chainId: ChainId }) {
  const proof = useWindowProof(windowId);
  if (proof.status === "failed") return <EmptyState why="This window's proof didn't load" />;
  if (!("value" in proof)) return <LoadingState label="Loading the window" />;
  if (!proof.value) return <EmptyState why="Nobody called in this window, so it has no proof" />;
  return <Proof p={proof.value} chainId={chainId} />;
}

export function WindowProofScreen() {
  const { id = "" } = useLocalSearchParams<{ id?: string }>();
  const { chainId } = useNetwork();
  return (
    <Screen>
      <Stack.Screen options={{ title: "Window proof", headerShown: true, headerBackTitle: "Back" }} />
      {WINDOW_ID.test(id) ? (
        <Body windowId={id as `0x${string}`} chainId={chainId} />
      ) : (
        <EmptyState why="This link doesn't name a window" />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { gap: SPACE.sm },
  head: { flexDirection: "row", alignItems: "baseline", gap: SPACE.md },
  source: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  flex: { flex: 1 },
});
