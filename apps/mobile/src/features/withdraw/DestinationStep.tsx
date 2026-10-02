/**
 * Withdraw, step 2 — where to (flow book B8–B10; plan §0.9 Withdraw "To"): Monad · Another chain · Bank.
 * - Monad: saved destinations (exchange marks) and a new address (paste or scan); every address is checked again.
 * - Another chain: only the chains this asset has a route to, each with its mark, time and provider; an asset without
 *   a route composes "Swap to USDC and withdraw" (verified only — an unverified token never auto-composes); then the
 *   address on that chain, checked for its format.
 * - Bank: Ramp's cash-out needs an off-ramp key from Ramp support; until then the tab says so, with no dead button.
 */
import type { BridgeRouteChain } from "@senryo/api-client";
import { anyAssetKeys, useBridgeRoutes, useQueryEnv } from "@senryo/query";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { EntityMark } from "~/components/identity/EntityMark";
import { Button } from "~/components/kit/Button";
import { Segmented } from "~/components/kit/Segmented";
import { ReadingView } from "~/components/kit/states";
import { ScanLine } from "~/components/kit/symbols";
import { SheetRow } from "~/components/sheet/SheetRow";
import type { MoneyAsset } from "~/features/money/assets";
import { ChainGrid } from "~/features/money/ChainGrid";
import { RAMP_SELL_READY } from "~/features/money/ramp";
import { checksumOk } from "~/features/money/recipient";
import { SearchField, TextTool, ToolCircle } from "~/features/money/SearchField";
import { readClipboard } from "~/lib/clipboard";
import { shortAddress } from "~/lib/format";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { addressFits, vmName } from "./chain-withdraw";
import { type Destination, destinationMark } from "./destinations";

export type DestinationTab = "monad" | "chain" | "bank";
const TABS: readonly { value: DestinationTab; label: string }[] = [
  { value: "monad", label: "Monad" },
  { value: "chain", label: "Another chain" },
  { value: "bank", label: "Bank" },
];
const ADDRESS_MAX = 64;
const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;

export function DestinationStep({
  asset,
  tab,
  onTab,
  saved,
  scanned,
  onScan,
  practice,
  onMonad,
  onChain,
}: {
  asset: MoneyAsset;
  tab: DestinationTab;
  onTab: (tab: DestinationTab) => void;
  saved: readonly Destination[];
  /** The last scanned address, filled into whichever field is showing. */
  scanned: string | undefined;
  onScan: () => void;
  practice: boolean;
  onMonad: (address: `0x${string}`, label: string) => void;
  onChain: (chain: BridgeRouteChain, recipient: string, composed: boolean) => void;
}) {
  return (
    <View style={styles.stack}>
      <Segmented options={TABS} value={tab} onChange={onTab} label="Withdraw to" />
      {tab === "monad" ? (
        <MonadDestinations saved={saved} scanned={scanned} onScan={onScan} onPick={onMonad} />
      ) : tab === "chain" ? (
        <ChainDestinations asset={asset} practice={practice} scanned={scanned} onScan={onScan} onPick={onChain} />
      ) : (
        <SheetRow
          title={practice ? "Mainnet only" : "Bank cash-out"}
          detail={RAMP_SELL_READY ? "Ramp" : "Pending Ramp approval"}
          disabled
        />
      )}
    </View>
  );
}

function AddressField({
  value,
  onChange,
  onScan,
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  onScan: () => void;
  placeholder: string;
}) {
  return (
    <SearchField
      value={value}
      onChangeText={(t) => onChange(t.trim().slice(0, ADDRESS_MAX))}
      placeholder={placeholder}
      label="Destination address"
      input={{ maxLength: ADDRESS_MAX }}
      tools={
        <>
          <TextTool
            label="Paste"
            onPress={() => void readClipboard().then((t) => onChange(t.trim().slice(0, ADDRESS_MAX)))}
          />
          <ToolCircle icon={ScanLine} label="Scan" onPress={onScan} />
        </>
      }
    />
  );
}

