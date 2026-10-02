import { useEffect, useState } from "react";
import { AppState, StyleSheet, Text, TurboModuleRegistry, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { Info, Lock } from "~/components/kit/symbols";
import { SheetRoute } from "~/components/sheet/SheetRoute";
import { CardFace } from "~/features/card/CardFace";
import { EMBED_TTL_SEC, useCardEmbed } from "~/features/card/useCardService";
import { useCardSummary } from "~/features/card/useCardSummary";
import { useAccount } from "~/lib/account/provider";
import { useCaptureProtection } from "~/lib/capture-protection";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";

const MS_PER_SECOND = 1000;
/** The issuer page's height inside the sheet (card number, expiry and CVV fit at the default embed CSS). */
const EMBED_HEIGHT = 220;

/** react-native-webview ships in runtime 0.2.0; an older dev client keeps the locked line instead of crashing. */
function webViewAvailable(): boolean {
  try {
    return TurboModuleRegistry.get("RNCWebViewModule") !== null;
  } catch {
    return false;
  }
}

/**
 * Card details (E5): the full number only ever shows inside the issuer's own page, in a capture-protected view, after
 * a passkey step-up. It hides itself after the link's lifetime, when the app leaves the foreground, or on Hide.
 * Nothing about the number passes through Senryo's code.
 */
export default function CardRevealSheet() {
  const { color } = useTheme();
  const account = useAccount();
  const card = useCardSummary().data?.cards.find((c) => c.state !== "CLOSED");
  const embed = useCardEmbed();
  const [url, setUrl] = useState<string | undefined>();
  const protection = useCaptureProtection();
  const supported = webViewAvailable();

  useEffect(() => {
    if (!url) return;
    const timer = setTimeout(() => setUrl(undefined), EMBED_TTL_SEC * MS_PER_SECOND);
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") setUrl(undefined);
    });
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, [url]);

  const reveal = async () => {
    if (!card?.cardToken) return;
    // The passkey ceremony is the gate; the link is fetched only after it succeeds.
    const result = await account.stepUp(async () => embed.mutateAsync(card.cardToken)).catch(() => undefined);
    if (result?.url) setUrl(result.url);
  };

  const WebView = supported && url && protection.ready ? require("react-native-webview").WebView : undefined;

  return (
    <SheetRoute title="Card details">
      <View style={styles.card}>
        <CardFace last4={card?.last4 ?? undefined} />
      </View>
      {WebView ? (
        <View style={styles.embed}>
          <WebView source={{ uri: url }} style={styles.web} incognito javaScriptEnabled={false} />
          <Button label="Hide" variant="secondary" onPress={() => setUrl(undefined)} />
        </View>
      ) : supported && card?.cardToken ? (
        <Button
          label={embed.isPending ? "Opening…" : "Show details"}
          disabled={embed.isPending}
          onPress={() => void reveal()}
        />
      ) : (
        <View style={styles.row}>
          <Lock size={SIZE.iconSm} color={color.text2} />
          <Text style={[TYPE.rowTitle, { color: color.text2 }]}>
            {card?.cardToken ? "Needs the new app build" : "No card yet"}
          </Text>
        </View>
      )}
      <View style={styles.row}>
        <Info size={SIZE.iconSm} color={color.text3} />
        <Text style={[TYPE.rowDetail, styles.shrink, { color: color.text3 }]}>
          Passkey first · hides after {EMBED_TTL_SEC}s
        </Text>
      </View>
    </SheetRoute>
  );
}

const styles = StyleSheet.create({
  card: { paddingHorizontal: SPACE.xl },
  embed: { gap: SPACE.sm },
  web: { height: EMBED_HEIGHT, backgroundColor: "transparent" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACE.xs },
  shrink: { flexShrink: 1 },
});
