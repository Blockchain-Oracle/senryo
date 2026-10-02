import { WEB_ORIGIN } from "@senryo/config";
import { type Href, router } from "expo-router";
import { Platform, Share, StyleSheet, View } from "react-native";
import { BellPlus, History, Share as ShareIcon, Star } from "~/components/kit/symbols";
import { UTILITY_ICON, UtilityButton } from "~/components/shell/Utilities";
import { alertRoute, marketRoute } from "~/lib/constants/routes";
import { SIZE, SPACE, useTheme } from "~/theme";
import { useWatchlist } from "./useWatchlist";

/** The public link to a market: the same path the app opens (`senryo.xyz/markets/XAU`). */
export const marketShareUrl = (symbol: string) => `${WEB_ORIGIN}${marketRoute(symbol)}`;

/**
 * Market detail's glass circles (Fomo F32; flow book C2 step 1): Alert · Watch · Share · History. The alert opens this
 * market's alert editor, the star adds it to the watchlist (filled when on), share hands its link to the system sheet,
 * and history opens your activity in this market. A read-only instrument passes no `alertFor` / `historyFor` (the
 * keeper has no price source for it yet, and it has no trades of yours), and keeps Watch and Share.
 */
export function MarketActions({
  name,
  watchKey,
  shareUrl,
  alertFor,
  historyFor,
}: {
  name: string;
  /** What the watchlist stores: an engine symbol ("XAU") or a read-only instrument id ("perpl:BTC"). */
  watchKey: string;
  shareUrl: string;
  alertFor?: string;
  historyFor?: string;
}) {
  const { color } = useTheme();
  const watchlist = useWatchlist();
  const starred = watchlist.has(watchKey);
  return (
    <View style={styles.row}>
      {alertFor ? (
        <UtilityButton label={`Set a price alert for ${name}`} onPress={() => router.push(alertRoute(alertFor))}>
          <BellPlus size={UTILITY_ICON} strokeWidth={SIZE.iconStroke} color={color.ink} />
        </UtilityButton>
      ) : null}
      <UtilityButton
        label={starred ? `Remove ${name} from your watchlist` : `Add ${name} to your watchlist`}
        onPress={() => watchlist.toggle(watchKey)}
      >
        <Star
          size={UTILITY_ICON}
          strokeWidth={SIZE.iconStroke}
          color={color.ink}
          fill={starred ? color.ink : color.transparent}
        />
      </UtilityButton>
      <UtilityButton
        label={`Share ${name}`}
        // iOS shares a link as a link (preview, "Copy"); Android's share sheet takes it as the message.
        onPress={() => void Share.share(Platform.OS === "ios" ? { url: shareUrl } : { message: shareUrl })}
      >
        <ShareIcon size={UTILITY_ICON} strokeWidth={SIZE.iconStroke} color={color.ink} />
      </UtilityButton>
      {historyFor ? (
        <UtilityButton
          label={`Your ${name} history`}
          onPress={() => router.push(`/activity?market=${historyFor}` as Href)}
        >
          <History size={UTILITY_ICON} strokeWidth={SIZE.iconStroke} color={color.ink} />
        </UtilityButton>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: SPACE.xs },
});
