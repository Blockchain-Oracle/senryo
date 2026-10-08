/**
 * "Card or bank" (B5 step 1): the assets Ramp sells on Monad — MON, USDC, AUSD, USDT0 — each opening Ramp's hosted
 * page with it preselected; KYC and payment happen in Ramp. A return through `finalUrl` starts an "Arriving" row that
 * clears when the holdings show it. An asset Ramp doesn't list (XAUt0) stays, dimmed: "Buy USDC, then swap".
 */
import { MAINNET_CHAIN_ID, MAINNET_TOKENS, NATIVE_TOKEN } from "@senryo/config";
import { collateralId, ids } from "@senryo/identity";
import { parseArrivals } from "@senryo/query";
import { ActivityIndicator, Text, View } from "react-native";
import { useMMKVString } from "react-native-mmkv";
import { EntityMark } from "~/components/identity/EntityMark";
import { SheetRow } from "~/components/sheet/SheetRow";
import { useMoneyAssets } from "~/features/money/useMoneyAssets";
import { useRampBuy } from "~/features/money/useRampBuy";
import { useAccount } from "~/lib/account/provider";
import { STORAGE_KEYS, storage } from "~/lib/storage";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";

const RAMP_ROWS = [
  { address: MAINNET_TOKENS.usdc, symbol: "USDC", name: "USD Coin", mark: collateralId(MAINNET_CHAIN_ID, "USDC") },
  { address: MAINNET_TOKENS.ausd, symbol: "AUSD", name: "Agora USD", mark: collateralId(MAINNET_CHAIN_ID, "AUSD") },
  { address: NATIVE_TOKEN, symbol: "MON", name: "Monad", mark: ids.native(MAINNET_CHAIN_ID, "MON") },
  {
    address: MAINNET_TOKENS.usdt0,
    symbol: "USDT0",
    name: "USDT0",
    mark: ids.token(MAINNET_CHAIN_ID, MAINNET_TOKENS.usdt0),
  },
] as const;

export function CardPanel({ onDone }: { onDone: () => void }) {
  const { color } = useTheme();
  const money = useMoneyAssets();
  const owner = useAccount().hint?.address.toLowerCase();
  const [raw] = useMMKVString(STORAGE_KEYS.arrivals, storage);
  const attempts = parseArrivals(raw).filter(
    (a) => a.kind === "ramp" && a.chainId === MAINNET_CHAIN_ID && a.account === owner,
  );
  const ramp = useRampBuy(MAINNET_CHAIN_ID);
  const opening = ramp.opening;
  const buy = async (row: (typeof RAMP_ROWS)[number]) => {
    const key = row.address.toLowerCase();
    if (await ramp.buy({ key, symbol: row.symbol, wallet: money.find(key)?.wallet ?? 0n })) onDone();
  };
  return (
    <>
      {attempts.length ? (
        <View style={{ gap: SPACE.sm }}>
          <Text style={[TYPE.rowStrong, { color: color.ink }]}>Provider purchases</Text>
          {attempts.map((attempt) => (
            <View key={attempt.id} style={{ gap: SPACE.xxs }}>
              <Text style={[TYPE.rowDetail, { color: color.ink }]}>
                {attempt.symbol} · {attempt.status ?? "unresolved"}
              </Text>
              <Text selectable style={[TYPE.meta, { color: color.text2 }]}>
                Ramp {attempt.providerOperationId ?? "operation"} · {attempt.providerStatus ?? "Check with provider"}
              </Text>
            </View>
          ))}
          <Text style={[TYPE.meta, { color: color.text2 }]}>
            Payment and wallet delivery are separate. If delivery is unresolved, use the purchase ID with Ramp. A
            balance change alone does not confirm delivery.
          </Text>
        </View>
      ) : null}
      {RAMP_ROWS.map((row, i) => (
        <SheetRow
          key={row.symbol}
          index={i}
          title={row.name}
          detail={`Buy ${row.symbol} · Ramp`}
          leading={<EntityMark id={row.mark} label={row.symbol} size={SIZE.markToken} decorative />}
          trailing={opening === row.address.toLowerCase() ? <ActivityIndicator color={color.text2} /> : undefined}
          disabled={opening !== undefined}
          onPress={() => void buy(row)}
        />
      ))}
      <SheetRow
        index={RAMP_ROWS.length}
        title="Tether Gold"
        detail="Buy USDC, then swap"
        leading={
          <EntityMark
            id={ids.token(MAINNET_CHAIN_ID, MAINNET_TOKENS.xaut0)}
            label="XAUt0"
            size={SIZE.markToken}
            decorative
          />
        }
        disabled
      />
    </>
  );
}
