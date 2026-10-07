/**
 * The Balance sheet (flow book B16; plan §0.9 "Balance sheet"): the Total (decimals in the quiet ink, `≈` when a part is
 * missing), then one row per part with its marks — Assets · Positions · Earn · Arriving · Card holds (−) · Card debt (−)
 * with Repay — and a row per missing source ("Missing price: SAKURA"). No paragraphs. Each row opens its surface; the
 * rows sum to the Total. Assets and Positions land Home on that tab.
 */
import { ids } from "@senryo/identity";
import { type Href, router } from "expo-router";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { EntityMark } from "~/components/identity/EntityMark";
import { MarkCluster } from "~/components/identity/MarkCluster";
import { Button } from "~/components/kit/Button";
import { Skeleton } from "~/components/kit/states";
import { ChartCandlestick, CreditCard, type SymbolIcon, TriangleAlert } from "~/components/kit/symbols";
import { useSheetClose } from "~/components/sheet/Sheet";
import { SheetRow } from "~/components/sheet/SheetRow";
import { ROUTES } from "~/lib/constants/routes";
import { masked, useHideBalances } from "~/lib/hide-balances";
import { signedUsd, usd } from "~/lib/money";
import { STORAGE_KEYS, storage } from "~/lib/storage";
import { CONTROL_FONT_SCALE, HERO_FONT_SCALE, RADIUS, SHEET_SHAPE, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { type SheetRow as Part, type SheetRowKey, useBalanceSheet } from "./useBalanceSheet";

const TOTAL_SKELETON = 180;
const DECIMAL_POINT = ".";

const TARGET: Record<SheetRowKey, { tab?: "assets" | "positions"; href?: Href }> = {
  assets: { tab: "assets" },
  positions: { tab: "positions" },
  earn: { href: ROUTES.lp },
  arriving: { href: ROUTES.activity },
  holds: { href: ROUTES.card },
  debt: { href: ROUTES.card },
};

/** "≈ $12,402.55" with the decimals in the quiet ink (Fomo's hero), never rolling (it is not the hero). */
function TotalLine({ value, partial }: { value: bigint; partial: boolean }) {
  const { color } = useTheme();
  const [hidden] = useHideBalances();
  const text = masked(`${partial ? "≈ " : ""}${usd(value)}`, hidden);
  const point = text.lastIndexOf(DECIMAL_POINT);
  return (
    <Text
      maxFontSizeMultiplier={HERO_FONT_SCALE}
      accessibilityRole="header"
      accessibilityLabel={hidden ? "Balance hidden" : `Total ${partial ? "about " : ""}${usd(value)}`}
      style={[TYPE.numXl, styles.center, { color: color.ink }]}
    >
      {point < 0 ? text : text.slice(0, point)}
      {point < 0 ? null : <Text style={{ color: color.text3 }}>{text.slice(point)}</Text>}
    </Text>
  );
}

function Glyph({ icon: Icon, tone }: { icon: SymbolIcon; tone?: string }) {
  const { color } = useTheme();
  return (
    <View style={[styles.disc, { backgroundColor: color.card }]}>
      <Icon size={SIZE.iconSm + SPACE.xs} strokeWidth={SIZE.iconStroke} color={tone ?? color.text2} />
    </View>
  );
}

function leadOf(part: Part): ReactNode {
  if (part.key === "positions") return <Glyph icon={ChartCandlestick} />;
  if (part.key === "earn")
    return <EntityMark id={ids.brand("senryo")} size={SIZE.markToken} variant="symbol" decorative />;
  if (part.key === "holds" || part.key === "debt") return <Glyph icon={CreditCard} />;
  const marks = part.marks.filter((m) => m !== "");
  if (marks.length === 0) return <Glyph icon={part.key === "arriving" ? CreditCard : ChartCandlestick} />;
  return <MarkCluster ids={marks} size={SIZE.markCell} />;
}

function valueText(part: Part): string {
  if (part.valueUsd6 === undefined) return "—";
  if (part.key === "arriving" && part.valueUsd6 === 0n) return "On its way";
  if (part.key === "positions") return signedUsd(part.valueUsd6);
  return part.valueUsd6 < 0n ? `−${usd(-part.valueUsd6)}` : usd(part.valueUsd6);
}

export function BalanceDetails() {
  const { color } = useTheme();
  const close = useSheetClose();
  const [hidden] = useHideBalances();
  const sheet = useBalanceSheet();
  const open = (key: SheetRowKey) => {
    const target = TARGET[key];
    if (target.tab) storage.set(STORAGE_KEYS.homeTab, target.tab);
    close(() => {
      if (target.href) router.push(target.href);
    });
  };
  return (
    <View style={styles.stack}>
      <View style={styles.total}>
        <Text
          maxFontSizeMultiplier={CONTROL_FONT_SCALE}
          style={[TYPE.rowDetail, styles.center, { color: color.text3 }]}
        >
          Total
        </Text>
        {sheet.status === "loading" ? (
          <View style={styles.center}>
            <Skeleton width={TOTAL_SKELETON} height={SIZE.skeletonRow} />
          </View>
        ) : (
          <TotalLine value={sheet.totalUsd6} partial={sheet.partial} />
        )}
      </View>
      <View style={styles.rows}>
        {sheet.rows.map((part, i) => {
          const value = masked(valueText(part), hidden);
          const negative = part.valueUsd6 !== undefined && part.valueUsd6 < 0n;
          const ink =
            part.key === "positions" && part.valueUsd6 !== undefined
              ? part.valueUsd6 < 0n
                ? color.down
                : color.up
              : negative
                ? color.text2
                : color.ink;
          return (
            <SheetRow
              key={part.key}
              index={i}
              title={part.label}
              {...(part.detail ? { detail: part.detail } : {})}
              leading={leadOf(part)}
              onPress={() => open(part.key)}
              trailing={
                <View style={styles.trailing}>
                  <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowPrice, { color: ink }]}>
                    {value}
                  </Text>
                  {part.key === "debt" ? (
                    <Button label="Repay" size="sm" variant="secondary" block={false} onPress={() => open("debt")} />
                  ) : null}
                </View>
              }
            />
          );
        })}
        {sheet.missingPrices.map((symbol, i) => (
          <SheetRow
            key={`missing:${symbol}`}
            index={sheet.rows.length + i}
            title={`Missing price: ${symbol}`}
            leading={<Glyph icon={TriangleAlert} tone={color.warn} />}
            onPress={() => open("assets")}
          />
        ))}
        {sheet.missingTokens ? (
          <SheetRow
            index={sheet.rows.length + sheet.missingPrices.length}
            title="Some tokens still loading"
            leading={<Glyph icon={TriangleAlert} tone={color.warn} />}
            onPress={() => open("assets")}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: SPACE.lg },
  total: { gap: SPACE.xs, alignItems: "center" },
  center: { textAlign: "center", alignItems: "center" },
  rows: { gap: SHEET_SHAPE.rowGap },
  trailing: { alignItems: "flex-end", gap: SPACE.xs },
  disc: {
    width: SIZE.markToken,
    height: SIZE.markToken,
    borderRadius: RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
  },
});
