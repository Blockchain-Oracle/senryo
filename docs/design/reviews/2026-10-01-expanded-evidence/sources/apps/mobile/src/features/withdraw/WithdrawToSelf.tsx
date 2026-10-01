/**
 * Withdraw to your own wallet (D-039; in session scope): pick AUSD or USDC, a share of what can leave, and confirm.
 * What can leave is the lower of that token's balance and Free to trade (`maxWithdrawable`; the core re-checks). The
 * destination is the account's own address — the same passkey keeps the funds — so no extra check is asked. The result
 * is said once the transaction is finalized; a failure says nothing moved.
 */
import type { AccountSnapshot } from "@senryo/chain";
import { positionCount } from "@senryo/config";
import { RISK } from "@senryo/core";
import { collateralId } from "@senryo/identity";
import { type CollateralSymbol, maxWithdrawable, useQueryEnv, useSendTrace, withdrawRequest } from "@senryo/query";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { MarkedLine } from "~/components/identity/MarkedLine";
import { Button } from "~/components/kit/Button";
import { Segmented } from "~/components/kit/Segmented";
import { KeyValue, Panel } from "~/components/kit/Surface";
import { COLLATERAL_STEPS_BPS as SHARES_BPS } from "~/features/portfolio/constants";
import { useEnsureGas } from "~/features/trade/useGasTopUp";
import { useAccount } from "~/lib/account/provider";
import { userSender } from "~/lib/account/sender";
import { shortAddress } from "~/lib/format";
import { pct, usd } from "~/lib/money";
import { useNetwork } from "~/lib/network";
import { HERO_FONT_SCALE, SIZE, SPACE, TYPE, useTheme } from "~/theme";

const TOKENS = [
  { value: "AUSD", label: "AUSD" },
  { value: "USDC", label: "USDC" },
] as const satisfies readonly { value: CollateralSymbol; label: string }[];

export function WithdrawToSelf({ snapshot }: { snapshot: AccountSnapshot }) {
  const { color } = useTheme();
  const env = useQueryEnv();
  const network = useNetwork();
  const account = useAccount();
  const trace = useSendTrace();
  const gas = useEnsureGas();
  const address = account.hint?.address;
  const [symbol, setSymbol] = useState<CollateralSymbol>(snapshot.ausd >= snapshot.usdc ? "AUSD" : "USDC");
  const [shareBps, setShareBps] = useState<bigint>(RISK.BPS);
  /** What the last send moved, so its result line names it after the balances refresh. */
  const [sent, setSent] = useState<{ amount: bigint; symbol: CollateralSymbol }>();
  const max = maxWithdrawable(snapshot, symbol);
  const amount = (max * shareBps) / RISK.BPS;
  const held = symbol === "AUSD" ? snapshot.ausd : snapshot.usdc;
  const practice = network.key === "testnet";
  const last = trace.events.at(-1)?.stage;
  const busy = trace.running;
  const send = async () => {
    const client = account.client;
    if (!client || !address || amount <= 0n) return;
    const request = withdrawRequest(env.chainId, symbol, amount, address, positionCount(snapshot.positionBitmap));
    setSent({ amount, symbol });
    await trace.run(userSender(client, address, account.settings.faceId), request, {
      preflight: gas.preflight(request),
    });
  };
  return (
    <View style={styles.stack}>
      <View style={styles.hero}>
        <Text style={[TYPE.rowDetail, { color: color.text3 }]}>You withdraw</Text>
        <Text
          maxFontSizeMultiplier={HERO_FONT_SCALE}
          adjustsFontSizeToFit
          numberOfLines={1}
          style={[TYPE.displayBalance, { color: color.ink }]}
        >
          {usd(amount)}
        </Text>
        <Text style={[TYPE.rowDetail, { color: color.text2 }]}>
          {symbol}
          {practice ? " · test token" : ""} · up to {usd(max)} can leave now
        </Text>
      </View>
      <Segmented options={TOKENS} value={symbol} onChange={setSymbol} label="Token" />
      <Segmented
        options={SHARES_BPS.map((b) => ({ value: String(b), label: b >= RISK.BPS ? "All" : pct(b) }))}
        value={String(shareBps)}
        onChange={(v) => setShareBps(BigInt(v))}
        label="How much"
      />
      <Panel style={styles.rows}>
        <MarkedLine
          id={collateralId(env.chainId, symbol)}
          label={`${symbol} in your account`}
          value={usd(held)}
          size={SIZE.markToken}
        />
        <KeyValue label="Free to trade" value={usd(snapshot.freeToTrade > 0n ? snapshot.freeToTrade : 0n)} />
        <KeyValue label="To" value={address ? `Your wallet · ${shortAddress(address)}` : "—"} />
        <KeyValue label="Network" value={network.name} />
      </Panel>
      {max < held ? (
        <Text style={[TYPE.rowDetail, { color: color.text3 }]}>
          The rest backs your open positions and holds; it can leave once they close.
        </Text>
      ) : null}
      {last === "finalized" && !busy ? (
        <Text accessibilityLiveRegion="polite" style={[TYPE.rowDetail, { color: color.up }]}>
          {sent ? `${usd(sent.amount)} ${sent.symbol} withdrawn` : "Withdrawn"} · finalized. It is in your wallet.
        </Text>
      ) : last === "failed" || last === "reverted" ? (
        <Text accessibilityRole="alert" style={[TYPE.rowDetail, { color: color.down }]}>
          That didn’t go through; nothing moved.
        </Text>
      ) : null}
      <Button
        label={busy ? "Withdrawing…" : `Withdraw ${usd(amount)} to your wallet`}
        loading={busy}
        disabled={busy || amount <= 0n || !account.client}
        onPress={() => void send()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: SPACE.lg },
  hero: { gap: SPACE.xs },
  rows: { paddingHorizontal: SPACE.lg, paddingVertical: SPACE.sm, gap: SPACE.xs },
});
