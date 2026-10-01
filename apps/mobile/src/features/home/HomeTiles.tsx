import type { Reading } from "@senryo/core";
import { ids } from "@senryo/identity";
import { useAccountRisk, useLpVault } from "@senryo/query";
import { type Href, router } from "expo-router";
import type { ReactNode } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { EntityMark } from "~/components/identity/EntityMark";
import { useGroupFill } from "~/components/kit/Surface";
import { Skeleton } from "~/components/kit/states";
import { usePressScale } from "~/components/kit/usePressScale";
import { fire } from "~/feedback/fire";
import { useAccount } from "~/lib/account/provider";
import { ROUTES } from "~/lib/constants/routes";
import { usd } from "~/lib/money";
import { SHEET_SHAPE, SIZE, SPACE, TYPE, useTheme } from "~/theme";

/** The Kinpaku art (brand/kinpaku-card.svg, rendered): the same raster the Card tab's face uses. */
const CARD_ART = require("../../../assets/images/kinpaku-card.png");
/** The tile's art row: the card thumbnail at the card's own proportions, and the seal beside it at the same height. */
const ART_HEIGHT = 40;
const ART_WIDTH = ART_HEIGHT * SIZE.cardAspect;
/** The amount line while its read is in flight. */
const VALUE_SKELETON_WIDTH = "70%";

/**
 * Home's two shortcuts (C20, direction §7 "Kinpaku / LP vault"): filled tiles side by side, one step lighter than the
 * page, no border. Kinpaku shows the card art and what the card can draw on right now — the account's own Free to
 * spend, never a card figure the service does not have yet — and opens the Card tab. The LP vault shows what your
 * shares are worth at the conservative price, or what the vault is for when you hold none, and opens the pool.
 */
export function HomeTiles() {
  const address = useAccount().hint?.address;
  const risk = useAccountRisk(address, "finalized");
  const vault = useLpVault(address);
  const shares = vault.status === "fresh" || vault.status === "stale" ? vault.value.sharesValue : undefined;
  return (
    <View style={styles.row}>
      <Tile
        name="Kinpaku"
        href={ROUTES.card}
        tab
        art={<Image source={CARD_ART} style={styles.card} resizeMode="contain" accessibilityIgnoresInvertColors />}
      >
        <Amount reading={risk} pick={(s) => s.freeToSpend} caption="Free to spend" />
      </Tile>
      <Tile
        name="LP vault"
        href={ROUTES.lp}
        art={<EntityMark id={ids.brand("senryo")} size={ART_HEIGHT} variant="symbol" decorative />}
      >
        {shares !== undefined && shares === 0n ? (
          <Pitch>Earn from the pool’s fees</Pitch>
        ) : (
          <Amount reading={vault} pick={(v) => v.sharesValue} caption="Your shares" />
        )}
      </Tile>
    </View>
  );
}

function Tile({
  name,
  href,
  tab = false,
  art,
  children,
}: {
  name: string;
  href: Href;
  /** A tab root is switched to, not pushed. */
  tab?: boolean;
  art: ReactNode;
  children: ReactNode;
}) {
  const { color } = useTheme();
  const fill = useGroupFill();
  const press = usePressScale();
  return (
    <Animated.View style={[styles.flex, press.style]}>
      <Pressable
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        onPress={() => {
          fire("tick");
          if (tab) router.navigate(href);
          else router.push(href);
        }}
        accessibilityRole="button"
        accessibilityHint={`Opens ${name}`}
        style={({ pressed }) => [styles.tile, { backgroundColor: pressed ? color.rowPressed : fill }]}
      >
        <View style={styles.art}>{art}</View>
        <View style={styles.text}>
          <Text style={[TYPE.rowDetail, { color: color.text3 }]} numberOfLines={1}>
            {name}
          </Text>
          {children}
        </View>
      </Pressable>
    </Animated.View>
  );
}

/** A real amount over its caption; a skeleton while unknown, a plain word when the read failed — never a zero. */
function Amount<T>({ reading, pick, caption }: { reading: Reading<T>; pick: (value: T) => bigint; caption: string }) {
  const { color } = useTheme();
  if (reading.status === "unknown") return <Skeleton width={VALUE_SKELETON_WIDTH} height={SIZE.skeletonLine} />;
  if (reading.status === "failed") return <Pitch>Unavailable right now</Pitch>;
  return (
    <>
      <Text style={[TYPE.rowPrice, { color: color.ink }]} numberOfLines={1} adjustsFontSizeToFit>
        {usd(pick(reading.value))}
      </Text>
      <Text style={[TYPE.meta, { color: color.text3 }]} numberOfLines={1}>
        {caption}
      </Text>
    </>
  );
}

function Pitch({ children }: { children: string }) {
  const { color } = useTheme();
  return (
    <Text style={[TYPE.row, { color: color.ink }]} numberOfLines={2}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: SPACE.md },
  flex: { flex: 1 },
  tile: { flex: 1, padding: SPACE.lg, gap: SPACE.lg, borderRadius: SHEET_SHAPE.rowRadius },
  art: { height: ART_HEIGHT, justifyContent: "center" },
  card: { width: ART_WIDTH, height: ART_HEIGHT },
  text: { gap: SPACE.xxs },
});
