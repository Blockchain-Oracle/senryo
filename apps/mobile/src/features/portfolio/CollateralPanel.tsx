/**
 * F26 (mainnet only): swap collateral inside the account — USDC ↔ AUSD through the Uniswap v4 stable pool via
 * `SenryoCore.swapCollateral` (no withdrawal). The quote refreshes every few seconds; the minimum received is 10 bps
 * under it and the core re-checks it against what actually arrived. Hidden on practice (no pool on testnet).
 */
import type { AccountSnapshot } from "@senryo/chain";
import { positionCount } from "@senryo/config";
import { RISK } from "@senryo/core";
import { collateralId, ids } from "@senryo/identity";
import { COLLATERAL_TOKENS, swapCollateralRequest, useCollateralQuote, useQueryEnv, useSendTrace } from "@senryo/query";
import { useState } from "react";
import { Text } from "react-native";
import { MarkedLine } from "~/components/identity/MarkedLine";
import { Button } from "~/components/kit/Button";
import { Segmented } from "~/components/kit/Segmented";
import { KeyValue, Panel, SectionLabel } from "~/components/kit/Surface";
import { useAccount } from "~/lib/account/provider";
import { userSender } from "~/lib/account/sender";
import { pct, usd } from "~/lib/money";
import { useNetwork } from "~/lib/network";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { COLLATERAL_STEPS_BPS } from "./constants";

const DIRECTIONS = [
  { value: "usdc", label: "USDC → AUSD" },
  { value: "ausd", label: "AUSD → USDC" },
] as const;
type From = (typeof DIRECTIONS)[number]["value"];

export function CollateralPanel({ snapshot }: { snapshot: AccountSnapshot }) {
  const network = useNetwork();
  const { color } = useTheme();
  const env = useQueryEnv();
  const account = useAccount();
  const trace = useSendTrace();
  const [from, setFrom] = useState<From>("usdc");
  const [shareBps, setShareBps] = useState<bigint>(RISK.BPS);
  const balance = from === "usdc" ? snapshot.usdc : snapshot.ausd;
  const amountIn = (balance * shareBps) / RISK.BPS;
  const quote = useCollateralQuote(COLLATERAL_TOKENS[from], amountIn);
  if (network.modeLabel !== "Mainnet") return null;
  const q = quote.status === "fresh" || quote.status === "stale" ? quote.value : undefined;
  const busy = trace.running;
  const swap = async () => {
    const client = account.client;
    const address = account.hint?.address;
    if (!client || !address || !q) return;
    const sender = userSender(client, address, account.settings.faceId);
    await trace.run(sender, swapCollateralRequest(env.chainId, q, positionCount(snapshot.positionBitmap)));
  };
  return (
    <Panel style={{ padding: SPACE.md, gap: SPACE.sm }}>
      <SectionLabel>COLLATERAL</SectionLabel>
      <MarkedLine
        id={collateralId(env.chainId, "AUSD")}
        label="AUSD"
        value={usd(snapshot.ausd)}
        size={SIZE.markToken}
      />
      <MarkedLine
        id={collateralId(env.chainId, "USDC")}
        label="USDC"
        value={usd(snapshot.usdc)}
        size={SIZE.markToken}
      />
      <Segmented options={DIRECTIONS} value={from} onChange={setFrom} label="Swap direction" />
      <Segmented
        options={COLLATERAL_STEPS_BPS.map((b) => ({ value: String(b), label: b >= RISK.BPS ? "All" : pct(b) }))}
        value={String(shareBps)}
        onChange={(v) => setShareBps(BigInt(v))}
        label="How much to swap"
      />
      <KeyValue label="YOU SWAP" value={usd(amountIn)} />
      <KeyValue label="YOU RECEIVE ≈" value={q ? usd(q.amountOut) : "—"} />
      <KeyValue label="AT LEAST" value={q ? usd(q.minOut) : "—"} />
      <MarkedLine id={ids.provider("uniswap")} label="Routed through Uniswap v4" variant="symbol" />
      {quote.status === "failed" ? (
        <Text style={[TYPE.caption, { color: color.down }]}>No quote right now — the pool may be busy; try again.</Text>
      ) : null}
      {trace.events.some((e) => e.stage === "finalized") ? (
        <Text style={[TYPE.caption, { color: color.up }]}>Swapped · your buckets update at finalization.</Text>
      ) : null}
      <Button
        label={busy ? "Swapping…" : "Swap in account"}
        loading={busy}
        disabled={busy || !q || amountIn === 0n || !account.client}
        onPress={() => void swap()}
      />
    </Panel>
  );
}
