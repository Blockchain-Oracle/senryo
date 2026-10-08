/**
 * Deposit from another chain (flow book B4 steps 3–5): the exact amount in the source token's own units, then the live
 * quote — what arrives on Monad (the minimum), the fees, the time and the route with its provider's mark — re-quoted
 * while open, "Quote expired · Refresh" past its expiry. The transfer starts on the other chain with no wallet of ours
 * there: "Get deposit address" opens a Relay open-mode address bound to this wallet (any wallet or exchange can send to
 * it; a later deposit of the same route arrives too), kept per route so reopening — after a kill too — shows the same
 * address and its timeline, and recorded as Arriving until the balance rises. Below the route's minimum the quote
 * fails first, so no address is shown for it. Practice: Relay doesn't serve the test network → "Mainnet only".
 */
import type { BridgeRouteChain } from "@senryo/api-client";
import { type BridgeAsset, MAINNET_CHAIN_ID, MONAD_BRIDGE_ASSETS } from "@senryo/config";
import { anyAssetKeys, requestDepositAddress, useBridgeQuote, useBridgeRoutes, useQueryEnv } from "@senryo/query";
import { useQueryClient } from "@tanstack/react-query";
import { router, usePathname } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { EntityMark } from "~/components/identity/EntityMark";
import { Button } from "~/components/kit/Button";
import { ReadingView } from "~/components/kit/states";
import { Info } from "~/components/kit/symbols";
import { ChildSheet } from "~/components/sheet/ChildSheet";
import { Keypad } from "~/components/trade/Keypad";
import { useAmountInput } from "~/features/money/amount";
import { recordArrival } from "~/features/money/arrivals";
import { etaText, providerMark, providerName } from "~/features/money/ChainGrid";
import { ReviewRow, ReviewRows } from "~/features/money/Review";
import { useMoneyAssets } from "~/features/money/useMoneyAssets";
import { tokenAmount } from "~/features/tokens/format";
import { useAccount } from "~/lib/account/provider";
import { ROUTES } from "~/lib/constants/routes";
import { shortAddress } from "~/lib/format";
import { usd } from "~/lib/money";
import { CONTROL_FONT_SCALE, HERO_FONT_SCALE, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { bridgeAssetMark } from "./bridge-assets";
import { DepositAddress } from "./DepositAddress";
import { saveDeposit, useSavedDeposit, useSavedDeposits } from "./deposit-addresses";

/** No balance to cap a deposit from elsewhere: the route's minimum and the quote say what works. */
const NO_CAP_BITS = 128n;
const NO_CAP = 2n ** NO_CAP_BITS;
const KEYPAD_HEIGHT = 248;
const MS_PER_SECOND = 1000;

export function BridgeIn({ asset, chainId }: { asset: BridgeAsset; chainId: number }) {
  const env = useQueryEnv();
  const client = useQueryClient();
  const routes = useBridgeRoutes(asset, "in");
  const retry = () => void client.invalidateQueries({ queryKey: anyAssetKeys.bridgeRoutes(env.chainId, asset, "in") });
  return (
    <ReadingView reading={routes} loading="plate" loadingLabel="Finding the route" retry={retry}>
      {(value) => {
        const chain = value.chains.find((c) => c.chainId === chainId && c.available);
        if (!chain) {
          return <Text style={[TYPE.rowDetail, styles.empty]}>No route for {asset} from this chain</Text>;
        }
        return <Quote asset={asset} chain={chain} />;
      }}
    </ReadingView>
  );
}

function Quote({ asset, chain }: { asset: BridgeAsset; chain: BridgeRouteChain }) {
  const { color } = useTheme();
  const env = useQueryEnv();
  const client = useQueryClient();
  const address = useAccount().hint?.address;
  const money = useMoneyAssets();
  const remote = chain.remote[0];
  const decimals = remote?.decimals ?? 0;
  const input = useAmountInput(decimals, null, NO_CAP);
  const pathname = usePathname();
  const scope = `${pathname}:${env.chainId}:${address}:${chain.chainId}:${asset}:${remote?.asset}:${input.amount}`;
  const live = useRef({ scope, mounted: true, busy: false, generation: 0 });
  if (live.current.scope !== scope) {
    live.current.scope = scope;
    live.current.generation += 1;
  }
  useEffect(() => {
    live.current.mounted = true;
    return () => {
      live.current.mounted = false;
    };
  }, []);
  useEffect(() => {
    setOpen(false);
    setRefused(undefined);
  }, [scope]);
  const [why, setWhy] = useState(false);
  const [open, setOpen] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [refused, setRefused] = useState<string>();
  const saved = useSavedDeposit(env.chainId, address, chain.chainId, asset, remote?.asset);
  const history = useSavedDeposits(env.chainId, address, chain.chainId, asset, remote?.asset);
  const mainnet = env.chainId === MAINNET_CHAIN_ID;
  const quote = useBridgeQuote(
    address && remote && input.amount > 0n
      ? {
          fromChain: chain.chainId,
          toChain: env.chainId,
          asset,
          amount: input.amount,
          sender: address,
          recipient: address,
          remote: remote.asset,
        }
      : undefined,
  );
  const q = quote.status === "fresh" || quote.status === "stale" ? quote.value : undefined;
  const ok = q?.status === "ok" ? q : undefined;
  const expired = ok?.expiresAt != null && ok.expiresAt * MS_PER_SECOND < Date.now();
  const feeUsd6 = ok?.fees.reduce((sum, f) => sum + (f.usd6 ?? 0n), 0n);
  // The saved address already serves this amount (or none is typed): show it; another amount opens a fresh one.
  const reuse = saved !== undefined && (input.amount === 0n || BigInt(saved.amount) === input.amount);
  const issue = async () => {
    if (!address || !remote || live.current.busy) return;
    if (reuse && saved && (saved.expiresAt === null || saved.expiresAt * MS_PER_SECOND > Date.now()))
      return setOpen(true);
    if (!ok || (ok.expiresAt !== null && ok.expiresAt * MS_PER_SECOND <= Date.now())) {
      setRefused("Quote expired · refresh before opening an address");
      return;
    }
    live.current.busy = true;
    const generation = live.current.generation;
    const current = () =>
      live.current.mounted && live.current.scope === scope && live.current.generation === generation;
    setIssuing(true);
    setRefused(undefined);
    try {
      const issued = await requestDepositAddress(env, {
        fromChain: chain.chainId,
        asset,
        remote: remote.asset,
        amount: input.amount,
        recipient: address,
      });
      if (issued.status !== "ok") {
        if (current()) setRefused(issued.reason);
        return;
      }
      saveDeposit(env.chainId, address, issued, {
        sourceName: chain.name,
        sourceMark: chain.mark,
        issuedWhileAway: !current(),
      });
      const token = MONAD_BRIDGE_ASSETS[env.chainId][asset]?.address;
      if (token) {
        recordArrival({
          kind: "bridge",
          chainId: env.chainId,
          account: address.toLowerCase(),
          asset: token.toLowerCase(),
          symbol: issued.out.symbol,
          baseline: (money.find(token)?.wallet ?? 0n).toString(),
          amount: issued.minReceived.toString(),
          via: chain.name,
          providerOperationId: issued.depositAddress,
          status: "created",
        });
      }
      if (current()) setOpen(true);
    } catch {
      if (current()) setRefused("Couldn’t open an address · try again");
    } finally {
      live.current.busy = false;
      if (live.current.mounted) setIssuing(false);
    }
  };
  const depositLabel = !mainnet
    ? "Deposit address · Mainnet only"
    : reuse
      ? "Show deposit address"
      : issuing
        ? "Opening an address…"
        : "Get deposit address";
  return (
    <View style={styles.stack}>
      <View style={styles.hero}>
        <Text
          maxFontSizeMultiplier={HERO_FONT_SCALE}
          numberOfLines={1}
          adjustsFontSizeToFit
          style={[TYPE.displayBalance, { color: input.text ? color.ink : color.text3 }]}
        >
          {input.text || "0"} {remote?.symbol}
        </Text>
        <View style={styles.from}>
          <EntityMark id={chain.mark} label={chain.name} size={SIZE.markInline} decorative />
          <Text style={[TYPE.rowDetail, { color: color.text2 }]}>From {chain.name}</Text>
        </View>
      </View>
      {input.amount > 0n ? (
        <ReviewRows>
          {ok ? (
            <>
              <ReviewRow
                label="You receive at least"
                value={tokenAmount(ok.minReceived, ok.out.decimals, ok.out.symbol)}
                mark={<EntityMark id={bridgeAssetMark(asset)} label={asset} size={SIZE.markChip} decorative />}
              />
              <ReviewRow label="Fees" value={feeUsd6 !== undefined && feeUsd6 > 0n ? usd(feeUsd6) : "Included"} />
              <ReviewRow label="Time" value={etaText(ok.etaSec)} />
              <ReviewRow
                label="Route"
                value={providerName(ok.provider)}
                mark={
                  <EntityMark
                    id={providerMark(ok.provider)}
                    label={providerName(ok.provider)}
                    size={SIZE.markChip}
                    decorative
                  />
                }
              />
              {expired ? (
                <Pressable
                  onPress={() => void client.invalidateQueries({ queryKey: ["bridge", "quote"] })}
                  accessibilityRole="button"
                >
                  <Text style={[TYPE.rowDetail, { color: color.link }]}>Quote expired · Refresh</Text>
                </Pressable>
              ) : null}
            </>
          ) : q?.status === "unsupported" ? (
            <ReviewRow label="Route" value={q.reason} tone="warn" />
          ) : quote.status === "failed" ? (
            <ReviewRow label="Quote" value="Unavailable · try again" tone="warn" />
          ) : (
            <ReviewRow label="Quote" value="Getting a quote" />
          )}
        </ReviewRows>
      ) : null}
      <View style={styles.keypad}>
        <Keypad onKey={input.key} />
      </View>
      {refused ? (
        <Text accessibilityLiveRegion="polite" style={[TYPE.rowDetail, styles.center, { color: color.down }]}>
          {refused}
        </Text>
      ) : null}
      <Button
        label={depositLabel}
        disabled={!mainnet || issuing || (!reuse && (!ok || expired))}
        onPress={() => void issue()}
      />
      {history.map((deposit) => (
        <Pressable
          key={deposit.depositAddress}
          accessibilityRole="link"
          onPress={() =>
            router.push(`/fund/deposit/${encodeURIComponent(`${deposit.fromChain}:${deposit.depositAddress}`)}`)
          }
        >
          <Text style={[TYPE.rowDetail, { color: color.link }]}>
            {deposit.issuedWhileAway ? "Saved while away" : "Saved deposit"} · {deposit.symbol} ·{" "}
            {shortAddress(deposit.depositAddress)} ›
          </Text>
        </Pressable>
      ))}
      <View style={styles.links}>
        <Pressable onPress={() => setWhy(true)} accessibilityRole="button" hitSlop={SPACE.sm} style={styles.link}>
          <Info size={SIZE.iconSm} color={color.text3} />
          <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowDetail, { color: color.text3 }]}>
            How it works
          </Text>
        </Pressable>
        <Pressable onPress={() => router.push(ROUTES.receive)} accessibilityRole="link" hitSlop={SPACE.sm}>
          <Text style={[TYPE.rowDetail, { color: color.link }]}>Receive on Monad ›</Text>
        </Pressable>
      </View>
      <ChildSheet open={open && saved !== undefined} onClose={() => setOpen(false)} title="Deposit address">
        {saved ? (
          <DepositAddress
            deposit={saved}
            chainName={chain.name}
            chainMark={chain.mark}
            onInfo={() => {
              setOpen(false);
              setWhy(true);
            }}
          />
        ) : null}
      </ChildSheet>
      <ChildSheet open={why} onClose={() => setWhy(false)} title="Sending from another chain">
        <Text style={[TYPE.body, { color: color.text2 }]}>
          {mainnet
            ? `Send ${remote?.symbol ?? ""} on ${chain.name} to the deposit address from any wallet or exchange — it arrives in this Monad wallet through Relay. The address keeps working for later deposits of the same token. A deposit Relay can’t fill, such as one below the minimum, goes back to the address it came from.`
            : "Practice money moves only on the test network, where Relay has no deposit addresses. Switch to Mainnet to bring tokens from another chain."}
        </Text>
      </ChildSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: SPACE.lg },
  empty: { textAlign: "center", paddingVertical: SPACE.xl },
  center: { textAlign: "center" },
  hero: { alignItems: "center", gap: SPACE.xs, paddingVertical: SPACE.md },
  from: { flexDirection: "row", alignItems: "center", gap: SPACE.xs },
  keypad: { height: KEYPAD_HEIGHT },
  links: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  link: { flexDirection: "row", alignItems: "center", gap: SPACE.xs },
});
