import type { PositionView } from "@senryo/chain";
import type { PositionHealth } from "@senryo/core";
import type { LiveMarket } from "@senryo/query";
import { StyleSheet, Text } from "react-native";
import { quantityText } from "~/features/trade/quantity";
import { fundingForSide, marketRates } from "~/features/trade/rates";
import { Facts } from "~/features/trade/TicketReceipt";
import { price18, priceDecimalsOf, signedUsd } from "~/lib/money";
import { CONTROL_FONT_SCALE, TYPE, useTheme } from "~/theme";

/**
 * The position's stat strip (flow book C5 step 3; plan §0.9 Position): Size — oz for the metals, the base currency
 * for FX (defect 9) — · Entry · Mark (the oracle) · Liq. One strip, value over label, no table.
 */
export function PositionStats({
  market,
  position,
  health,
}: {
  market: LiveMarket;
  position: PositionView;
  health: PositionHealth;
}) {
  const decimals = priceDecimalsOf(market.marketId);
  return (
    <Facts
      facts={[
        { label: "Size", value: quantityText(market.marketId, position.size) },
        { label: "Entry", value: `$${price18(position.entry, decimals)}` },
        { label: "Mark", value: `$${price18(market.pv.price18, decimals)}` },
        { label: "Liq.", value: health.liqPrice18 === null ? "None" : `$${price18(health.liqPrice18, decimals)}` },
      ]}
    />
  );
}

/**
 * Funding and borrow in one line (C5 step 4): what was accrued so far and what the position pays or receives now
 * ("Funding −P$0.12 · Borrow −P$0.04 so far · you pay 0.0040%/h").
 */
export function FundingLine({
  market,
  isLong,
  fundingUsd6,
  borrowUsd6,
}: {
  market: LiveMarket;
  isLong: boolean;
  fundingUsd6: bigint;
  borrowUsd6: bigint;
}) {
  const { color } = useTheme();
  const now = market.pv.status === "OPEN" ? fundingForSide(marketRates(market), isLong).toLowerCase() : undefined;
  return (
    <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowDetail, styles.center, { color: color.text3 }]}>
      Funding {signedUsd(-fundingUsd6)} · Borrow {signedUsd(-borrowUsd6)} so far{now ? ` · ${now}` : ""}
    </Text>
  );
}

const styles = StyleSheet.create({ center: { textAlign: "center" } });
