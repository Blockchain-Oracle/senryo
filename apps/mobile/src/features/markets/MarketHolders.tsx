/**
 * Market detail's Holders tab (FT098; Fomo F32/F33 adapted): the open positions in this market of people who share
 * their trades on this network, largest first — portrait, name and side; the average entry under it; the leveraged
 * size (position × the accepted price) and its unrealised P&L at the right. Friends narrows it to people you follow.
 * Senryo is cross-margin, so there is no per-position leverage to show — the side alone, never an invented "4×".
 * Only what the api returned is listed; an empty market is one quiet line; failures offer Retry.
 */
import type { MarketHolder } from "@senryo/api-client";
import { useMarketHolders } from "@senryo/query";
import { router } from "expo-router";
import { type ReactNode, useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { ReadingView, Skeleton } from "~/components/kit/states";
import { TraderAvatar, traderName } from "~/features/social/TraderAvatar";
import { useSessionGate } from "~/features/social/useSocialAccount";
import { fire } from "~/feedback/fire";
import { watchRoute } from "~/lib/constants/routes";
import { price18, signedUsd, usd } from "~/lib/money";
import { BUTTON, CONTROL_FONT_SCALE, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { SideBadge } from "./LeverageBadge";
import { QuietLine } from "./QuietLine";

/** Rows the loading state draws. */
const SKELETON_ROWS = [0, 1, 2] as const;

export function MarketHolders({ marketId, name, decimals }: { marketId: number; name: string; decimals: number }) {
  const { color } = useTheme();
  const gate = useSessionGate();
  const [friends, setFriends] = useState(false);
  // Friends is the session's own list, so it is asked for only once the session is up; everyone is public.
  const asking = friends && gate.status === "ready";
  const holders = useMarketHolders(marketId, asking, !friends || asking);
  const canFilter = gate.status !== "guest";
  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
        {canFilter ? (
          <View style={styles.friends}>
            <Switch
              value={friends}
              onValueChange={(on) => {
                fire("tick");
                setFriends(on);
                if (on && gate.status === "locked") gate.open();
              }}
              trackColor={{ true: color.primary, false: color.muted }}
              thumbColor={color.foreground}
              accessibilityLabel="Only people you follow"
            />
            <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.row, { color: color.text2 }]}>
              Following
            </Text>
          </View>
        ) : (
          <View />
        )}
        <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowDetail, { color: color.text3 }]}>
          Leveraged size
        </Text>
      </View>
      {friends && !asking ? (
        <FriendsGate status={gate.status} onOpen={gate.open} />
      ) : (
        <ReadingView reading={holders.reading} loading="list" loadingLabel="Loading holders" retry={holders.retry}>
          {(data) =>
            data.holders.length === 0 ? (
              <QuietLine>
                {friends ? `Nobody you follow holds ${name} right now` : `Nobody shares a position in ${name} yet`}
              </QuietLine>
            ) : (
              <View>
                {data.holders.map((h) => (
                  <HolderRow key={h.address} holder={h} decimals={decimals} />
                ))}
                {data.more > 0 ? (
                  <Text style={[TYPE.rowDetail, styles.more, { color: color.text3 }]}>
                    {data.more} more {data.more === 1 ? "person shares" : "people share"} a smaller position
                  </Text>
                ) : null}
              </View>
            )
          }
        </ReadingView>
      )}
    </View>
  );
}

/** Friends before the session is up: said in the tab's own place, never a prompt on arrival. */
function FriendsGate({ status, onOpen }: { status: string; onOpen: () => void }) {
  if (status === "pending") {
    return (
      <View accessibilityRole="progressbar" accessibilityLabel="Checking who you follow" style={styles.skeleton}>
        {SKELETON_ROWS.map((row) => (
          <Skeleton key={row} height={SIZE.skeletonRow} />
        ))}
      </View>
    );
  }
  const line: ReactNode =
    status === "failed"
      ? "Couldn’t confirm it’s you, so the people you follow stayed hidden"
      : "Unlock to see what the people you follow hold";
  return (
    <View style={styles.gate}>
      <QuietLine>{line}</QuietLine>
      <Button label={status === "failed" ? "Try again" : "Unlock"} variant="secondary" size="sm" onPress={onOpen} />
    </View>
  );
}

function HolderRow({ holder, decimals }: { holder: MarketHolder; decimals: number }) {
  const { color } = useTheme();
  const notional = holder.notionalUsd6;
  const upnl = holder.upnlUsd6;
  const who = traderName(holder);
  const entry = `$${price18(holder.entry18, decimals)}`;
  return (
    <Pressable
      onPress={() => {
        fire("tick");
        router.push(watchRoute(holder.address));
      }}
      accessibilityRole="button"
      accessibilityLabel={`${who}, ${holder.isLong ? "long" : "short"}, average entry ${entry}, leveraged size ${usd(notional)}, ${upnl >= 0n ? "up" : "down"} ${signedUsd(upnl)}`}
      accessibilityHint="Opens the trader"
      style={({ pressed }) => [styles.row, pressed ? { backgroundColor: color.card } : null]}
    >
      <TraderAvatar trader={holder} size={SIZE.avatarMd} />
      <View style={styles.text}>
        <View style={styles.headline}>
          <Text numberOfLines={1} style={[TYPE.rowStrong, styles.shrink, { color: color.ink }]}>
            {who}
          </Text>
          <SideBadge side={holder.isLong ? "LONG" : "SHORT"} />
        </View>
        <Text numberOfLines={1} style={[TYPE.rowDetail, { color: color.text3 }]}>
          Avg. entry: {entry}
        </Text>
      </View>
      <View style={styles.figures}>
        <Text style={[TYPE.rowAmount, { color: color.ink }]}>{usd(notional)}</Text>
        <Text style={[TYPE.rowChange, { color: upnl >= 0n ? color.up : color.down }]}>{signedUsd(upnl)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: SPACE.sm },
  bar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: SIZE.touch },
  friends: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  // The feed's row geometry, so the two tabs read as one list style.
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    minHeight: SIZE.rowMinHeight,
    paddingVertical: SPACE.md,
    paddingHorizontal: SPACE.sm,
    marginHorizontal: -SPACE.sm,
    borderRadius: BUTTON.radius.md,
  },
  text: { flex: 1, gap: SPACE.xxs },
  headline: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  shrink: { flexShrink: 1 },
  figures: { alignItems: "flex-end", gap: SPACE.xxs },
  more: { paddingTop: SPACE.sm },
  skeleton: { gap: SPACE.md, paddingVertical: SPACE.md },
  gate: { alignItems: "center", gap: SPACE.sm },
});
