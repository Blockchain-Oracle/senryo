import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { FeedbackHost } from "~/components/shell/FeedbackHost";
import { OfflineBanner } from "~/components/shell/OfflineBanner";
import { ToastHost } from "~/components/toast/ToastHost";
import { PrivacyPlate } from "~/features/auth/PrivacyPlate";
import { AccountProvider } from "~/lib/account/provider";
import { QUERY_RETRIES, QUERY_STALE_MS } from "~/lib/constants/time";
import { MarketDataProvider } from "~/lib/market-data";
import { FONT, ThemeProvider, useTheme } from "~/theme";
import { useAppFonts } from "~/theme/fonts";

void SplashScreen.preventAutoHideAsync();

/** Sheets are transparent modals that draw their own scrim and panel (the ported one-sheet pattern). */
const sheet = {
  presentation: "transparentModal",
  animation: "none",
  headerShown: false,
  contentStyle: { backgroundColor: "transparent" },
} as const;

const SHEETS = ["add-money", "step-up", "risk-explainer", "receipt", "session", "card-reveal", "account-required"];

export default function RootLayout() {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: QUERY_STALE_MS, retry: QUERY_RETRIES } } }),
  );
  const fontsReady = useAppFonts();
  useEffect(() => {
    if (fontsReady) void SplashScreen.hideAsync();
  }, [fontsReady]);
  if (!fontsReady) return null;
  return (
    <GestureHandlerRootView style={styles.fill}>
      <SafeAreaProvider>
        <QueryClientProvider client={client}>
          <ThemeProvider>
            <AccountProvider>
              <MarketDataProvider>
                <RootStack />
              </MarketDataProvider>
            </AccountProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * The stack over the tabs, plus the headless hosts mounted once (ported pattern): feedback (sound pool), toasts and
 * the offline banner, and the privacy plate (S6). Later: TxRecovery, AlertsHost.
 */
function RootStack() {
  const { name, color } = useTheme();
  return (
    <>
      <StatusBar style={name === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: color.ground },
          headerTintColor: color.ink,
          headerTitleStyle: { fontFamily: FONT.sansStrong },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: "minimal",
          contentStyle: { backgroundColor: color.ground },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="welcome" options={{ headerShown: false, animation: "fade" }} />
        {SHEETS.map((route) => (
          <Stack.Screen key={route} name={`(sheets)/${route}`} options={sheet} />
        ))}
      </Stack>
      <FeedbackHost />
      <OfflineBanner />
      <ToastHost />
      <PrivacyPlate />
    </>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