function MonadDestinations({
  saved,
  scanned,
  onScan,
  onPick,
}: {
  saved: readonly Destination[];
  scanned: string | undefined;
  onScan: () => void;
  onPick: (address: `0x${string}`, label: string) => void;
}) {
  const { color } = useTheme();
  const env = useQueryEnv();
  const [typed, setTyped] = useState("");
  const input = typed || scanned || "";
  const valid = EVM_ADDRESS.test(input);
  const mine = saved.filter((d) => d.chainId === env.chainId);
  return (
    <View style={styles.stack}>
      {mine.map((d, i) => (
        <SheetRow
          key={d.address}
          index={i}
          title={d.name}
          detail={shortAddress(d.address)}
          leading={<EntityMark id={destinationMark(d)} label={d.name} size={SIZE.markToken} decorative />}
          onPress={() => onPick(d.address as `0x${string}`, d.name)}
        />
      ))}
      {mine.length === 0 ? <Text style={[TYPE.rowDetail, { color: color.text3 }]}>No saved destinations</Text> : null}
      <AddressField value={input} onChange={setTyped} onScan={onScan} placeholder="New Monad address" />
      {input && !valid ? <Text style={[TYPE.rowDetail, { color: color.down }]}>Not a Monad address</Text> : null}
      {input && valid && !checksumOk(input) ? (
        <Text style={[TYPE.rowDetail, { color: color.down }]}>Address typo · check it</Text>
      ) : null}
      <Button
        label="Continue"
        disabled={!valid || !checksumOk(input)}
        onPress={() => onPick(input as `0x${string}`, shortAddress(input))}
      />
    </View>
  );
}

function ChainDestinations({
  asset,
  practice,
  scanned,
  onScan,
  onPick,
}: {
  asset: MoneyAsset;
  practice: boolean;
  scanned: string | undefined;
  onScan: () => void;
  onPick: (chain: BridgeRouteChain, recipient: string, composed: boolean) => void;
}) {
  const { color } = useTheme();
  const env = useQueryEnv();
  const client = useQueryClient();
  // A verified asset without its own route goes as USDC (one composed operation); Practice has no swaps.
  const composed = asset.bridge === undefined && asset.verified && !practice;
  const routeAsset = asset.bridge ?? (composed ? "USDC" : undefined);
  const routes = useBridgeRoutes(routeAsset, "out");
  const [chain, setChain] = useState<BridgeRouteChain>();
  const [typed, setTyped] = useState("");
  if (!routeAsset) {
    return (
      <SheetRow
        title={asset.verified ? "Mainnet only" : "Unverified · swap first"}
        detail={asset.verified ? "No route for this token here" : "Swap it, then withdraw"}
        disabled
      />
    );
  }
  if (chain) {
    const input = typed || scanned || "";
    const fits = addressFits(chain.vm, input);
    return (
      <View style={styles.stack}>
        <SheetRow
          title={chain.name}
          detail="Change chain"
          leading={<EntityMark id={chain.mark} label={chain.name} size={SIZE.markToken} decorative />}
          onPress={() => setChain(undefined)}
        />
        <AddressField value={input} onChange={setTyped} onScan={onScan} placeholder={`Address on ${chain.name}`} />
        {input && !fits ? (
          <Text style={[TYPE.rowDetail, { color: color.down }]}>Not {vmName(chain.vm)} address</Text>
        ) : null}
        <Button label="Continue" disabled={!fits} onPress={() => onPick(chain, input, composed)} />
      </View>
    );
  }
  const retry = () =>
    void client.invalidateQueries({ queryKey: anyAssetKeys.bridgeRoutes(env.chainId, routeAsset, "out") });
  return (
    <View style={styles.stack}>
      {composed ? <Text style={[TYPE.rowDetail, { color: color.text2 }]}>Swap to USDC and withdraw</Text> : null}
      <ReadingView reading={routes} loading="list" loadingLabel="Finding routes" retry={retry}>
        {(value) => <ChainGrid routes={value} onPick={setChain} direction="out" />}
      </ReadingView>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: SPACE.md },
});
