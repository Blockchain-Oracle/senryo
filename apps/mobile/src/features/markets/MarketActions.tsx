import { WEB_ORIGIN } from "@senryo/config";
import { type Href, router } from "expo-router";
import { BellPlus, History, Share as ShareIcon, Star } from "lucide-react-native";
import { Platform, Share, StyleSheet, View } from "react-native";
import { UTILITY_ICON, UtilityButton } from "~/components/shell/Utilities";
import { alertRoute, marketRoute } from "~/lib/constants/routes";
import { SIZE, SPACE, useTheme } from "~/theme";
import { useWatchlist } from "./useWatchlist";

/** The public link to a market: the same path the app opens (`senryo.xyz/markets/XAU`). */
export const marketShareUrl = (symbol: string) => `${WEB_ORIGIN}${marketRoute(symbol)}`;

/**
 * Market detail's utilities (Fomo F32: history / favourite / share, plus our price alert): history opens your activity
 * in this market (FT097), the alert opens this market's alert editor, the star adds it to the watchlist (filled when
 * on, as the dock fills its active icon), and share hands the market's link to the system share sheet.
 */
export function MarketActions({ symbol, name }: { symbol: string; name: string }) {
  const { color } = useTheme();
  const watchlist = useWatchlist();
  const starred = watchlist.has(symbol);
  const url = marketShareUrl(symbol);
  return (
    <View style={styles.row}>
      <UtilityButton label={`Your ${name} history`} onPress={() => router.push(`/activity?market=${symbol}` as Href)}>
        <History size={UTILITY_ICON} strokeWidth={SIZE.iconStroke} color={color.ink} />
      </UtilityButton>
      <UtilityButton label={`Set a price alert for ${name}`} onPress={() => router.push(alertRoute(symbol))}>
        <BellPlus size={UTILITY_ICON} strokeWidth={SIZE.iconStroke} color={color.ink} />
      </UtilityButton>
      <UtilityButton
        label={starred ? `Remove ${name} from your watchlist` : `Add ${name} to your watchlist`}
        onPress={() => watchlist.toggle(symbol)}
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
        onPress={() => void Share.share(Platform.OS === "ios" ? { url } : { message: url })}
      >
        <ShareIcon size={UTILITY_ICON} strokeWidth={SIZE.iconStroke} color={color.ink} />
      </UtilityButton>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: SPACE.xs },
});
