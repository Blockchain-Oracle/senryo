import type { AccountSnapshot } from "@senryo/chain";
import { useAccountRisk, useLpVault } from "@senryo/query";
import { router } from "expo-router";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ListRow } from "~/components/kit/ListRow";
import { Panel } from "~/components/kit/Surface";
import { ReadingView } from "~/components/kit/states";
import { useSheetClose } from "~/components/sheet/Sheet";
import { useAccount } from "~/lib/account/provider";
import { ROUTES } from "~/lib/constants/routes";
import { usd } from "~/lib/money";
import { SPACE, TYPE, useTheme } from "~/theme";
import { lockedOf, useAccountRetry } from "./account";
import { CollateralPanel } from "./CollateralPanel";

/**
 * Balance details (direction §7, screen inventory "Balance details"; opened from Home's availability row): the
 * headline valuation named and explained, then Free to trade, Free to spend and Locked each with its amount and one
 * line saying what it is — in the words of the risk model (specs/risk-math.md: E_init, FreeToTrade, FreeToSpend) —
 * with Locked opened into the margin, holds and envelope actually behind it. Then the collateral by token, and the
 * LP allocation when there is one (it is not part of the balance; it returns through its own redeem). The sheet's
 * heading says the three overlap, so nothing here is drawn as parts of a whole. Amounts are the finalized read.
 */
export function BalanceDetails() {
  const address = useAccount().hint?.address;
  const risk = useAccountRisk(address, "finalized");
  const retry = useAccountRetry();
  return (
    <ReadingView reading={risk} loading="list" loadingLabel="Reading your balance" retry={retry}>
      {(s) => (
        <>
          <Panel style={styles.panel}>
            <Explained
              label="Risk-adjusted balance"
              value={s.equityInit}
              line="Your collateral at its counted value, less open losses, fees owed and card debt. Gains count once you take them."
              strong
            />
          </Panel>
          <Panel style={styles.panel}>
            <Explained
              label="Free to trade"
              value={s.freeToTrade}
              line="What a new position can use: your balance less the margin your positions need, card holds or the envelope, and a small safety buffer."
            />
            <Explained
              label="Free to spend"
              value={s.freeToSpend}
              line="What the card can draw on now: free to trade plus the unused envelope, within your daily spend limit."
            />
            <Explained
              label="Locked"
              value={lockedOf(s)}
              line="What is held back from new trades: your balance less free to trade."
            >
              <Encumbrances snapshot={s} />
            </Explained>
          </Panel>
          <CollateralPanel snapshot={s} />
          <LpAllocation />
        </>
      )}
    </ReadingView>
  );
}

/** One figure with its name and the one line that says what it is. */
function Explained({
  label,
  value,
  line,
  strong = false,
  children,
}: {
  label: string;
  value: bigint;
  line: string;
  /** The headline figure is set a step larger than the three under it. */
  strong?: boolean;
  children?: ReactNode;
}) {
  const { color } = useTheme();
  return (
    <View style={styles.item}>
      <View style={styles.item} accessible accessibilityLabel={`${label} ${usd(value)}. ${line}`}>
        <View style={styles.between}>
          <Text style={[TYPE.rowTitle, styles.grow, { color: color.ink }]} numberOfLines={1}>
            {label}
          </Text>
          <Text style={[strong ? TYPE.numMd : TYPE.rowPrice, { color: value < 0n ? color.down : color.ink }]}>
            {usd(value)}
          </Text>
        </View>
        <Text style={[TYPE.rowDetail, { color: color.text3 }]}>{line}</Text>
      </View>
      {children}
    </View>
  );
}

/** What Locked is made of, from the account itself; only what is actually there is listed. */
function Encumbrances({ snapshot }: { snapshot: AccountSnapshot }) {
  const { color } = useTheme();
  const lines = [
    { label: "Margin your positions need", value: snapshot.im },
    { label: "Card holds", value: snapshot.holds },
    { label: "Spending envelope", value: snapshot.envelope },
  ].filter((l) => l.value > 0n);
  if (lines.length === 0) return null;
  return (
    <View style={styles.lines}>
      {lines.map((l) => (
        <View key={l.label} style={styles.between}>
          <Text style={[TYPE.rowDetail, styles.grow, { color: color.text2 }]}>{l.label}</Text>
          <Text style={[TYPE.rowChange, { color: color.text2 }]}>{usd(l.value)}</Text>
        </View>
      ))}
      {snapshot.holds > 0n && snapshot.envelope > 0n ? (
        <Text style={[TYPE.meta, { color: color.text3 }]}>Of card holds and the envelope, only the larger counts.</Text>
      ) : null}
    </View>
  );
}

/** The LP vault holds its own money: shown beside the balance, never inside it, with the way back. */
function LpAllocation() {
  const address = useAccount().hint?.address;
  const vault = useLpVault(address);
  const close = useSheetClose();
  if (vault.status !== "fresh" && vault.status !== "stale") return null;
  const v = vault.value;
  if (v.sharesValue === 0n && v.pending.length === 0) return null;
  const waiting = v.pending.length;
  return (
    <Panel>
      <ListRow
        title={`In the LP vault · ${usd(v.sharesValue)}`}
        detail={
          waiting > 0
            ? `Not part of your balance · ${waiting} ${waiting === 1 ? "redeem" : "redeems"} waiting to be claimed`
            : "Not part of your balance · it returns through a redeem (24 h), then a claim"
        }
        onPress={() => close(() => router.push(ROUTES.lp))}
      />
    </Panel>
  );
}

const styles = StyleSheet.create({
  panel: { padding: SPACE.lg, gap: SPACE.lg },
  item: { gap: SPACE.xs },
  between: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: SPACE.md },
  grow: { flex: 1 },
  lines: { gap: SPACE.xs, paddingTop: SPACE.xs },
});
