import { usePortfolio } from "@senryo/query";
import { Text, View } from "react-native";
import { useAccount } from "~/lib/account/provider";
import { usd } from "~/lib/money";
import { SPACE, TYPE, useTheme } from "~/theme";
export function PortfolioDetails() {
  const { color } = useTheme();
  const reading = usePortfolio(useAccount().hint?.address);
  if (reading.status !== "fresh" && reading.status !== "stale")
    return <Text style={[TYPE.body, { color: color.text3 }]}>Reading portfolio valuation…</Text>;
  const s = reading.value;
  return (
    <View style={{ gap: SPACE.md }}>
      {s.components.map((c) => (
        <View key={c.name} style={{ gap: SPACE.xs }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: SPACE.md }}>
            <Text style={[TYPE.row, { color: color.ink }]}>{c.name}</Text>
            <Text style={[TYPE.rowAmount, { color: color.ink }]}>
              {c.supported === false ? "Not available" : c.valueUsd6 === undefined ? "Unavailable" : usd(c.valueUsd6)}
            </Text>
          </View>
          {c.missing.length ? <Text style={[TYPE.meta, { color: color.warn }]}>{c.missing.join(" · ")}</Text> : null}
        </View>
      ))}
      <Text style={[TYPE.meta, { color: color.text3 }]}>
        Estimated at block {s.blockNumber.toString()}. Includes unrealized trading gains/losses, accrued fees, card debt
        and pool shares awaiting redemption. USD pegs are estimates where no feed is configured. Availability and
        position exposure are excluded.
      </Text>
    </View>
  );
}
