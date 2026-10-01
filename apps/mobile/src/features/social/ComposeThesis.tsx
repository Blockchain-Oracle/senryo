/**
 * Compose a thesis (screen inventory "Compose thesis"; direction §9: an authored opinion, distinct from a fill): the
 * text with a live count against the api's limit, an optional market picked from the engine's listings by their real
 * marks and oracle prices, the mode it will be public on, and Post with its pending and refused states said in place.
 * `NOT_LISTED` explains that posting needs a listed profile and links to where that is set. Success closes the sheet;
 * the new thesis is then the first row of the feed.
 */
import { POST_MAX_CHARS } from "@senryo/api-client";
import { engineMarketsOn } from "@senryo/config";
import { ids } from "@senryo/identity";
import { type useCreatePost, useMarket } from "@senryo/query";
import { type Href, router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { EntityMark } from "~/components/identity/EntityMark";
import { Button } from "~/components/kit/Button";
import { useGroupFill } from "~/components/kit/Surface";
import { useSheetClose } from "~/components/sheet/Sheet";
import { SheetHeading } from "~/components/sheet/SheetRoute";
import { fire } from "~/feedback/fire";
import { ROUTES } from "~/lib/constants/routes";
import { price18, priceDecimalsOf } from "~/lib/money";
import { useNetwork } from "~/lib/network";
import { BUTTON, HAIRLINE_PX, SHEET_SHAPE, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { engineMarketId, isNotListed, socialErrorCopy } from "./format";
import { ModeBadge } from "./Quiet";

/** The field shows four lines of body text before it scrolls: a thesis is short, and the sheet stays compact. */
const FIELD_LINES = 4;
const FIELD_HEIGHT = (TYPE.body.lineHeight ?? 0) * FIELD_LINES + 2 * SPACE.md;
/** The count turns to the warning ink when this few characters are left. */
const NEAR_LIMIT = 20;

export function ComposeThesis({ create }: { create: ReturnType<typeof useCreatePost> }) {
  const { color } = useTheme();
  const fill = useGroupFill();
  const network = useNetwork();
  const close = useSheetClose();
  const [text, setText] = useState("");
  const [market, setMarket] = useState<number>();
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState<unknown>();
  const markets = engineMarketsOn(network.chainId);
  const body = text.trim();
  const left = POST_MAX_CHARS - text.length;

  const publish = () => {
    setError(undefined);
    create.mutate(
      { kind: "thesis", text: body, ...(market === undefined ? {} : { marketId: engineMarketId(market) }) },
      {
        onSuccess: () => {
          fire("confirm");
          close();
        },
        onError: (failure) => {
          fire("fail");
          setError(failure);
        },
      },
    );
  };

  return (
    <>
      <SheetHeading title="New thesis" body="Your view on a market. An opinion, never an order." />
      <View style={styles.block}>
        <View style={[styles.field, { backgroundColor: fill, borderColor: focused ? color.ring : color.transparent }]}>
          <TextInput
            value={text}
            onChangeText={(next) => {
              setText(next);
              if (error !== undefined) setError(undefined);
            }}
            placeholder="What do you think happens next, and why?"
            placeholderTextColor={color.text3}
            selectionColor={color.primary}
            multiline
            autoFocus
            maxLength={POST_MAX_CHARS}
            editable={!create.isPending}
            textAlignVertical="top"
            accessibilityLabel="Your thesis"
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={[TYPE.body, styles.input, { color: color.ink }]}
          />
        </View>
        <View style={styles.under}>
          <View style={styles.public}>
            <Text style={[TYPE.rowDetail, { color: color.text3 }]}>Public on</Text>
            <ModeBadge />
          </View>
          <Text
            accessibilityLabel={`${text.length} of ${POST_MAX_CHARS} characters`}
            accessibilityLiveRegion="polite"
            style={[TYPE.moneyMeta, { color: left <= NEAR_LIMIT ? color.warn : color.text3 }]}
          >
            {text.length}/{POST_MAX_CHARS}
          </Text>
        </View>
      </View>
      {markets.length > 0 ? (
        <View style={styles.block}>
          <Text style={[TYPE.rowDetail, { color: color.text3 }]}>About a market (optional)</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            accessibilityRole="radiogroup"
            accessibilityLabel="Market"
            contentContainerStyle={styles.picks}
          >
            {markets.map((m) => (
              <MarketPick
                key={m.id}
                marketId={m.id}
                symbol={m.symbol}
                name={m.name}
                selected={market === m.id}
                onPress={() => setMarket((current) => (current === m.id ? undefined : m.id))}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}
      {error === undefined ? null : (
        <View style={styles.block}>
          <Text accessibilityRole="alert" style={[TYPE.rowDetail, styles.center, { color: color.down }]}>
            {socialErrorCopy(error, "Couldn’t post your thesis. Check your connection and try again.")}
          </Text>
          {isNotListed(error) ? (
            <Button
              label="Open profile settings"
              variant="ghost"
              size="sm"
              onPress={() => close(() => router.navigate(ROUTES.profileSettings as Href))}
            />
          ) : null}
        </View>
      )}
      <Button label="Post" loading={create.isPending} disabled={body.length === 0} onPress={publish} />
    </>
  );
}

/** One market to attach: its real mark, ticker and oracle price. A second tap takes it off again. */
function MarketPick({
  marketId,
  symbol,
  name,
  selected,
  onPress,
}: {
  marketId: number;
  symbol: string;
  name: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { color } = useTheme();
  const fill = useGroupFill();
  const network = useNetwork();
  const reading = useMarket(marketId);
  const price = reading.status === "fresh" || reading.status === "stale" ? reading.value.pv.price18 : undefined;
  return (
    <Pressable
      onPress={() => {
        fire("tick");
        onPress();
      }}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={name}
      style={({ pressed }) => [
        styles.pick,
        { backgroundColor: pressed ? color.rowPressed : fill, borderColor: selected ? color.ring : color.transparent },
      ]}
    >
      <EntityMark id={ids.engineMarket(network.chainId, marketId)} size={SIZE.markCell} decorative ground={fill} />
      <View>
        <Text style={[TYPE.chipCategory, { color: color.ink }]}>{symbol}</Text>
        {price === undefined ? null : (
          <Text style={[TYPE.moneyMeta, { color: color.text3 }]}>${price18(price, priceDecimalsOf(marketId))}</Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  block: { gap: SPACE.sm },
  /** The edge is the input's focus boundary and, on a pick, the mark of a choice (as the follow rows of setup). */
  field: {
    height: FIELD_HEIGHT,
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.md,
    borderRadius: SHEET_SHAPE.rowRadius,
    borderWidth: HAIRLINE_PX,
  },
  /** iOS gives a multiline input its own top inset; the field's padding is the only one wanted. */
  input: { flex: 1, paddingTop: 0, paddingBottom: 0 },
  under: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  public: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  picks: { gap: SPACE.sm },
  pick: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    minHeight: SIZE.touch,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.xs,
    borderRadius: BUTTON.radius.md,
    borderWidth: HAIRLINE_PX,
  },
  center: { textAlign: "center" },
});
