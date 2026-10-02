/**
 * The asset picker (flow book B0.1; Fomo F22's searchable token list, Phantom P20's token chip): every holding with its
 * mark, amount and value, searchable by name, symbol or pasted address; verified first by value, then "Other tokens
 * (n)" collapsed. A row that can't do this action stays, dimmed, with its reason ("No bridge for this token"). Render it
 * inside a `ChildSheet`; it opens on the entry point's asset.
 */
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronDown } from "~/components/kit/symbols";
import { fire } from "~/feedback/fire";
import { CONTROL_FONT_SCALE, SPACE, TYPE, useTheme } from "~/theme";
import { AssetRow } from "./AssetRow";
import { type MoneyAsset, matchesQuery } from "./assets";
import { SearchField } from "./SearchField";

export function AssetPicker({
  assets,
  other = [],
  selectedKey,
  onPick,
  reasonFor,
  detailFor,
  emptyLine = "Nothing here yet",
}: {
  assets: readonly MoneyAsset[];
  /** Unverified rows ("Other tokens"); omit where they can never apply (a swap's receive side). */
  other?: readonly MoneyAsset[];
  selectedKey?: string | undefined;
  onPick: (asset: MoneyAsset) => void;
  /** Why this row can't do the action (≤ 4 words), or undefined when it can. */
  reasonFor?: (asset: MoneyAsset) => string | undefined;
  /** Replaces a row's amount line ("Available 212.00"). */
  detailFor?: (asset: MoneyAsset) => string | undefined;
  emptyLine?: string;
}) {
  const { color } = useTheme();
  const [query, setQuery] = useState("");
  const [showOther, setShowOther] = useState(false);
  const verified = assets.filter((a) => matchesQuery(a, query));
  const others = other.filter((a) => matchesQuery(a, query));
  const searching = query.trim() !== "";
  const row = (asset: MoneyAsset, index: number) => {
    const detail = detailFor?.(asset);
    return (
      <AssetRow
        key={asset.key}
        asset={asset}
        index={index}
        selected={asset.key === selectedKey}
        disabledReason={reasonFor?.(asset)}
        {...(detail ? { detail } : {})}
        onPress={() => onPick(asset)}
      />
    );
  };
  return (
    <View style={styles.stack}>
      <SearchField value={query} onChangeText={setQuery} placeholder="Name, symbol or address" label="Search assets" />
      <View>
        {verified.map(row)}
        {verified.length === 0 && others.length === 0 ? (
          <Text style={[TYPE.rowDetail, styles.center, { color: color.text3 }]}>
            {searching ? "No match" : emptyLine}
          </Text>
        ) : null}
      </View>
      {others.length > 0 ? (
        <View>
          <Pressable
            onPress={() => {
              fire("tick");
              setShowOther((v) => !v);
            }}
            accessibilityRole="button"
            accessibilityState={{ expanded: showOther || searching }}
            style={styles.toggle}
          >
            <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowDetail, { color: color.text2 }]}>
              Other tokens ({others.length})
            </Text>
            <View style={{ transform: [{ rotate: showOther || searching ? "180deg" : "0deg" }] }}>
              <ChevronDown size={SPACE.lg} color={color.text2} />
            </View>
          </Pressable>
          {showOther || searching ? others.map((a, i) => row(a, i)) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: SPACE.md },
  center: { textAlign: "center", paddingVertical: SPACE.lg },
  toggle: { flexDirection: "row", alignItems: "center", gap: SPACE.xs, paddingVertical: SPACE.sm },
});
