/**
 * Compose a thesis (F4 step 5): the text with a count against the api's 280, "About a market" chips over every market
 * this network lists — our engine's and Perpl's — by their real marks, and "Attach my position" chips over the
 * account's own open positions (the api checks the position is theirs). The mode it will be public on sits under the
 * field. Post answers in place: pending, or the api's refusal in one line (`NOT_LISTED` adds the way to Settings).
 * Success closes the sheet; the new thesis is the feed's first row.
 */
import { POST_MAX_CHARS } from "@senryo/api-client";
import { engineMarketsOn, PERPL_MARKETS } from "@senryo/config";
import { ids } from "@senryo/identity";
import { useAttachablePositions, type useCreatePost } from "@senryo/query";
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
import { useNetwork } from "~/lib/network";
import { BUTTON, HAIRLINE_PX, SHEET_SHAPE, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { engineMarketId, isNotListed, marketOfId, SIDE_WORD, socialErrorCopy } from "./format";
import { ModeBadge } from "./Quiet";
import { useSocialAccount } from "./useSocialAccount";

/** The field shows four lines of body text before it scrolls: a thesis is short, and the sheet stays compact. */
const FIELD_LINES = 4;
const FIELD_HEIGHT = (TYPE.body.lineHeight ?? 0) * FIELD_LINES + 2 * SPACE.md;
/** The count turns to the warning ink when this few characters are left. */
const NEAR_LIMIT = 20;

interface Pick {
  key: string;
  marketId: string;
  mark: string | undefined;
  label: string;
  detail?: string;
  detailTone?: "up" | "down";
}

/** Every market this network lists: our engine's first, then Perpl's (`perpl-<id>`). */
function useMarketPicks(): Pick[] {
  const network = useNetwork();
  const engine = engineMarketsOn(network.chainId).map((m) => ({
    key: engineMarketId(m.id),
    marketId: engineMarketId(m.id),
    mark: ids.engineMarket(network.chainId, m.id),
    label: m.symbol,
  }));
  const perpl = Object.entries(PERPL_MARKETS[network.chainId] ?? {}).map(([symbol, perplId]) => ({
    key: `perpl-${perplId}`,
    marketId: `perpl-${perplId}`,
    mark: ids.perplMarket(network.chainId, perplId),
    label: symbol,
  }));
  return [...engine, ...perpl];
}

export function ComposeThesis({ create }: { create: ReturnType<typeof useCreatePost> }) {
  const { color } = useTheme();
  const fill = useGroupFill();
  const network = useNetwork();
  const close = useSheetClose();
  const { address } = useSocialAccount();
  const [text, setText] = useState("");
  const [market, setMarket] = useState<string>();
  const [position, setPosition] = useState<{ id: string; marketId: string }>();
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState<unknown>();
  const markets = useMarketPicks();
  const owned = useAttachablePositions(address);
  const positions: Pick[] =
    owned.status === "fresh" || owned.status === "stale"
      ? owned.value.map((p) => {
          const ref = marketOfId(network.chainId, p.market.id, p.market.symbol);
          return {
            key: p.id,
            marketId: p.market.id,
            mark: ref?.mark,
            label: p.market.symbol,
            detail: SIDE_WORD[p.side],
            detailTone: p.side === "LONG" ? "up" : "down",
          };
        })
      : [];
  const body = text.trim();
  const left = POST_MAX_CHARS - text.length;

  const publish = () => {
    setError(undefined);
    const about = position
      ? { marketId: position.marketId, positionId: position.id }
      : market
        ? { marketId: market }
        : {};
    create.mutate(
      { kind: "thesis", text: body, ...about },
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
      <SheetHeading title="New thesis" />
      <View style={styles.block}>
        <View style={[styles.field, { backgroundColor: fill, borderColor: focused ? color.ring : color.transparent }]}>
          <TextInput
            value={text}
            onChangeText={(next) => {
              setText(next);
              if (error !== undefined) setError(undefined);
            }}
            placeholder="What happens next, and why?"
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
      {positions.length > 0 ? (
        <PickRow
          title="Attach my position"
          picks={positions}
          selected={position?.id}
          onPick={(pick) => {
            setPosition((current) =>
              current?.id === pick.key ? undefined : { id: pick.key, marketId: pick.marketId },
            );
            setMarket(undefined);
          }}
        />
      ) : null}
      {markets.length > 0 && !position ? (
        <PickRow
          title="About a market"
          picks={markets}
          selected={market}
          onPick={(pick) => setMarket((current) => (current === pick.marketId ? undefined : pick.marketId))}
        />
      ) : null}
      {error === undefined ? null : (
        <View style={styles.refusal}>
          <Text accessibilityRole="alert" style={[TYPE.rowDetail, styles.grow, { color: color.down }]}>
            {socialErrorCopy(error, "Couldn’t post · try again")}
          </Text>
          {isNotListed(error) ? (
            <Text
              accessibilityRole="link"
              onPress={() => close(() => router.navigate(ROUTES.accountSettings as Href))}
              style={[TYPE.rowDetail, { color: color.link }]}
            >
              Settings
            </Text>
          ) : null}
        </View>
      )}
      <Button label="Post" loading={create.isPending} disabled={body.length === 0} onPress={publish} />
    </>
  );
}

function PickRow({
  title,
  picks,
  selected,
  onPick,
}: {
  title: string;
  picks: Pick[];
  selected: string | undefined;
  onPick: (pick: Pick) => void;
}) {
  const { color } = useTheme();
  return (
    <View style={styles.block}>
      <Text style={[TYPE.rowDetail, { color: color.text3 }]}>{title}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        accessibilityRole="radiogroup"
        accessibilityLabel={title}
        contentContainerStyle={styles.picks}
      >
        {picks.map((pick) => (
          <PickChip
            key={pick.key}
            pick={pick}
            selected={selected === pick.key || selected === pick.marketId}
            onPress={() => onPick(pick)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

/** One market or position to attach: its real mark and ticker (and side). A second tap takes it off again. */
function PickChip({ pick, selected, onPress }: { pick: Pick; selected: boolean; onPress: () => void }) {
  const { color } = useTheme();
  const fill = useGroupFill();
  return (
    <Pressable
      onPress={() => {
        fire("tick");
        onPress();
      }}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={pick.detail ? `${pick.label} ${pick.detail}` : pick.label}
      style={({ pressed }) => [
        styles.pick,
        { backgroundColor: pressed ? color.rowPressed : fill, borderColor: selected ? color.ring : color.transparent },
      ]}
    >
      <EntityMark id={pick.mark} size={SIZE.markCell} label={pick.label} decorative ground={fill} />
      <Text style={[TYPE.chipCategory, { color: color.ink }]}>{pick.label}</Text>
      {pick.detail ? (
        <Text style={[TYPE.chipCategory, { color: pick.detailTone === "down" ? color.down : color.up }]}>
          {pick.detail}
        </Text>
      ) : null}
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
    borderRadius: BUTTON.radius.md,
    borderWidth: HAIRLINE_PX,
  },
  refusal: { flexDirection: "row", alignItems: "center", gap: SPACE.md },
  grow: { flex: 1 },
});
