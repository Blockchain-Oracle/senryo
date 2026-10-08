import { LiveProvider } from "@senryo/live/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { DeferredLinkHost } from "~/components/shell/DeferredLinkHost";
import { FeedbackHost } from "~/components/shell/FeedbackHost";
import { LiveHost } from "~/components/shell/LiveHost";
import { OfflineBanner } from "~/components/shell/OfflineBanner";
import { ResultHost } from "~/components/shell/ResultHost";
import { ToastHost } from "~/components/toast/ToastHost";
import { PrivacyPlate } from "~/features/auth/PrivacyPlate";
import { TermsHost } from "~/features/legal/TermsHost";
import { AccountProvider } from "~/lib/account/provider";
import { QUERY_RETRIES, QUERY_STALE_MS } from "~/lib/constants/time";
import { appLive } from "~/lib/live";
import { PushHost } from "~/lib/notifications/PushHost";
import { QueryEnvHost } from "~/lib/query-env";
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

const SHEETS = ["step-up", "session", "account-required", "network", "receive", "terms", "withdraw"];

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
              <QueryEnvHost>
                <LiveProvider live={appLive()}>
                  <RootStack />
                </LiveProvider>
              </QueryEnvHost>
            </AccountProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * The stack over the tab shell (S1b.7: `(tabs)` is the dock on headless tabs; S5 sets the prediction places), plus the headless
 * hosts mounted once (ported pattern): feedback (sound pool), toasts and the offline banner, the privacy plate (S6),
 * TxRecovery (S8.24) and pushes (S1b.13). Root pages (account, notifications) push over the shell; sheets are
 * transparent modals.
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
          // The back button shows no text, but VoiceOver reads its title: never a route name like "(tabs)".
          headerBackTitle: "Back",
          contentStyle: { backgroundColor: color.ground },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="welcome" options={{ headerShown: false, animation: "fade" }} />
        <Stack.Screen name="setup" options={{ headerShown: false, gestureEnabled: false }} />
        {SHEETS.map((route) => (
          <Stack.Screen key={route} name={`(sheets)/${route}`} options={sheet} />
        ))}
      </Stack>
      <FeedbackHost />
      <LiveHost />
      <ResultHost />
      <DeferredLinkHost />
      <OfflineBanner />
      <ToastHost />
      <PushHost />
      <TermsHost />
      <PrivacyPlate />
    </>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
